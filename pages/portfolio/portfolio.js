const app = getApp();
const stockUtil = require('../../utils/stock.js');

Page({
  data: {
    userData: null,
    stocks: [],
    totalAssets: 0,
    totalProfit: 0,
    profitRate: 0,
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const userData = app.getUserData();
    
    userData.stocks.forEach(stock => {
      const marketStock = stockUtil.getStockByCode(stock.code);
      if (marketStock) {
        stock.currentPrice = marketStock.currentPrice;
        stock.change = marketStock.change;
      }
    });
    
    const totalAssets = userData.cash + userData.stocks.reduce((sum, s) => sum + s.quantity * (s.currentPrice || 0), 0);
    const totalProfit = totalAssets - app.globalData.initialMoney;
    const profitRate = ((totalProfit / app.globalData.initialMoney) * 100).toFixed(2);
    
    this.setData({
      userData,
      stocks: userData.stocks,
      totalAssets,
      totalProfit,
      profitRate,
    });
  },

  toTrade(e) {
    const code = e.currentTarget.dataset.code;
    wx.navigateTo({
      url: `/pages/trade/trade?code=${code}`,
    });
  },
})
