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
/* ===== 历史记录页 ===== */
.container {
  background: linear-gradient(180deg, #0a0a14 0%, #0f0f1a 100%);
  min-height: 100vh;
  padding-bottom: 40rpx;
}

.header-card {
  background: linear-gradient(135deg, #0d0d22 0%, #151530 100%);
  padding: 40rpx 30rpx 28rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #ffffff;
}

.header-count {
  font-size: 24rpx;
  color: #555577;
  background: rgba(255,255,255,0.04);
  padding: 6rpx 18rpx;
  border-radius: 20rpx;
}

.filter-section {
  display: flex;
  gap: 14rpx;
  padding: 24rpx 24rpx 12rpx;
}

.filter-btn {
  flex: 1;
  padding: 18rpx;
  text-align: center;
  border-radius: 14rpx;
  font-size: 28rpx;
  font-weight: 600;
  background: rgba(255,255,255,0.04);
  color: #666688;
  border: 1rpx solid rgba(255,255,255,0.06);
}

.filter-btn.active {
  background: rgba(59,130,246,0.18);
  color: #3b82f6;
  border-color: rgba(59,130,246,0.4);
}

.filter-btn.active.open {
  background: rgba(14,203,129,0.15);
  color: #0ecb81;
  border-color: rgba(14,203,129,0.35);
}

.filter-btn.active.close {
  background: rgba(246,70,93,0.15);
  color: #f6465d;
  border-color: rgba(246,70,93,0.35);
}

.history-list {
  padding: 12rpx 24rpx 0;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.history-card {
  background: linear-gradient(135deg, #13132a 0%, #1b1b38 100%);
  border-radius: 22rpx;
  padding: 26rpx 28rpx;
  border: 1rpx solid rgba(255,255,255,0.06);
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.35);
}

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
  width: 80rpx;
  height: 80rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: 700;
}

.type-badge.long  { background: rgba(14,203,129,0.12); color: #0ecb81; }
.type-badge.short { background: rgba(246,70,93,0.12);  color: #f6465d; }

.card-name-wrap { display: flex; flex-direction: column; gap: 4rpx; }

.card-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.card-leverage {
  font-size: 20rpx;
  color: #f0b90b;
  background: rgba(240,185,11,0.1);
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
}

.card-name { font-size: 30rpx; font-weight: 700; color: #ffffff; }
.card-code { font-size: 22rpx; color: #5555aa; letter-spacing: 0.04em; }

.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
}

.card-amount { font-size: 32rpx; font-weight: 700; }
.card-amount.amount-open   { color: #848e9c; }
.card-amount.amount-profit { color: #0ecb81; }
.card-amount.amount-loss   { color: #f6465d; }

.card-time { font-size: 22rpx; color: #44446a; }

.card-divider {
  height: 1rpx;
  background: rgba(255,255,255,0.06);
  margin: 18rpx 0;
}

.card-stats { display: flex; }

.card-stat {
  flex: 1;
  text-align: center;
  padding: 0 8rpx;
  border-right: 1rpx solid rgba(255,255,255,0.06);
}

.card-stat:last-child { border-right: none; }

.stat-label {
  font-size: 20rpx;
  color: #666688;
  margin-bottom: 6rpx;
  display: block;
}

.stat-value {
  font-size: 24rpx;
  font-weight: 600;
  color: #ddddff;
  display: block;
}

.stat-value.pnl-up   { color: #26c97a; }
.stat-value.pnl-down { color: #f04c5a; }

.empty-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 0 60rpx;
  gap: 16rpx;
}

.empty-icon { font-size: 80rpx; }
.empty-text { font-size: 32rpx; color: #555577; font-weight: 600; }
.empty-hint { font-size: 26rpx; color: #444466; }
</style>
