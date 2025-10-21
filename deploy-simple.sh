#!/bin/bash

# VoiceGo 极简部署脚本
# GitHub: https://github.com/XiaoLuoTian189/VoiceGo.git

set -e

echo "🚀 VoiceGo 极简部署脚本"
echo "================================"

# 检查root权限
[ "$EUID" -ne 0 ] && { echo "❌ 请使用root用户运行"; exit 1; }

# 安装必要工具
echo "📦 安装工具..."
apt update -qq && apt install -y curl git || yum install -y curl git

# 安装Node.js
if ! command -v node &> /dev/null; then
    echo "📥 安装Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# 安装PM2
if ! command -v pm2 &> /dev/null; then
    echo "📥 安装PM2..."
    npm install -g pm2
fi

# 部署项目
echo "🚀 部署项目..."
PROJECT_DIR="/opt/voicego"
[ -d "$PROJECT_DIR" ] && rm -rf "$PROJECT_DIR"
git clone https://github.com/XiaoLuoTian189/VoiceGo.git "$PROJECT_DIR"
cd "$PROJECT_DIR"
npm install --silent

# 配置防火墙
ufw allow 3000 2>/dev/null || firewall-cmd --permanent --add-port=3000/tcp 2>/dev/null || true

# 启动应用
pm2 delete voicego 2>/dev/null || true
pm2 start server.js --name voicego
pm2 startup
pm2 save

# 显示结果
echo ""
echo "🎉 VoiceGo部署完成！"
echo "================================"
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "your-server-ip")
echo "🌐 访问地址: http://$SERVER_IP:3000"
echo ""
echo "🔧 管理命令:"
echo "  查看状态: pm2 status"
echo "  查看日志: pm2 logs voicego"
echo "  重启应用: pm2 restart voicego"
echo ""
echo "✅ 部署完成！"
