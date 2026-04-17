const app = getApp();
const stockUtil = require('../../utils/stock.js');
const dateUtil = require('../../utils/date.js');

Page({
  data: {
    stocks: [],
    userData: null,
    currentTime: '',
  },

  onLoad() {
    this.loadData();
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

  loadData() {
    const stocks = stockUtil.updateMarketStocks();
    this.setData({
      stocks,
      currentTime: dateUtil.getCurrentTime(),
    });
  },

  loadUserData() {
    const userData = app.getUserData();
    this.setData({
      userData,
    });
  },

  startTimer() {
    this.timer = setInterval(() => {
      this.loadData();
    }, 3000);
  },

  toTrade(e) {
    const code = e.currentTarget.dataset.code;
    wx.navigateTo({
      url: `/pages/trade/trade?code=${code}`,
    });
  },
})
