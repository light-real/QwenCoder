<template>
  <view class="container">
    <view class="brand">
      <text class="brand-dot"></text>
      <text class="brand-name">CryptoSim</text>
      <text class="brand-sub">模拟合约交易</text>
    </view>

    <!-- Tab 切换 -->
    <view class="tab-bar">
      <view :class="['tab', mode === 'login' ? 'active' : '']" @tap="mode = 'login'">登录</view>
      <view :class="['tab', mode === 'register' ? 'active' : '']" @tap="mode = 'register'">注册</view>
    </view>

    <!-- 表单 -->
    <view class="form">
      <view class="input-group">
        <text class="input-label">邮箱</text>
        <view class="input-wrap">
          <input
            class="input"
            type="text"
            v-model="email"
            placeholder="请输入邮箱"
            placeholder-class="input-placeholder"
            :disabled="loading"
          />
        </view>
      </view>

      <view class="input-group">
        <text class="input-label">密码</text>
        <view class="input-wrap">
          <input
            class="input"
            :type="showPassword ? 'text' : 'password'"
            v-model="password"
            placeholder="请输入密码（至少6位）"
            placeholder-class="input-placeholder"
            :disabled="loading"
          />
          <text class="eye-btn" @tap="showPassword = !showPassword">
            {{ showPassword ? '🙈' : '👁️' }}
          </text>
        </view>
      </view>

      <!-- 错误提示 -->
      <view class="error-msg" v-if="errorMsg">
        <text class="error-text">{{ errorMsg }}</text>
      </view>

      <!-- 提交按钮 -->
      <view :class="['submit-btn', loading ? 'loading' : '']" @tap="submit">
        <text class="submit-text">{{ loading ? '处理中...' : (mode === 'login' ? '登录' : '注册') }}</text>
      </view>

      <!-- 跳过登录 -->
      <view class="skip-btn" @tap="skipLogin">
        <text class="skip-text">暂不登录，以游客模式使用</text>
      </view>
    </view>

    <!-- 底部说明 -->
    <view class="footer">
      <text class="footer-text">登录后数据将同步到云端，多设备共享</text>
    </view>
  </view>
</template>

<script>
import userService from '../../utils/userService.js';

export default {
  data() {
    return {
      mode: 'login',
      email: '',
      password: '',
      showPassword: false,
      loading: false,
      errorMsg: '',
    };
  },

  methods: {
    async submit() {
      const email = this.email.trim();
      const password = this.password;

      if (!email || !password) {
        this.errorMsg = '邮箱和密码不能为空';
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        this.errorMsg = '请输入有效的邮箱地址';
        return;
      }
      if (password.length < 6) {
        this.errorMsg = '密码至少需要6位';
        return;
      }

      this.loading = true;
      this.errorMsg = '';

      try {
        if (this.mode === 'login') {
          await userService.signIn(email, password);
          uni.showToast({ title: '登录成功', icon: 'success', duration: 1500 });
        } else {
          await userService.signUp(email, password);
          uni.showToast({ title: '注册成功！', icon: 'success', duration: 1500 });
        }

        setTimeout(() => {
          this._goHome();
        }, 1500);
      } catch (err) {
        this.errorMsg = this._translateError(err.message);
      } finally {
        this.loading = false;
      }
    },

    skipLogin() {
      uni.showModal({
        title: '游客模式',
        content: '游客模式下数据仅保存在本设备，更换设备或清除数据后将丢失。确认继续？',
        confirmText: '继续',
        success: (res) => {
          if (res.confirm) {
            uni.setStorageSync('skipLogin', true);
            this._goHome();
          }
        },
      });
    },

    _goHome() {
      uni.reLaunch({ url: '/pages/index/index' });
    },

    _translateError(msg) {
      if (msg.includes('Invalid login credentials')) return '邮箱或密码错误';
      if (msg.includes('Email not confirmed')) return '邮箱或密码错误，请重新输入';
      if (msg.includes('User already registered')) return '该邮箱已注册，请直接登录';
      if (msg.includes('network')) return '网络错误，请检查网络连接';
      return msg;
    },
  },
};
</script>

<style>
.container {
  background: #0a0b0d;
  min-height: 100vh;
  padding: 80rpx 48rpx 60rpx;
  display: flex;
  flex-direction: column;
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 72rpx;
  padding-top: 40rpx;
}

.brand-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: #3b82f6;
  display: block;
  box-shadow: 0 0 16rpx rgba(59,130,246,0.8);
  margin-bottom: 20rpx;
}

.brand-name {
  font-size: 56rpx;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 0.04em;
  margin-bottom: 10rpx;
}

.brand-sub {
  font-size: 26rpx;
  color: #5a5f70;
  letter-spacing: 0.06em;
}

.tab-bar {
  display: flex;
  background: rgba(255,255,255,0.04);
  border-radius: 16rpx;
  padding: 6rpx;
  margin-bottom: 48rpx;
}

.tab {
  flex: 1;
  padding: 18rpx 0;
  text-align: center;
  font-size: 30rpx;
  font-weight: 600;
  color: #5a5f70;
  border-radius: 12rpx;
}

.tab.active {
  background: #1e2329;
  color: #e8eaf2;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.3);
}

.form {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.input-label {
  font-size: 24rpx;
  color: #5a5f70;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.input-wrap {
  display: flex;
  align-items: center;
  background: #13151a;
  border: 1rpx solid rgba(255,255,255,0.08);
  border-radius: 16rpx;
  padding: 28rpx 28rpx;
}

.input {
  flex: 1;
  font-size: 30rpx;
  color: #e8eaf2;
}

.input-placeholder {
  color: #3a3e50;
}

.eye-btn {
  font-size: 32rpx;
  padding-left: 16rpx;
}

.error-msg {
  background: rgba(255,83,83,0.08);
  border: 1rpx solid rgba(255,83,83,0.2);
  border-radius: 12rpx;
  padding: 18rpx 24rpx;
}

.error-text {
  font-size: 26rpx;
  color: #ff5353;
}

.submit-btn {
  background: #3b82f6;
  border-radius: 20rpx;
  padding: 34rpx 0;
  text-align: center;
  margin-top: 12rpx;
}

.submit-btn.loading {
  opacity: 0.6;
}

.submit-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.04em;
}

.skip-btn {
  padding: 20rpx 0;
  text-align: center;
}

.skip-text {
  font-size: 26rpx;
  color: #5a5f70;
  text-decoration: underline;
}

.footer {
  padding-top: 40rpx;
  text-align: center;
}

.footer-text {
  font-size: 22rpx;
  color: #3a3e50;
  letter-spacing: 0.02em;
}
</style>
