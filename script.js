class VoiceCallApp {
    constructor() {
        this.socket = null;
        this.localStream = null;
        this.peerConnection = null;
        this.roomCode = null;
        this.isMuted = false;
        this.isFirstUser = false;
        this.connectionTimeout = null;
        this.remoteAudio = null;
        this.isMobile = this.detectMobile();
        this.currentUser = null;
        
        this.initElements();
        this.initEventListeners();
        this.checkAuthStatus();
    }
    
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
    }
    
    initElements() {
        this.roomCodeInput = document.getElementById('roomCode');
        this.joinRoomBtn = document.getElementById('joinRoom');
        this.statusDiv = document.getElementById('status');
        this.callSection = document.getElementById('callSection');
        this.muteBtn = document.getElementById('muteBtn');
        this.hangupBtn = document.getElementById('hangupBtn');
        this.debugBtn = document.getElementById('debugBtn');
        this.testAudioBtn = document.getElementById('testAudioBtn');
        this.currentRoomSpan = document.getElementById('currentRoom');
        this.connectionStatusSpan = document.getElementById('connectionStatus');
        
        // 认证相关元素
        this.userInfoDiv = document.getElementById('userInfo');
        this.usernameSpan = document.getElementById('username');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.authLinksDiv = document.getElementById('authLinks');
    }
    
    initEventListeners() {
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        this.hangupBtn.addEventListener('click', () => this.hangup());
        this.debugBtn.addEventListener('click', () => this.showDebugInfo());
        this.testAudioBtn.addEventListener('click', () => this.testAudioDevices());
        
        // 认证相关事件
        if (this.logoutBtn) {
            this.logoutBtn.addEventListener('click', () => this.logout());
        }
        
        this.roomCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinRoom();
            }
        });
        
        this.roomCodeInput.addEventListener('input', (e) => {
            // 只允许输入数字
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
        
        // 移动端优化
        this.initMobileOptimizations();
    }
    
    initMobileOptimizations() {
        // 防止双击缩放
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // 防止长按选择文本
        document.addEventListener('selectstart', (e) => {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
            }
        });
        
        // 防止上下文菜单
        document.addEventListener('contextmenu', (e) => {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
            }
        });
        
        // 优化触摸反馈
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.addEventListener('touchstart', () => {
                btn.style.transform = 'scale(0.95)';
            });
            
            btn.addEventListener('touchend', () => {
                setTimeout(() => {
                    btn.style.transform = '';
                }, 150);
            });
        });
    }
    
    async checkAuthStatus() {
        try {
            // 检查本地存储的token
            const token = localStorage.getItem('authToken');
            if (token) {
                // 验证token是否有效
                const response = await fetch('/api/user', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const result = await response.json();
                
                if (result.success) {
                    this.currentUser = result.user;
                    this.showUserInfo();
                    this.initSocket();
                    return;
                } else {
                    // Token无效，清除本地存储
                    localStorage.removeItem('authToken');
                }
            }
            
            // 没有有效token，显示登录链接
            this.showAuthLinks();
            this.showStatus('error', '请先登录才能使用语音通话功能');
            this.joinRoomBtn.disabled = true;
            
        } catch (error) {
            console.error('检查登录状态失败:', error);
            this.showAuthLinks();
            this.showStatus('error', '请先登录才能使用语音通话功能');
            this.joinRoomBtn.disabled = true;
        }
    }

    showUserInfo() {
        if (this.userInfoDiv && this.usernameSpan) {
            this.usernameSpan.textContent = this.currentUser.username;
            this.userInfoDiv.style.display = 'flex';
        }
        if (this.authLinksDiv) {
            this.authLinksDiv.style.display = 'none';
        }
    }

    showAuthLinks() {
        if (this.userInfoDiv) {
            this.userInfoDiv.style.display = 'none';
        }
        if (this.authLinksDiv) {
            this.authLinksDiv.style.display = 'block';
        }
    }

    async logout() {
        try {
            const token = localStorage.getItem('authToken');
            if (token) {
                const response = await fetch('/api/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                const result = await response.json();
                
                if (result.success) {
                    console.log('服务器端登出成功');
                }
            }
            
            // 清除本地存储
            localStorage.removeItem('authToken');
            
            // 重置状态
            this.currentUser = null;
            this.showAuthLinks();
            this.showStatus('waiting', '已退出登录');
            this.joinRoomBtn.disabled = true;
            
            // 断开Socket连接
            if (this.socket) {
                this.socket.disconnect();
                this.socket = null;
            }
            
            console.log('退出登录成功');
        } catch (error) {
            console.error('退出登录失败:', error);
        }
    }

    getSessionId() {
        // 从cookie中获取sessionId
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'connect.sid') {
                console.log('原始会话Cookie:', value);
                
                // Express-session的会话ID格式通常是: s:sessionId.signature
                let sessionId = value;
                
                // 去掉s:前缀
                if (sessionId.startsWith('s:')) {
                    sessionId = sessionId.substring(2);
                    console.log('去掉s:前缀后:', sessionId);
                }
                
                // 保留完整的会话ID（包括签名），让服务器端处理
                console.log('最终会话ID:', sessionId);
                return sessionId;
            }
        }
        console.log('未找到会话ID');
        return null;
    }

    initSocket() {
        console.log('初始化Socket连接...');
        
        // 获取token
        const token = localStorage.getItem('authToken');
        console.log('使用Token进行Socket认证:', !!token);
        
        this.socket = io({
            auth: {
                token: token
            }
        });
        
        this.socket.on('connect', () => {
            console.log('Socket连接成功:', this.socket.id);
            this.showStatus('waiting', '已连接到服务器，可以加入房间');
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('Socket连接失败:', error);
            this.showStatus('error', '连接服务器失败: ' + error.message);
            this.joinRoomBtn.disabled = true;
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('Socket断开连接:', reason);
            this.showStatus('error', '与服务器断开连接');
        });
        
        this.socket.on('roomJoined', (data) => {
            this.handleRoomJoined(data);
        });
        
        this.socket.on('userJoined', (data) => {
            this.handleUserJoined(data);
        });
        
        this.socket.on('roomReady', (data) => {
            this.handleRoomReady(data);
        });
        
        this.socket.on('offer', (data) => {
            this.handleOffer(data);
        });
        
        this.socket.on('answer', (data) => {
            this.handleAnswer(data);
        });
        
        this.socket.on('iceCandidate', (data) => {
            this.handleIceCandidate(data);
        });
        
        this.socket.on('userLeft', () => {
            this.handleUserLeft();
        });
        
        this.socket.on('error', (error) => {
            this.showStatus('error', error.message);
        });
    }
    
    async joinRoom() {
        // 检查用户是否已登录
        if (!this.currentUser) {
            this.showStatus('error', '请先登录才能使用语音通话功能');
            return;
        }

        // 检查Socket连接
        if (!this.socket || !this.socket.connected) {
            this.showStatus('error', '请等待服务器连接...');
            return;
        }

        const roomCode = this.roomCodeInput.value.trim();
        
        if (!roomCode || roomCode.length !== 4) {
            this.showStatus('error', '请输入4位数字的房间号码');
            return;
        }
        
        console.log('尝试加入房间:', roomCode);
        
        // 检查移动端环境
        if (this.isMobile) {
            console.log('检测到移动设备，优化音频设置...');
        }
        
        this.roomCode = roomCode;
        this.joinRoomBtn.disabled = true;
        this.showStatus('connecting', '正在加入房间...');
        
        try {
            // 检查浏览器支持
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('浏览器不支持getUserMedia API');
            }
            
            // 检查是否为HTTPS或localhost
            if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
                throw new Error('WebRTC需要HTTPS环境，请使用HTTPS访问');
            }
            
            // 获取麦克风权限
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    // 移动端优化
                    sampleRate: this.isMobile ? 16000 : 44100,
                    channelCount: 1
                },
                video: false
            });
            
            // 加入房间
            this.socket.emit('joinRoom', { roomCode });
            
        } catch (error) {
            console.error('获取麦克风权限失败:', error);
            
            let errorMessage = '无法访问麦克风，请检查权限设置';
            
            if (error.name === 'NotAllowedError') {
                errorMessage = '麦克风权限被拒绝，请在浏览器中允许麦克风访问';
            } else if (error.name === 'NotFoundError') {
                errorMessage = '未找到麦克风设备，请检查设备连接';
            } else if (error.name === 'NotSupportedError') {
                errorMessage = '浏览器不支持麦克风访问，请使用现代浏览器';
            } else if (error.message.includes('HTTPS')) {
                errorMessage = 'WebRTC需要HTTPS环境，请使用HTTPS访问网站';
            }
            
            this.showStatus('error', errorMessage);
            this.joinRoomBtn.disabled = false;
        }
    }
    
    handleRoomJoined(data) {
        this.showStatus('connected', `已加入房间 ${this.roomCode}`);
        this.currentRoomSpan.textContent = this.roomCode;
        this.callSection.style.display = 'block';
        this.connectionStatusSpan.textContent = '等待其他用户加入...';
        
        // 设置用户角色
        this.isFirstUser = data.isFirstUser;
        
        if (data.isFirstUser) {
            this.connectionStatusSpan.textContent = '您是第一个用户，等待其他用户加入...';
        }
    }
    
    handleUserJoined(data) {
        console.log('用户加入:', data);
        this.connectionStatusSpan.textContent = '用户已加入，正在建立连接...';
        this.createPeerConnection();
        this.createOffer();
        
        // 设置连接超时
        this.connectionTimeout = setTimeout(() => {
            if (this.peerConnection && this.peerConnection.iceConnectionState !== 'connected') {
                console.warn('连接超时，尝试重新连接');
                this.connectionStatusSpan.textContent = '连接超时，正在重试...';
                this.retryConnection();
            }
        }, 30000);
    }
    
    retryConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        
        setTimeout(() => {
            this.createPeerConnection();
            this.createOffer();
        }, 2000);
    }
    
    handleRoomReady(data) {
        console.log('房间已准备就绪，等待offer...');
        this.connectionStatusSpan.textContent = '房间已准备就绪，等待连接...';
        
        // 第二个用户创建PeerConnection并等待offer
        this.createPeerConnection();
    }
    
    async createPeerConnection() {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' }
            ],
            iceCandidatePoolSize: 10
        };
        
        this.peerConnection = new RTCPeerConnection(configuration);
        
        // 初始化待处理ICE候选数组
        this.pendingIceCandidates = [];
        
        // 添加本地流
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });
        
        // 处理远程流
        this.peerConnection.ontrack = (event) => {
            console.log('收到远程音频流:', event.streams);
            this.connectionStatusSpan.textContent = '通话已连接';
            
            // 播放远程音频流
            const remoteStream = event.streams[0];
            if (remoteStream) {
                this.playRemoteAudio(remoteStream);
            }
        };
        
        // 处理ICE候选
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('发送ICE候选:', event.candidate);
                this.socket.emit('iceCandidate', {
                    roomCode: this.roomCode,
                    candidate: event.candidate
                });
            } else {
                console.log('ICE候选收集完成');
            }
        };
        
        // 处理ICE连接状态
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE连接状态:', this.peerConnection.iceConnectionState);
            const state = this.peerConnection.iceConnectionState;
            
            if (state === 'connected' || state === 'completed') {
                this.connectionStatusSpan.textContent = '通话已连接';
            } else if (state === 'disconnected') {
                this.connectionStatusSpan.textContent = '连接已断开';
            } else if (state === 'failed') {
                this.connectionStatusSpan.textContent = '连接失败，请检查网络';
                console.error('ICE连接失败');
            } else if (state === 'checking') {
                this.connectionStatusSpan.textContent = '正在建立连接...';
            }
        };
        
        // 处理连接状态变化
        this.peerConnection.onconnectionstatechange = () => {
            console.log('连接状态:', this.peerConnection.connectionState);
            const state = this.peerConnection.connectionState;
            
            if (state === 'connected') {
                this.connectionStatusSpan.textContent = '通话已连接';
            } else if (state === 'disconnected') {
                this.connectionStatusSpan.textContent = '连接已断开';
            } else if (state === 'failed') {
                this.connectionStatusSpan.textContent = '连接失败';
                console.error('WebRTC连接失败');
            }
        };
        
        // 设置超时处理
        setTimeout(() => {
            if (this.peerConnection && this.peerConnection.iceConnectionState === 'checking') {
                console.warn('连接超时，尝试重新连接');
                this.connectionStatusSpan.textContent = '连接超时，请重试';
            }
        }, 30000); // 30秒超时
    }
    
    async createOffer() {
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.socket.emit('offer', {
                roomCode: this.roomCode,
                offer: offer
            });
        } catch (error) {
            console.error('创建offer失败:', error);
        }
    }
    
    async handleOffer(data) {
        try {
            console.log('收到offer，创建PeerConnection...');
            
            // 如果PeerConnection不存在，先创建
            if (!this.peerConnection) {
                this.createPeerConnection();
            }
            
            await this.peerConnection.setRemoteDescription(data.offer);
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            console.log('发送answer...');
            this.socket.emit('answer', {
                roomCode: this.roomCode,
                answer: answer
            });
            
            // 处理待处理的ICE候选
            if (this.pendingIceCandidates && this.pendingIceCandidates.length > 0) {
                console.log(`处理${this.pendingIceCandidates.length}个待处理的ICE候选`);
                for (const candidate of this.pendingIceCandidates) {
                    try {
                        await this.peerConnection.addIceCandidate(candidate);
                        console.log('待处理ICE候选添加成功');
                    } catch (error) {
                        console.error('添加待处理ICE候选失败:', error);
                    }
                }
                this.pendingIceCandidates = [];
            }
        } catch (error) {
            console.error('处理offer失败:', error);
        }
    }
    
    async handleAnswer(data) {
        try {
            console.log('收到answer...');
            
            // 确保PeerConnection存在
            if (!this.peerConnection) {
                console.error('PeerConnection不存在，无法处理answer');
                return;
            }
            
            await this.peerConnection.setRemoteDescription(data.answer);
            console.log('answer处理完成');
            
            // 处理待处理的ICE候选
            if (this.pendingIceCandidates && this.pendingIceCandidates.length > 0) {
                console.log(`处理${this.pendingIceCandidates.length}个待处理的ICE候选`);
                for (const candidate of this.pendingIceCandidates) {
                    try {
                        await this.peerConnection.addIceCandidate(candidate);
                        console.log('待处理ICE候选添加成功');
                    } catch (error) {
                        console.error('添加待处理ICE候选失败:', error);
                    }
                }
                this.pendingIceCandidates = [];
            }
        } catch (error) {
            console.error('处理answer失败:', error);
        }
    }
    
    async handleIceCandidate(data) {
        try {
            console.log('收到ICE候选:', data.candidate);
            
            // 确保PeerConnection存在
            if (!this.peerConnection) {
                console.error('PeerConnection不存在，无法添加ICE候选');
                return;
            }
            
            // 检查远程描述是否已设置
            if (!this.peerConnection.remoteDescription) {
                console.log('远程描述未设置，等待设置后再添加ICE候选');
                // 将ICE候选保存起来，稍后添加
                if (!this.pendingIceCandidates) {
                    this.pendingIceCandidates = [];
                }
                this.pendingIceCandidates.push(data.candidate);
                return;
            }
            
            await this.peerConnection.addIceCandidate(data.candidate);
            console.log('ICE候选添加成功');
        } catch (error) {
            console.error('添加ICE候选失败:', error);
        }
    }
    
    handleUserLeft() {
        this.connectionStatusSpan.textContent = '对方已离开';
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
    }
    
    toggleMute() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.isMuted = !audioTrack.enabled;
                
                if (this.isMuted) {
                    this.muteBtn.textContent = '取消静音';
                    this.muteBtn.style.background = '#ffc107';
                } else {
                    this.muteBtn.textContent = '静音';
                    this.muteBtn.style.background = '#28a745';
                }
            }
        }
    }
    
    hangup() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.remoteAudio) {
            this.remoteAudio.pause();
            this.remoteAudio.srcObject = null;
            this.remoteAudio.remove();
            this.remoteAudio = null;
        }
        
        if (this.socket) {
            this.socket.emit('leaveRoom', { roomCode: this.roomCode });
        }
        
        this.resetUI();
    }
    
    playRemoteAudio(remoteStream) {
        console.log('播放远程音频流...');
        
        // 创建音频元素
        const audio = document.createElement('audio');
        audio.srcObject = remoteStream;
        audio.autoplay = true;
        audio.controls = false;
        audio.style.display = 'none';
        
        // 添加到页面
        document.body.appendChild(audio);
        
        // 监听播放事件
        audio.onloadedmetadata = () => {
            console.log('远程音频元数据加载完成');
            audio.play().catch(e => {
                console.error('自动播放失败，需要用户交互:', e);
                // 显示播放按钮
                this.showPlayButton(audio);
            });
        };
        
        audio.onplay = () => {
            console.log('远程音频开始播放');
            this.connectionStatusSpan.textContent = '通话已连接 - 音频播放中';
        };
        
        audio.onerror = (e) => {
            console.error('远程音频播放错误:', e);
            this.connectionStatusSpan.textContent = '音频播放失败';
        };
        
        // 保存引用
        this.remoteAudio = audio;
    }
    
    showPlayButton(audio) {
        // 创建播放按钮
        const playBtn = document.createElement('button');
        playBtn.textContent = '点击播放音频';
        playBtn.className = 'control-btn';
        playBtn.style.marginTop = '10px';
        
        playBtn.onclick = () => {
            audio.play().then(() => {
                playBtn.remove();
                this.connectionStatusSpan.textContent = '通话已连接 - 音频播放中';
            }).catch(e => {
                console.error('手动播放失败:', e);
            });
        };
        
        // 添加到通话控制区域
        const callControls = document.querySelector('.call-controls');
        callControls.appendChild(playBtn);
    }
    
    async testAudioDevices() {
        try {
            console.log('测试音频设备...');
            this.testAudioBtn.textContent = '测试中...';
            this.testAudioBtn.disabled = true;
            
            // 获取麦克风权限
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    // 移动端优化
                    sampleRate: this.isMobile ? 16000 : 44100,
                    channelCount: 1
                }
            });
            
            console.log('麦克风测试成功:', stream.getAudioTracks());
            
            // 创建音频元素测试播放
            const audio = document.createElement('audio');
            audio.srcObject = stream;
            audio.autoplay = true;
            audio.volume = 0.5;
            
            audio.onloadedmetadata = () => {
                console.log('音频元数据加载完成');
                audio.play().then(() => {
                    console.log('音频播放测试成功');
                    this.testAudioBtn.textContent = '✅ 音频设备正常';
                    this.testAudioBtn.style.background = '#4caf50';
                    
                    // 3秒后停止测试
                    setTimeout(() => {
                        stream.getTracks().forEach(track => track.stop());
                        audio.remove();
                        this.testAudioBtn.textContent = '测试音频设备';
                        this.testAudioBtn.style.background = '#007bff';
                        this.testAudioBtn.disabled = false;
                    }, 3000);
                }).catch(e => {
                    console.error('音频播放测试失败:', e);
                    this.testAudioBtn.textContent = '❌ 播放失败';
                    this.testAudioBtn.style.background = '#f44336';
                    this.testAudioBtn.disabled = false;
                });
            };
            
        } catch (error) {
            console.error('音频设备测试失败:', error);
            this.testAudioBtn.textContent = '❌ 麦克风不可用';
            this.testAudioBtn.style.background = '#f44336';
            this.testAudioBtn.disabled = false;
        }
    }
    
    showDebugInfo() {
        const debugInfo = {
            'Socket连接': this.socket ? this.socket.connected ? '已连接' : '未连接' : '未初始化',
            '用户信息': this.currentUser ? `${this.currentUser.username} (${this.currentUser.gender}, QQ: ${this.currentUser.qq})` : '未登录',
            '本地流': this.localStream ? '已获取' : '未获取',
            '远程音频': this.remoteAudio ? '已创建' : '未创建',
            'PeerConnection': this.peerConnection ? '已创建' : '未创建',
            'ICE连接状态': this.peerConnection ? this.peerConnection.iceConnectionState : 'N/A',
            '连接状态': this.peerConnection ? this.peerConnection.connectionState : 'N/A',
            '房间号': this.roomCode || 'N/A',
            '用户角色': this.isFirstUser ? '第一个用户' : '第二个用户',
            '移动设备': this.isMobile ? '是' : '否',
            '用户代理': navigator.userAgent,
            '协议': location.protocol,
            '主机': location.host
        };
        
        let debugText = '🔧 调试信息:\n\n';
        for (const [key, value] of Object.entries(debugInfo)) {
            debugText += `${key}: ${value}\n`;
        }
        
        alert(debugText);
        console.log('调试信息:', debugInfo);
    }
    
    resetUI() {
        this.callSection.style.display = 'none';
        this.joinRoomBtn.disabled = false;
        this.roomCodeInput.value = '';
        this.showStatus('waiting', '等待加入房间...');
        this.muteBtn.textContent = '静音';
        this.muteBtn.style.background = '#28a745';
        this.isMuted = false;
        this.roomCode = null;
        
        // 清除超时
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
        }
    }
    
    showStatus(type, message) {
        this.statusDiv.className = `status ${type}`;
        this.statusDiv.textContent = message;
    }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new VoiceCallApp();
});
