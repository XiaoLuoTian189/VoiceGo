const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('./database');

class AuthService {
    constructor() {
        this.db = new Database();
        this.jwtSecret = process.env.JWT_SECRET || 'voicego_secret_key_2024';
        this.sessionExpiry = 24 * 60 * 60 * 1000; // 24小时
    }

    // 用户注册
    async register(userData) {
        try {
            const { username, password, gender, qq } = userData;

            // 验证输入
            if (!username || !password || !gender || !qq) {
                throw new Error('所有字段都是必填的');
            }

            if (username.length < 3 || username.length > 20) {
                throw new Error('用户名长度必须在3-20个字符之间');
            }

            if (password.length < 6) {
                throw new Error('密码长度至少6个字符');
            }

            if (!['男', '女', '其他'].includes(gender)) {
                throw new Error('性别必须是：男、女或其他');
            }

            if (!/^\d{5,11}$/.test(qq)) {
                throw new Error('QQ号码格式不正确');
            }

            // 检查用户名是否已存在
            const existingUser = await this.db.findUserByUsername(username);
            if (existingUser) {
                throw new Error('用户名已存在');
            }

            // 加密密码
            const hashedPassword = await bcrypt.hash(password, 10);

            // 创建用户
            const user = await this.db.registerUser({
                username,
                password: hashedPassword,
                gender,
                qq
            });

            return {
                success: true,
                message: '注册成功',
                user: {
                    id: user.id,
                    username: user.username,
                    gender,
                    qq
                }
            };

        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // 用户登录
    async login(username, password) {
        try {
            if (!username || !password) {
                throw new Error('用户名和密码不能为空');
            }

            // 查找用户
            const user = await this.db.findUserByUsername(username);
            if (!user) {
                throw new Error('用户名或密码错误');
            }

            // 验证密码
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                throw new Error('用户名或密码错误');
            }

            // 更新最后登录时间
            await this.db.updateLastLogin(user.id);

            // 生成JWT token
            const token = jwt.sign(
                { 
                    userId: user.id, 
                    username: user.username 
                },
                this.jwtSecret,
                { expiresIn: '24h' }
            );

            // 创建会话
            const sessionId = this.generateSessionId();
            const expiresAt = new Date(Date.now() + this.sessionExpiry);
            await this.db.createSession(sessionId, user.id, expiresAt);

            return {
                success: true,
                message: '登录成功',
                token,
                sessionId,
                user: {
                    id: user.id,
                    username: user.username,
                    gender: user.gender,
                    qq: user.qq
                }
            };

        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // 验证token
    async verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            const user = await this.db.findUserById(decoded.userId);
            
            if (!user) {
                throw new Error('用户不存在');
            }

            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    gender: user.gender,
                    qq: user.qq
                }
            };

        } catch (error) {
            return {
                success: false,
                message: 'Token无效或已过期'
            };
        }
    }

    // 验证会话
    async verifySession(sessionId) {
        try {
            const session = await this.db.validateSession(sessionId);
            
            if (!session) {
                throw new Error('会话无效或已过期');
            }

            return {
                success: true,
                user: {
                    id: session.user_id,
                    username: session.username,
                    gender: session.gender,
                    qq: session.qq
                }
            };

        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // 登出
    async logout(sessionId) {
        try {
            await this.db.deleteSession(sessionId);
            return {
                success: true,
                message: '登出成功'
            };
        } catch (error) {
            return {
                success: false,
                message: '登出失败'
            };
        }
    }

    // 生成会话ID
    generateSessionId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    // 清理过期会话
    async cleanExpiredSessions() {
        try {
            await this.db.cleanExpiredSessions();
        } catch (error) {
            console.error('清理过期会话失败:', error);
        }
    }
}

module.exports = AuthService;