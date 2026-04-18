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
    const rawHistory = userData.history || [];
    // 格式化每条记录，方便 wxml 渲染
    const history = rawHistory.map(item => this._formatItem(item));
    this.setData({ history, filteredHistory: history, filterType: 'all' });
  },

  _formatItem(item) {
    const type = item.type; // 'buy' | 'sell' | 'close_buy' | 'close_sell'
    // 标签文字
    const typeLabel = type === 'buy' ? '开多'
      : type === 'sell' ? '开空'
      : type === 'close_buy' ? '平多'
      : '平空';
    // 颜色类
    const typeClass = (type === 'buy' || type === 'close_sell') ? 'long' : 'short';

    // 开仓：显示保证金；平仓：显示净盈亏
    let amountLabel, amountVal, amountClass;
    if (type === 'buy' || type === 'sell') {
      // 开仓：扣除保证金
      amountLabel = '保证金';
      amountVal = '-' + parseFloat(item.margin || 0).toFixed(2) + ' USDT';
      amountClass = 'amount-open';
    } else {
      // 平仓：展示净盈亏
      const pnl = parseFloat(item.pnl || 0);
      amountLabel = '盈亏';
      amountVal = (pnl >= 0 ? '+' : '') + pnl.toFixed(2) + ' USDT';
      amountClass = pnl >= 0 ? 'amount-profit' : 'amount-loss';
    }

    // 数量格式化
    const qty = parseFloat(item.quantity || 0).toFixed(6);
    // 价格
    const price = parseFloat(item.price || 0).toFixed(2);
    // 杠杆
    const leverage = item.leverage ? item.leverage + 'x' : '--';
    // 名义价值
    const notional = parseFloat(item.notional || item.amount || 0).toFixed(2);

    return {
      ...item,
      typeLabel,
      typeClass,
      amountLabel,
      amountVal,
      amountClass,
      qtyStr: qty,
      priceStr: price,
      leverageStr: leverage,
      notionalStr: notional,
      closeFeeStr: parseFloat(item.closeFee || 0).toFixed(2),
    };
  },

  filterHistory(e) {
    const type = e.currentTarget.dataset.type;
    const { history } = this.data;
    let filteredHistory;
    if (type === 'all') {
      filteredHistory = history;
    } else if (type === 'open') {
      filteredHistory = history.filter(item => item.type === 'buy' || item.type === 'sell');
    } else {
      filteredHistory = history.filter(item => item.type === 'close_buy' || item.type === 'close_sell');
    }
    this.setData({ filterType: type, filteredHistory });
  },
})
