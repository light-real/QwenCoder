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
      <view class="guest-hero">
        <view class="guest-avatar">
          <text class="guest-icon">👤</text>
        </view>
        <text class="guest-title">游客模式</text>
        <text class="guest-hint">登录后数据将同步到云端，多设备共享，不丢失</text>
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
      // totalAssets 已经在每次交易时更新（cash + 持仓保证金），直接用
      // 但持仓有浮动盈亏，需要从 userData.profit 取（已在开/平仓时实时更新）
      const totalMargin = (data.stocks || []).reduce((s, p) => s + (p.margin || 0), 0);
      const total = (data.cash || 0) + totalMargin;
      this.totalAssets = Number(total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      // profit = 总资产 - 初始资金，亏损时为负数
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
/* ══════════════════════════════════════════
   我的页  —  高质感暗色 v2
   ══════════════════════════════════════════ */

.container {
  background: #080a0f;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding-bottom: 100rpx;
}

.up   { color: #34d399; }
.down { color: #f87171; }

/* 已登录 / 未登录 公共布局 */
.logged-in, .not-logged-in {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0;
}

/* ── 顶部 Hero 区 ─────────────────────────── */
.avatar-wrap {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 52rpx 40rpx 44rpx;
  background: linear-gradient(180deg, #0d1117 0%, #111827 60%, #080a0f 100%);
  position: relative;
  overflow: hidden;
  margin-bottom: 24rpx;
}

.avatar-wrap::before {
  content: '';
  position: absolute;
  top: -80rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 500rpx;
  height: 500rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%);
  pointer-events: none;
}

.avatar {
  width: 130rpx;
  height: 130rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2));
  border: 2rpx solid rgba(59,130,246,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 22rpx;
  box-shadow: 0 0 40rpx rgba(59,130,246,0.2), 0 8rpx 24rpx rgba(0,0,0,0.4);
}

.avatar-letter {
  font-size: 56rpx;
  font-weight: 800;
  background: linear-gradient(135deg, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.email {
  font-size: 28rpx;
  color: #e2e8f0;
  font-weight: 600;
  margin-bottom: 14rpx;
  letter-spacing: 0.02em;
}

.sync-badge {
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: rgba(16,185,129,0.1);
  border: 1rpx solid rgba(16,185,129,0.25);
  border-radius: 24rpx;
  padding: 8rpx 20rpx;
}

.sync-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #34d399;
  display: block;
  box-shadow: 0 0 6rpx rgba(52,211,153,0.8);
}

.sync-text {
  font-size: 21rpx;
  color: #34d399;
  font-weight: 500;
}

/* ── 未登录 Hero 区 ─────────────────────── */
.guest-hero {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 52rpx 40rpx 44rpx;
  background: linear-gradient(180deg, #0d1117 0%, #111827 60%, #080a0f 100%);
  position: relative;
  overflow: hidden;
  margin-bottom: 24rpx;
}

.guest-hero::before {
  content: '';
  position: absolute;
  top: -80rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 500rpx;
  height: 500rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(100,116,139,0.08) 0%, transparent 65%);
  pointer-events: none;
}

/* ── 未登录 头像 ─────────────────────────── */
.guest-avatar {
  width: 130rpx;
  height: 130rpx;
  border-radius: 50%;
  background: rgba(255,255,255,0.04);
  border: 2rpx solid rgba(255,255,255,0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 22rpx;
  box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.4);
}

.guest-icon { font-size: 64rpx; }

.guest-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #e2e8f0;
  margin-bottom: 12rpx;
  letter-spacing: 0.02em;
}

.guest-hint {
  font-size: 24rpx;
  color: #475569;
  text-align: center;
  line-height: 1.7;
  margin-bottom: 0;
  padding: 0 20rpx;
}

/* 统计卡 */
.stat-cards {
  display: flex;
  gap: 16rpx;
  width: 100%;
  margin-bottom: 20rpx;
  padding: 0 24rpx;
}

.stat-card {
  flex: 1;
  background: rgba(15,20,30,0.8);
  border-radius: 22rpx;
  padding: 30rpx 20rpx;
  text-align: center;
  border: 1rpx solid rgba(255,255,255,0.07);
  box-shadow: 0 4rpx 24rpx rgba(0,0,0,0.35), inset 0 1rpx 0 rgba(255,255,255,0.04);
}

.stat-label {
  font-size: 20rpx;
  color: #475569;
  display: block;
  margin-bottom: 12rpx;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.stat-val {
  font-size: 30rpx;
  font-weight: 700;
  color: #e2e8f0;
  font-variant-numeric: tabular-nums;
}

/* 登录按钮 */
.login-btn {
  width: calc(100% - 48rpx);
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  border-radius: 24rpx;
  padding: 32rpx 0;
  text-align: center;
  margin-bottom: 20rpx;
  box-shadow: 0 8rpx 32rpx rgba(59,130,246,0.35);
}

.login-btn-text {
  font-size: 30rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.04em;
}

/* 菜单列表 */
.menu-list {
  width: calc(100% - 48rpx);
  background: rgba(15,20,30,0.8);
  border-radius: 22rpx;
  overflow: hidden;
  border: 1rpx solid rgba(255,255,255,0.07);
  box-shadow: 0 4rpx 24rpx rgba(0,0,0,0.35), inset 0 1rpx 0 rgba(255,255,255,0.04);
  margin-bottom: 24rpx;
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
  color: #e2e8f0;
  font-weight: 500;
}

.menu-item.danger .menu-label { color: #f87171; }

.menu-arrow {
  font-size: 34rpx;
  color: #1e293b;
  font-weight: 300;
}
</style>
