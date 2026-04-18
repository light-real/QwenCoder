const app = getApp();
const stockUtil = require('../../utils/stock.js');
const dateUtil = require('../../utils/date.js');
const binanceService = require('../../utils/binanceService.js');

Page({
  data: {
    stocks: [],
    userData: null,
    currentTime: '',
  },

  _timeTimer: null,   // 时钟定时器
  _priceMap: null,    // symbol -> { currentPrice, change, changePercent }
  _isFirstShow: true, // 防止 onLoad+onShow 重复连接
  _tickerHandler: null, // 保存回调引用，用于取消监听

  onLoad() {
    // 初始化实例属性（确保在 Promise 回调中可用）
    this._priceMap = {};

    // 注册 ticker 回调（保存引用方便取消）
    this._tickerHandler = (ticker) => { this._onTickerUpdate(ticker); };
    binanceService.on('ticker', this._tickerHandler);

    // 先用静态数据渲染骨架
    const stocks = stockUtil.getAllStocks();
    this.setData({
      stocks,
      currentTime: dateUtil.getCurrentTime(),
    });

    this._startClock();
    this._loadAndSubscribe(stocks);
  },

  onShow() {
    this._loadUserData();
    // onLoad 后首次 onShow 跳过（_loadAndSubscribe 已经处理）
    if (this._isFirstShow) {
      this._isFirstShow = false;
      return;
    }

    const stocks = stockUtil.getAllStocks();
    const wsSymbols = stocks.map(s => s.code.toLowerCase());

    // 检查是否需要重连：WS 断开、或当前订阅的不是首页的多币种轮询
    const currentSymbols = binanceService.currentSymbols || [];
    const hasIndexSymbols = wsSymbols.every(function(sym) {
      return currentSymbols.indexOf(sym) > -1;
    });

    if (!binanceService.isConnected || !hasIndexSymbols) {
      binanceService.reconnect(wsSymbols, []);
    }
  },

  onHide() {
    // 进入 trade 页时不取消监听（首页 ticker 监听一直存在）
    // trade 页自行 reconnect 切换到单币种轮询
  },

  onUnload() {
    if (this._timeTimer) clearInterval(this._timeTimer);
    // 取消 ticker 监听
    if (this._tickerHandler) binanceService.off('ticker', this._tickerHandler);
    binanceService.close();
  },

  // ─── 时钟 ──────────────────────────────────────────────────
  _startClock() {
    this._timeTimer = setInterval(() => {
      this.setData({ currentTime: dateUtil.getCurrentTime() });
    }, 1000);
  },

  // ─── 加载初始价格 + 开启 WebSocket ────────────────────────
  _loadAndSubscribe(stocks) {
    const self = this;
    const symbols = stocks.map(s => s.code);  // ['BTCUSDT', 'ETHUSDT']

    // 1. 先通过 REST 获取各币种24h行情（含涨跌幅），立刻渲染
    Promise.all(symbols.map(sym => binanceService.fetch24hTicker(sym)))
      .then(function(tickers) {
        tickers.forEach(function(ticker) {
          if (!self._priceMap) self._priceMap = {};
          self._priceMap[ticker.symbol] = {
            currentPrice: ticker.closePrice,
            displayPrice: ticker.displayPrice,
            change: parseFloat(ticker.priceChangePercent),
            changeAmount: parseFloat(ticker.priceChange),
          };
          // 把开盘价存入 service，供 WS 计算涨跌幅
          binanceService.setOpenPrice(
            ticker.symbol,
            ticker.closePrice - parseFloat(ticker.priceChange)
          );
        });
        self._flushStocks();
        self._updateTotalAssets(); // REST 拿到价格后立即更新总资产
      })
      .catch(function(err) {
        console.warn('[Index] fetch24hTicker failed:', err);
      });

    // 2. 连接轮询（所有币种的 markPrice）
    const wsSymbols = symbols.map(s => s.toLowerCase());
    binanceService.connect(wsSymbols, [])   // 首页不需要K线，intervals 为空
      .catch(function(err) {
        console.error('[Index] WS connect failed:', err);
      });
  },

  // ─── WebSocket 价格推送回调 ────────────────────────────────
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
    this._updateTotalAssets(); // 实时更新含未实现盈亏的总资产
  },

  // ─── 将 _priceMap 同步到 data.stocks ──────────────────────
  _flushStocks() {
    const priceMap = this._priceMap || {};
    const stocks = this.data.stocks.map(function(stock) {
      const p = priceMap[stock.code];
      if (!p) return stock;
      return Object.assign({}, stock, {
        currentPrice: p.displayPrice,
        change: p.change,
        changeAmount: p.changeAmount,
      });
    });
    this.setData({ stocks });
  },

  // ─── 实时计算含未实现盈亏的总资产 ──────────────────────────
  _updateTotalAssets() {
    const userData = app.getUserData();
    if (!userData) return;
    const priceMap = this._priceMap || {};
    // 总资产 = 现金 + 各持仓（保证金 + 未实现盈亏）
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
    // 只更新展示字段，不写入 storage（避免频繁IO）
    if (this.data.userData) {
      this.setData({ 'userData.cash': totalDisplay });
    }
  },

  // ─── 用户数据（页面切换时刷新）──────────────────────────────
  _loadUserData() {
    const userData = app.getUserData();
    if (!userData) return;
    // 基础展示：现金 + 持仓保证金（无实时价格时的兜底）
    const totalMargin = (userData.stocks || []).reduce((sum, s) => sum + (s.margin || 0), 0);
    const totalAssets = (userData.cash || 0) + totalMargin;
    const totalDisplay = Number(totalAssets).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    // 先用静态总资产渲染（现金 + 持仓保证金，无实时价格时的兜底）
    this.setData({ userData: Object.assign({}, userData, { cash: totalDisplay }) });
    // 如果已有实时价格，立即覆盖为含盈亏的精确总资产
    if (this._priceMap && Object.keys(this._priceMap).length > 0) {
      this._updateTotalAssets();
    }
  },

  toTrade(e) {
    const code = e.currentTarget.dataset.code;
    wx.navigateTo({
      url: `/pages/trade/trade?code=${code}`,
    });
  },
})
