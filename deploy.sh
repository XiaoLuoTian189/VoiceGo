#!/bin/bash

# VoiceGo 语音通话应用一键部署脚本
# 适用于 Ubuntu 20.04+ / CentOS 7+ / Debian 10+
# GitHub: https://github.com/XiaoLuoTian189/VoiceGo.git

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否为root用户
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "请使用root用户运行此脚本"
        exit 1
    fi
}

# 检测操作系统
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        VER=$VERSION_ID
    else
        log_error "无法检测操作系统"
        exit 1
    fi
    
    log_info "检测到操作系统: $OS $VER"
}

# 更新系统包
update_system() {
    log_info "更新系统包..."
    
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        apt update && apt upgrade -y
        apt install -y curl wget git unzip software-properties-common
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
        yum update -y
        yum install -y curl wget git unzip epel-release
    else
        log_error "不支持的操作系统: $OS"
        exit 1
    fi
    
    log_success "系统包更新完成"
}

# 安装Node.js
install_nodejs() {
    log_info "安装Node.js..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log_info "Node.js已安装: $NODE_VERSION"
        return
    fi
    
    # 安装Node.js 18.x
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        apt-get install -y nodejs
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
        yum install -y nodejs
    fi
    
    # 验证安装
    if command -v node &> /dev/null; then
        log_success "Node.js安装成功: $(node --version)"
        log_success "npm版本: $(npm --version)"
    else
        log_error "Node.js安装失败"
        exit 1
    fi
}

# 安装PM2
install_pm2() {
    log_info "安装PM2进程管理器..."
    
    if command -v pm2 &> /dev/null; then
        log_info "PM2已安装: $(pm2 --version)"
        return
    fi
    
    npm install -g pm2
    
    if command -v pm2 &> /dev/null; then
        log_success "PM2安装成功: $(pm2 --version)"
    else
        log_error "PM2安装失败"
        exit 1
    fi
}

# 克隆项目
clone_project() {
    log_info "克隆VoiceGo项目..."
    
    PROJECT_DIR="/opt/voicego"
    GITHUB_URL="https://github.com/XiaoLuoTian189/VoiceGo.git"
    
    # 如果目录已存在，先删除
    if [ -d "$PROJECT_DIR" ]; then
        log_warning "项目目录已存在，正在删除..."
        rm -rf "$PROJECT_DIR"
    fi
    
    # 克隆项目
    git clone "$GITHUB_URL" "$PROJECT_DIR"
    
    if [ -d "$PROJECT_DIR" ]; then
        log_success "项目克隆成功"
        cd "$PROJECT_DIR"
    else
        log_error "项目克隆失败"
        exit 1
    fi
}

# 安装项目依赖
install_dependencies() {
    log_info "安装项目依赖..."
    
    cd "$PROJECT_DIR"
    npm install
    
    if [ $? -eq 0 ]; then
        log_success "项目依赖安装成功"
    else
        log_error "项目依赖安装失败"
        exit 1
    fi
}

# 配置防火墙
configure_firewall() {
    log_info "配置防火墙..."
    
    if command -v ufw &> /dev/null; then
        # Ubuntu/Debian使用ufw
        ufw allow 3000
        ufw allow 22
        ufw allow 80
        ufw allow 443
        ufw --force enable
        log_success "UFW防火墙配置完成"
    elif command -v firewall-cmd &> /dev/null; then
        # CentOS/RHEL使用firewalld
        systemctl start firewalld
        systemctl enable firewalld
        firewall-cmd --permanent --add-port=3000/tcp
        firewall-cmd --permanent --add-port=22/tcp
        firewall-cmd --permanent --add-port=80/tcp
        firewall-cmd --permanent --add-port=443/tcp
        firewall-cmd --reload
        log_success "Firewalld防火墙配置完成"
    else
        log_warning "未检测到防火墙，请手动开放端口3000"
    fi
}

# 创建PM2配置文件
create_pm2_config() {
    log_info "创建PM2配置文件..."
    
    cat > "$PROJECT_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: 'voicego',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/voicego/error.log',
    out_file: '/var/log/voicego/out.log',
    log_file: '/var/log/voicego/combined.log',
    time: true
  }]
};
EOF
    
    # 创建日志目录
    mkdir -p /var/log/voicego
    chown -R $(whoami):$(whoami) /var/log/voicego
    
    log_success "PM2配置文件创建完成"
}

# 启动应用
start_application() {
    log_info "启动VoiceGo应用..."
    
    cd "$PROJECT_DIR"
    
    # 停止可能存在的旧进程
    pm2 delete voicego 2>/dev/null || true
    
    # 启动应用
    pm2 start ecosystem.config.js
    
    # 设置开机自启
    pm2 startup
    pm2 save
    
    # 等待应用启动
    sleep 3
    
    # 检查应用状态
    if pm2 list | grep -q "voicego.*online"; then
        log_success "VoiceGo应用启动成功"
    else
        log_error "VoiceGo应用启动失败"
        pm2 logs voicego --lines 20
        exit 1
    fi
}

# 安装Nginx (可选)
install_nginx() {
    read -p "是否安装Nginx反向代理? (y/n): " install_nginx
    
    if [ "$install_nginx" = "y" ] || [ "$install_nginx" = "Y" ]; then
        log_info "安装Nginx..."
        
        if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
            apt install -y nginx
        elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
            yum install -y nginx
        fi
        
        # 启动并设置开机自启
        systemctl start nginx
        systemctl enable nginx
        
        # 创建Nginx配置
        read -p "请输入您的域名 (或按Enter跳过): " domain_name
        
        if [ -n "$domain_name" ]; then
            create_nginx_config "$domain_name"
        fi
        
        log_success "Nginx安装完成"
    fi
}

# 创建Nginx配置
create_nginx_config() {
    local domain_name=$1
    
    log_info "创建Nginx配置文件..."
    
    cat > /etc/nginx/sites-available/voicego << EOF
server {
    listen 80;
    server_name $domain_name;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
EOF
    
    # 启用站点
    if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
        ln -sf /etc/nginx/sites-available/voicego /etc/nginx/sites-enabled/
        rm -f /etc/nginx/sites-enabled/default
    elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
        cp /etc/nginx/sites-available/voicego /etc/nginx/conf.d/voicego.conf
    fi
    
    # 测试配置
    nginx -t
    
    if [ $? -eq 0 ]; then
        systemctl restart nginx
        log_success "Nginx配置完成"
    else
        log_error "Nginx配置有误"
    fi
}

# 安装SSL证书 (可选)
install_ssl() {
    read -p "是否安装SSL证书? (y/n): " install_ssl
    
    if [ "$install_ssl" = "y" ] || [ "$install_ssl" = "Y" ]; then
        if command -v certbot &> /dev/null; then
            log_info "Certbot已安装"
        else
            log_info "安装Certbot..."
            
            if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
                apt install -y certbot python3-certbot-nginx
            elif [[ "$OS" == *"CentOS"* ]] || [[ "$OS" == *"Red Hat"* ]]; then
                yum install -y certbot python3-certbot-nginx
            fi
        fi
        
        read -p "请输入您的域名: " ssl_domain
        
        if [ -n "$ssl_domain" ]; then
            certbot --nginx -d "$ssl_domain" --non-interactive --agree-tos --email admin@$ssl_domain
            
            # 设置自动续期
            (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
            
            log_success "SSL证书安装完成"
        fi
    fi
}

# 创建监控脚本
create_monitor_script() {
    log_info "创建监控脚本..."
    
    cat > "$PROJECT_DIR/monitor.sh" << 'EOF'
#!/bin/bash

echo "=== VoiceGo 应用状态监控 ==="
echo "时间: $(date)"
echo ""

echo "=== PM2状态 ==="
pm2 status

echo ""
echo "=== 系统资源 ==="
echo "CPU使用率:"
top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1

echo "内存使用:"
free -h

echo "磁盘使用:"
df -h /

echo ""
echo "=== 网络连接 ==="
netstat -tulpn | grep :3000

echo ""
echo "=== 应用日志 (最近10行) ==="
pm2 logs voicego --lines 10 --nostream

echo ""
echo "=== 系统负载 ==="
uptime
EOF
    
    chmod +x "$PROJECT_DIR/monitor.sh"
    log_success "监控脚本创建完成"
}

# 创建备份脚本
create_backup_script() {
    log_info "创建备份脚本..."
    
    cat > "$PROJECT_DIR/backup.sh" << EOF
#!/bin/bash

DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"
PROJECT_DIR="$PROJECT_DIR"

mkdir -p \$BACKUP_DIR

# 备份项目文件
tar -czf \$BACKUP_DIR/voicego-backup-\$DATE.tar.gz -C \$PROJECT_DIR .

# 备份PM2配置
pm2 save
cp ~/.pm2/dump.pm2 \$BACKUP_DIR/pm2-dump-\$DATE.pm2

# 删除7天前的备份
find \$BACKUP_DIR -name "voicego-backup-*.tar.gz" -mtime +7 -delete
find \$BACKUP_DIR -name "pm2-dump-*.pm2" -mtime +7 -delete

echo "备份完成: \$BACKUP_DIR/voicego-backup-\$DATE.tar.gz"
EOF
    
    chmod +x "$PROJECT_DIR/backup.sh"
    
    # 设置定时备份
    (crontab -l 2>/dev/null; echo "0 2 * * * $PROJECT_DIR/backup.sh") | crontab -
    
    log_success "备份脚本创建完成"
}

# 显示部署结果
show_result() {
    echo ""
    echo "🎉 VoiceGo部署完成！"
    echo "================================"
    
    echo ""
    echo "📊 应用状态:"
    pm2 status
    
    echo ""
    echo "🌐 访问地址:"
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || echo "your-server-ip")
    echo "  直接访问: http://$SERVER_IP:3000"
    
    if [ -f /etc/nginx/sites-available/voicego ]; then
        DOMAIN=$(grep "server_name" /etc/nginx/sites-available/voicego | awk '{print $2}' | head -1)
        if [ -n "$DOMAIN" ] && [ "$DOMAIN" != "your-domain.com" ]; then
            echo "  域名访问: http://$DOMAIN"
            if [ -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ]; then
                echo "  HTTPS访问: https://$DOMAIN"
            fi
        fi
    fi
    
    echo ""
    echo "🔧 管理命令:"
    echo "  查看状态: pm2 status"
    echo "  查看日志: pm2 logs voicego"
    echo "  重启应用: pm2 restart voicego"
    echo "  停止应用: pm2 stop voicego"
    echo "  监控面板: pm2 monit"
    echo "  系统监控: $PROJECT_DIR/monitor.sh"
    
    echo ""
    echo "💾 备份命令:"
    echo "  手动备份: $PROJECT_DIR/backup.sh"
    
    echo ""
    echo "📝 重要文件位置:"
    echo "  项目目录: $PROJECT_DIR"
    echo "  日志目录: /var/log/voicego"
    echo "  备份目录: /opt/backups"
    echo "  PM2配置: $PROJECT_DIR/ecosystem.config.js"
    
    echo ""
    echo "✅ 部署完成！现在可以开始使用VoiceGo语音通话应用了！"
}

# 主函数
main() {
    echo "🚀 VoiceGo 语音通话应用一键部署脚本"
    echo "GitHub: https://github.com/XiaoLuoTian189/VoiceGo.git"
    echo "=========================================="
    
    check_root
    detect_os
    update_system
    install_nodejs
    install_pm2
    clone_project
    install_dependencies
    configure_firewall
    create_pm2_config
    start_application
    install_nginx
    install_ssl
    create_monitor_script
    create_backup_script
    show_result
}

# 运行主函数
main "$@"
