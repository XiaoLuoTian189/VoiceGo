const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const session = require('express-session');
const cors = require('cors');
const AuthService = require('./auth-service');

const app = express();
const server = http.createServer(app);
const authService = new AuthService();

// 中间件
app.use(cors());
app.use(express.json({ 
    limit: '10mb',
    type: 'application/json',
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf);
        } catch (e) {
            console.error('JSON解析错误:', e.message);
            console.error('请求体:', buf.toString());
            throw new Error('Invalid JSON');
        }
    }
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
    type: 'application/x-www-form-urlencoded'
}));
app.use(express.static(path.join(__dirname)));

// 错误处理中间件
app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        console.error('JSON解析错误:', error.message);
        return res.status(400).json({ 
            success: false, 
            message: '请求数据格式错误' 
        });
    }
    next(error);
});

// 会话配置
app.use(session({
    secret: process.env.SESSION_SECRET || 'voicego_session_secret_2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // 在生产环境中应该设置为true（HTTPS）
        maxAge: 24 * 60 * 60 * 1000 // 24小时
    }
}));

const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 认证API路由
app.post('/api/register', async (req, res) => {
    const result = await authService.register(req.body);
    res.json(result);
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const result = await authService.login(username, password);
    
    if (result.success) {
        req.session.userId = result.user.id;
        req.session.username = result.user.username;
        req.session.sessionId = result.sessionId;
    }
    
    res.json(result);
});

app.post('/api/logout', async (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        // Token认证登出
        const token = authHeader.substring(7);
        try {
            // 验证token并获取用户信息
            const result = await authService.verifyToken(token);
            if (result.success) {
                // 这里可以添加token黑名单逻辑
                res.json({ success: true, message: '登出成功' });
            } else {
                res.json({ success: false, message: 'Token无效' });
            }
        } catch (error) {
            res.json({ success: false, message: '登出失败' });
        }
    } else {
        // 会话认证登出（向后兼容）
        const sessionId = req.session.sessionId;
        if (sessionId) {
            await authService.logout(sessionId);
        }
        
        req.session.destroy((err) => {
            if (err) {
                res.json({ success: false, message: '登出失败' });
            } else {
                res.json({ success: true, message: '登出成功' });
            }
        });
    }
});

app.get('/api/user', async (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        // Token认证
        const token = authHeader.substring(7);
        const result = await authService.verifyToken(token);
        res.json(result);
    } else {
        // 会话认证（向后兼容）
        const sessionId = req.session.sessionId;
        if (sessionId) {
            const result = await authService.verifySession(sessionId);
            res.json(result);
        } else {
            res.json({ success: false, message: '未登录' });
        }
    }
});

// Socket.IO认证中间件
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    console.log('Socket认证请求:', { 
        token: !!token,
        tokenLength: token ? token.length : 0
    });

    if (token) {
        try {
            console.log('尝试Token认证...');
            const result = await authService.verifyToken(token);
            console.log('Token认证结果:', result);
            
            if (result.success) {
                socket.user = result.user;
                console.log('Token认证成功:', socket.user.username);
                return next();
            } else {
                console.log('Token认证失败:', result.message);
            }
        } catch (error) {
            console.log('Token认证异常:', error.message);
        }
    }

    console.log('Socket认证失败，拒绝连接');
    next(new Error('Authentication required'));
});

// 房间管理
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('用户连接:', socket.id, '用户名:', socket.user?.username);

    socket.on('joinRoom', (data) => {
        const { roomCode } = data;
        
        console.log(`收到加入房间请求: ${roomCode}, 用户: ${socket.user.username}`);
        
        if (!roomCode || roomCode.length !== 4) {
            socket.emit('error', { message: '房间号必须是4位数字' });
            return;
        }

        // 检查房间是否存在
        if (!rooms.has(roomCode)) {
            rooms.set(roomCode, new Map());
        }

        const room = rooms.get(roomCode);
        
        // 检查房间是否已满（最多2人）
        if (room.size >= 2) {
            socket.emit('error', { message: '房间已满' });
            return;
        }

        // 加入房间
        socket.join(roomCode);
        room.set(socket.id, socket);
        
        const isFirstUser = room.size === 1;
        
        console.log(`用户 ${socket.user.username} (${socket.id}) 加入房间 ${roomCode}, 是否第一个用户: ${isFirstUser}`);
        
        socket.emit('roomJoined', { 
            roomCode, 
            isFirstUser,
            userId: socket.id,
            username: socket.user.username
        });

        // 如果是第二个用户，通知第一个用户
        if (room.size === 2) {
            const firstUserSocket = Array.from(room.values())[0];
            firstUserSocket.emit('userJoined', { 
                userId: socket.id,
                username: socket.user.username
            });
            
            // 通知第二个用户房间已准备就绪
            socket.emit('roomReady', { 
                userId: socket.id, 
                isSecondUser: true,
                username: socket.user.username
            });
        }
    });

    socket.on('offer', (data) => {
        const { roomCode, offer } = data;
        const room = rooms.get(roomCode);
        
        console.log(`收到offer: 房间${roomCode}, 用户${socket.user.username}`);
        
        if (room) {
            // 发送给房间内的其他用户
            room.forEach((otherSocket, socketId) => {
                if (socketId !== socket.id) {
                    console.log(`转发offer给用户: ${otherSocket.user.username}`);
                    otherSocket.emit('offer', {
                        offer,
                        fromUserId: socket.id,
                        fromUsername: socket.user.username
                    });
                }
            });
        } else {
            console.log(`房间${roomCode}不存在`);
        }
    });

    socket.on('answer', (data) => {
        const { roomCode, answer } = data;
        const room = rooms.get(roomCode);
        
        console.log(`收到answer: 房间${roomCode}, 用户${socket.user.username}`);
        
        if (room) {
            // 发送给房间内的其他用户
            room.forEach((otherSocket, socketId) => {
                if (socketId !== socket.id) {
                    console.log(`转发answer给用户: ${otherSocket.user.username}`);
                    otherSocket.emit('answer', {
                        answer,
                        fromUserId: socket.id,
                        fromUsername: socket.user.username
                    });
                }
            });
        } else {
            console.log(`房间${roomCode}不存在`);
        }
    });

    socket.on('iceCandidate', (data) => {
        const { roomCode, candidate } = data;
        const room = rooms.get(roomCode);
        
        console.log(`收到ICE候选: 房间${roomCode}, 用户${socket.user.username}`);
        
        if (room) {
            // 发送给房间内的其他用户
            room.forEach((otherSocket, socketId) => {
                if (socketId !== socket.id) {
                    console.log(`转发ICE候选给用户: ${otherSocket.user.username}`);
                    otherSocket.emit('iceCandidate', {
                        candidate,
                        fromUserId: socket.id,
                        fromUsername: socket.user.username
                    });
                }
            });
        } else {
            console.log(`房间${roomCode}不存在`);
        }
    });

    socket.on('disconnect', () => {
        console.log('用户断开连接:', socket.id, '用户名:', socket.user?.username);
        
        // 从所有房间中移除用户
        for (const [roomCode, room] of rooms.entries()) {
            if (room.has(socket.id)) {
                room.delete(socket.id);
                
                // 通知房间内其他用户
                socket.to(roomCode).emit('userLeft', { 
                    userId: socket.id,
                    username: socket.user?.username
                });
                
                // 如果房间为空，删除房间
                if (room.size === 0) {
                    rooms.delete(roomCode);
                }
                
                break;
            }
        }
    });
});

// 定期清理过期会话
setInterval(() => {
    authService.cleanExpiredSessions();
}, 60 * 60 * 1000); // 每小时清理一次

// 获取房间统计信息
app.get('/api/rooms', (req, res) => {
    const roomStats = Array.from(rooms.entries()).map(([code, room]) => ({
        roomCode: code,
        userCount: room.size,
        users: Array.from(room.values()).map(socket => ({
            id: socket.id,
            username: socket.user?.username
        }))
    }));
    
    res.json({
        totalRooms: rooms.size,
        rooms: roomStats
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
    console.log(`访问 http://localhost:${PORT} 开始使用`);
});