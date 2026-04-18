class FormatData {
  static formatPrice(price, decimals = 2) {
    if (!price && price !== 0) return '0.00';
    const num = parseFloat(price);
    if (isNaN(num)) return '0.00';
    return num.toFixed(decimals);
  }

  static formatVolume(volume) {
    if (!volume && volume !== 0) return '0';
    const num = parseFloat(volume);
    if (isNaN(num)) return '0';
    
    if (num >= 1e9) {
      return (num / 1e9).toFixed(2) + 'B';
    } else if (num >= 1e6) {
      return (num / 1e6).toFixed(2) + 'M';
    } else if (num >= 1e3) {
      return (num / 1e3).toFixed(2) + 'K';
    }
    return num.toFixed(2);
  }

  static formatPercent(percent) {
    if (!percent && percent !== 0) return '0.00%';
    const num = parseFloat(percent);
    if (isNaN(num)) return '0.00%';
    const sign = num >= 0 ? '+' : '';
    return sign + num.toFixed(2) + '%';
  }

  static formatTimestamp(timestamp, format = 'datetime') {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    
    if (format === 'time') {
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    } else if (format === 'date') {
      return `${date.getMonth() + 1}-${date.getDate()}`;
    } else if (format === 'datetime') {
      return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (format === 'full') {
      return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    }
    
    return date.toLocaleString();
  }

  static formatKlineDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }

  static formatCurrency(amount) {
    if (!amount && amount !== 0) return '$0.00';
    const num = parseFloat(amount);
    if (isNaN(num)) return '$0.00';
    return '$' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  static formatNumber(num, decimals = 2) {
    if (!num && num !== 0) return '0';
    const n = parseFloat(num);
    if (isNaN(n)) return '0';
    return n.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  static formatSymbol(symbol) {
    if (!symbol) return '';
    return symbol.toUpperCase();
  }

  static formatTradeType(type) {
    const types = {
      'buy': 'Buy',
      'sell': 'Sell',
      'BUY': 'Buy',
      'SELL': 'Sell'
    };
    return types[type] || type;
  }

  static formatInterval(interval) {
    const intervals = {
      '1m': '1 Minute',
      '5m': '5 Minutes',
      '15m': '15 Minutes',
      '30m': '30 Minutes',
      '1h': '1 Hour',
      '4h': '4 Hours',
      '1d': '1 Day',
      '1w': '1 Week'
    };
    return intervals[interval] || interval;
  }

  static normalizeSymbol(symbol) {
    if (!symbol) return '';
    return symbol.toLowerCase();
  }

  static formatDepthData(depth) {
    if (!depth) return { bids: [], asks: [] };
    
    return {
      bids: (depth.bids || []).slice(0, 20).map(bid => ({
        price: this.formatPrice(bid.price || bid[0]),
        quantity: this.formatVolume(bid.quantity || bid[1]),
        total: this.formatVolume((bid.price || bid[0]) * (bid.quantity || bid[1]))
      })),
      asks: (depth.asks || []).slice(0, 20).map(ask => ({
        price: this.formatPrice(ask.price || ask[0]),
        quantity: this.formatVolume(ask.quantity || ask[1]),
        total: this.formatVolume((ask.price || ask[0]) * (ask.quantity || ask[1]))
      }))
    };
  }

  static convertKlineFromBinance(kline) {
    return {
      date: this.formatKlineDate(kline.time),
      open: parseFloat(kline.open),
      high: parseFloat(kline.high),
      low: parseFloat(kline.low),
      close: parseFloat(kline.close),
      volume: parseFloat(kline.volume),
      timestamp: kline.time,
      isClosed: kline.isClosed
    };
  }

  static convertTickerFromBinance(ticker) {
    return {
      symbol: this.formatSymbol(ticker.symbol),
      price: this.formatPrice(ticker.closePrice || ticker.lastPrice),
      change: this.formatPercent(ticker.priceChangePercent || ticker.changePercent),
      changeValue: this.formatPrice(ticker.priceChange || ticker.change),
      high: this.formatPrice(ticker.highPrice),
      low: this.formatPrice(ticker.lowPrice),
      volume: this.formatVolume(ticker.volume),
      quoteVolume: this.formatCurrency(ticker.quoteVolume)
    };
  }

  static formatProfitLoss(current, cost, quantity) {
    const currentTotal = current * quantity;
    const costTotal = cost * quantity;
    const profit = currentTotal - costTotal;
    const profitPercent = ((currentTotal - costTotal) / costTotal * 100).toFixed(2);
    
    return {
      profit: this.formatCurrency(profit),
      profitPercent: this.formatPercent(profitPercent),
      isProfit: profit >= 0
    };
  }

  static validateQuantity(quantity, min = 0, max = Infinity) {
    const num = parseInt(quantity);
    if (isNaN(num) || num < min || num > max) {
      return false;
    }
    return true;
  }

  static calculateCommission(amount, rate = 0.001) {
    const commission = amount * rate;
    return {
      amount: this.formatCurrency(amount),
      commission: this.formatCurrency(commission),
      rate: (rate * 100).toFixed(2) + '%'
    };
  }
}

module.exports = FormatData;
