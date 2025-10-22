class AuthApp {
    constructor() {
        this.initElements();
        this.initEventListeners();
        this.checkAuthStatus();
    }

    initElements() {
        // 根据页面类型初始化不同的元素
        if (document.getElementById('registerForm')) {
            this.form = document.getElementById('registerForm');
            this.submitBtn = document.getElementById('registerBtn');
            this.isRegister = true;
        } else if (document.getElementById('loginForm')) {
            this.form = document.getElementById('loginForm');
            this.submitBtn = document.getElementById('loginBtn');
            this.isRegister = false;
        }

        this.btnText = this.submitBtn.querySelector('.btn-text');
        this.btnLoading = this.submitBtn.querySelector('.btn-loading');
    }

    initEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // 实时验证
        if (this.isRegister) {
            this.initRegisterValidation();
        }
    }

    initRegisterValidation() {
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const qqInput = document.getElementById('qq');

        // 用户名验证
        usernameInput.addEventListener('input', () => {
            this.validateUsername(usernameInput.value);
        });

        // 密码验证
        passwordInput.addEventListener('input', () => {
            this.validatePassword(passwordInput.value);
            // 如果确认密码已填写，重新验证
            if (confirmPasswordInput.value) {
                this.validateConfirmPassword(confirmPasswordInput.value, passwordInput.value);
            }
        });

        // 确认密码验证
        confirmPasswordInput.addEventListener('input', () => {
            this.validateConfirmPassword(confirmPasswordInput.value, passwordInput.value);
        });

        // QQ号码验证
        qqInput.addEventListener('input', () => {
            this.validateQQ(qqInput.value);
        });
    }

    validateUsername(username) {
        const errorElement = document.getElementById('usernameError');
        
        if (!username) {
            errorElement.textContent = '用户名不能为空';
            return false;
        }
        
        if (username.length < 3) {
            errorElement.textContent = '用户名至少3个字符';
            return false;
        }
        
        if (username.length > 20) {
            errorElement.textContent = '用户名不能超过20个字符';
            return false;
        }
        
        if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
            errorElement.textContent = '用户名只能包含字母、数字、下划线和中文';
            return false;
        }
        
        errorElement.textContent = '';
        return true;
    }

    validatePassword(password) {
        const errorElement = document.getElementById('passwordError');
        
        if (!password) {
            errorElement.textContent = '密码不能为空';
            return false;
        }
        
        if (password.length < 6) {
            errorElement.textContent = '密码至少6个字符';
            return false;
        }
        
        errorElement.textContent = '';
        return true;
    }

    validateConfirmPassword(confirmPassword, password) {
        const errorElement = document.getElementById('confirmPasswordError');
        
        if (!confirmPassword) {
            errorElement.textContent = '请确认密码';
            return false;
        }
        
        if (confirmPassword !== password) {
            errorElement.textContent = '两次输入的密码不一致';
            return false;
        }
        
        errorElement.textContent = '';
        return true;
    }

    validateQQ(qq) {
        const errorElement = document.getElementById('qqError');
        
        if (!qq) {
            errorElement.textContent = 'QQ号码不能为空';
            return false;
        }
        
        if (!/^\d{5,11}$/.test(qq)) {
            errorElement.textContent = 'QQ号码必须是5-11位数字';
            return false;
        }
        
        errorElement.textContent = '';
        return true;
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (this.isRegister) {
            await this.handleRegister();
        } else {
            await this.handleLogin();
        }
    }

    async handleRegister() {
        const formData = new FormData(this.form);
        const userData = {
            username: formData.get('username'),
            password: formData.get('password'),
            gender: formData.get('gender'),
            qq: formData.get('qq')
        };

        // 验证所有字段
        const isValid = this.validateUsername(userData.username) &&
                       this.validatePassword(userData.password) &&
                       this.validateConfirmPassword(formData.get('confirmPassword'), userData.password) &&
                       this.validateQQ(userData.qq) &&
                       userData.gender;

        if (!isValid) {
            this.showMessage('请检查输入信息', 'error');
            return;
        }

        this.setLoading(true);

        try {
            console.log('发送注册请求:', userData);
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            console.log('注册响应状态:', response.status);
            const result = await response.json();
            console.log('注册响应结果:', result);

            if (result.success) {
                this.showMessage('注册成功！正在跳转到登录页面...', 'success');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('注册失败:', error);
            this.showMessage('网络错误，请稍后重试', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    async handleLogin() {
        const formData = new FormData(this.form);
        const loginData = {
            username: formData.get('username'),
            password: formData.get('password')
        };

        if (!loginData.username || !loginData.password) {
            this.showMessage('用户名和密码不能为空', 'error');
            return;
        }

        this.setLoading(true);

        try {
            console.log('发送登录请求:', loginData);
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(loginData)
            });

            console.log('登录响应状态:', response.status);
            const result = await response.json();
            console.log('登录响应结果:', result);

            if (result.success) {
                this.showMessage('登录成功！正在跳转到通话页面...', 'success');
                
                // 保存token到本地存储
                if (result.token) {
                    localStorage.setItem('authToken', result.token);
                    console.log('Token已保存到本地存储');
                }
                
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000);
            } else {
                this.showMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('登录失败:', error);
            this.showMessage('网络错误，请稍后重试', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(loading) {
        this.submitBtn.disabled = loading;
        
        if (loading) {
            this.submitBtn.classList.add('loading');
        } else {
            this.submitBtn.classList.remove('loading');
        }
    }

    showMessage(message, type) {
        // 移除现有消息
        const existingMessage = document.querySelector('.message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // 创建新消息
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;

        // 插入到表单前
        this.form.parentNode.insertBefore(messageDiv, this.form);

        // 3秒后自动移除
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }

    async checkAuthStatus() {
        try {
            const response = await fetch('/api/user');
            const result = await response.json();
            
            if (result.success) {
                // 用户已登录，跳转到主页面
                if (window.location.pathname.includes('login.html') || 
                    window.location.pathname.includes('register.html')) {
                    window.location.href = 'index.html';
                }
            }
        } catch (error) {
            console.log('检查登录状态失败:', error);
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new AuthApp();
});
