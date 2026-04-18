﻿const app = getApp();
const stockUtil = require('../../utils/stock.js');

Page({
  data: {
    userData: null,
    stocks: [],
    totalAssets: 0,
    totalProfit: 0,
    profitRate: 0,
    holdingValue: 0,
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const userData = app.getUserData();
    
    const stocks = userData.stocks.map(stock => {
      const marketStock = stockUtil.getStockByCode(stock.code);
      const currentPrice = marketStock ? marketStock.currentPrice : (stock.currentPrice || 0);
      const change = marketStock ? marketStock.change : (stock.change || 0);
      const marketValue = parseFloat((currentPrice * stock.quantity).toFixed(2));
      const pnl = parseFloat((marketValue - stock.cost).toFixed(2));
      return {
        ...stock,
        currentPrice,
        change,
        marketValue,
        pnl,
      };
    });
    
    const holdingValue = parseFloat(stocks.reduce((sum, s) => sum + s.marketValue, 0).toFixed(2));
    const totalAssets = parseFloat((userData.cash + holdingValue).toFixed(2));
    const totalProfit = parseFloat((totalAssets - app.globalData.initialMoney).toFixed(2));
    const profitRate = ((totalProfit / app.globalData.initialMoney) * 100).toFixed(2);
    
    this.setData({
      userData: { ...userData, cash: parseFloat(userData.cash.toFixed(2)) },
      stocks,
      holdingValue,
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
