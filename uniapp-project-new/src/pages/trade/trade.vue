<template>
  <view class="container">

    <!-- ① 顶部行情栏 -->
    <view class="top-bar">
      <view class="top-coin">
        <text class="top-coin-name">{{ stock ? stock.code : '' }}</text>
        <text class="top-coin-sub">永续</text>
      </view>
      <view class="top-change-only">
        <text :class="['top-change', priceChangePercent >= 0 ? 'up' : 'down']">
          {{ priceChangePercent >= 0 ? '+' : '' }}{{ priceChangePercent }}%
        </text>
      </view>
    </view>

    <!-- ② 核心区：左侧下单 + 右侧盘口 -->
    <view class="main-body">

      <!-- 左：下单区 -->
      <view class="order-panel">

        <!-- 做多 / 做空 Tab -->
        <view class="trade-tabs">
          <view
            :class="['trade-tab', tradeType === 'buy' ? 'active-buy' : '']"
            @tap="switchTradeType('buy')"
          >做多</view>
          <view
            :class="['trade-tab', tradeType === 'sell' ? 'active-sell' : '']"
            @tap="switchTradeType('sell')"
          >做空</view>
        </view>

        <!-- 杠杆选择 -->
        <view class="leverage-section">
          <view class="leverage-header">
            <text class="leverage-label">杠杆倍数</text>
            <text class="leverage-hint">1 - 150</text>
          </view>
          <view class="lev-input-box">
            <input
              class="lev-input"
              type="number"
              :value="leverage"
              @input="onLeverageInput"
              @blur="onLeverageBlur"
              placeholder="输入杠杆"
              maxlength="3"
            />
            <text class="lev-input-unit">x</text>
          </view>
        </view>

        <!-- 开仓金额输入框（USDT）-->
        <view class="input-row">
          <text class="input-hint">开仓金额 (USDT)</text>
          <view class="input-box">
            <input
              class="qty-input"
              type="digit"
              :value="notionalInput"
              @input="inputMargin"
              placeholder="0.00"
            />
            <text class="input-unit">USDT</text>
          </view>
        </view>

        <!-- 百分比快捷 -->
        <view class="pct-row">
          <view :class="['pct-btn', pctIndex === 0 ? 'pct-active' : '']" @tap="setPctMargin(0.25, 0)">25%</view>
          <view class="pct-line"></view>
          <view :class="['pct-btn', pctIndex === 1 ? 'pct-active' : '']" @tap="setPctMargin(0.5, 1)">50%</view>
          <view class="pct-line"></view>
          <view :class="['pct-btn', pctIndex === 2 ? 'pct-active' : '']" @tap="setPctMargin(0.75, 2)">75%</view>
          <view class="pct-line"></view>
          <view :class="['pct-btn', pctIndex === 3 ? 'pct-active' : '']" @tap="setPctMargin(1, 3)">100%</view>
        </view>

        <!-- 可用余额 -->
        <view class="avail-row">
          <text class="avail-label">可用余额</text>
          <text class="avail-value">{{ cashDisplay }} USDT</text>
        </view>

        <!-- 计算汇总 -->
        <view class="summary-block">
          <view class="summary-row">
            <text class="sum-label">所需保证金</text>
            <text class="sum-val">{{ marginValue }} USDT</text>
          </view>
          <view class="summary-row">
            <text class="sum-label">开仓数量</text>
            <text class="sum-val">{{ openQty }} {{ stock ? stock.symbol : '' }}</text>
          </view>
          <view class="summary-row">
            <text class="sum-label">手续费</text>
            <text class="sum-val">{{ commission }} USDT</text>
          </view>
          <view class="summary-row highlight">
            <text class="sum-label">预计强平价</text>
            <text :class="['sum-val liq-price', tradeType === 'buy' ? 'down' : 'up']">{{ liqPrice }}</text>
          </view>
        </view>

        <!-- 下单按钮 -->
        <button
          :class="['submit-btn', tradeType]"
          :disabled="!canTrade"
          @tap="confirmTrade"
        >
          {{ tradeType === 'buy' ? '做多' : '做空' }} {{ stock ? stock.symbol : '' }}  {{ leverage }}x
        </button>

      </view>

      <!-- 右：盘口 -->
      <view class="orderbook-panel">
        <view class="ob-header">
          <text class="ob-col-label">价格(USDT)</text>
          <text class="ob-col-label right">数量</text>
        </view>

        <!-- 卖单（红，从高到低展示） -->
        <view v-for="(item, idx) in asks" :key="'ask'+idx" class="ob-row ask">
          <text class="ob-price ask-price">{{ item.price }}</text>
          <text class="ob-qty">{{ item.qty }}</text>
        </view>

        <!-- 最新成交价 -->
        <view class="ob-mid">
          <text :class="['ob-mid-price', priceChangePercent >= 0 ? 'up' : 'down']">{{ currentPrice }}</text>
        </view>

        <!-- 买单（绿，从高到低） -->
        <view v-for="(item, idx) in bids" :key="'bid'+idx" class="ob-row bid">
          <text class="ob-price bid-price">{{ item.price }}</text>
          <text class="ob-qty">{{ item.qty }}</text>
        </view>
      </view>

    </view>

    <!-- ③ K线图区（展开状态） -->
    <view class="kline-section" v-if="klineExpanded">
      <!-- 展开状态的 header -->
      <view class="kline-header" @tap="toggleKline">
        <view class="kline-header-left">
          <text class="kline-header-title">{{ stock ? stock.code : '' }} K线图表</text>
        </view>
        <text class="kline-toggle-icon expanded">▾</text>
      </view>

      <!-- 周期选择 -->
      <view class="interval-bar">
        <view
          v-for="item in intervalList"
          :key="item.val"
          :class="['interval-btn', klineInterval === item.val ? 'active' : '']"
          @tap="switchKlineInterval(item.val)"
        >{{ item.label }}</view>
      </view>

      <!-- MA 值指示行 -->
      <view class="ma-legend" v-if="showMA5 || showMA10">
        <text class="ma-item ma5" v-if="showMA5">MA5</text>
        <text class="ma-item ma10" v-if="showMA10">MA10</text>
      </view>

      <!-- K线 Canvas -->
      <view class="kline-wrap">
        <canvas
          canvas-id="klineCanvas"
          class="kline-canvas"
          @touchstart="onKLineTouchStart"
          @touchmove="onKLineTouchMove"
          @touchend="onKLineTouchEnd"
          @touchcancel="onKLineTouchEnd"
        ></canvas>

        <!-- 缩放提示（右上角）-->
        <view class="kline-zoom-hint" v-if="zoomHintVisible">
          <text class="kline-zoom-hint-text">{{ zoomHintText }}</text>
        </view>

        <!-- 长按 OHLC 浮层 tooltip（悬浮在图表左上角）-->
        <view class="kline-tooltip" v-if="klineInfo">
          <view class="tooltip-row-top">
            <text class="tooltip-date">{{ klineInfo.date }}</text>
            <text :class="['tooltip-chg', klineInfo.isUp ? 'up' : 'down']">
              {{ klineInfo.isUp ? '▲' : '▼' }} {{ klineInfo.changeStr }}%
            </text>
          </view>
          <view class="tooltip-grid">
            <view class="tooltip-item">
              <text class="tooltip-label">开</text>
              <text class="tooltip-val">{{ klineInfo.open }}</text>
            </view>
            <view class="tooltip-item">
              <text class="tooltip-label">高</text>
              <text class="tooltip-val up">{{ klineInfo.high }}</text>
            </view>
            <view class="tooltip-item">
              <text class="tooltip-label">低</text>
              <text class="tooltip-val down">{{ klineInfo.low }}</text>
            </view>
            <view class="tooltip-item">
              <text class="tooltip-label">收</text>
              <text :class="['tooltip-val', klineInfo.isUp ? 'up' : 'down']">{{ klineInfo.close }}</text>
            </view>
            <view class="tooltip-item">
              <text class="tooltip-label">量</text>
              <text class="tooltip-val vol">{{ klineInfo.volumeStr }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 指标切换 -->
      <view class="tools-bar">
        <view :class="['tool-btn', showMA5 ? 'active' : '']" @tap="toggleMA5">MA5</view>
        <view :class="['tool-btn', showMA10 ? 'active' : '']" @tap="toggleMA10">MA10</view>
        <view :class="['tool-btn', showVolume ? 'active' : '']" @tap="toggleVolume">成交量</view>
      </view>
    </view>

    <!-- ④ 持仓区（K线收起时显示） -->
    <view class="position-section" v-if="!klineExpanded">

      <!-- Tab 栏 -->
      <view class="pos-tabs">
        <view :class="['pos-tab', posTab === 'holding' ? 'pos-tab-active' : '']" @tap="switchPosTab('holding')">
          持有仓位 ({{ currentPositions.length }})
        </view>
        <view :class="['pos-tab', posTab === 'orders' ? 'pos-tab-active' : '']" @tap="switchPosTab('orders')">
          当前委托 (0)
        </view>
      </view>

      <!-- 持有仓位列表 -->
      <view v-if="posTab === 'holding'">
        <view class="pos-empty" v-if="currentPositions.length === 0">
          <text class="pos-empty-text">暂无持仓</text>
        </view>
        <view v-for="item in currentPositions" :key="item.code" class="pos-card">
          <view class="pos-card-top">
            <view class="pos-card-left">
              <text class="pos-code">{{ item.code }}</text>
              <view :class="['pos-side-badge', item.tradeType === 'buy' ? 'badge-long' : 'badge-short']">
                {{ item.tradeType === 'buy' ? '做多' : '做空' }} {{ item.leverage }}x
              </view>
            </view>
            <view class="pos-card-right">
              <text :class="['pos-pnl', item.pnl >= 0 ? 'up' : 'down']">
                {{ item.pnl >= 0 ? '+' : '' }}{{ item.pnlStr }} USDT
              </text>
              <text :class="['pos-pnl-pct', item.pnl >= 0 ? 'up' : 'down']">({{ item.pnlPctStr }}%)</text>
            </view>
          </view>
          <view class="pos-card-body">
            <view class="pos-info-col">
              <text class="pos-info-label">数量</text>
              <text class="pos-info-val">{{ item.qtyStr }} {{ item.symbol }}</text>
            </view>
            <view class="pos-info-col">
              <text class="pos-info-label">开仓均价</text>
              <text class="pos-info-val">{{ item.avgPriceStr }}</text>
            </view>
            <view class="pos-info-col">
              <text class="pos-info-label">标记价格</text>
              <text class="pos-info-val">{{ currentPrice }}</text>
            </view>
            <view class="pos-info-col">
              <text class="pos-info-label">保证金</text>
              <text class="pos-info-val">{{ item.marginStr }} USDT</text>
            </view>
            <view class="pos-info-col">
              <text class="pos-info-label">强平价</text>
              <text class="pos-info-val down">{{ item.liqPrice }}</text>
            </view>
            <view class="pos-info-col">
              <text class="pos-info-label">名义价值</text>
              <text class="pos-info-val">{{ item.notionalStr }} USDT</text>
            </view>
          </view>
          <!-- 平仓操作栏 -->
          <view class="pos-close-bar">
            <view class="pos-close-info">
              <text class="pos-close-fee-label">平仓手续费</text>
              <text class="pos-close-fee-val">≈{{ item.closeFeeStr }} USDT</text>
            </view>
            <view
              :class="['pos-close-btn', item.tradeType === 'buy' ? 'close-sell' : 'close-buy']"
              @tap="closePosition(item.code)"
            >
              {{ item.tradeType === 'buy' ? '平多（全部）' : '平空（全部）' }}
            </view>
          </view>
        </view>
      </view>

      <!-- 当前委托（暂无内容） -->
      <view v-if="posTab === 'orders'">
        <view class="pos-empty">
          <text class="pos-empty-text">暂无委托</text>
        </view>
      </view>

    </view>

    <!-- 收起时的占位 -->
    <view class="kline-collapsed-placeholder"></view>

  </view>

  <!-- 收起状态：吸底栏 -->
  <view class="kline-bottom-bar" v-if="!klineExpanded" @tap="toggleKline">
    <text class="kline-bottom-title">{{ stock ? stock.code : '' }} 永续 K线图表</text>
    <text class="kline-bottom-arrow">▲</text>
  </view>
</template>

<script>
import { getStockByCode } from '../../utils/stock.js';
import { getCurrentDateTime } from '../../utils/date.js';
import binanceService from '../../utils/binanceService.js';
import ChartHelper from '../../utils/chartHelper.js';
import FormatData from '../../utils/formatData.js';

const TAKER_FEE_RATE = 0.001;
const MAINT_MARGIN_RATE = 0.005;

export default {
  data() {
    return {
      stock: null,
      userData: null,
      tradeType: 'buy',

      leverage: 1,
      leverageRisk: '',

      notionalInput: '',

      cashDisplay: '0.00',
      marginValue: '0.00',
      openQty: '0.000000',
      commission: '0.00',
      liqPrice: '--',
      canTrade: false,

      klineData: [],
      klineInfo: null,
      crosshairIndex: -1,
      currentPrice: 0,
      priceChange: 0,
      priceChangePercent: 0,
      showVolume: false,
      showMA5: false,
      showMA10: false,
      klineInterval: '5m',
      klineExpanded: true,
      zoomHintVisible: false,
      zoomHintText: '',

      asks: [],
      bids: [],

      pctIndex: -1,

      posTab: 'holding',
      currentPositions: [],

      intervalList: [
        { val: '5m', label: '5m' },
        { val: '15m', label: '15m' },
        { val: '30m', label: '30m' },
        { val: '1h', label: '1时' },
        { val: '4h', label: '4时' },
        { val: '8h', label: '8时' },
        { val: '1d', label: '日' },
        { val: '1w', label: '周' },
        { val: '1M', label: '月' },
      ],
    };
  },

  created() {
    this.orderBookTimer = null;
    this.chartHelper = null;
    this.currentSymbol = null;
    this._winWidth = 375;
    this._tickerHandler = null;
    this._klineHandler = null;
    this._klineClosedHandler = null;

    // 手势状态
    this._gesture = {
      mode: 'none',         // 'none' | 'pan' | 'pinch' | 'longpress'
      startX: 0,
      startPinchDist: 0,
      startVisibleStart: 0,
      startVisibleCount: 60,
      lastX: 0,
      longPressTimer: null,
      panThreshold: 3,      // px，超过才算平移
    };
    this._zoomHintTimer = null;
  },

  async onLoad(options) {
    const code = options.code;
    const stock = await getStockByCode(code);
    const app = getApp();
    const userData = app.getUserData();

    const savedLeverage = uni.getStorageSync('lastLeverage') || 1;
    const savedKlineExpanded = uni.getStorageSync('klineExpanded');
    const klineExpanded = savedKlineExpanded === false ? false : true;

    this.stock = stock;
    this.userData = userData;
    this.cashDisplay = parseFloat(userData.cash || 0).toFixed(2);
    this.notionalInput = '';
    this.currentPrice = stock.currentPrice;
    this.priceChange = 0;
    this.priceChangePercent = 0;
    this.leverage = savedLeverage;
    this.klineExpanded = klineExpanded;

    this.currentSymbol = code;
    this.initChart();
    this.refreshPositions(stock.currentPrice);

    binanceService.fetch24hTicker(code).then((ticker) => {
      this.currentPrice = ticker.displayPrice;
      this.priceChange = ticker.priceChange;
      this.priceChangePercent = parseFloat(ticker.priceChangePercent);
      if (this.stock) this.stock = Object.assign({}, this.stock, { currentPrice: ticker.closePrice });
      binanceService.setOpenPrice(code, ticker.closePrice - parseFloat(ticker.priceChange));
      this.generateOrderBook();
      this.calculateCost();
    }).catch((err) => {
      console.warn('⚠️ fetch24hTicker failed:', err);
    });

    this.loadKlineData(code);
    this.initWebSocket(code);
    this.startOrderBookTimer();
  },

  onReady() {
    setTimeout(() => { this.drawKLine(); }, 200);
  },

  onShow() {
    const app = getApp();
    const userData = app.getUserData();
    this.userData = userData;
    this.cashDisplay = parseFloat(userData.cash || 0).toFixed(2);
    this.calculateCost();
  },

  onUnload() {
    if (this._tickerHandler) binanceService.off('ticker', this._tickerHandler);
    if (this._klineHandler) binanceService.off('kline', this._klineHandler);
    if (this._klineClosedHandler) binanceService.off('klineClosed', this._klineClosedHandler);
    this.closeWebSocket();
    if (this.orderBookTimer) clearInterval(this.orderBookTimer);
  },

  methods: {
    // ── 生成模拟盘口 ─────────────────────────────────
    generateOrderBook() {
      const price = parseFloat(this.currentPrice) || parseFloat(this.stock ? this.stock.currentPrice : 1) || 1;
      const tickSize = price >= 10000 ? 0.1 : price >= 1000 ? 0.01 : price >= 1 ? 0.001 : 0.0001;
      const asks = [];
      const bids = [];
      for (let i = 5; i >= 1; i--) {
        const p = parseFloat((price + tickSize * i).toFixed(4));
        const qty = (Math.random() * 5 + 0.001).toFixed(3);
        asks.push({ price: p, qty });
      }
      for (let i = 1; i <= 5; i++) {
        const p = parseFloat((price - tickSize * i).toFixed(4));
        const qty = (Math.random() * 5 + 0.001).toFixed(3);
        bids.push({ price: p, qty });
      }
      this.asks = asks;
      this.bids = bids;
    },

    startOrderBookTimer() {
      this.generateOrderBook();
      this.orderBookTimer = setInterval(() => { this.generateOrderBook(); }, 1500);
    },

    // ── K线 ──────────────────────────────────────────
    async loadKlineData(code) {
      try {
        uni.showLoading({ title: '加载中...', mask: true });
        const klines = await binanceService.fetchKlines(code, this.klineInterval, 200);
        this.klineData = klines;
        this.drawKLine();
        uni.hideLoading();
      } catch (err) {
        uni.hideLoading();
        console.error('❌ Failed to load kline data:', err);
        uni.showToast({ title: '图表加载失败', icon: 'none' });
      }
    },

    initChart() {
      const ctx = uni.createCanvasContext('klineCanvas', this);
      this.chartHelper = new ChartHelper('klineCanvas').init(ctx);
      try {
        const info = uni.getWindowInfo ? uni.getWindowInfo() : null;
        if (info && info.windowWidth) {
          this._winWidth = info.windowWidth;
        } else {
          uni.getSystemInfo({
            success: (s) => { this._winWidth = s.windowWidth; }
          });
        }
      } catch (e) {
        uni.getSystemInfo({
          success: (s) => { this._winWidth = s.windowWidth; }
        });
      }
    },

    initWebSocket(code) {
      this._tickerHandler = (ticker) => { this.handleTickerUpdate(ticker); };
      this._klineHandler = (kline) => { this.handleKlineUpdate(kline); };
      this._klineClosedHandler = (kline) => { this.handleKlineClosed(kline); };

      binanceService.on('ticker', this._tickerHandler);
      binanceService.on('kline', this._klineHandler);
      binanceService.on('klineClosed', this._klineClosedHandler);

      const symbol = code.toLowerCase();
      binanceService.connect([symbol], [this.klineInterval])
        .catch((err) => { console.error('✗ WS init failed:', err); });
    },

    handleTickerUpdate(ticker) {
      if (!this.stock) return;
      const stockCode = this.stock.code.toUpperCase();
      if (ticker.symbol !== stockCode) return;

      const price = ticker.closePrice;
      const changePercent = parseFloat(ticker.priceChangePercent);

      this.currentPrice = ticker.displayPrice;
      this.priceChange = ticker.priceChange;
      this.priceChangePercent = changePercent;
      if (this.stock) this.stock = Object.assign({}, this.stock, { currentPrice: price, change: changePercent });

      this.calculateCost();
      this.refreshPositions(price);
    },

    intervalToMs(interval) {
      const map = {
        '1m': 60000, '3m': 180000, '5m': 300000, '15m': 900000,
        '30m': 1800000, '1h': 3600000, '2h': 7200000, '4h': 14400000,
        '6h': 21600000, '8h': 28800000, '12h': 43200000,
        '1d': 86400000, '3d': 259200000, '1w': 604800000, '1M': 2592000000,
      };
      return map[interval] || 60000;
    },

    handleKlineUpdate(kline) {
      if (!this.stock) return;
      const stockCode = this.stock.code.toUpperCase();
      if (kline.symbol !== stockCode) return;
      if (kline.interval !== this.klineInterval) return;

      let klineData = [...this.klineData];
      const intervalMs = this.intervalToMs(this.klineInterval);

      if (klineData.length > 0) {
        const lastKline = klineData[klineData.length - 1];
        if (kline.time - lastKline.time < intervalMs) {
          klineData[klineData.length - 1] = kline;
        } else {
          klineData.push(kline);
          if (klineData.length > 200) klineData = klineData.slice(-200);
        }
      } else {
        klineData.push(kline);
      }

      this.klineData = klineData;

      if (this.chartHelper) {
        this.drawKLine();
      }
    },

    handleKlineClosed(kline) {
      if (!this.stock) return;
      const stockCode = this.stock.code.toUpperCase();
      if (kline.symbol !== stockCode) return;

      let klineData = [...this.klineData];
      klineData.push(kline);
      if (klineData.length > 200) klineData = klineData.slice(-200);
      this.klineData = klineData;
      this.drawKLine();
    },

    closeWebSocket() {
      binanceService.close();
    },

    drawKLine() {
      const klineData = this.klineData;
      if (!klineData || klineData.length === 0) return;
      if (!this.chartHelper) this.initChart();

      // 保留当前可见区间，仅追加新数据时滚动到最新
      const prevLen = this.chartHelper.data.length;
      const prevStart = this.chartHelper.visibleStart;
      const prevCount = this.chartHelper.visibleCount || 60;

      this.chartHelper.data = klineData;
      this.chartHelper.setInterval(this.klineInterval);
      this.chartHelper.setDimensions(this._winWidth, 300);

      // 如果是新数据加载（数据量大幅变化），重置到最新
      if (prevLen === 0 || Math.abs(klineData.length - prevLen) > 10) {
        const initCount = Math.min(60, klineData.length);
        this.chartHelper.visibleCount = initCount;
        this.chartHelper.visibleStart = Math.max(0, klineData.length - initCount);
      } else if (klineData.length > prevLen) {
        // 正常追加，尾随最新
        const added = klineData.length - prevLen;
        const atEnd = (prevStart + prevCount >= prevLen);
        if (atEnd) {
          this.chartHelper.visibleStart = Math.max(0, klineData.length - prevCount);
        }
      }

      this.chartHelper.render({
        showVolume: this.showVolume,
        showMA5: this.showMA5,
        showMA10: this.showMA10,
        crosshairIndex: this.crosshairIndex,
      });
    },

    // ── K线手势：TouchStart ──────────────────────────────────
    onKLineTouchStart(e) {
      if (!this.chartHelper || !this.klineData || this.klineData.length === 0) return;
      const g = this._gesture;
      const touches = e.touches;

      if (touches.length === 1) {
        // 单指：准备平移 or 长按
        const t = touches[0];
        g.mode = 'none';
        g.startX = t.x;
        g.lastX = t.x;
        g.startVisibleStart = this.chartHelper.visibleStart;
        g.startVisibleCount = this.chartHelper.visibleCount;

        // 长按计时器：400ms
        if (g.longPressTimer) clearTimeout(g.longPressTimer);
        g.longPressTimer = setTimeout(() => {
          if (g.mode === 'none' || g.mode === 'longpress') {
            g.mode = 'longpress';
            this._showCrosshair(t.x);
          }
        }, 400);

      } else if (touches.length === 2) {
        // 双指：捏合缩放
        g.mode = 'pinch';
        if (g.longPressTimer) clearTimeout(g.longPressTimer);
        const dx = touches[1].x - touches[0].x;
        const dy = touches[1].y - touches[0].y;
        g.startPinchDist = Math.sqrt(dx * dx + dy * dy);
        g.startVisibleCount = this.chartHelper.getVisibleCount();
        g.startVisibleStart = this.chartHelper.visibleStart;
        // 捏合中心比例
        const midX = (touches[0].x + touches[1].x) / 2;
        const chartArea = this.chartHelper.getChartArea();
        g.pinchCenterRatio = Math.max(0, Math.min(1,
          (midX - chartArea.left) / chartArea.width
        ));
      }
    },

    // ── K线手势：TouchMove ──────────────────────────────────
    onKLineTouchMove(e) {
      if (!this.chartHelper || !this.klineData || this.klineData.length === 0) return;
      const g = this._gesture;
      const touches = e.touches;

      if (touches.length === 2 || g.mode === 'pinch') {
        // 捏合缩放
        if (g.longPressTimer) { clearTimeout(g.longPressTimer); g.longPressTimer = null; }
        g.mode = 'pinch';
        if (touches.length < 2) return;

        const dx = touches[1].x - touches[0].x;
        const dy = touches[1].y - touches[0].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ratio = dist / g.startPinchDist;

        // 基于初始状态重新计算可见数量
        const newCount = Math.round(g.startVisibleCount / ratio);
        const clampedCount = Math.max(
          this.chartHelper.MIN_VISIBLE,
          Math.min(this.chartHelper.MAX_VISIBLE, newCount, this.klineData.length)
        );
        // 保持捏合中心不变
        let newStart = Math.round(g.startVisibleStart + g.startVisibleCount * g.pinchCenterRatio - clampedCount * g.pinchCenterRatio);
        newStart = Math.max(0, Math.min(this.klineData.length - clampedCount, newStart));

        const changed = (newStart !== this.chartHelper.visibleStart || clampedCount !== this.chartHelper.visibleCount);
        this.chartHelper.visibleStart = newStart;
        this.chartHelper.visibleCount = clampedCount;

        if (changed) {
          this.drawKLine();
          this._showZoomHint(clampedCount);
        }

      } else if (touches.length === 1) {
        const t = touches[0];
        const deltaX = t.x - g.startX;

        if (g.mode === 'longpress') {
          // 长按模式：移动十字光标
          this._showCrosshair(t.x);
          return;
        }

        if (g.mode === 'none' && Math.abs(deltaX) > g.panThreshold) {
          // 开始平移，取消长按
          g.mode = 'pan';
          if (g.longPressTimer) { clearTimeout(g.longPressTimer); g.longPressTimer = null; }
        }

        if (g.mode === 'pan') {
          // 平移：计算移动了几根K线
          const chartArea = this.chartHelper.getChartArea();
          const count = this.chartHelper.getVisibleCount();
          const step = chartArea.width / count;
          const deltaIndex = -Math.round(deltaX / step);

          let newStart = g.startVisibleStart + deltaIndex;
          newStart = Math.max(0, Math.min(this.klineData.length - count, newStart));

          if (newStart !== this.chartHelper.visibleStart) {
            this.chartHelper.visibleStart = newStart;
            this.drawKLine();
          }
        }
      }
    },

    // ── K线手势：TouchEnd ────────────────────────────────────
    onKLineTouchEnd(e) {
      const g = this._gesture;
      if (g.longPressTimer) { clearTimeout(g.longPressTimer); g.longPressTimer = null; }

      if (g.mode === 'longpress') {
        // 长按抬手：保留tooltip一段时间后消失
        setTimeout(() => {
          this.klineInfo = null;
          this.crosshairIndex = -1;
          this.drawKLine();
        }, 2500);
      } else if (g.mode === 'none') {
        // 单次点击，清除tooltip
        if (this.klineInfo) {
          this.klineInfo = null;
          this.crosshairIndex = -1;
          this.drawKLine();
        }
      }

      g.mode = 'none';
    },

    // ── 内部：显示十字光标 ───────────────────────────────────
    _showCrosshair(x) {
      if (!this.chartHelper) return;
      const visibleIndex = this.chartHelper.getVisibleIndexAtX(x);
      if (visibleIndex < 0) return;
      const d = this.chartHelper.getDataAtVisibleIndex(visibleIndex);
      if (!d) return;

      this.crosshairIndex = visibleIndex;
      const isUp = d.close >= d.open;
      const change = d.open !== 0 ? ((d.close - d.open) / d.open * 100) : 0;
      this.klineInfo = {
        ...d,
        isUp,
        changeStr: change >= 0 ? '+' + change.toFixed(2) : change.toFixed(2),
        open: FormatData.formatPrice(d.open),
        high: FormatData.formatPrice(d.high),
        low: FormatData.formatPrice(d.low),
        close: FormatData.formatPrice(d.close),
        volumeStr: FormatData.formatVolume(d.volume),
      };
      this.drawKLine();
    },

    // ── 内部：显示缩放提示 ───────────────────────────────────
    _showZoomHint(count) {
      this.zoomHintText = `${count} 根`;
      this.zoomHintVisible = true;
      if (this._zoomHintTimer) clearTimeout(this._zoomHintTimer);
      this._zoomHintTimer = setTimeout(() => {
        this.zoomHintVisible = false;
      }, 1200);
    },

    // ── 交易类型切换 ────────────────────────────────
    switchTradeType(type) {
      this.tradeType = type;
      this.pctIndex = -1;
      this.calculateCost();
    },

    // ── 杠杆控制 ───────────────────────────────────
    onLeverageInput(e) {
      const raw = e.detail.value;
      const val = parseInt(raw);
      if (!isNaN(val) && val >= 1 && val <= 150) {
        this.leverage = val;
        uni.setStorageSync('lastLeverage', val);
        this.calculateCost();
      }
    },

    onLeverageBlur(e) {
      let val = parseInt(e.detail.value);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 150) val = 150;
      this.leverage = val;
      uni.setStorageSync('lastLeverage', val);
      this.calculateCost();
    },

    // ── 开仓金额输入 ────────────────────────────────
    inputMargin(e) {
      this.notionalInput = e.detail.value;
      this.pctIndex = -1;
      this.calculateCost();
    },

    setPctMargin(pct, idx) {
      const { userData } = this;
      const leverage = parseInt(this.leverage) || 1;
      const maxNotional = userData.cash * leverage;
      const notionalInput = parseFloat((maxNotional * pct).toFixed(2));
      this.notionalInput = String(notionalInput);
      this.pctIndex = idx;
      this.calculateCost();
    },

    // ── 核心计算 ────────────────────────────────────
    calculateCost() {
      const { tradeType, userData } = this;
      if (!userData) return;
      const leverage = parseInt(this.leverage) || 1;
      const currentPrice = parseFloat(this.currentPrice) || 0;
      const notional = parseFloat(this.notionalInput) || 0;

      if (notional <= 0 || currentPrice <= 0) {
        this.marginValue = '0.00';
        this.openQty = '0.000000';
        this.commission = '0.00';
        this.liqPrice = '--';
        this.canTrade = false;
        return;
      }

      const margin = notional / leverage;
      const qty = notional / currentPrice;
      const fee = notional * TAKER_FEE_RATE;

      const cash = userData.cash || 0;
      const lossRatio = cash / notional;
      const priceDec = currentPrice >= 1000 ? 2 : currentPrice >= 1 ? 4 : 6;
      let liqPrice;
      if (tradeType === 'buy') {
        liqPrice = currentPrice * (1 - lossRatio + MAINT_MARGIN_RATE);
      } else {
        liqPrice = currentPrice * (1 + lossRatio - MAINT_MARGIN_RATE);
      }
      const liqPriceStr = (tradeType === 'buy' && liqPrice <= 0)
        ? '不会强平'
        : liqPrice > 0 ? liqPrice.toFixed(priceDec) : '--';

      const leverageRisk = leverage >= 50 ? 'extreme'
        : leverage >= 20 ? 'high'
        : leverage >= 5  ? 'mid'
        : 'low';

      const canTrade = margin <= userData.cash && notional > 0;

      this.marginValue = margin.toFixed(2);
      this.openQty = qty.toFixed(6);
      this.commission = fee.toFixed(2);
      this.liqPrice = liqPriceStr;
      this.leverageRisk = leverageRisk;
      this.canTrade = canTrade;
    },

    // ── 确认下单 ────────────────────────────────────
    confirmTrade() {
      const { stock, tradeType, notionalInput, marginValue, leverage, openQty, currentPrice } = this;
      const notional = parseFloat(notionalInput) || 0;
      const margin = parseFloat(marginValue) || 0;

      if (notional <= 0) {
        uni.showToast({ title: '请输入开仓金额', icon: 'none' });
        return;
      }
      if (!this.canTrade) {
        uni.showToast({ title: '余额不足', icon: 'none' });
        return;
      }

      const action = tradeType === 'buy' ? '做多' : '做空';
      const priceStr = FormatData.formatPrice(currentPrice);
      const msg = `${action} ${stock.symbol}\n杠杆：${leverage}x\n开仓金额：${notional} USDT\n保证金：${margin} USDT\n开仓数量：${openQty}\n当前价：${priceStr}`;

      uni.showModal({
        title: '确认开仓',
        content: msg,
        success: (res) => {
          if (res.confirm) this.executeTrade();
        },
      });
    },

    executeTrade() {
      const { stock, tradeType, notionalInput, marginValue, leverage, openQty, commission, currentPrice, liqPrice } = this;
      const notional = parseFloat(notionalInput);
      const margin = parseFloat(marginValue);
      const fee = parseFloat(commission);
      const qty = parseFloat(openQty);
      const price = parseFloat(currentPrice);

      const app = getApp();
      let userData = app.getUserData();
      const now = getCurrentDateTime();

      userData.cash -= margin;

      const existingIndex = userData.stocks.findIndex(s => s.code === stock.code);
      if (existingIndex > -1) {
        const existing = userData.stocks[existingIndex];
        const totalQty = existing.quantity + qty;
        const newCost = existing.cost + price * qty;
        userData.stocks[existingIndex] = {
          ...existing,
          quantity: totalQty,
          cost: newCost,
          currentPrice: price,
          leverage,
          margin: (existing.margin || 0) + margin,
          tradeType,
          liqPrice,
        };
      } else {
        userData.stocks.push({
          code: stock.code,
          name: stock.name,
          symbol: stock.symbol,
          quantity: qty,
          cost: price * qty,
          currentPrice: price,
          buyPrice: price,
          leverage,
          margin,
          tradeType,
          liqPrice,
        });
      }

      userData.history.unshift({
        type: tradeType,
        code: stock.code,
        name: stock.name,
        symbol: stock.symbol,
        quantity: qty,
        price,
        margin,
        leverage,
        amount: notional,
        notional: margin * leverage,
        time: now,
      });

      const totalMargin = userData.stocks.reduce((sum, s) => sum + (s.margin || 0), 0);
      userData.totalAssets = userData.cash + totalMargin;
      userData.profit = userData.totalAssets - 10000;

      app.updateUserData(userData);

      const freshUserData = app.getUserData();
      this.userData = freshUserData;
      this.cashDisplay = parseFloat(freshUserData.cash || 0).toFixed(2);
      this.notionalInput = '';
      this.pctIndex = -1;
      this.calculateCost();
      this.refreshPositions(price);
      uni.showToast({ title: '开仓成功', icon: 'success', duration: 1500 });
    },

    // ── K线周期 / 指标切换 ──────────────────────────
    switchKlineInterval(interval) {
      if (interval === this.klineInterval) return;
      this.klineInterval = interval;
      this.klineData = [];
      this.klineInfo = null;
      this.crosshairIndex = -1;
      // 切换周期时重置可见区间
      if (this.chartHelper) {
        this.chartHelper.visibleStart = 0;
        this.chartHelper.visibleCount = 60;
      }

      const symbol = this.stock.code;
      binanceService.reconnect([symbol.toLowerCase()], [interval]);
      this.loadKlineData(symbol);
    },

    toggleVolume() {
      this.showVolume = !this.showVolume;
      this.drawKLine();
    },

    toggleMA5() {
      this.showMA5 = !this.showMA5;
      this.drawKLine();
    },

    toggleMA10() {
      this.showMA10 = !this.showMA10;
      this.drawKLine();
    },

    toggleKline() {
      const expanded = !this.klineExpanded;
      this.klineExpanded = expanded;
      uni.setStorageSync('klineExpanded', expanded);
      if (expanded) {
        setTimeout(() => { this.drawKLine(); }, 50);
      }
    },

    // ── 持仓区 ─────────────────────────────────────
    switchPosTab(tab) {
      this.posTab = tab;
    },

    closePosition(code) {
      const price = parseFloat(this.currentPrice) || 0;
      const app = getApp();
      let userData = app.getUserData();
      const idx = userData.stocks.findIndex(s => s.code === code);
      if (idx === -1 || !price) return;

      const pos = userData.stocks[idx];
      const avgPrice = pos.quantity > 0 ? pos.cost / pos.quantity : 0;
      const notional = pos.quantity * price;

      const pnl = pos.tradeType === 'buy'
        ? (price - avgPrice) * pos.quantity
        : (avgPrice - price) * pos.quantity;

      const closeFee = notional * TAKER_FEE_RATE;
      const returnAmount = Math.max(0, (pos.margin || 0) + pnl - closeFee);
      const pnlNet = pnl - closeFee;
      const pnlStr = (pnlNet >= 0 ? '+' : '') + pnlNet.toFixed(2);
      const action = pos.tradeType === 'buy' ? '平多' : '平空';

      uni.showModal({
        title: `确认${action}`,
        content: `平仓价格：${price}\n数量：${pos.quantity.toFixed(6)} ${pos.symbol}\n净盈亏：${pnlStr} USDT\n平仓手续费：${closeFee.toFixed(2)} USDT\n返还保证金：${returnAmount.toFixed(2)} USDT`,
        success: (res) => {
          if (!res.confirm) return;

          userData.cash += returnAmount;
          userData.stocks.splice(idx, 1);

          const now = getCurrentDateTime();
          userData.history.unshift({
            type: pos.tradeType === 'buy' ? 'close_buy' : 'close_sell',
            code: pos.code,
            name: pos.name,
            symbol: pos.symbol,
            quantity: pos.quantity,
            price,
            avgPrice,
            pnl: pnlNet,
            closeFee,
            returnAmount,
            leverage: pos.leverage,
            time: now,
          });

          const totalMargin = userData.stocks.reduce((sum, s) => sum + (s.margin || 0), 0);
          userData.totalAssets = userData.cash + totalMargin;
          userData.profit = userData.totalAssets - 10000;

          app.updateUserData(userData);

          const latestUserData = app.getUserData();
          this.userData = latestUserData;
          this.cashDisplay = parseFloat(latestUserData.cash || 0).toFixed(2);
          this.refreshPositions(price);

          const toast = pnlNet >= 0 ? `盈利 +${pnlNet.toFixed(2)} USDT` : `亏损 ${pnlNet.toFixed(2)} USDT`;
          uni.showToast({ title: toast, icon: pnlNet >= 0 ? 'success' : 'none', duration: 2000 });
        },
      });
    },

    refreshPositions(latestPrice) {
      if (!this.stock) return;
      const price = parseFloat(latestPrice) || parseFloat(this.currentPrice) || 0;
      if (!price) return;
      const app = getApp();
      const userData = app.getUserData();
      const code = this.stock.code;
      if (!code || !userData || !userData.stocks) {
        this.currentPositions = [];
        return;
      }

      const positions = userData.stocks
        .filter(s => s.code === code)
        .map(s => {
          const avgPrice = s.quantity > 0 ? s.cost / s.quantity : 0;
          const notional = s.quantity * price;
          const pnl = s.tradeType === 'buy'
            ? (price - avgPrice) * s.quantity
            : (avgPrice - price) * s.quantity;
          const margin = s.margin || 1;
          const pnlPct = (pnl / margin) * 100;
          const closeFee = notional * TAKER_FEE_RATE;

          return {
            ...s,
            qtyStr: s.quantity.toFixed(6),
            avgPriceStr: avgPrice.toFixed(2),
            marginStr: margin.toFixed(2),
            notionalStr: notional.toFixed(2),
            pnl,
            pnlStr: Math.abs(pnl).toFixed(2),
            pnlPctStr: (pnl >= 0 ? '+' : '-') + Math.abs(pnlPct).toFixed(2),
            closeFeeStr: closeFee.toFixed(2),
          };
        });

      this.currentPositions = positions;
    },
  },
};
</script>

<style>
/* ══════════════════════════════════════════════
   交易页  —  Binance U本位合约 风格
   ══════════════════════════════════════════════ */

.container {
  background: #161a1e;
  min-height: 100vh;
  padding-bottom: 60rpx;
}

.up   { color: #0ecb81; }
.down { color: #f6465d; }

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx 18rpx;
  background: #1e2329;
  border-bottom: 1rpx solid #2b3139;
}

.top-coin {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.top-coin-name {
  font-size: 34rpx;
  font-weight: 700;
  color: #eaecef;
  letter-spacing: 0.01em;
}

.top-coin-sub {
  font-size: 19rpx;
  color: #848e9c;
  background: #2b3139;
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
  letter-spacing: 0.02em;
}

.top-change-only {
  display: flex;
  align-items: center;
}

.top-change {
  font-size: 21rpx;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.main-body {
  display: flex;
  align-items: stretch;
  background: #1e2329;
  border-bottom: 1rpx solid #2b3139;
}

.order-panel {
  flex: 1;
  padding: 16rpx 16rpx 20rpx;
  border-right: 1rpx solid #2b3139;
  min-width: 0;
}

.trade-tabs {
  display: flex;
  margin-bottom: 16rpx;
  background: #2b3139;
  border-radius: 6rpx;
  padding: 3rpx;
}

.trade-tab {
  flex: 1;
  padding: 12rpx 0;
  text-align: center;
  font-size: 25rpx;
  font-weight: 600;
  color: #848e9c;
  border-radius: 4rpx;
  letter-spacing: 0.02em;
}

.trade-tab.active-buy  { background: #0ecb81; color: #1e2329; }
.trade-tab.active-sell { background: #f6465d; color: #ffffff; }

.leverage-section { margin-bottom: 14rpx; }

.leverage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.leverage-label { font-size: 21rpx; color: #848e9c; font-weight: 500; }
.leverage-hint  { font-size: 19rpx; color: #474d57; }

.lev-input-box {
  display: flex;
  align-items: center;
  background: #2b3139;
  border: 1rpx solid #3d4451;
  border-radius: 6rpx;
  padding: 12rpx 14rpx;
}

.lev-input {
  flex: 1;
  font-size: 30rpx;
  font-weight: 700;
  color: #f0b90b;
  font-variant-numeric: tabular-nums;
}

.lev-input-unit {
  font-size: 24rpx;
  font-weight: 700;
  color: #f0b90b;
  margin-left: 4rpx;
  flex-shrink: 0;
}

.input-row { margin-bottom: 12rpx; }

.input-hint {
  font-size: 19rpx;
  color: #848e9c;
  margin-bottom: 7rpx;
  display: block;
}

.input-box {
  display: flex;
  align-items: center;
  background: #2b3139;
  border: 1rpx solid #3d4451;
  border-radius: 6rpx;
  padding: 14rpx 14rpx;
}

.qty-input {
  flex: 1;
  font-size: 26rpx;
  font-weight: 600;
  color: #eaecef;
}

.input-unit {
  font-size: 20rpx;
  color: #848e9c;
  font-weight: 600;
  margin-left: 8rpx;
  flex-shrink: 0;
}

.pct-row {
  display: flex;
  align-items: center;
  margin-bottom: 14rpx;
  background: #2b3139;
  border-radius: 6rpx;
  overflow: hidden;
}

.pct-btn {
  flex: 1;
  font-size: 19rpx;
  color: #848e9c;
  padding: 8rpx 0;
  text-align: center;
  font-weight: 500;
}

.pct-btn.pct-active {
  color: #f0b90b;
  background: rgba(240,185,11,0.12);
  font-weight: 700;
}

.pct-line {
  width: 1rpx;
  height: 28rpx;
  background: #3d4451;
  flex-shrink: 0;
}

.avail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.avail-label { font-size: 20rpx; color: #848e9c; }
.avail-value { font-size: 20rpx; color: #eaecef; font-weight: 600; font-variant-numeric: tabular-nums; }

.summary-block {
  background: #2b3139;
  border-radius: 6rpx;
  padding: 10rpx 12rpx;
  margin-bottom: 14rpx;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5rpx 0;
}

.summary-row.highlight {
  padding-top: 9rpx;
  margin-top: 4rpx;
  border-top: 1rpx solid #3d4451;
}

.sum-label { font-size: 19rpx; color: #848e9c; }
.sum-val { font-size: 20rpx; color: #eaecef; font-weight: 600; font-variant-numeric: tabular-nums; }
.liq-price { font-size: 21rpx; font-weight: 700; }

.submit-btn {
  width: 100%;
  margin-top: 2rpx;
  padding: 18rpx 0;
  border-radius: 6rpx;
  font-size: 26rpx;
  font-weight: 700;
  text-align: center;
  border: none;
  letter-spacing: 0.04em;
}

.submit-btn.buy  { background: #0ecb81; color: #1e2329; }
.submit-btn.sell { background: #f6465d; color: #ffffff; }
.submit-btn[disabled] { opacity: 0.3; }

/* ── 盘口面板 ──────────────────────────────────────── */
.orderbook-panel {
  width: 210rpx;
  flex-shrink: 0;
  padding: 16rpx 12rpx 20rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.ob-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6rpx;
  padding-bottom: 6rpx;
  border-bottom: 1rpx solid #2b3139;
}

.ob-col-label       { font-size: 17rpx; color: #474d57; }
.ob-col-label.right { text-align: right; }

.ob-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4rpx 0;
  position: relative;
}

.ob-row.ask::before {
  content: '';
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 30%;
  background: rgba(246,70,93,0.08);
  border-radius: 2rpx;
}

.ob-row.bid::before {
  content: '';
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 30%;
  background: rgba(14,203,129,0.08);
  border-radius: 2rpx;
}

.ob-price {
  font-size: 21rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  position: relative;
  z-index: 1;
}

.ask-price { color: #f6465d; }
.bid-price { color: #0ecb81; }

.ob-qty {
  font-size: 19rpx;
  color: #848e9c;
  font-variant-numeric: tabular-nums;
  position: relative;
  z-index: 1;
}

.ob-mid {
  padding: 7rpx 2rpx;
  border-top: 1rpx solid #2b3139;
  border-bottom: 1rpx solid #2b3139;
  margin: 3rpx 0;
  background: rgba(255,255,255,0.02);
  border-radius: 3rpx;
}

.ob-mid-price {
  font-size: 28rpx;
  font-weight: 800;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  display: block;
  text-align: left;
}

/* ── K线图区 ──────────────────────────────────────── */
.kline-section {
  background: #161a1e;
  border-top: 1rpx solid #2b3139;
}

.kline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 20rpx;
  border-bottom: 1rpx solid #2b3139;
  background: #1e2329;
}

.kline-header-left {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.kline-header-title { font-size: 23rpx; font-weight: 600; color: #848e9c; }
.kline-toggle-icon  { font-size: 22rpx; color: #474d57; }

.kline-bottom-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 24rpx;
  background: #161a1e;
  border-top: 1rpx solid #2b3139;
}

.kline-bottom-title { font-size: 25rpx; font-weight: 600; color: #b7bdc6; }
.kline-bottom-arrow { font-size: 20rpx; color: #474d57; }

.kline-collapsed-placeholder {
  height: 110rpx;
  background: #161a1e;
}

/* ── 持仓区 ──────────────────────────────────────── */
.position-section {
  background: #161a1e;
  border-top: 1rpx solid #2b3139;
}

.pos-tabs {
  display: flex;
  border-bottom: 1rpx solid #2b3139;
  padding: 0 16rpx;
  background: #161a1e;
}

.pos-tab {
  padding: 18rpx 16rpx 14rpx;
  font-size: 23rpx;
  color: #848e9c;
  position: relative;
  font-weight: 500;
  margin-right: 4rpx;
}

.pos-tab-active { color: #eaecef; font-weight: 600; }

.pos-tab-active::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 3rpx;
  background: #f0b90b;
  border-radius: 2rpx 2rpx 0 0;
}

.pos-empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 80rpx 0 60rpx;
  gap: 16rpx;
}

.pos-empty-text { font-size: 24rpx; color: #474d57; }

.pos-card {
  margin: 12rpx 16rpx;
  background: #2b3139;
  border-radius: 8rpx;
  overflow: hidden;
  border: 1rpx solid #3d4451;
}

.pos-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16rpx 18rpx 12rpx;
  border-bottom: 1rpx solid #3d4451;
}

.pos-card-left { display: flex; align-items: center; gap: 10rpx; }
.pos-code { font-size: 26rpx; font-weight: 700; color: #eaecef; }

.pos-side-badge { font-size: 18rpx; font-weight: 600; padding: 3rpx 10rpx; border-radius: 4rpx; }
.badge-long { background: rgba(14,203,129,0.15); color: #0ecb81; }
.badge-short { background: rgba(246,70,93,0.15); color: #f6465d; }

.pos-card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 3rpx; }
.pos-pnl { font-size: 27rpx; font-weight: 700; font-variant-numeric: tabular-nums; }
.pos-pnl-pct { font-size: 19rpx; font-variant-numeric: tabular-nums; }

.pos-card-body {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  padding: 12rpx 18rpx 14rpx;
}

.pos-info-col { display: flex; flex-direction: column; gap: 5rpx; padding: 8rpx 0; }
.pos-info-label { font-size: 18rpx; color: #848e9c; }
.pos-info-val { font-size: 21rpx; color: #eaecef; font-weight: 600; font-variant-numeric: tabular-nums; }

.pos-close-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 18rpx 16rpx;
  border-top: 1rpx solid #3d4451;
}

.pos-close-info { display: flex; align-items: center; gap: 8rpx; }
.pos-close-fee-label { font-size: 19rpx; color: #848e9c; }
.pos-close-fee-val { font-size: 19rpx; color: #eaecef; font-weight: 600; font-variant-numeric: tabular-nums; }

.pos-close-btn { padding: 10rpx 28rpx; border-radius: 6rpx; font-size: 22rpx; font-weight: 600; letter-spacing: 0.02em; }
.pos-close-btn.close-sell { background: rgba(246,70,93,0.15); color: #f6465d; border: 1rpx solid rgba(246,70,93,0.35); }
.pos-close-btn.close-buy  { background: rgba(14,203,129,0.15); color: #0ecb81; border: 1rpx solid rgba(14,203,129,0.35); }

/* ── K线周期栏 ────────────────────────────────────── */
.interval-bar {
  display: flex;
  padding: 6rpx 8rpx 8rpx;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  background: #1e2329;
  border-bottom: 1rpx solid #2b3139;
}

.interval-bar::-webkit-scrollbar { display: none; }

.interval-btn {
  flex-shrink: 0;
  padding: 7rpx 16rpx;
  background: transparent;
  border-radius: 4rpx;
  font-size: 22rpx;
  font-weight: 500;
  color: #848e9c;
  text-align: center;
}

.interval-btn.active { color: #f0b90b; background: rgba(240,185,11,0.1); font-weight: 600; }

.ma-legend { display: flex; gap: 20rpx; padding: 4rpx 16rpx 6rpx; }
.ma-item   { font-size: 19rpx; font-weight: 600; }
.ma5       { color: #f0b90b; }
.ma10      { color: #a78bfa; }

.kline-wrap { background: #161a1e; width: 100%; position: relative; }
.kline-canvas { width: 100%; height: 460rpx; display: block; }

/* 缩放根数提示 */
.kline-zoom-hint {
  position: absolute;
  top: 16rpx;
  right: 24rpx;
  background: rgba(0,0,0,0.55);
  border-radius: 8rpx;
  padding: 6rpx 16rpx;
  pointer-events: none;
}
.kline-zoom-hint-text {
  font-size: 20rpx;
  color: #f0b90b;
  font-weight: 600;
}

.tools-bar {
  display: flex;
  gap: 8rpx;
  padding: 10rpx 16rpx 12rpx;
  background: #1e2329;
  border-top: 1rpx solid #2b3139;
}

.tool-btn {
  padding: 6rpx 16rpx;
  background: #2b3139;
  border-radius: 4rpx;
  font-size: 20rpx;
  font-weight: 600;
  color: #848e9c;
  border: 1rpx solid #3d4451;
}

.tool-btn.active { color: #f0b90b; background: rgba(240,185,11,0.1); border-color: rgba(240,185,11,0.3); }

.kline-tooltip {
  position: absolute;
  top: 10rpx;
  left: 10rpx;
  z-index: 10;
  background: rgba(15,17,22,0.88);
  border-radius: 10rpx;
  padding: 12rpx 16rpx;
  border: 1rpx solid rgba(255,255,255,0.1);
  pointer-events: none;
  min-width: 300rpx;
}

.tooltip-row-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10rpx;
}

.tooltip-date {
  font-size: 20rpx;
  color: #848e9c;
}

.tooltip-chg {
  font-size: 20rpx;
  font-weight: 600;
}
.tooltip-chg.up   { color: #0ecb81; }
.tooltip-chg.down { color: #f6465d; }

.tooltip-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4rpx;
}

.tooltip-item  { text-align: center; }
.tooltip-label { font-size: 16rpx; color: #474d57; display: block; margin-bottom: 4rpx; }
.tooltip-val   { font-size: 18rpx; font-weight: 600; color: #eaecef; display: block; font-variant-numeric: tabular-nums; }
.tooltip-val.up   { color: #0ecb81; }
.tooltip-val.down { color: #f6465d; }
.tooltip-val.vol  { color: #a78bfa; }
</style>
