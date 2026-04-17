const app = getApp();

Page({
  data: {
    history: [],
    filterType: 'all',
  },

  onShow() {
    this.loadData();
  },

  loadData() {
    const userData = app.getUserData();
    this.setData({
      history: userData.history,
    });
  },

  filterHistory(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      filterType: type,
    });
  },

  getFilteredHistory() {
    const { history, filterType } = this.data;
    if (filterType === 'all') {
      return history;
    }
    return history.filter(item => item.type === filterType);
  },
})
