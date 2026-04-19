<script>
import userService from './utils/userService.js';

export default {
  async onLaunch() {
    // 初始化：检查登录态，云端/本地数据同步
    await userService.initialize();
  },

  methods: {
    // ─── 兼容旧代码的同步 API ──────────────────────────────
    getUserData() {
      return userService.getUserData();
    },
    updateUserData(data) {
      // 同步写本地，异步同步云端
      userService.updateUserDataSync(data);
    },
  },
};
</script>

<style>
/* ════════════════════════════════════════════════
   全局基础样式  —  极简暗色 / Binance 风格
   ════════════════════════════════════════════════ */
page {
  background-color: #0a0b0d;
  color: #e8eaf2;
  font-family: -apple-system, 'PingFang SC', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
}

.up   { color: #00c076; }
.down { color: #ff5353; }

.glass-card {
  background: rgba(255,255,255,0.035);
  border: 1rpx solid rgba(255,255,255,0.07);
  border-radius: 20rpx;
}

.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #9098b0;
  letter-spacing: 0.06em;
}

.empty-state {
  text-align: center;
  padding: 120rpx 0;
  color: #3a3d4a;
}

.empty-hint {
  font-size: 26rpx;
  color: #2e313c;
}
</style>
