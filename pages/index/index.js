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

  onLoad() {
    this.loadInitialData();
    this.startTimer();
  },

  onShow() {
    this.loadUserData();
  },

  onUnload() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  },

  async loadInitialData() {
    try {
      const stocks = stockUtil.getAllStocks();
      const symbols = stocks.map(s => s.code.toLowerCase());
      
      const prices = await binanceService.fetchAllPrices(symbols);
      
      const updatedStocks = stocks.map(stock => ({
        ...stock,
        currentPrice: prices[stock.code.toUpperCase()] || stock.basePrice,
        change: 0,
        changeAmount: 0
      }));
      
      this.setData({
        stocks: updatedStocks,
        currentTime: dateUtil.getCurrentTime(),
      });
      
      console.log('? Initial prices loaded');
    } catch (err) {
      console.error('? Failed to load initial prices:', err);
      const stocks = stockUtil.updateMarketData();
      this.setData({
        stocks,
        currentTime: dateUtil.getCurrentTime(),
      });
    }
  },

  loadUserData() {
    const userData = app.getUserData();
    this.setData({
      userData,
    });
  },

  startTimer() {
    this.timer = setInterval(() => {
      this.updatePrices();
    }, 3000);
  },

  async updatePrices() {
    try {
      const stocks = this.data.stocks;
      const symbols = stocks.map(s => s.code.toLowerCase());
      
      const prices = await binanceService.fetchAllPrices(symbols);
      
      const updatedStocks = stocks.map(stock => {
        const currentPrice = prices[stock.code.toUpperCase()] || stock.currentPrice;
        const change = currentPrice - stock.basePrice;
        const changePercent = ((change / stock.basePrice) * 100).toFixed(2);
        
        return {
          ...stock,
          currentPrice,
          change: parseFloat(changePercent),
          changeAmount: change
        };
      });
      
      this.setData({
        stocks: updatedStocks,
        currentTime: dateUtil.getCurrentTime(),
      });
    } catch (err) {
      console.error('? Failed to update prices:', err);
    }
  },

  toTrade(e) {
    const code = e.currentTarget.dataset.code;
    wx.navigateTo({
      url: `/pages/trade/trade?code=${code}`,
    });
  },
})
