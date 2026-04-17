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
    this.calculateMyRank();
    this.generateMockRanking();
  },

  onShow() {
    this.calculateMyRank();
  },

  calculateMyRank() {
    const userData = app.getUserData();
    const totalAssets = userData.cash + userData.stocks.reduce((sum, s) => sum + s.quantity * s.currentPrice, 0);
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
      return { ...item, assets };
    });
    
    rankList.sort((a, b) => b.assets - a.assets);
    
    const myRank = rankList.findIndex(item => Math.abs(item.assets - totalAssets) < 0.01) + 1;
    
    rankList.unshift({
      name: '我',
      assets: totalAssets,
      profit: totalAssets - app.globalData.initialMoney,
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
      { name: '股神巴韭特', profit: 25000, initialAssets: 100000 },
      { name: '韭菜不想哭', profit: 18000, initialAssets: 100000 },
      { name: '追涨杀跌侠', profit: 12000, initialAssets: 100000 },
      { name: '价值投资者', profit: 8500, initialAssets: 100000 },
      { name: '短线王', profit: 6200, initialAssets: 100000 },
      { name: '趋势跟踪者', profit: 4500, initialAssets: 100000 },
      { name: '波段操作手', profit: 2800, initialAssets: 100000 },
      { name: '稳健理财', profit: 1500, initialAssets: 100000 },
      { name: '小试牛刀', profit: 800, initialAssets: 100000 },
      { name: '新股民', profit: 200, initialAssets: 100000 },
    ];
    
    this.setData({
      rankList: mockPlayers,
    });
  },
})
