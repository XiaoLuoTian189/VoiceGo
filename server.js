const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// 静态文件服务
app.use(express.static(path.join(__dirname)));

// 存储房间信息
const rooms = new Map();

// Socket.IO 连接处理
io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);
    
    // 加入房间
    socket.on('joinRoom', (data) => {
        const { roomCode } = data;
        
        if (!roomCode || roomCode.length !== 4) {
            socket.emit('error', { message: '房间号码必须是4位数字' });
            return;
        }
        
        // 检查房间是否存在
        if (!rooms.has(roomCode)) {
            // 创建新房间
            rooms.set(roomCode, {
                users: new Set(),
                createdAt: Date.now()
            });
        }
        
        const room = rooms.get(roomCode);
        
        // 检查房间是否已满（限制2人）
        if (room.users.size >= 2) {
            socket.emit('error', { message: '房间已满，最多支持2人通话' });
            return;
        }
        
        // 将用户加入房间
        room.users.add(socket.id);
        socket.join(roomCode);
        socket.roomCode = roomCode;
        
        console.log(`用户 ${socket.id} 加入房间 ${roomCode}`);
        
        // 通知用户成功加入房间
        socket.emit('roomJoined', {
            roomCode: roomCode,
            isFirstUser: room.users.size === 1
        });
        
        // 如果房间有2个用户，通知第一个用户有新用户加入
        if (room.users.size === 2) {
            socket.to(roomCode).emit('userJoined', {
                userId: socket.id
            });
        }
    });
    
    // 处理WebRTC offer
    socket.on('offer', (data) => {
        const { roomCode, offer } = data;
        socket.to(roomCode).emit('offer', {
            offer: offer,
            from: socket.id
        });
    });
    
    // 处理WebRTC answer
    socket.on('answer', (data) => {
        const { roomCode, answer } = data;
        socket.to(roomCode).emit('answer', {
            answer: answer,
            from: socket.id
        });
    });
    
    // 处理ICE候选
    socket.on('iceCandidate', (data) => {
        const { roomCode, candidate } = data;
        socket.to(roomCode).emit('iceCandidate', {
            candidate: candidate,
            from: socket.id
        });
    });
    
    // 用户离开房间
    socket.on('leaveRoom', (data) => {
        const { roomCode } = data;
        if (roomCode && rooms.has(roomCode)) {
            const room = rooms.get(roomCode);
            room.users.delete(socket.id);
            
            // 通知房间内其他用户
            socket.to(roomCode).emit('userLeft');
            
            // 如果房间为空，删除房间
            if (room.users.size === 0) {
                rooms.delete(roomCode);
                console.log(`房间 ${roomCode} 已删除`);
            }
            
            socket.leave(roomCode);
            console.log(`用户 ${socket.id} 离开房间 ${roomCode}`);
        }
    });
    
    // 用户断开连接
    socket.on('disconnect', () => {
        console.log('用户断开连接:', socket.id);
        
        if (socket.roomCode) {
            const roomCode = socket.roomCode;
            if (rooms.has(roomCode)) {
                const room = rooms.get(roomCode);
                room.users.delete(socket.id);
                
                // 通知房间内其他用户
                socket.to(roomCode).emit('userLeft');
                
                // 如果房间为空，删除房间
                if (room.users.size === 0) {
                    rooms.delete(roomCode);
                    console.log(`房间 ${roomCode} 已删除`);
                }
            }
        }
    });
});

// 定期清理空房间（每5分钟）
setInterval(() => {
    const now = Date.now();
    for (const [roomCode, room] of rooms.entries()) {
        // 删除超过30分钟的空房间
        if (room.users.size === 0 && (now - room.createdAt) > 30 * 60 * 1000) {
            rooms.delete(roomCode);
            console.log(`清理空房间: ${roomCode}`);
        }
    }
}, 5 * 60 * 1000);

// 获取房间统计信息
app.get('/api/rooms', (req, res) => {
    const roomStats = Array.from(rooms.entries()).map(([code, room]) => ({
        roomCode: code,
        userCount: room.users.size,
        createdAt: room.createdAt
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
