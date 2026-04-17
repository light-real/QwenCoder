const app = getApp();

Page({
  data: {
    history: [],
    filteredHistory: [],
    filterType: 'all',
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const userData = app.getUserData();
    this.setData({
      history: userData.history,
      filteredHistory: userData.history,
    });
  },

  filterHistory(e) {
    const type = e.currentTarget.dataset.type;
    const { history } = this.data;
    
    let filteredHistory = history;
    if (type !== 'all') {
      filteredHistory = history.filter(item => item.type === type);
    }
    
    this.setData({
      filterType: type,
      filteredHistory,
    });
  },
})
