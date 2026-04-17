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
    klineData: [],
    klineInfo: null,
  },

  onLoad(options) {
    const code = options.code;
    const stock = stockUtil.getStockByCode(code);
    const userData = app.getUserData();
    
    const existingStock = userData.stocks.find(s => s.code === code);
    const maxQuantity = existingStock ? existingStock.quantity : Math.floor(userData.cash / stock.currentPrice);
    
    const klineData = stockUtil.generateKLineData(code, 30);
    
    this.setData({
      stock,
      userData,
      maxQuantity,
      quantity: 0,
      klineData: klineData,
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

  onReady() {
    setTimeout(() => {
      this.drawKLine();
    }, 200);
  },

  drawKLine() {
    const klineData = this.data.klineData;
    if (!klineData || klineData.length === 0) {
      console.log('No kline data');
      return;
    }
    
    const ctx = wx.createCanvasContext('klineCanvas', this);
    
    wx.getSystemInfo({
      success: (sysInfo) => {
        const width = sysInfo.windowWidth;
        const height = 300;
        const padding = { top: 20, right: 20, bottom: 40, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        const prices = klineData.map(d => Math.max(d.high, d.low));
        const maxPrice = Math.max(...prices);
        const minPrice = Math.min(...prices);
        const priceRange = maxPrice - minPrice || 1;
        
        const candleWidth = chartWidth / klineData.length * 0.6;
        const gap = chartWidth / klineData.length * 0.4;
        
        ctx.setFillStyle('#18181b');
        ctx.fillRect(0, 0, width, height);
        
        for (let i = 0; i <= 4; i++) {
          const y = padding.top + (chartHeight / 4) * i;
          ctx.setStrokeStyle('#3f3f46');
          ctx.setLineWidth(1);
          ctx.beginPath();
          ctx.moveTo(padding.left, y);
          ctx.lineTo(width - padding.right, y);
          ctx.stroke();
          
          const price = maxPrice - (priceRange / 4) * i;
          ctx.setFillStyle('#71717a');
          ctx.setFontSize(10);
          ctx.setTextAlign('right');
          ctx.fillText(price.toFixed(2), padding.left - 5, y + 4);
        }
        
        for (let i = 0; i < klineData.length; i++) {
          if (i % 5 === 0) {
            const x = padding.left + i * (candleWidth + gap) + candleWidth / 2;
            ctx.setFillStyle('#71717a');
            ctx.setFontSize(10);
            ctx.setTextAlign('center');
            ctx.fillText(klineData[i].date, x, height - 10);
          }
          
          const d = klineData[i];
          const x = padding.left + i * (candleWidth + gap) + gap / 2;
          
          const isUp = d.close >= d.open;
          const color = isUp ? '#22c55e' : '#ef4444';
          
          const openY = padding.top + chartHeight - ((d.open - minPrice) / priceRange * chartHeight);
          const closeY = padding.top + chartHeight - ((d.close - minPrice) / priceRange * chartHeight);
          const highY = padding.top + chartHeight - ((d.high - minPrice) / priceRange * chartHeight);
          const lowY = padding.top + chartHeight - ((d.low - minPrice) / priceRange * chartHeight);
          
          ctx.setStrokeStyle(color);
          ctx.setLineWidth(1);
          ctx.beginPath();
          ctx.moveTo(x + candleWidth / 2, highY);
          ctx.lineTo(x + candleWidth / 2, lowY);
          ctx.stroke();
          
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(Math.abs(closeY - openY), 2);
          
          ctx.setFillStyle(color);
          ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);
        }
        
        ctx.draw();
      }
    });
  },

  onTouchKLine(e) {
    const klineData = this.data.klineData;
    if (!klineData || klineData.length === 0) return;
    
    const x = e.touches[0].x;
    
    wx.getSystemInfo({
      success: (sysInfo) => {
        const width = sysInfo.windowWidth;
        const padding = { left: 60, right: 20 };
        const chartWidth = width - padding.left - padding.right;
        const candleWidth = chartWidth / klineData.length * 0.6;
        const gap = chartWidth / klineData.length * 0.4;
        
        const index = Math.floor((x - padding.left) / (candleWidth + gap));
        
        if (index >= 0 && index < klineData.length) {
          this.setData({
            klineInfo: klineData[index],
          });
        }
      }
    });
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
    const { stock, quantity, tradeType, totalCost } = this.data;
    
    if (quantity <= 0) {
      wx.showToast({
        title: 'Enter quantity',
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
    const msg = `Confirm ${action} ${quantity} shares of ${stock.name}?`;
    
    wx.showModal({
      title: 'Confirm Trade',
      content: msg,
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
        const newCost = existing.cost + stock.currentPrice * quantity;
        userData.stocks[existingIndex] = {
          ...existing,
          quantity: totalQuantity,
          cost: newCost,
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
      title: 'Trade Success',
      icon: 'success',
      duration: 1500,
    });
    
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  },
})
