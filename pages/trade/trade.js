const app = getApp();
const stockUtil = require('../../utils/stock.js');
const dateUtil = require('../../utils/date.js');

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
  },

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
    });
  },

  onShow() {
    const userData = app.getUserData();
    const existingStock = userData.stocks.find(s => s.code === this.data.stock.code);
    const maxQuantity = existingStock ? existingStock.quantity : Math.floor(userData.cash / this.data.stock.currentPrice);
    
    this.setData({
      userData,
      maxQuantity,
    });
    
    this.calculateCost();
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
    const quantity = parseInt(e.detail.value) || 0;
    this.setData({ quantity });
    this.calculateCost();
  },

  setQuantity(e) {
    const quantity = parseInt(e.currentTarget.dataset.qty);
    this.setData({ quantity });
    this.calculateCost();
  },

  calculateCost() {
    const { stock, quantity, tradeType } = this.data;
    
    if (quantity <= 0) {
      this.setData({
        totalCost: 0,
        commission: 0,
        canTrade: false,
      });
      return;
    }
    
    if (tradeType === 'buy') {
      const costInfo = stockUtil.buyStock(stock.code, quantity, stock.currentPrice);
      this.setData({
        totalCost: costInfo.totalCost,
        commission: costInfo.commission,
        canTrade: costInfo.totalCost <= this.data.userData.cash,
      });
    } else {
      const costInfo = stockUtil.sellStock(stock.code, quantity, stock.currentPrice);
      this.setData({
        totalCost: costInfo.totalAmount,
        commission: costInfo.commission,
        canTrade: quantity <= this.data.maxQuantity,
      });
    }
  },

  confirmTrade() {
    const { stock, quantity, tradeType, totalCost, userData } = this.data;
    
    if (quantity <= 0) {
      wx.showToast({
        title: '请输入数量',
        icon: 'none',
      });
      return;
    }
    
    if (!this.data.canTrade) {
      wx.showToast({
        title: tradeType === 'buy' ? '余额不足' : '数量不足',
        icon: 'none',
      });
      return;
    }
    
    wx.showModal({
      title: '确认交易',
      content: `确定要${tradeType === 'buy' ? '买入' : '卖出'} ${stock.name} ${quantity}股吗？`,
      success: (res) => {
        if (res.confirm) {
          this.executeTrade(stock, quantity, tradeType, totalCost);
        }
      },
    });
  },

  executeTrade(stock, quantity, tradeType, totalCost) {
    let userData = app.getUserData();
    const now = dateUtil.getCurrentDateTime();
    
    if (tradeType === 'buy') {
      userData.cash -= totalCost;
      
      const existingIndex = userData.stocks.findIndex(s => s.code === stock.code);
      if (existingIndex > -1) {
        const existing = userData.stocks[existingIndex];
        const totalQuantity = existing.quantity + quantity;
        const totalCost = existing.cost + stock.currentPrice * quantity;
        userData.stocks[existingIndex] = {
          ...existing,
          quantity: totalQuantity,
          cost: totalCost,
          currentPrice: stock.currentPrice,
        };
      } else {
        userData.stocks.push({
          code: stock.code,
          name: stock.name,
          quantity: quantity,
          cost: stock.currentPrice * quantity,
          currentPrice: stock.currentPrice,
          buyPrice: stock.currentPrice,
        });
      }
      
      userData.history.unshift({
        type: 'buy',
        code: stock.code,
        name: stock.name,
        quantity: quantity,
        price: stock.currentPrice,
        amount: totalCost,
        time: now,
      });
      
    } else {
      const sellInfo = stockUtil.sellStock(stock.code, quantity, stock.currentPrice);
      userData.cash += sellInfo.totalAmount;
      
      const existingIndex = userData.stocks.findIndex(s => s.code === stock.code);
      if (existingIndex > -1) {
        const existing = userData.stocks[existingIndex];
        existing.quantity -= quantity;
        existing.currentPrice = stock.currentPrice;
        
        if (existing.quantity <= 0) {
          userData.stocks.splice(existingIndex, 1);
        }
      }
      
      userData.history.unshift({
        type: 'sell',
        code: stock.code,
        name: stock.name,
        quantity: quantity,
        price: stock.currentPrice,
        amount: sellInfo.totalAmount,
        profit: sellInfo.totalAmount - (stock.currentPrice * quantity),
        time: now,
      });
    }
    
    userData.totalAssets = userData.cash + userData.stocks.reduce((sum, s) => sum + s.quantity * s.currentPrice, 0);
    userData.profit = userData.totalAssets - app.globalData.initialMoney;
    
    app.updateUserData(userData);
    
    wx.showToast({
      title: '交易成功',
      icon: 'success',
      duration: 1500,
    });
    
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  },
})
