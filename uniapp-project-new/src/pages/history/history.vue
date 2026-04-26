<template>
  <view class="container">
    <!-- 顶部标题栏 -->
    <view class="header-card">
      <text class="header-title">交易记录</text>
      <text class="header-count">共 {{ history.length }} 笔</text>
    </view>

    <!-- 筛选 Tab -->
    <view class="filter-section">
      <view :class="['filter-btn', filterType === 'all' ? 'active' : '']" @tap="filterHistory('all')">全部</view>
      <view :class="['filter-btn', filterType === 'open' ? 'active open' : '']" @tap="filterHistory('open')">开仓</view>
      <view :class="['filter-btn', filterType === 'close' ? 'active close' : '']" @tap="filterHistory('close')">平仓</view>
    </view>

    <!-- 记录列表 -->
    <view class="history-list">
      <block v-if="filteredHistory.length > 0">
        <view v-for="(item, index) in filteredHistory" :key="index" class="history-card">

          <!-- 卡片头部 -->
          <view class="card-header">
            <view class="card-left">
              <view :class="['type-badge', item.typeClass]">{{ item.typeLabel }}</view>
              <view class="card-name-wrap">
                <text class="card-name">{{ item.name }}</text>
                <view class="card-meta">
                  <text class="card-code">{{ item.code }}</text>
                  <text class="card-leverage">{{ item.leverageStr }}</text>
                </view>
              </view>
            </view>
            <view class="card-right">
              <text :class="['card-amount', item.amountClass]">{{ item.amountVal }}</text>
              <text class="card-time">{{ item.time }}</text>
            </view>
          </view>

          <!-- 分割线 -->
          <view class="card-divider"></view>

          <!-- 卡片底部详情 -->
          <view class="card-stats">
            <view class="card-stat">
              <text class="stat-label">数量</text>
              <text class="stat-value">{{ item.qtyStr }} {{ item.symbol }}</text>
            </view>
            <view class="card-stat">
              <text class="stat-label">成交价</text>
              <text class="stat-value">{{ item.priceStr }} USDT</text>
            </view>
            <!-- 开仓：显示名义价值 -->
            <view class="card-stat" v-if="item.type === 'buy' || item.type === 'sell'">
              <text class="stat-label">名义价值</text>
              <text class="stat-value">{{ item.notionalStr }} USDT</text>
            </view>
            <!-- 平仓：显示平仓手续费 -->
            <view class="card-stat" v-if="item.type === 'close_buy' || item.type === 'close_sell'">
              <text class="stat-label">手续费</text>
              <text class="stat-value">{{ item.closeFeeStr }} USDT</text>
            </view>
          </view>

        </view>
      </block>

      <block v-else>
        <view class="empty-wrap">
          <text class="empty-icon">📋</text>
          <text class="empty-text">
            暂无{{ filterType === 'open' ? '开仓' : filterType === 'close' ? '平仓' : '' }}记录
          </text>
          <text class="empty-hint">完成第一笔交易后在此查看</text>
        </view>
      </block>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      history: [],
      filteredHistory: [],
      filterType: 'all',
    };
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  methods: {
    loadData() {
      const app = getApp();
      const userData = app.getUserData();
      const rawHistory = userData.history || [];
      const history = rawHistory.map(item => this._formatItem(item));
      this.history = history;
      this.filteredHistory = history;
      this.filterType = 'all';
    },

    _formatItem(item) {
      const type = item.type;
      const typeLabel = type === 'buy' ? '开多'
        : type === 'sell' ? '开空'
        : type === 'close_buy' ? '平多'
        : '平空';
      const typeClass = (type === 'buy' || type === 'close_sell') ? 'long' : 'short';

      let amountLabel, amountVal, amountClass;
      if (type === 'buy' || type === 'sell') {
        amountLabel = '保证金';
        amountVal = '-' + parseFloat(item.margin || 0).toFixed(2) + ' USDT';
        amountClass = 'amount-open';
      } else {
        const pnl = parseFloat(item.pnl || 0);
        amountLabel = '盈亏';
        amountVal = (pnl >= 0 ? '+' : '') + pnl.toFixed(2) + ' USDT';
        amountClass = pnl >= 0 ? 'amount-profit' : 'amount-loss';
      }

      const qty = parseFloat(item.quantity || 0).toFixed(6);
      const price = parseFloat(item.price || 0).toFixed(2);
      const leverage = item.leverage ? item.leverage + 'x' : '--';
      const notional = parseFloat(item.notional || item.amount || 0).toFixed(2);

      return {
        ...item,
        typeLabel,
        typeClass,
        amountLabel,
        amountVal,
        amountClass,
        qtyStr: qty,
        priceStr: price,
        leverageStr: leverage,
        notionalStr: notional,
        closeFeeStr: parseFloat(item.closeFee || 0).toFixed(2),
      };
    },

    filterHistory(type) {
      const { history } = this;
      let filteredHistory;
      if (type === 'all') {
        filteredHistory = history;
      } else if (type === 'open') {
        filteredHistory = history.filter(item => item.type === 'buy' || item.type === 'sell');
      } else {
        filteredHistory = history.filter(item => item.type === 'close_buy' || item.type === 'close_sell');
      }
      this.filterType = type;
      this.filteredHistory = filteredHistory;
    },
  },
};
</script>

<style>
/* ══════════════════════════════════════════
   历史记录页  —  高质感暗色 v2
   ══════════════════════════════════════════ */

.container {
  background: #080a0f;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding-bottom: 80rpx;
}

/* ── 顶部标题栏 ─────────────────────────── */
.header-card {
  background: linear-gradient(180deg, #0d1117 0%, #111827 100%);
  padding: 36rpx 32rpx 28rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-title {
  font-size: 38rpx;
  font-weight: 800;
  color: #f1f5f9;
  letter-spacing: 0.02em;
}

.header-count {
  font-size: 22rpx;
  color: #475569;
  background: rgba(255,255,255,0.05);
  padding: 6rpx 18rpx;
  border-radius: 24rpx;
  border: 1rpx solid rgba(255,255,255,0.07);
}

/* ── 筛选 Tab ────────────────────────────── */
.filter-section {
  display: flex;
  gap: 12rpx;
  padding: 16rpx 20rpx 10rpx;
}

.filter-btn {
  flex: 1;
  padding: 16rpx;
  text-align: center;
  border-radius: 16rpx;
  font-size: 26rpx;
  font-weight: 600;
  background: rgba(255,255,255,0.03);
  color: #475569;
  border: 1rpx solid rgba(255,255,255,0.05);
}

.filter-btn.active {
  background: rgba(59,130,246,0.12);
  color: #60a5fa;
  border-color: rgba(59,130,246,0.3);
  box-shadow: 0 0 12rpx rgba(59,130,246,0.12);
}

.filter-btn.active.open {
  background: rgba(16,185,129,0.12);
  color: #34d399;
  border-color: rgba(16,185,129,0.3);
  box-shadow: 0 0 12rpx rgba(16,185,129,0.12);
}

.filter-btn.active.close {
  background: rgba(239,68,68,0.12);
  color: #f87171;
  border-color: rgba(239,68,68,0.3);
  box-shadow: 0 0 12rpx rgba(239,68,68,0.12);
}

/* ── 记录列表 ─────────────────────────────── */
.history-list {
  flex: 1;
  padding: 12rpx 20rpx 0;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.history-card {
  background: rgba(15,20,30,0.85);
  border-radius: 24rpx;
  padding: 24rpx 26rpx;
  border: 1rpx solid rgba(255,255,255,0.07);
  box-shadow: 0 4rpx 24rpx rgba(0,0,0,0.4), inset 0 1rpx 0 rgba(255,255,255,0.04);
}

/* ── 卡片头部 ─────────────────────────────── */
.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.card-left {
  display: flex;
  align-items: center;
  gap: 18rpx;
  flex: 1;
}

.type-badge {
  flex-shrink: 0;
  width: 76rpx;
  height: 76rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 21rpx;
  font-weight: 700;
}

.type-badge.long  {
  background: rgba(16,185,129,0.12);
  color: #34d399;
  border: 1rpx solid rgba(16,185,129,0.18);
}
.type-badge.short {
  background: rgba(239,68,68,0.12);
  color: #f87171;
  border: 1rpx solid rgba(239,68,68,0.18);
}

.card-name-wrap { display: flex; flex-direction: column; gap: 6rpx; }

.card-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.card-leverage {
  font-size: 19rpx;
  color: #fbbf24;
  background: rgba(251,191,36,0.1);
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  border: 1rpx solid rgba(251,191,36,0.2);
}

.card-name { font-size: 28rpx; font-weight: 700; color: #f1f5f9; }
.card-code { font-size: 20rpx; color: #334155; letter-spacing: 0.06em; text-transform: uppercase; }

.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
}

.card-amount { font-size: 30rpx; font-weight: 700; font-variant-numeric: tabular-nums; }
.card-amount.amount-open   { color: #64748b; }
.card-amount.amount-profit { color: #34d399; }
.card-amount.amount-loss   { color: #f87171; }

.card-time { font-size: 20rpx; color: #334155; }

/* ── 分割线 ─────────────────────────────── */
.card-divider {
  height: 1rpx;
  background: rgba(255,255,255,0.05);
  margin: 18rpx 0;
}

/* ── 底部统计 ─────────────────────────────── */
.card-stats { display: flex; }

.card-stat {
  flex: 1;
  text-align: center;
  padding: 0 8rpx;
  border-right: 1rpx solid rgba(255,255,255,0.05);
}

.card-stat:last-child { border-right: none; }

.stat-label {
  font-size: 18rpx;
  color: #475569;
  margin-bottom: 7rpx;
  display: block;
  letter-spacing: 0.02em;
}

.stat-value {
  font-size: 22rpx;
  font-weight: 600;
  color: #e2e8f0;
  display: block;
  font-variant-numeric: tabular-nums;
}

.stat-value.pnl-up   { color: #34d399; }
.stat-value.pnl-down { color: #f87171; }

/* ── 空状态 ─────────────────────────────── */
.empty-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 0 60rpx;
  gap: 16rpx;
}

.empty-icon { font-size: 80rpx; }
.empty-text { font-size: 30rpx; color: #334155; font-weight: 600; }
.empty-hint { font-size: 24rpx; color: #1e293b; }
</style>
