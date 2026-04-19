<template>
  <view class="container">
    <!-- 已登录 -->
    <view v-if="user" class="logged-in">
      <view class="avatar-wrap">
        <view class="avatar">
          <text class="avatar-letter">{{ email.charAt(0).toUpperCase() }}</text>
        </view>
        <text class="email">{{ email }}</text>
        <view class="sync-badge">
          <text class="sync-dot"></text>
          <text class="sync-text">已同步至云端</text>
        </view>
      </view>

      <view class="stat-cards">
        <view class="stat-card">
          <text class="stat-label">总资产</text>
          <text class="stat-val">{{ totalAssets }} USDT</text>
        </view>
        <view class="stat-card">
          <text class="stat-label">累计盈亏</text>
          <text :class="['stat-val', profit >= 0 ? 'up' : 'down']">
            {{ profit >= 0 ? '+' : '' }}{{ profit }} USDT
          </text>
        </view>
      </view>

      <view class="menu-list">
        <view class="menu-item" @tap="syncNow">
          <text class="menu-icon">☁️</text>
          <text class="menu-label">立即同步数据</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="confirmReset">
          <text class="menu-icon">🔄</text>
          <text class="menu-label">重置账户（清空数据）</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item danger" @tap="confirmLogout">
          <text class="menu-icon">🚪</text>
          <text class="menu-label">退出登录</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 未登录 -->
    <view v-else class="not-logged-in">
      <view class="guest-avatar">
        <text class="guest-icon">👤</text>
      </view>
      <text class="guest-title">游客模式</text>
      <text class="guest-hint">登录后数据将同步到云端，多设备共享，不丢失</text>

      <view class="stat-cards">
        <view class="stat-card">
          <text class="stat-label">总资产</text>
          <text class="stat-val">{{ totalAssets }} USDT</text>
        </view>
        <view class="stat-card">
          <text class="stat-label">累计盈亏</text>
          <text :class="['stat-val', profit >= 0 ? 'up' : 'down']">
            {{ profit >= 0 ? '+' : '' }}{{ profit }} USDT
          </text>
        </view>
      </view>

      <view class="login-btn" @tap="goLogin">
        <text class="login-btn-text">登录 / 注册</text>
      </view>

      <view class="menu-list">
        <view class="menu-item danger" @tap="confirmReset">
          <text class="menu-icon">🔄</text>
          <text class="menu-label">重置账户（清空数据）</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import userService from '../../utils/userService.js';

export default {
  data() {
    return {
      user: null,
      email: '',
      totalAssets: '0.00',
      profit: '0.00',
    };
  },

  async onShow() {
    this.user = await userService.getUser();
    if (this.user) {
      this.email = this.user.email || '';
    }
    this._loadStats();
  },

  methods: {
    _loadStats() {
      const data = userService.getUserData();
      const totalMargin = (data.stocks || []).reduce((s, p) => s + (p.margin || 0), 0);
      const total = (data.cash || 0) + totalMargin;
      this.totalAssets = Number(total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const pnl = total - 10000;
      this.profit = pnl.toFixed(2);
    },

    async syncNow() {
      uni.showLoading({ title: '同步中...', mask: true });
      try {
        const data = userService.getUserData();
        await userService.updateUserData(data);
        uni.showToast({ title: '同步成功', icon: 'success' });
      } catch (e) {
        uni.showToast({ title: '同步失败', icon: 'none' });
      } finally {
        uni.hideLoading();
      }
    },

    confirmLogout() {
      uni.showModal({
        title: '退出登录',
        content: '退出后数据将保留在本地，下次登录可恢复云端数据',
        confirmText: '退出',
        success: async (res) => {
          if (res.confirm) {
            await userService.signOut();
            this.user = null;
            this.email = '';
            uni.showToast({ title: '已退出', icon: 'none' });
          }
        },
      });
    },

    confirmReset() {
      uni.showModal({
        title: '⚠️ 重置账户',
        content: '将清空所有持仓和交易记录，余额恢复为 10,000 USDT。此操作不可撤销！',
        confirmText: '确认重置',
        confirmColor: '#ff5353',
        success: async (res) => {
          if (res.confirm) {
            const freshData = {
              cash: 10000,
              stocks: [],
              history: [],
              totalAssets: 10000,
              profit: 0,
            };
            await userService.updateUserData(freshData);
            this._loadStats();
            uni.showToast({ title: '账户已重置', icon: 'success' });
          }
        },
      });
    },

    goLogin() {
      uni.navigateTo({ url: '/pages/auth/auth' });
    },
  },
};
</script>

<style>
.container {
  background: #0a0b0d;
  min-height: 100vh;
  padding-bottom: 60rpx;
}

.up   { color: #00c076; }
.down { color: #ff5353; }

/* 已登录 */
.logged-in, .not-logged-in {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 40rpx 0;
}

.avatar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 48rpx;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(59,130,246,0.2);
  border: 2rpx solid rgba(59,130,246,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
}

.avatar-letter {
  font-size: 52rpx;
  font-weight: 800;
  color: #3b82f6;
}

.email {
  font-size: 30rpx;
  color: #e8eaf2;
  font-weight: 600;
  margin-bottom: 12rpx;
}

.sync-badge {
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: rgba(0,192,118,0.1);
  border: 1rpx solid rgba(0,192,118,0.3);
  border-radius: 20rpx;
  padding: 6rpx 16rpx;
}

.sync-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #00c076;
  display: block;
}

.sync-text {
  font-size: 22rpx;
  color: #00c076;
}

/* 未登录 */
.guest-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(255,255,255,0.06);
  border: 2rpx solid rgba(255,255,255,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20rpx;
}

.guest-icon { font-size: 60rpx; }

.guest-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #e8eaf2;
  margin-bottom: 12rpx;
}

.guest-hint {
  font-size: 24rpx;
  color: #5a5f70;
  text-align: center;
  line-height: 1.6;
  margin-bottom: 40rpx;
  padding: 0 20rpx;
}

/* 统计卡 */
.stat-cards {
  display: flex;
  gap: 20rpx;
  width: 100%;
  margin-bottom: 48rpx;
}

.stat-card {
  flex: 1;
  background: #13151a;
  border-radius: 20rpx;
  padding: 28rpx 20rpx;
  text-align: center;
  border: 1rpx solid rgba(255,255,255,0.06);
}

.stat-label {
  font-size: 22rpx;
  color: #5a5f70;
  display: block;
  margin-bottom: 10rpx;
}

.stat-val {
  font-size: 28rpx;
  font-weight: 700;
  color: #e8eaf2;
  font-variant-numeric: tabular-nums;
}

/* 登录按钮 */
.login-btn {
  width: 100%;
  background: #3b82f6;
  border-radius: 20rpx;
  padding: 34rpx 0;
  text-align: center;
  margin-bottom: 40rpx;
}

.login-btn-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #ffffff;
}

/* 菜单列表 */
.menu-list {
  width: 100%;
  background: #13151a;
  border-radius: 20rpx;
  overflow: hidden;
  border: 1rpx solid rgba(255,255,255,0.06);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 32rpx 28rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.04);
}

.menu-item:last-child { border-bottom: none; }
.menu-item:active { background: rgba(255,255,255,0.03); }

.menu-icon { font-size: 36rpx; }

.menu-label {
  flex: 1;
  font-size: 28rpx;
  color: #e8eaf2;
  font-weight: 500;
}

.menu-item.danger .menu-label { color: #ff5353; }

.menu-arrow {
  font-size: 36rpx;
  color: #3a3e50;
}
</style>
