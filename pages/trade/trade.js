const app = getApp();
const stockUtil = require('../../utils/stock.js');
const dateUtil = require('../../utils/date.js');
const binanceService = require('../../utils/binanceService.js');
const ChartHelper = require('../../utils/chartHelper.js');
const formatData = require('../../utils/formatData.js');

Page({
  data: {
    stock: null,
    userData: null,
    tradeType: 'buy',
    quantity: 0,
    maxQuantity: 0,
    totalCost: 0,
    commission: 0,
    canTrade: false,
    klineData: [],
    klineInfo: null,
    currentPrice: 0,
    priceChange: 0,
    priceChangePercent: 0,
    showVolume: false,
    showMA5: false,
    showMA10: false,
    klineInterval: '1m'
  },

  chartHelper: null,
  currentSymbol: null,

  onLoad(options) {
    const code = options.code;
    const stock = stockUtil.getStockByCode(code);
    const userData = app.getUserData();
    
    const existingStock = userData.stocks.find(s => s.code === code);
    const maxQuantity = existingStock ? existingStock.quantity : Math.floor(userData.cash / stock.currentPrice);
    
    this.setData({
      stock,
      userData,
      maxQuantity,
      quantity: 0,
      currentPrice: stock.currentPrice,
      priceChange: 0,
      priceChangePercent: 0
    });

    this.currentSymbol = code;
    this.initChart();
    this.loadKlineData(code);
    this.initWebSocket(code);
  },

  async loadKlineData(code) {
    try {
      console.log('📊 Loading klines for', code, 'interval:', this.data.klineInterval);
      wx.showLoading({
        title: 'Loading...',
        mask: true
      });

      const klines = await binanceService.fetchKlines(code, this.data.klineInterval, 30);
      
      console.log('📈 Received', klines.length, 'klines');
      
      this.setData({
        klineData: klines
      });
      
      console.log('🎨 Data set to view, drawing chart...');
      this.drawKLine();
      
      wx.hideLoading();
      console.log('✅ Chart drawn');
    } catch (err) {
      wx.hideLoading();
      console.error('❌ Failed to load kline data:', err);
      wx.showToast({
        title: 'Failed to load chart',
        icon: 'none'
      });
    }
  },

  onReady() {
    setTimeout(() => {
      this.drawKLine();
    }, 200);
  },

  onShow() {
    const userData = app.getUserData();
    const existingStock = userData.stocks.find(s => s.code === this.data.stock.code);
    const maxQuantity = existingStock ? existingStock.quantity : Math.floor(userData.cash / this.data.currentPrice);
    
    this.setData({
      userData,
      maxQuantity,
    });
    
    this.calculateCost();
  },

  onUnload() {
    this.closeWebSocket();
  },

  initChart() {
    const ctx = wx.createCanvasContext('klineCanvas', this);
    this.chartHelper = new ChartHelper('klineCanvas').init(ctx);
  },

  initWebSocket(code) {
    binanceService.on('ticker', (ticker) => {
      this.handleTickerUpdate(ticker);
    });

    binanceService.on('kline', (kline) => {
      this.handleKlineUpdate(kline);
    });

    binanceService.on('klineClosed', (kline) => {
      this.handleKlineClosed(kline);
    });

    const symbol = code.toLowerCase();
    binanceService.connect([symbol], [this.data.klineInterval])
      .catch((err) => {
        console.error('✗ Failed to initialize WebSocket:', err);
      });
  },

  handleTickerUpdate(ticker) {
    const stockCode = this.data.stock.code.toUpperCase();
    if (ticker.symbol !== stockCode) return;

    const price = ticker.closePrice;
    const change = ticker.priceChange;
    const changePercent = parseFloat(ticker.priceChangePercent);

    this.setData({
      currentPrice: price,
      priceChange: change,
      priceChangePercent: changePercent
    });

    if (this.data.stock) {
      this.setData({
        'stock.currentPrice': price,
        'stock.change': changePercent
      });
    }

    this.calculateCost();
  },

  handleKlineUpdate(kline) {
    const stockCode = this.data.stock.code.toUpperCase();
    if (kline.symbol !== stockCode) return;
    if (kline.interval !== this.data.klineInterval) return;

    const klineItem = kline;
    let klineData = this.data.klineData;

    if (klineData.length > 0) {
      const lastKline = klineData[klineData.length - 1];
      
      if (klineItem.time - lastKline.time < 60000) {
        klineData[klineData.length - 1] = klineItem;
      } else {
        klineData.push(klineItem);
        
        if (klineData.length > 30) {
          klineData = klineData.slice(-30);
        }
      }
    } else {
      klineData.push(klineItem);
    }

    this.setData({
      klineData: klineData
    });

    if (this.chartHelper) {
      this.chartHelper.setData(klineData);
      wx.getSystemInfo({
        success: (sysInfo) => {
          const width = sysInfo.windowWidth;
          const height = 300;
          this.chartHelper.setDimensions(width, height);
          this.chartHelper.render({
            showVolume: this.data.showVolume,
            showMA5: this.data.showMA5,
            showMA10: this.data.showMA10
          });
        }
      });
    }
  },

  handleKlineClosed(kline) {
    const stockCode = this.data.stock.code.toUpperCase();
    if (kline.symbol !== stockCode) return;
    
    console.log('✓ Kline closed:', kline);

    let klineData = this.data.klineData;
    klineData.push(kline);
    
    if (klineData.length > 30) {
      klineData = klineData.slice(-30);
    }

    this.setData({
      klineData: klineData
    });

    this.drawKLine();
  },

  handleTradeUpdate(trade) {
    const stockCode = this.data.stock.code.toUpperCase();
    if (trade.symbol !== stockCode) return;
    
    console.log('📊 New trade:', formatData.formatPrice(trade.price), 'Qty:', formatData.formatVolume(trade.quantity));
  },

  closeWebSocket() {
    binanceService.close();
  },

  drawKLine() {
    const klineData = this.data.klineData;
    if (!klineData || klineData.length === 0) {
      return;
    }

    if (!this.chartHelper) {
      this.initChart();
    }

    wx.getSystemInfo({
      success: (sysInfo) => {
        const width = sysInfo.windowWidth;
        const height = 300;
        
        this.chartHelper.setData(klineData);
        this.chartHelper.setDimensions(width, height);
        this.chartHelper.render({
          showVolume: this.data.showVolume,
          showMA5: this.data.showMA5,
          showMA10: this.data.showMA10
        });
      }
    });
  },

  onTouchKLine(e) {
    const klineData = this.data.klineData;
    if (!klineData || klineData.length === 0) return;
    
    const x = e.touches[0].x;

    if (this.chartHelper) {
      const result = this.chartHelper.getDataAtX(x);
      if (result) {
        this.setData({
          klineInfo: result.data,
        });
      }
    }
  },

  switchTradeType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      tradeType: type,
      quantity: 0,
      totalCost: 0,
      commission: 0,
    });
  },

  inputQuantity(e) {
    const quantity = parseFloat(e.detail.value) || 0;
    this.setData({ quantity });
    this.calculateCost();
  },

  setQuantity(e) {
    const quantity = parseFloat(e.currentTarget.dataset.qty);
    this.setData({ quantity });
    this.calculateCost();
  },

  calculateCost() {
    const { currentPrice, quantity, tradeType } = this.data;
    
    if (quantity <= 0 || currentPrice <= 0) {
      this.setData({
        totalCost: 0,
        commission: 0,
        canTrade: false,
      });
      return;
    }
    
    if (tradeType === 'buy') {
      const total = currentPrice * quantity;
      const commission = total * 0.001;
      const totalCost = total + commission;
      
      this.setData({
        totalCost: totalCost.toFixed(2),
        commission: commission.toFixed(2),
        canTrade: totalCost <= this.data.userData.cash,
      });
    } else {
      const totalAmount = currentPrice * quantity;
      const commission = totalAmount * 0.001;
      const totalReceived = totalAmount - commission;
      
      this.setData({
        totalCost: totalReceived.toFixed(2),
        commission: commission.toFixed(2),
        canTrade: quantity <= this.data.maxQuantity,
      });
    }
  },

  confirmTrade() {
    const { stock, quantity, tradeType, totalCost, currentPrice } = this.data;
    
    if (quantity <= 0) {
      wx.showToast({
        title: 'Please enter quantity',
        icon: 'none',
      });
      return;
    }
    
    if (!this.data.canTrade) {
      wx.showToast({
        title: tradeType === 'buy' ? 'Insufficient balance' : 'Insufficient shares',
        icon: 'none',
      });
      return;
    }
    
    const action = tradeType === 'buy' ? 'buy' : 'sell';
    const priceStr = formatData.formatPrice(currentPrice);
    const msg = `Confirm ${action} ${quantity} ${stock.symbol} at ${priceStr}?`;
    
    wx.showModal({
      title: 'Confirm Trade',
      content: msg,
      success: (res) => {
        if (res.confirm) {
          this.executeTrade(stock, quantity, tradeType, parseFloat(totalCost), currentPrice);
        }
      },
    });
  },

  executeTrade(stock, quantity, tradeType, totalCost, currentPrice) {
    let userData = app.getUserData();
    const now = dateUtil.getCurrentDateTime();
    
    if (tradeType === 'buy') {
      userData.cash -= totalCost;
      
      const existingIndex = userData.stocks.findIndex(s => s.code === stock.code);
      if (existingIndex > -1) {
        const existing = userData.stocks[existingIndex];
        const totalQuantity = existing.quantity + quantity;
        const newCost = existing.cost + currentPrice * quantity;
        userData.stocks[existingIndex] = {
          ...existing,
          quantity: totalQuantity,
          cost: newCost,
          currentPrice: currentPrice,
        };
      } else {
        userData.stocks.push({
          code: stock.code,
          name: stock.name,
          symbol: stock.symbol,
          quantity: quantity,
          cost: currentPrice * quantity,
          currentPrice: currentPrice,
          buyPrice: currentPrice,
        });
      }
      
      userData.history.unshift({
        type: 'buy',
        code: stock.code,
        name: stock.name,
        symbol: stock.symbol,
        quantity: quantity,
        price: currentPrice,
        amount: totalCost,
        time: now,
      });
      
    } else {
      userData.cash += totalCost;
      
      const existingIndex = userData.stocks.findIndex(s => s.code === stock.code);
      if (existingIndex > -1) {
        const existing = userData.stocks[existingIndex];
        existing.quantity -= quantity;
        existing.currentPrice = currentPrice;
        
        if (existing.quantity <= 0) {
          userData.stocks.splice(existingIndex, 1);
        }
      }
      
      userData.history.unshift({
        type: 'sell',
        code: stock.code,
        name: stock.name,
        symbol: stock.symbol,
        quantity: quantity,
        price: currentPrice,
        amount: totalCost,
        profit: totalCost - (currentPrice * quantity),
        time: now,
      });
    }
    
    userData.totalAssets = userData.cash + userData.stocks.reduce((sum, s) => sum + s.quantity * s.currentPrice, 0);
    userData.profit = userData.totalAssets - app.globalData.initialMoney;
    
    app.updateUserData(userData);
    
    wx.showToast({
      title: 'Trade Success',
      icon: 'success',
      duration: 1500,
    });
    
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  },

  switchKlineInterval(e) {
    const interval = e.currentTarget.dataset.interval;
    
    console.log('🔄 Switching interval:', interval, 'current:', this.data.klineInterval);
    
    if (interval === this.data.klineInterval) {
      console.log('⚠️ Same interval, skip');
      return;
    }
    
    console.log('✅ Changing to interval:', interval);
    
    this.setData({
      klineInterval: interval,
      klineData: [],
      klineInfo: null
    });

    const symbol = this.data.stock.code;
    console.log('📡 Symbol:', symbol, 'Interval:', interval);
    binanceService.reconnect([symbol.toLowerCase()], [interval]);
    this.loadKlineData(symbol);
  },

  toggleVolume() {
    this.setData({
      showVolume: !this.data.showVolume
    });
    this.drawKLine();
  },

  toggleMA5() {
    this.setData({
      showMA5: !this.data.showMA5
    });
    this.drawKLine();
  },

  toggleMA10() {
    this.setData({
      showMA10: !this.data.showMA10
    });
    this.drawKLine();
  },

  reconnectWebSocket() {
    const symbol = this.data.stock.code.toLowerCase();
    binanceService.reconnect([symbol], [this.data.klineInterval]);
  }
})
