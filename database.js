const fs = require('fs');
const path = require('path');

class Database {
    constructor() {
        this.dataFile = path.join(__dirname, 'users.json');
        this.sessionsFile = path.join(__dirname, 'sessions.json');
        this.initFiles();
    }

    initFiles() {
        console.log('初始化数据库文件...');
        
        // 初始化用户数据文件
        if (!fs.existsSync(this.dataFile)) {
            console.log('创建用户数据文件...');
            fs.writeFileSync(this.dataFile, JSON.stringify({ users: [] }, null, 2));
        }
        
        // 初始化会话数据文件
        if (!fs.existsSync(this.sessionsFile)) {
            console.log('创建会话数据文件...');
            fs.writeFileSync(this.sessionsFile, JSON.stringify({ sessions: [] }, null, 2));
        }
        
        console.log('数据库文件初始化完成');
    }

    // 读取数据
    readData(file) {
        try {
            const data = fs.readFileSync(file, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('读取数据失败:', error);
            return file === this.dataFile ? { users: [] } : { sessions: [] };
        }
    }

    // 写入数据
    writeData(file, data) {
        try {
            fs.writeFileSync(file, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('写入数据失败:', error);
            throw error;
        }
    }

    // 用户注册
    registerUser(userData) {
        return new Promise((resolve, reject) => {
            try {
                const data = this.readData(this.dataFile);
                const { username, password, gender, qq } = userData;
                
                // 检查用户名是否已存在
                const existingUser = data.users.find(user => user.username === username);
                if (existingUser) {
                    reject(new Error('用户名已存在'));
                    return;
                }
                
                // 生成新用户ID
                const newId = data.users.length > 0 ? Math.max(...data.users.map(u => u.id)) + 1 : 1;
                
                // 添加新用户
                const newUser = {
                    id: newId,
                    username,
                    password,
                    gender,
                    qq,
                    created_at: new Date().toISOString(),
                    last_login: null
                };
                
                data.users.push(newUser);
                this.writeData(this.dataFile, data);
                
                resolve({ id: newId, username });
            } catch (error) {
                reject(error);
            }
        });
    }

    // 根据用户名查找用户
    findUserByUsername(username) {
        return new Promise((resolve, reject) => {
            try {
                const data = this.readData(this.dataFile);
                const user = data.users.find(user => user.username === username);
                resolve(user || null);
            } catch (error) {
                reject(error);
            }
        });
    }

    // 根据ID查找用户
    findUserById(id) {
        return new Promise((resolve, reject) => {
            try {
                const data = this.readData(this.dataFile);
                const user = data.users.find(user => user.id === id);
                resolve(user || null);
            } catch (error) {
                reject(error);
            }
        });
    }

    // 更新最后登录时间
    updateLastLogin(userId) {
        return new Promise((resolve, reject) => {
            try {
                const data = this.readData(this.dataFile);
                const userIndex = data.users.findIndex(user => user.id === userId);
                if (userIndex !== -1) {
                    data.users[userIndex].last_login = new Date().toISOString();
                    this.writeData(this.dataFile, data);
                }
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    // 创建会话
    createSession(sessionId, userId, expiresAt) {
        return new Promise((resolve, reject) => {
            try {
                const data = this.readData(this.sessionsFile);
                const session = {
                    id: sessionId,
                    user_id: userId,
                    created_at: new Date().toISOString(),
                    expires_at: expiresAt.toISOString()
                };
                
                data.sessions.push(session);
                this.writeData(this.sessionsFile, data);
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    // 验证会话
    validateSession(sessionId) {
        return new Promise((resolve, reject) => {
            try {
                const data = this.readData(this.sessionsFile);
                const userData = this.readData(this.dataFile);
                
                const session = data.sessions.find(s => s.id === sessionId);
                if (!session) {
                    resolve(null);
                    return;
                }
                
                // 检查是否过期
                if (new Date(session.expires_at) <= new Date()) {
                    resolve(null);
                    return;
                }
                
                // 查找用户信息
                const user = userData.users.find(u => u.id === session.user_id);
                if (!user) {
                    resolve(null);
                    return;
                }
                
                resolve({
                    user_id: session.user_id,
                    username: user.username,
                    gender: user.gender,
                    qq: user.qq
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    // 删除会话
    deleteSession(sessionId) {
        return new Promise((resolve, reject) => {
            try {
                const data = this.readData(this.sessionsFile);
                data.sessions = data.sessions.filter(s => s.id !== sessionId);
                this.writeData(this.sessionsFile, data);
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    // 清理过期会话
    cleanExpiredSessions() {
        return new Promise((resolve, reject) => {
            try {
                const data = this.readData(this.sessionsFile);
                const now = new Date();
                data.sessions = data.sessions.filter(s => new Date(s.expires_at) > now);
                this.writeData(this.sessionsFile, data);
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    close() {
        // JSON文件数据库不需要关闭连接
    }
}

module.exports = Database;