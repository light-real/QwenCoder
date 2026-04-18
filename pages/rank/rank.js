const app = getApp();

Page({
  data: {
    userRank: null,
    totalAssets: 0,
    profit: 0,
    profitRate: 0,
    rankList: [],
  },

  onLoad() {
    this.generateMockRanking();
    this.calculateMyRank();
  },

  onShow() {
    this.calculateMyRank();
  },

  calculateMyRank() {
    const userData = app.getUserData();
    // 合约账户：总资产 = 现金 + 所有持仓保证金
    const totalAssets = userData.cash + userData.stocks.reduce((sum, s) => sum + (s.margin || 0), 0);
    const profit = totalAssets - app.globalData.initialMoney;
    const profitRate = ((profit / app.globalData.initialMoney) * 100).toFixed(2);
    
    this.setData({
      totalAssets,
      profit,
      profitRate,
    });
    
    this.updateRankList();
  },

  updateRankList() {
    const { totalAssets } = this.data;
    const rankList = this.data.rankList.map(item => {
      const assets = item.initialAssets + item.profit;
      const profitRate = ((item.profit / item.initialAssets) * 100).toFixed(2);
      return { ...item, assets, profitRate };
    });
    
    rankList.sort((a, b) => b.assets - a.assets);
    
    const myProfit = totalAssets - app.globalData.initialMoney;
    const myProfitRate = ((myProfit / app.globalData.initialMoney) * 100).toFixed(2);
    
    rankList.unshift({
      name: 'Me',
      assets: totalAssets,
      profit: myProfit,
      profitRate: myProfitRate,
      isMe: true,
    });
    
    rankList.sort((a, b) => b.assets - a.assets);
    
    const myIndex = rankList.findIndex(item => item.isMe);
    this.setData({
      rankList,
      userRank: myIndex + 1,
    });
  },

  generateMockRanking() {
    const mockPlayers = [
      { name: 'Stock Master', profit: 25000, initialAssets: 100000 },
      { name: 'Investor Pro', profit: 18000, initialAssets: 100000 },
      { name: 'Day Trader', profit: 12000, initialAssets: 100000 },
      { name: 'Value Investor', profit: 8500, initialAssets: 100000 },
      { name: 'Swing Trader', profit: 6200, initialAssets: 100000 },
      { name: 'Trend Follower', profit: 4500, initialAssets: 100000 },
      { name: 'Market Maker', profit: 2800, initialAssets: 100000 },
      { name: 'Risk Manager', profit: 1500, initialAssets: 100000 },
      { name: 'Beginner', profit: 800, initialAssets: 100000 },
      { name: 'Novice', profit: 200, initialAssets: 100000 },
    ];
    
    this.setData({
      rankList: mockPlayers,
    });
  },
})
