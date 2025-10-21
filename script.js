class VoiceCallApp {
    constructor() {
        this.socket = null;
        this.localStream = null;
        this.peerConnection = null;
        this.roomCode = null;
        this.isMuted = false;
        
        this.initElements();
        this.initEventListeners();
        this.initSocket();
    }
    
    initElements() {
        this.roomCodeInput = document.getElementById('roomCode');
        this.joinRoomBtn = document.getElementById('joinRoom');
        this.statusDiv = document.getElementById('status');
        this.callSection = document.getElementById('callSection');
        this.muteBtn = document.getElementById('muteBtn');
        this.hangupBtn = document.getElementById('hangupBtn');
        this.currentRoomSpan = document.getElementById('currentRoom');
        this.connectionStatusSpan = document.getElementById('connectionStatus');
    }
    
    initEventListeners() {
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        this.hangupBtn.addEventListener('click', () => this.hangup());
        
        this.roomCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinRoom();
            }
        });
        
        this.roomCodeInput.addEventListener('input', (e) => {
            // 只允许输入数字
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
    }
    
    initSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('已连接到服务器');
        });
        
        this.socket.on('roomJoined', (data) => {
            this.handleRoomJoined(data);
        });
        
        this.socket.on('userJoined', (data) => {
            this.handleUserJoined(data);
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
        const roomCode = this.roomCodeInput.value.trim();
        
        if (!roomCode || roomCode.length !== 4) {
            this.showStatus('error', '请输入4位数字的房间号码');
            return;
        }
        
        this.roomCode = roomCode;
        this.joinRoomBtn.disabled = true;
        this.showStatus('connecting', '正在加入房间...');
        
        try {
            // 获取麦克风权限
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });
            
            // 加入房间
            this.socket.emit('joinRoom', { roomCode });
            
        } catch (error) {
            console.error('获取麦克风权限失败:', error);
            this.showStatus('error', '无法访问麦克风，请检查权限设置');
            this.joinRoomBtn.disabled = false;
        }
    }
    
    handleRoomJoined(data) {
        this.showStatus('connected', `已加入房间 ${this.roomCode}`);
        this.currentRoomSpan.textContent = this.roomCode;
        this.callSection.style.display = 'block';
        this.connectionStatusSpan.textContent = '等待其他用户加入...';
        
        if (data.isFirstUser) {
            this.connectionStatusSpan.textContent = '您是第一个用户，等待其他用户加入...';
        }
    }
    
    handleUserJoined(data) {
        console.log('用户加入:', data);
        this.connectionStatusSpan.textContent = '用户已加入，正在建立连接...';
        this.createPeerConnection();
        this.createOffer();
    }
    
    async createPeerConnection() {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        this.peerConnection = new RTCPeerConnection(configuration);
        
        // 添加本地流
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });
        
        // 处理远程流
        this.peerConnection.ontrack = (event) => {
            console.log('收到远程音频流');
            this.connectionStatusSpan.textContent = '通话已连接';
        };
        
        // 处理ICE候选
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('iceCandidate', {
                    roomCode: this.roomCode,
                    candidate: event.candidate
                });
            }
        };
        
        // 处理连接状态变化
        this.peerConnection.onconnectionstatechange = () => {
            console.log('连接状态:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'connected') {
                this.connectionStatusSpan.textContent = '通话已连接';
            } else if (this.peerConnection.connectionState === 'disconnected') {
                this.connectionStatusSpan.textContent = '连接已断开';
            }
        };
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
            await this.peerConnection.setRemoteDescription(data.offer);
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.socket.emit('answer', {
                roomCode: this.roomCode,
                answer: answer
            });
        } catch (error) {
            console.error('处理offer失败:', error);
        }
    }
    
    async handleAnswer(data) {
        try {
            await this.peerConnection.setRemoteDescription(data.answer);
        } catch (error) {
            console.error('处理answer失败:', error);
        }
    }
    
    async handleIceCandidate(data) {
        try {
            await this.peerConnection.addIceCandidate(data.candidate);
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
                    this.muteBtn.textContent = '🔊 取消静音';
                    this.muteBtn.style.background = '#ffc107';
                } else {
                    this.muteBtn.textContent = '🔇 静音';
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
        
        if (this.socket) {
            this.socket.emit('leaveRoom', { roomCode: this.roomCode });
        }
        
        this.resetUI();
    }
    
    resetUI() {
        this.callSection.style.display = 'none';
        this.joinRoomBtn.disabled = false;
        this.roomCodeInput.value = '';
        this.showStatus('waiting', '等待加入房间...');
        this.muteBtn.textContent = '🔇 静音';
        this.muteBtn.style.background = '#28a745';
        this.isMuted = false;
        this.roomCode = null;
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
