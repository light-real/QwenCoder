App({
  globalData: {
    userInfo: null,
    initialMoney: 100000,
  },

  onLaunch() {
    this.initializeUserData();
  },

  initializeUserData() {
    const userData = wx.getStorageSync('userData');
    if (!userData) {
      const initialData = {
        cash: this.globalData.initialMoney,
        stocks: [],
        history: [],
        totalAssets: this.globalData.initialMoney,
        profit: 0,
      };
      wx.setStorageSync('userData', initialData);
    }
  },

  getUserData() {
    return wx.getStorageSync('userData') || {
      cash: this.globalData.initialMoney,
      stocks: [],
      history: [],
      totalAssets: this.globalData.initialMoney,
      profit: 0,
    };
  },

  updateUserData(data) {
    wx.setStorageSync('userData', data);
  }
})
