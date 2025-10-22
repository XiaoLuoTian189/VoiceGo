# VoiceGo - 实时语音通话应用

<div align="center">

![VoiceGo Logo](https://img.shields.io/badge/VoiceGo-语音通话-blue?style=for-the-badge&logo=webrtc)

**基于WebRTC技术的实时语音通话解决方案**

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-Supported-blue.svg)](https://webrtc.org/)

</div>

---

## ✨ 项目简介

VoiceGo 是一个基于 WebRTC 技术的实时语音通话应用，支持用户通过简单的房间号快速建立语音连接。项目采用现代化的技术栈，提供稳定、低延迟的语音通话体验。

### 🎯 核心特性

- 🚀 **即开即用** - 输入4位房间号即可开始通话
- 🔒 **安全认证** - 完整的用户注册登录系统
- 📱 **跨平台** - 支持桌面端和移动端浏览器
- 🌐 **实时通信** - 基于WebRTC的P2P连接
- 🎛️ **简单控制** - 静音、挂断等基础功能
- 🔧 **调试友好** - 内置调试工具和状态监控

## 🛠️ 技术栈

### 后端技术
- **Node.js** - 服务器运行环境
- **Express.js** - Web应用框架
- **Socket.IO** - 实时双向通信
- **JWT** - 用户认证令牌
- **bcryptjs** - 密码加密

### 前端技术
- **原生JavaScript** - 客户端逻辑
- **WebRTC API** - 音视频通信
- **CSS3** - 现代化UI设计
- **HTML5** - 语义化标记

### 部署技术
- **Nginx** - 反向代理和静态文件服务
- **PM2** - 进程管理
- **SSL/TLS** - HTTPS安全连接

## 📦 快速开始

### 环境要求

- Node.js 18.0+
- Nginx (生产环境)
- 现代浏览器 (Chrome, Firefox, Safari, Edge)

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/your-username/voicego.git
   cd voicego
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm start
   ```

4. **访问应用**
   ```
   http://localhost:3000
   ```

### 生产环境部署

1. **配置Nginx**
   ```bash
   # 将 nginx.conf 配置添加到您的Nginx配置中
   sudo cp nginx.conf /etc/nginx/sites-available/voicego
   sudo ln -s /etc/nginx/sites-available/voicego /etc/nginx/sites-enabled/
   ```

2. **使用PM2启动**
   ```bash
   npm install -g pm2
   pm2 start ecosystem.config.js
   ```

3. **配置SSL证书**
   - 在Nginx配置中启用SSL
   - 更新域名配置

## 🎮 使用指南

### 用户注册登录
1. 访问应用首页
2. 点击"注册"创建新账户
3. 填写用户名、密码等信息
4. 注册成功后自动登录

### 开始语音通话
1. 登录后输入4位数字房间号
2. 点击"加入房间"
3. 允许浏览器访问麦克风
4. 等待其他用户加入同一房间
5. 开始语音通话

### 通话控制
- **静音/取消静音** - 控制麦克风开关
- **挂断** - 结束通话并离开房间
- **调试** - 查看连接状态和调试信息

## 🔧 配置说明

### 环境变量
```bash
PORT=3000                    # 服务器端口
SESSION_SECRET=your_secret   # 会话密钥
```

### Nginx配置要点
- WebSocket代理配置
- SSL证书配置
- 静态文件缓存
- 安全头设置

## 📱 浏览器兼容性

| 浏览器 | 版本要求 | 支持状态 |
|--------|----------|----------|
| Chrome | 60+ | ✅ 完全支持 |
| Firefox | 55+ | ✅ 完全支持 |
| Safari | 11+ | ✅ 完全支持 |
| Edge | 79+ | ✅ 完全支持 |
| 移动端浏览器 | 最新版本 | ✅ 支持 |

## 🔒 安全特性

- **HTTPS强制** - 生产环境强制使用HTTPS
- **JWT认证** - 安全的用户认证机制
- **密码加密** - bcrypt密码哈希
- **会话管理** - 安全的会话处理
- **CORS配置** - 跨域请求控制

## 🐛 故障排除

### 常见问题

**Q: 无法建立语音连接？**
A: 检查以下几点：
- 确保使用HTTPS访问（localhost除外）
- 检查麦克风权限是否已授予
- 确认防火墙未阻止UDP端口
- 查看浏览器控制台错误信息

**Q: 移动端无法正常使用？**
A: 移动端优化建议：
- 使用最新版本浏览器
- 确保网络连接稳定
- 允许浏览器访问麦克风
- 避免在后台运行

**Q: 服务器部署问题？**
A: 部署检查清单：
- 确认Node.js版本兼容
- 检查Nginx配置正确性
- 验证SSL证书有效性
- 查看服务器日志

## 📊 性能优化

- **ICE候选池** - 预收集ICE候选提高连接速度
- **音频优化** - 回声消除、噪声抑制
- **移动端适配** - 针对移动设备的音频参数优化
- **连接重试** - 自动重连机制

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 👨‍💻 作者信息

**小洛天** - 全栈开发者

- GitHub: [@xiaoluotian](https://github.com/XiaoLuoTian189)

## 🙏 致谢

感谢以下开源项目和技术：

- [WebRTC](https://webrtc.org/) - 实时通信技术
- [Socket.IO](https://socket.io/) - 实时双向通信
- [Express.js](https://expressjs.com/) - Web应用框架
- [Node.js](https://nodejs.org/) - JavaScript运行环境

---

<div align="center">

**⭐ 如果这个项目对您有帮助，请给它一个星标！**

Made with ❤️ by **小洛天**

</div>
