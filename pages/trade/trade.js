const app = getApp();
const stockUtil = require('../../utils/stock.js');
const dateUtil = require('../../utils/date.js');
const binanceService = require('../../utils/binanceService.js');
const ChartHelper = require('../../utils/chartHelper.js');
const formatData = require('../../utils/formatData.js');

// 合约手续费率（千分之一，开仓/平仓各扣一次）
const TAKER_FEE_RATE = 0.001;
// 维持保证金率（简化：0.5%，用于计算强平价）
const MAINT_MARGIN_RATE = 0.005;


Page({
  data: {
    stock: null,
    userData: null,
    tradeType: 'buy',   // 'buy'=做多，'sell'=做空

    // 杠杆
    leverage: 1,
    leverageRisk: '',   // 'low'|'mid'|'high'|'extreme'

    // 下单输入：开仓金额（名义价值，USDT）
    notionalInput: '',   // 用户输入的开仓金额

    // 计算结果展示
    marginValue: '0.00',     // 所需保证金 = 开仓金额 / 杠杆
    openQty: '0.000000',     // 开仓数量（币）= 名义价值 / 价格
    commission: '0.00',      // 手续费 = 名义价值 × 0.05%
    liqPrice: '--',          // 预计强平价（价格反向 1/杠杆 爆仓）

    canTrade: false,

    klineData: [],
    klineInfo: null,
    currentPrice: 0,
    priceChange: 0,
    priceChangePercent: 0,
    showVolume: false,
    showMA5: false,
    showMA10: false,
    klineInterval: '5m',
    klineExpanded: true,  // K线图展开/收起状态（onLoad 时从 storage 读取）

    // 盘口数据
    asks: [],
    bids: [],

    // 百分比快捷
    pctIndex: -1,

    // 持仓区
    posTab: 'holding',       // 'holding' | 'orders' | 'robot'
    currentPositions: [],    // 当前品种的持仓（格式化后，供 wxml 渲染）
  },

  orderBookTimer: null,
  chartHelper: null,
  currentSymbol: null,
  _winWidth: 375,

  onLoad(options) {
    const code = options.code;
    const stock = stockUtil.getStockByCode(code);
    const userData = app.getUserData();

    // 读取持久化偏好
    const savedLeverage = wx.getStorageSync('lastLeverage') || 1;
    const savedKlineExpanded = wx.getStorageSync('klineExpanded');
    // 首次安装时 getStorageSync 返回 ''（空字符串），视为展开
    const klineExpanded = savedKlineExpanded === false ? false : true;

    this.setData({
      stock,
      userData,
      notionalInput: '',
      currentPrice: stock.currentPrice,
      priceChange: 0,
      priceChangePercent: 0,
      leverage: savedLeverage,
      klineExpanded,
    });

    this.currentSymbol = code;
    this.initChart();
    this.refreshPositions(stock.currentPrice);

    // 立刻拉取最新24h行情
    binanceService.fetch24hTicker(code).then((ticker) => {
      this.setData({
        currentPrice: ticker.displayPrice,
        priceChange: ticker.priceChange,
        priceChangePercent: parseFloat(ticker.priceChangePercent),
        'stock.currentPrice': ticker.closePrice,
      });
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

  // ── 生成模拟盘口 ──────────────────────────────────────
  generateOrderBook() {
    const price = parseFloat(this.data.currentPrice) || parseFloat(this.data.stock.currentPrice) || 1;
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
    this.setData({ asks, bids });
  },

  startOrderBookTimer() {
    this.generateOrderBook();
    this.orderBookTimer = setInterval(() => {
      this.generateOrderBook();
    }, 1500);
  },

  // ── K线 ───────────────────────────────────────────────
  async loadKlineData(code) {
    try {
      wx.showLoading({ title: '加载中...', mask: true });
      const klines = await binanceService.fetchKlines(code, this.data.klineInterval, 60);
      this.setData({ klineData: klines });
      this.drawKLine();
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      console.error('❌ Failed to load kline data:', err);
      wx.showToast({ title: '图表加载失败', icon: 'none' });
    }
  },

  onReady() {
    setTimeout(() => { this.drawKLine(); }, 200);
  },

  onShow() {
    const userData = app.getUserData();
    this.setData({ userData }, () => {
      this.calculateCost();
    });
  },

  onUnload() {
    // 取消事件监听，防止内存泄漏和已销毁实例收到回调
    if (this._tickerHandler) binanceService.off('ticker', this._tickerHandler);
    if (this._klineHandler) binanceService.off('kline', this._klineHandler);
    if (this._klineClosedHandler) binanceService.off('klineClosed', this._klineClosedHandler);
    this.closeWebSocket();
    if (this.orderBookTimer) clearInterval(this.orderBookTimer);
  },


  initChart() {
    const ctx = wx.createCanvasContext('klineCanvas', this);
    this.chartHelper = new ChartHelper('klineCanvas').init(ctx);
    const info = wx.getWindowInfo ? wx.getWindowInfo() : null;
    if (info && info.windowWidth) {
      this._winWidth = info.windowWidth;
    } else {
      wx.getSystemInfo({ success: (s) => { this._winWidth = s.windowWidth; } });
    }
  },

  initWebSocket(code) {
    // 保存函数引用，供页面销毁时取消监听
    this._tickerHandler = (ticker) => { this.handleTickerUpdate(ticker); };
    this._klineHandler = (kline) => { this.handleKlineUpdate(kline); };
    this._klineClosedHandler = (kline) => { this.handleKlineClosed(kline); };

    binanceService.on('ticker', this._tickerHandler);
    binanceService.on('kline', this._klineHandler);
    binanceService.on('klineClosed', this._klineClosedHandler);

    const symbol = code.toLowerCase();
    binanceService.connect([symbol], [this.data.klineInterval])
      .catch((err) => { console.error('✗ WS init failed:', err); });
  },

  handleTickerUpdate(ticker) {
    if (!this.data.stock) return;
    const stockCode = this.data.stock.code.toUpperCase();
    if (ticker.symbol !== stockCode) return;

    const price = ticker.closePrice;
    const changePercent = parseFloat(ticker.priceChangePercent);

    this.setData({
      currentPrice: ticker.displayPrice,
      priceChange: ticker.priceChange,
      priceChangePercent: changePercent,
      'stock.currentPrice': price,
      'stock.change': changePercent,
    });

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
    if (!this.data.stock) return;
    const stockCode = this.data.stock.code.toUpperCase();
    if (kline.symbol !== stockCode) return;
    if (kline.interval !== this.data.klineInterval) return;

    let klineData = this.data.klineData;
    const intervalMs = this.intervalToMs(this.data.klineInterval);

    if (klineData.length > 0) {
      const lastKline = klineData[klineData.length - 1];
      if (kline.time - lastKline.time < intervalMs) {
        klineData[klineData.length - 1] = kline;
      } else {
        klineData.push(kline);
        if (klineData.length > 60) klineData = klineData.slice(-60);
      }
    } else {
      klineData.push(kline);
    }

    this.setData({ klineData });

    if (this.chartHelper) {
      this.chartHelper.setData(klineData);
      this.chartHelper.setInterval(this.data.klineInterval);
      this.chartHelper.setDimensions(this._winWidth, 300);
      this.chartHelper.render({
        showVolume: this.data.showVolume,
        showMA5: this.data.showMA5,
        showMA10: this.data.showMA10,
      });
    }
  },

  handleKlineClosed(kline) {
    if (!this.data.stock) return;
    const stockCode = this.data.stock.code.toUpperCase();
    if (kline.symbol !== stockCode) return;

    let klineData = this.data.klineData;
    klineData.push(kline);
    if (klineData.length > 30) klineData = klineData.slice(-30);
    this.setData({ klineData });
    this.drawKLine();
  },

  closeWebSocket() {
    binanceService.close();
  },

  drawKLine() {
    const klineData = this.data.klineData;
    if (!klineData || klineData.length === 0) return;
    if (!this.chartHelper) this.initChart();

    this.chartHelper.setData(klineData);
    this.chartHelper.setInterval(this.data.klineInterval);
    this.chartHelper.setDimensions(this._winWidth, 300);
    this.chartHelper.render({
      showVolume: this.data.showVolume,
      showMA5: this.data.showMA5,
      showMA10: this.data.showMA10,
    });
  },

  onTouchKLine(e) {
    const klineData = this.data.klineData;
    if (!klineData || klineData.length === 0) return;
    const x = e.touches[0].x;
    if (this.chartHelper) {
      const result = this.chartHelper.getDataAtX(x);
      if (result) {
        const d = result.data;
        const klineInfo = {
          ...d,
          open: formatData.formatPrice(d.open),
          high: formatData.formatPrice(d.high),
          low: formatData.formatPrice(d.low),
          close: formatData.formatPrice(d.close),
          volumeStr: formatData.formatVolume(d.volume),
        };
        this.setData({ klineInfo });
      }
    }
  },

  // ══════════════════════════════════════════════════════
  //  交易类型切换
  // ══════════════════════════════════════════════════════
  switchTradeType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ tradeType: type, pctIndex: -1 });
    this.calculateCost();
  },

  // ══════════════════════════════════════════════════════
  //  杠杆控制
  // ══════════════════════════════════════════════════════
  onLeverageInput(e) {
    const raw = e.detail.value;
    const val = parseInt(raw);
    if (!isNaN(val) && val >= 1 && val <= 150) {
      this.setData({ leverage: val });
      wx.setStorageSync('lastLeverage', val);
      this.calculateCost();
    }
  },

  onLeverageBlur(e) {
    let val = parseInt(e.detail.value);
    if (isNaN(val) || val < 1) val = 1;
    if (val > 150) val = 150;
    this.setData({ leverage: val });
    wx.setStorageSync('lastLeverage', val);
    this.calculateCost();
  },

  // ══════════════════════════════════════════════════════
  //  开仓金额（名义价值）输入
  // ══════════════════════════════════════════════════════
  inputMargin(e) {
    this.setData({ notionalInput: e.detail.value, pctIndex: -1 });
    this.calculateCost();
  },

  // 百分比快捷：按 「余额 × 杠杆」 比例设置开仓金额
  setPctMargin(e) {
    const pct = parseFloat(e.currentTarget.dataset.pct);
    const idx = parseInt(e.currentTarget.dataset.idx);
    const { userData } = this.data;
    const leverage = parseInt(this.data.leverage) || 1;
    // 最大可开 = 账户余额 × 杠杆
    const maxNotional = userData.cash * leverage;
    const notionalInput = parseFloat((maxNotional * pct).toFixed(2));
    this.setData({ notionalInput: String(notionalInput), pctIndex: idx });
    this.calculateCost();
  },

  // ══════════════════════════════════════════════════════
  //  核心计算：开仓金额（名义价值）→ 保证金 → 数量 → 强平价
  //
  //  保证金 = 名义价值 / 杠杆，保证金 ≤ 账户余额才能开
  //  强平价（全仓）：用账户总余额作为可承受亏损，
  //    做多强平价 = 入场价 × (1 - 余额/名义价值 + 维持保证金率)
  //    做空强平价 = 入场价 × (1 + 余额/名义价值 - 维持保证金率)
  //  即：余额越多，强平价离入场价越远
  // ══════════════════════════════════════════════════════
  calculateCost() {
    const { tradeType, userData } = this.data;
    if (!userData) return;
    const leverage = parseInt(this.data.leverage) || 1;
    const currentPrice = parseFloat(this.data.currentPrice) || 0;
    const notional = parseFloat(this.data.notionalInput) || 0; // 开仓金额（名义价值）

    if (notional <= 0 || currentPrice <= 0) {
      this.setData({
        marginValue: '0.00',
        openQty: '0.000000',
        commission: '0.00',
        liqPrice: '--',
        canTrade: false,
      });
      return;
    }

    // 保证金 = 开仓金额 / 杠杆
    const margin = notional / leverage;
    // 开仓数量（币）
    const qty = notional / currentPrice;
    // 手续费 = 名义价值 × Taker 费率
    const fee = notional * TAKER_FEE_RATE;

    // ── 强平价（全仓，结合账户余额）────────────────────────
    //   用户账户总余额（开仓前）/ 名义价值 = 可承受亏损比率
    //   做多：入场价 × (1 - 余额/名义价值 + 维持保证金率)
    //   做空：入场价 × (1 + 余额/名义价值 - 维持保证金率)
    //   余额充足时强平价会很远甚至为负（不会强平）
    const cash = userData.cash || 0;
    const lossRatio = cash / notional; // 余额能撑住的跌幅比率
    const priceDec = currentPrice >= 1000 ? 2 : currentPrice >= 1 ? 4 : 6;
    let liqPrice;
    if (tradeType === 'buy') {
      liqPrice = currentPrice * (1 - lossRatio + MAINT_MARGIN_RATE);
    } else {
      liqPrice = currentPrice * (1 + lossRatio - MAINT_MARGIN_RATE);
    }
    // 做多：强平价为负时表示不会强平；做空：强平价过高时也不会强平
    const liqPriceStr = (tradeType === 'buy' && liqPrice <= 0)
      ? '不会强平'
      : liqPrice > 0 ? liqPrice.toFixed(priceDec) : '--';

    // 杠杆风险等级
    const leverageRisk = leverage >= 50 ? 'extreme'
      : leverage >= 20 ? 'high'
      : leverage >= 5  ? 'mid'
      : 'low';

    // 保证金不超过账户余额才能开单
    const canTrade = margin <= userData.cash && notional > 0;

    this.setData({
      marginValue: margin.toFixed(2),
      openQty: qty.toFixed(6),
      commission: fee.toFixed(4),
      liqPrice: liqPriceStr,
      leverageRisk,
      canTrade,
    });
  },

  // ══════════════════════════════════════════════════════
  //  确认下单
  // ══════════════════════════════════════════════════════
  confirmTrade() {
    const { stock, tradeType, notionalInput, marginValue, leverage, openQty, currentPrice } = this.data;
    const notional = parseFloat(notionalInput) || 0;
    const margin = parseFloat(marginValue) || 0;

    if (notional <= 0) {
      wx.showToast({ title: '请输入开仓金额', icon: 'none' });
      return;
    }
    if (!this.data.canTrade) {
      wx.showToast({ title: '余额不足', icon: 'none' });
      return;
    }

    const action = tradeType === 'buy' ? '做多' : '做空';
    const priceStr = formatData.formatPrice(currentPrice);
    const msg = `${action} ${stock.symbol}\n杠杆：${leverage}x\n开仓金额：${notional} USDT\n保证金：${margin} USDT\n开仓数量：${openQty}\n当前价：${priceStr}`;

    wx.showModal({
      title: '确认开仓',
      content: msg,
      success: (res) => {
        if (res.confirm) {
          this.executeTrade();
        }
      },
    });
  },

  executeTrade() {
    const { stock, tradeType, notionalInput, marginValue, leverage, openQty, commission, currentPrice, liqPrice } = this.data;
    const notional = parseFloat(notionalInput);
    const margin = parseFloat(marginValue);
    const fee = parseFloat(commission);
    const qty = parseFloat(openQty);
    const price = parseFloat(currentPrice);

    let userData = app.getUserData();
    const now = dateUtil.getCurrentDateTime();

    // 只扣除保证金（手续费计入开仓成本，体现在持仓均价里）
    userData.cash -= margin;

    // 持仓处理（合约持仓，以 USDT 保证金为基础）
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

    // 合约账户总资产 = 现金 + 所有持仓的保证金（不含未实现盈亏，避免开仓瞬间因手续费显示亏损）
    // 未实现盈亏在行情页/持仓页实时计算展示，不写入 totalAssets
    const totalMargin = userData.stocks.reduce((sum, s) => sum + (s.margin || 0), 0);
    userData.totalAssets = userData.cash + totalMargin;
    userData.profit = userData.totalAssets - app.globalData.initialMoney;

    app.updateUserData(userData);

    // 下单成功后留在当前页面，刷新数据
    this.setData({
      userData: app.getUserData(),
      notionalInput: '',
      pctIndex: -1,
    });
    this.calculateCost();
    this.refreshPositions(price);
    wx.showToast({ title: '开仓成功', icon: 'success', duration: 1500 });
  },

  // ══════════════════════════════════════════════════════
  //  K线周期 / 指标切换
  // ══════════════════════════════════════════════════════
  switchKlineInterval(e) {
    const interval = e.currentTarget.dataset.interval;
    if (interval === this.data.klineInterval) return;

    this.setData({ klineInterval: interval, klineData: [], klineInfo: null });

    const symbol = this.data.stock.code;
    binanceService.reconnect([symbol.toLowerCase()], [interval]);
    this.loadKlineData(symbol);
  },

  toggleVolume() {
    this.setData({ showVolume: !this.data.showVolume });
    this.drawKLine();
  },

  toggleMA5() {
    this.setData({ showMA5: !this.data.showMA5 });
    this.drawKLine();
  },

  toggleMA10() {
    this.setData({ showMA10: !this.data.showMA10 });
    this.drawKLine();
  },

  reconnectWebSocket() {
    const symbol = this.data.stock.code.toLowerCase();
    binanceService.reconnect([symbol], [this.data.klineInterval]);
  },

  toggleKline() {
    const expanded = !this.data.klineExpanded;
    this.setData({ klineExpanded: expanded });
    wx.setStorageSync('klineExpanded', expanded);
    // 展开时重新绘制（canvas 被隐藏后需要重绘）
    if (expanded) {
      setTimeout(() => { this.drawKLine(); }, 50);
    }
  },

  // ══════════════════════════════════════════════════════
  //  持仓区
  // ══════════════════════════════════════════════════════

  switchPosTab(e) {
    this.setData({ posTab: e.currentTarget.dataset.tab });
  },

  // ══════════════════════════════════════════════════════
  //  平仓（全部）
  //  盈亏 = (现价 - 均价) × 数量（做多），做空反向
  //  返还 = 保证金 + 盈亏 - 平仓手续费
  //  平仓手续费 = 平仓时名义价值（现价×数量）× 千分之一
  // ══════════════════════════════════════════════════════
  closePosition(e) {
    const code = e.currentTarget.dataset.code;
    const price = parseFloat(this.data.currentPrice) || 0;
    let userData = app.getUserData();
    const idx = userData.stocks.findIndex(s => s.code === code);
    if (idx === -1 || !price) return;

    const pos = userData.stocks[idx];
    const avgPrice = pos.quantity > 0 ? pos.cost / pos.quantity : 0;
    const notional = pos.quantity * price;  // 平仓名义价值（按现价）

    // 盈亏
    const pnl = pos.tradeType === 'buy'
      ? (price - avgPrice) * pos.quantity
      : (avgPrice - price) * pos.quantity;

    // 平仓手续费 = 名义价值 × 千分之一
    const closeFee = notional * TAKER_FEE_RATE;

    // 返还金额 = 保证金 + 盈亏 - 手续费（最少返还0，防止穿仓时负数）
    const returnAmount = Math.max(0, (pos.margin || 0) + pnl - closeFee);

    const pnlNet = pnl - closeFee; // 净盈亏（扣手续费后）
    const pnlStr = (pnlNet >= 0 ? '+' : '') + pnlNet.toFixed(2);
    const action = pos.tradeType === 'buy' ? '平多' : '平空';

    wx.showModal({
      title: `确认${action}`,
      content: `平仓价格：${price}\n数量：${pos.quantity.toFixed(6)} ${pos.symbol}\n净盈亏：${pnlStr} USDT\n平仓手续费：${closeFee.toFixed(2)} USDT\n返还保证金：${returnAmount.toFixed(2)} USDT`,
      success: (res) => {
        if (!res.confirm) return;

        // 返还现金
        userData.cash += returnAmount;

        // 移除持仓
        userData.stocks.splice(idx, 1);

        // 写入历史
        const now = dateUtil.getCurrentDateTime();
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

        // 更新总资产
        const totalMargin = userData.stocks.reduce((sum, s) => sum + (s.margin || 0), 0);
        userData.totalAssets = userData.cash + totalMargin;
        userData.profit = userData.totalAssets - app.globalData.initialMoney;

        app.updateUserData(userData);

        this.setData({ userData: app.getUserData() });
        this.refreshPositions(price);

        const toast = pnlNet >= 0 ? `盈利 +${pnlNet.toFixed(2)} USDT` : `亏损 ${pnlNet.toFixed(2)} USDT`;
        wx.showToast({ title: toast, icon: pnlNet >= 0 ? 'success' : 'none', duration: 2000 });
      },
    });
  },

  // 根据当前实时价格，计算本品种持仓的盈亏并格式化供渲染
  refreshPositions(latestPrice) {
    if (!this.data.stock) return;
    const price = parseFloat(latestPrice) || parseFloat(this.data.currentPrice) || 0;
    if (!price) return;
    const userData = app.getUserData();
    const code = this.data.stock.code;
    if (!code || !userData || !userData.stocks) {
      this.setData({ currentPositions: [] });
      return;
    }

    const positions = userData.stocks
      .filter(s => s.code === code)
      .map(s => {
        const avgPrice = s.quantity > 0 ? s.cost / s.quantity : 0;
        const notional = s.quantity * price;
        // 做多盈亏：(现价 - 均价) × 数量；做空相反
        const pnl = s.tradeType === 'buy'
          ? (price - avgPrice) * s.quantity
          : (avgPrice - price) * s.quantity;
        // 盈亏比 = pnl / 保证金
        const margin = s.margin || 1;
        const pnlPct = (pnl / margin) * 100;

        // 平仓手续费 = 平仓时名义价值 × 千分之一
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

    this.setData({ currentPositions: positions });
  },
})
