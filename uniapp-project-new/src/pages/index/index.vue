<template>
  <view class="container">

    <!-- ══ 顶部资产区 ══ -->
    <view class="hero">
      <view class="hero-top">
        <view class="hero-logo">
          <text class="logo-dot"></text>
          <text class="logo-text">CryptoSim</text>
        </view>
        <text class="hero-time">{{ currentTime }}</text>
      </view>

      <view class="balance-block">
        <text class="balance-label">总资产（USDT）</text>
        <view class="balance-row">
          <text class="balance-num">{{ userData ? userData.cash : '0.00' }}</text>
        </view>
      </view>

      <!-- 光晕装饰 -->
      <view class="hero-glow"></view>
    </view>

    <!-- ══ Tab切换 ══ -->
    <view class="tab-bar">
      <view :class="['tab-item', showMode === 'favorite' ? 'active' : '']" @tap="switchMode('favorite')">
        <text class="tab-text">自选</text>
        <text class="tab-count">{{ favoriteCount }}</text>
      </view>
      <view :class="['tab-item', showMode === 'all' ? 'active' : '']" @tap="switchMode('all')">
        <text class="tab-text">全部</text>
        <text class="tab-count">{{ stocks.length }}</text>
      </view>
      <view class="tab-search" @tap="showSearchPanel">
        <text class="search-icon">🔍</text>
      </view>
    </view>

    <!-- ══ 行情列表 ══ -->
    <view class="market-wrap">
      <view v-if="loading" class="loading-wrap">
        <text class="loading-text">加载中...</text>
      </view>

      <view v-else-if="displayStocks.length === 0" class="empty-wrap">
        <text class="empty-icon">📋</text>
        <text class="empty-text">{{ showMode === 'favorite' ? '暂无自选' : '暂无数据' }}</text>
        <text class="empty-hint" v-if="showMode === 'favorite'" @tap="switchMode('all')">点击「全部」添加自选</text>
      </view>

      <view v-else class="coin-list">
        <view
          v-for="item in displayStocks"
          :key="item.code"
          class="coin-row"
          @tap="toTrade(item.code)"
        >
          <!-- 左：图标 -->
          <view class="coin-avatar" :style="coinAvatarStyle(item)">
            <text class="coin-letter" :style="{ color: item.color || '#ffffff' }">{{ item.symbol.charAt(0) }}</text>
          </view>

          <!-- 中：名称+代码 -->
          <view class="coin-meta">
            <text class="coin-sym">{{ item.symbol }}</text>
            <text class="coin-pair">{{ item.code }}</text>
          </view>

          <!-- 右：价格+涨跌 -->
          <view class="coin-right">
            <text class="coin-price">{{ item.currentPrice || '--' }}</text>
            <view :class="['coin-badge', item.change >= 0 ? 'green' : 'red']">
              <text>{{ item.change >= 0 ? '+' : '' }}{{ item.change || 0 }}%</text>
            </view>
          </view>

          <!-- 自选星标 -->
          <view class="coin-fav" @tap.stop="toggleFavorite(item.code)">
            <text :class="['fav-star', isFavorite(item.code) ? 'active' : '']">★</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ══ 搜索弹窗 ══ -->
    <view class="search-mask" v-if="searchVisible" @tap="hideSearchPanel">
      <view class="search-panel" @tap.stop>
        <view class="search-header">
          <view class="search-input-wrap">
            <text class="search-icon-small">🔍</text>
            <input
              class="search-input"
              type="text"
              v-model="searchKeyword"
              placeholder="搜索币种名称"
              placeholder-class="search-placeholder"
              focus
            />
            <text class="search-clear" v-if="searchKeyword" @tap="clearSearch">✕</text>
          </view>
          <text class="search-cancel" @tap="hideSearchPanel">取消</text>
        </view>

        <view class="search-result">
          <view
            v-for="item in searchResults"
            :key="item.code"
            class="search-row"
            @tap="selectSearchItem(item)"
          >
            <view class="coin-avatar small" :style="coinAvatarStyle(item)">
              <text class="coin-letter" :style="{ color: item.color || '#ffffff' }">{{ item.symbol.charAt(0) }}</text>
            </view>
            <view class="search-meta">
              <text class="search-sym">{{ item.symbol }}</text>
              <text class="search-code">{{ item.code }}</text>
            </view>
            <view class="search-fav" @tap.stop="toggleFavorite(item.code)">
              <text :class="['fav-star', isFavorite(item.code) ? 'active' : '']">★</text>
            </view>
          </view>

          <view v-if="searchKeyword && searchResults.length === 0" class="search-empty">
            <text class="search-empty-text">未找到「{{ searchKeyword }}」</text>
          </view>
        </view>
      </view>
    </view>

  </view>
</template>

<script>
import { getAllStocks, getFavorites, addFavorite, removeFavorite, isFavorite as checkFavorite } from '../../utils/stock.js';
import { getCurrentTime } from '../../utils/date.js';
import binanceService from '../../utils/binanceService.js';

export default {
  data() {
    return {
      stocks: [],
      displayStocks: [],
      userData: null,
      currentTime: '',
      showMode: 'favorite',
      favoriteCount: 0,
      loading: true,
      searchVisible: false,
      searchKeyword: '',
      searchResults: [],
    };
  },

  // 实例属性（非响应式）
  created() {
    this._priceMap = {};
    this._isFirstShow = true;
    this._timeTimer = null;
    this._tickerHandler = null;
    this._allSymbols = [];
  },

  async onLoad() {
    this._priceMap = {};

    this._tickerHandler = (ticker) => { this._onTickerUpdate(ticker); };
    binanceService.on('ticker', this._tickerHandler);

    this.currentTime = getCurrentTime();
    this._startClock();

    // 异步加载币种列表
    await this._loadSymbols();
  },

  onShow() {
    this._loadUserData();
    this._refreshFavoriteCount();
    if (this._isFirstShow) {
      this._isFirstShow = false;
      return;
    }

    // 检查 WebSocket 连接
    const wsSymbols = this._allSymbols.map(s => s.code.toLowerCase());
    const currentSymbols = binanceService.currentSymbols || [];
    const hasIndexSymbols = wsSymbols.every(sym => currentSymbols.indexOf(sym) > -1);

    if (!binanceService.isConnected || !hasIndexSymbols) {
      binanceService.reconnect(wsSymbols.slice(0, 20), []);
    }
  },

  onHide() {},

  onUnload() {
    if (this._timeTimer) clearInterval(this._timeTimer);
    if (this._tickerHandler) binanceService.off('ticker', this._tickerHandler);
    binanceService.close();
  },

  methods: {
    coinAvatarStyle(item) {
      const color = item.color || '#888888';
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return {
        background: 'rgba(' + r + ',' + g + ',' + b + ',0.12)',
        border: '1.5rpx solid rgba(' + r + ',' + g + ',' + b + ',0.25)',
      };
    },

    async _loadSymbols() {
      this.loading = true;
      try {
        const allSymbols = await getAllStocks();
        this._allSymbols = allSymbols;
        this.stocks = allSymbols;
        this._refreshDisplay();
        this._refreshFavoriteCount();
        this._loadAndSubscribe(allSymbols.slice(0, 50)); // 只订阅前50个
      } catch (err) {
        console.error('[Index] _loadSymbols failed:', err);
      } finally {
        this.loading = false;
      }
    },

    _refreshDisplay() {
      if (this.showMode === 'favorite') {
        const favCodes = getFavorites();
        this.displayStocks = this.stocks.filter(s => favCodes.indexOf(s.code) !== -1);
      } else {
        this.displayStocks = this.stocks;
      }
      this._flushStocks();
    },

    _refreshFavoriteCount() {
      this.favoriteCount = getFavorites().length;
    },

    switchMode(mode) {
      this.showMode = mode;
      this._refreshDisplay();
    },

    isFavorite(code) {
      return checkFavorite(code);
    },

    toggleFavorite(code) {
      if (this.isFavorite(code)) {
        removeFavorite(code);
      } else {
        addFavorite(code);
      }
      this._refreshFavoriteCount();
      this._refreshDisplay();
      // 强制刷新视图
      this.$forceUpdate();
    },

    showSearchPanel() {
      this.searchVisible = true;
      this.searchKeyword = '';
      this.searchResults = [];
    },

    hideSearchPanel() {
      this.searchVisible = false;
      this.searchKeyword = '';
      this.searchResults = [];
    },

    clearSearch() {
      this.searchKeyword = '';
      this.searchResults = [];
    },

    selectSearchItem(item) {
      this.hideSearchPanel();
      this.toTrade(item.code);
    },

    _startClock() {
      this._timeTimer = setInterval(() => {
        this.currentTime = getCurrentTime();
      }, 1000);
    },

    _loadAndSubscribe(stocks) {
      const self = this;
      const symbols = stocks.map(s => s.code);

      // 批量获取行情
      binanceService._fetchAllTickers(symbols)
        .then(function(tickers) {
          tickers.forEach(function(ticker) {
            if (!self._priceMap) self._priceMap = {};
            self._priceMap[ticker.symbol] = {
              currentPrice: ticker.closePrice,
              displayPrice: ticker.displayPrice,
              change: parseFloat(ticker.priceChangePercent),
              changeAmount: parseFloat(ticker.priceChange),
            };
            binanceService.setOpenPrice(
              ticker.symbol,
              ticker.closePrice - parseFloat(ticker.priceChange)
            );
          });
          self._flushStocks();
          self._updateTotalAssets();
        })
        .catch(function(err) {
          console.warn('[Index] fetchAllTickers failed:', err);
        });

      // 启动轮询（只轮询自选的币种）
      const favCodes = getFavorites();
      const pollSymbols = symbols.filter(s => favCodes.indexOf(s) !== -1);
      if (pollSymbols.length > 0) {
        binanceService.connect(pollSymbols.map(s => s.toLowerCase()), []);
      }
    },

    _onTickerUpdate(ticker) {
      if (!this._priceMap) this._priceMap = {};
      const sym = ticker.symbol;
      this._priceMap[sym] = {
        currentPrice: ticker.closePrice,
        displayPrice: ticker.displayPrice,
        change: parseFloat(ticker.priceChangePercent),
        changeAmount: parseFloat(ticker.priceChange),
      };
      this._flushStocks();
      this._updateTotalAssets();
    },

    _flushStocks() {
      const priceMap = this._priceMap || {};
      this.stocks = this.stocks.map(function(stock) {
        const p = priceMap[stock.code];
        if (!p) return stock;
        return Object.assign({}, stock, {
          currentPrice: p.displayPrice,
          change: p.change,
          changeAmount: p.changeAmount,
        });
      });
      this.displayStocks = this.displayStocks.map(function(stock) {
        const p = priceMap[stock.code];
        if (!p) return stock;
        return Object.assign({}, stock, {
          currentPrice: p.displayPrice,
          change: p.change,
          changeAmount: p.changeAmount,
        });
      });
    },

    _updateTotalAssets() {
      const app = getApp();
      const userData = app.getUserData();
      if (!userData) return;
      const priceMap = this._priceMap || {};
      let positionValue = 0;
      (userData.stocks || []).forEach(function(s) {
        const markPrice = (priceMap[s.code] && priceMap[s.code].currentPrice) || s.currentPrice || 0;
        const avgPrice = s.quantity > 0 ? s.cost / s.quantity : 0;
        const upnl = s.tradeType === 'buy'
          ? (markPrice - avgPrice) * s.quantity
          : (avgPrice - markPrice) * s.quantity;
        positionValue += (s.margin || 0) + upnl;
      });
      const totalAssets = (userData.cash || 0) + positionValue;
      const totalDisplay = Number(totalAssets).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      if (this.userData) {
        this.userData = Object.assign({}, this.userData, { cash: totalDisplay });
      }
    },

    _loadUserData() {
      const app = getApp();
      const userData = app.getUserData();
      if (!userData) return;
      const totalMargin = (userData.stocks || []).reduce((sum, s) => sum + (s.margin || 0), 0);
      const totalAssets = (userData.cash || 0) + totalMargin;
      const totalDisplay = Number(totalAssets).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      this.userData = Object.assign({}, userData, { cash: totalDisplay });
      if (this._priceMap && Object.keys(this._priceMap).length > 0) {
        this._updateTotalAssets();
      }
    },

    toTrade(code) {
      uni.navigateTo({
        url: `/pages/trade/trade?code=${code}`,
      });
    },
  },

  watch: {
    searchKeyword(val) {
      if (!val) {
        this.searchResults = [];
        return;
      }
      const keyword = val.toUpperCase();
      this.searchResults = this._allSymbols.filter(function(s) {
        return s.code.indexOf(keyword) !== -1 || s.symbol.indexOf(keyword) !== -1;
      }).slice(0, 20);
    }
  },
};
</script>

<style>
/* ══════════════════════════════════════════
   行情首页  —  极简暗色  OKX / Bybit 风格
   ══════════════════════════════════════════ */

.container {
  background: #0a0b0d;
  min-height: 100vh;
}

/* ── 顶部英雄区 ────────────────────────────── */
.hero {
  position: relative;
  overflow: hidden;
  padding: 48rpx 36rpx 52rpx;
  background: #0d0f14;
  border-bottom: 1rpx solid rgba(255,255,255,0.05);
}

.hero-glow {
  position: absolute;
  top: -80rpx;
  right: -60rpx;
  width: 340rpx;
  height: 340rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%);
  pointer-events: none;
}

.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 44rpx;
}

.hero-logo {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.logo-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #3b82f6;
  display: block;
  box-shadow: 0 0 8rpx rgba(59,130,246,0.8);
}

.logo-text {
  font-size: 30rpx;
  font-weight: 700;
  color: #e8eaf2;
  letter-spacing: 0.04em;
}

.hero-time {
  font-size: 24rpx;
  color: #3a3e50;
  letter-spacing: 0.02em;
}

.balance-block {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.balance-label {
  font-size: 24rpx;
  color: #4a4f66;
  letter-spacing: 0.04em;
  font-weight: 500;
}

.balance-row {
  display: flex;
  align-items: baseline;
}

.balance-num {
  font-size: 72rpx;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.03em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

/* ── Tab栏 ────────────────────────────── */
.tab-bar {
  display: flex;
  align-items: center;
  padding: 24rpx 24rpx 16rpx;
  gap: 16rpx;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 14rpx 28rpx;
  background: rgba(255,255,255,0.04);
  border-radius: 24rpx;
  border: 1rpx solid rgba(255,255,255,0.06);
}

.tab-item.active {
  background: rgba(59,130,246,0.15);
  border-color: rgba(59,130,246,0.3);
}

.tab-text {
  font-size: 28rpx;
  font-weight: 600;
  color: #848e9c;
}

.tab-item.active .tab-text {
  color: #3b82f6;
}

.tab-count {
  font-size: 22rpx;
  color: #5a5f70;
  background: rgba(255,255,255,0.06);
  padding: 2rpx 10rpx;
  border-radius: 10rpx;
}

.tab-item.active .tab-count {
  background: rgba(59,130,246,0.2);
  color: #3b82f6;
}

.tab-search {
  margin-left: auto;
  padding: 14rpx 20rpx;
  background: rgba(255,255,255,0.04);
  border-radius: 24rpx;
  border: 1rpx solid rgba(255,255,255,0.06);
}

.search-icon {
  font-size: 28rpx;
}

/* ── 行情列表区 ────────────────────────────── */
.market-wrap {
  padding: 0 24rpx 40rpx;
}

.loading-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 120rpx 0;
}

.loading-text {
  font-size: 28rpx;
  color: #5a5f70;
}

.empty-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
  gap: 16rpx;
}

.empty-icon {
  font-size: 80rpx;
}

.empty-text {
  font-size: 32rpx;
  color: #5a5f70;
  font-weight: 600;
}

.empty-hint {
  font-size: 26rpx;
  color: #3b82f6;
}

.coin-list {
  display: flex;
  flex-direction: column;
  background: #13151a;
  border-radius: 20rpx;
  overflow: hidden;
  border: 1rpx solid rgba(255,255,255,0.06);
}

.coin-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 28rpx 24rpx;
  background: transparent;
  border-bottom: 1rpx solid rgba(255,255,255,0.04);
  position: relative;
}

.coin-row:last-child {
  border-bottom: none;
}

.coin-row:active {
  background: rgba(255,255,255,0.03);
}

.coin-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.coin-avatar.small {
  width: 64rpx;
  height: 64rpx;
}

.coin-letter {
  font-size: 34rpx;
  font-weight: 800;
}

.coin-avatar.small .coin-letter {
  font-size: 28rpx;
}

.coin-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5rpx;
}

.coin-sym {
  font-size: 30rpx;
  font-weight: 700;
  color: #e8eaf2;
  letter-spacing: 0.02em;
}

.coin-pair {
  font-size: 22rpx;
  color: #3a3e50;
  letter-spacing: 0.04em;
}

.coin-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
}

.coin-price {
  font-size: 32rpx;
  font-weight: 700;
  color: #e8eaf2;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
}

.coin-badge {
  font-size: 22rpx;
  font-weight: 700;
  padding: 4rpx 14rpx;
  border-radius: 6rpx;
  letter-spacing: 0.02em;
}

.coin-badge.green {
  color: #00c076;
  background: rgba(0,192,118,0.1);
}

.coin-badge.red {
  color: #ff5353;
  background: rgba(255,83,83,0.1);
}

.coin-fav {
  padding: 10rpx;
  margin-left: 8rpx;
}

.fav-star {
  font-size: 36rpx;
  color: #3a3e50;
}

.fav-star.active {
  color: #f0b90b;
}

/* ── 搜索面板 ────────────────────────────── */
.search-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.7);
  z-index: 1000;
}

.search-panel {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: #0d0f14;
  border-radius: 0 0 32rpx 32rpx;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.search-header {
  display: flex;
  align-items: center;
  padding: 24rpx;
  gap: 16rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.06);
}

.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: #1a1d24;
  border-radius: 24rpx;
  padding: 16rpx 24rpx;
  gap: 12rpx;
}

.search-icon-small {
  font-size: 28rpx;
}

.search-input {
  flex: 1;
  font-size: 30rpx;
  color: #e8eaf2;
}

.search-placeholder {
  color: #5a5f70;
}

.search-clear {
  font-size: 28rpx;
  color: #5a5f70;
  padding: 8rpx;
}

.search-cancel {
  font-size: 28rpx;
  color: #3b82f6;
  font-weight: 600;
}

.search-result {
  flex: 1;
  overflow-y: auto;
  padding: 16rpx 24rpx;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 16rpx;
  border-radius: 16rpx;
}

.search-row:active {
  background: rgba(255,255,255,0.04);
}

.search-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.search-sym {
  font-size: 30rpx;
  font-weight: 600;
  color: #e8eaf2;
}

.search-code {
  font-size: 22rpx;
  color: #5a5f70;
}

.search-fav {
  padding: 8rpx;
}

.search-empty {
  display: flex;
  justify-content: center;
  padding: 80rpx 0;
}

.search-empty-text {
  font-size: 28rpx;
  color: #5a5f70;
}
</style>
