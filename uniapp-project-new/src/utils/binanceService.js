/**
 * Binance 合约行情服务（纯 REST 轮询版）
 * uni-app 版本：wx.request → uni.request
 */

// H5 开发环境（Vite devServer）走代理；Capacitor App 或生产环境直接请求 Binance
// Capacitor App 的 hostname 是 localhost，但 window.Capacitor 存在
const IS_CAPACITOR = typeof window !== 'undefined' && !!(window.Capacitor);
const IS_H5_DEV = !IS_CAPACITOR &&
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
  typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

const BASE = IS_H5_DEV
  ? '/fapi/v1'
  : 'https://fapi.binance.com/fapi/v1';
const EXCHANGE_INFO_URL = IS_H5_DEV
  ? '/fapi/v1/exchangeInfo'
  : 'https://fapi.binance.com/fapi/v1/exchangeInfo';

// 主流币种主题色映射
const COIN_COLORS = {
  BTC: '#f7931a',
  ETH: '#627eea',
  BNB: '#f3ba2f',
  SOL: '#9945ff',
  XRP: '#00aae4',
  DOGE: '#c2a633',
  ADA: '#0033ad',
  AVAX: '#e84142',
  DOT: '#e6007a',
  LINK: '#2a5ada',
  MATIC: '#8247e5',
  UNI: '#ff007a',
  ATOM: '#2e3148',
  LTC: '#bfbbbb',
  BCH: '#8dc351',
  NEAR: '#00c08b',
  FIL: '#0096dc',
  APT: '#acb9cd',
  ARB: '#28a0f0',
  OP: '#ff0420',
};

// 根据symbol获取主题色
function getCoinColor(symbol) {
  const coin = symbol.replace('USDT', '').toUpperCase();
  return COIN_COLORS[coin] || '#6b7280';
}

class BinanceService {
  constructor() {
    this.listeners = {};
    this.isConnected = false;
    this.streams = [];
    this.currentSymbols = [];
    this.currentIntervals = [];
    this.priceCache = {};

    this._tickerTimer = null;
    this._polling = false;
  }

  // ─── REST: 获取所有 USDT 永续合约列表 ─────────────────────────
  fetchAllSymbols() {
    return new Promise(function(resolve, reject) {
      uni.request({
        url: EXCHANGE_INFO_URL,
        method: 'GET',
        timeout: 15000,
        success: function(res) {
          if (res.statusCode === 200 && res.data && res.data.symbols) {
            const symbols = res.data.symbols
              .filter(function(s) {
                // 只要 USDT 本位合约，且状态为 TRADING
                return s.contractType === 'PERPETUAL' &&
                       s.quoteAsset === 'USDT' &&
                       s.status === 'TRADING';
              })
              .map(function(s) {
                const coin = s.baseAsset;
                return {
                  code: s.symbol,
                  name: coin,
                  symbol: coin,
                  color: getCoinColor(s.symbol),
                  status: s.status,
                };
              })
              .sort(function(a, b) {
                // 按名称排序，主流币种优先
                const priority = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'LINK'];
                const aIdx = priority.indexOf(a.symbol);
                const bIdx = priority.indexOf(b.symbol);
                if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                if (aIdx !== -1) return -1;
                if (bIdx !== -1) return 1;
                return a.symbol.localeCompare(b.symbol);
              });
            resolve(symbols);
          } else {
            reject(new Error('exchangeInfo: invalid response'));
          }
        },
        fail: reject
      });
    });
  }

  // ─── REST: K线 ───────────────────────────────────────────────
  fetchKlines(symbol, interval, limit) {
    return new Promise(function(resolve, reject) {
      uni.request({
        url: BASE + '/klines?symbol=' + symbol.toUpperCase() + '&interval=' + interval + '&limit=' + limit,
        method: 'GET',
        timeout: 10000,
        success: function(res) {
          if (res.statusCode === 200 && Array.isArray(res.data)) {
            resolve(res.data.map(function(k) {
              return {
                time: k[0],
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5]),
                closeTime: k[6],
                date: formatDate(k[0])
              };
            }));
          } else {
            reject(new Error('fetchKlines: ' + res.statusCode));
          }
        },
        fail: reject
      });
    });
  }

  // ─── REST: 单个币种 24h 行情 ─────────────────────────────────
  fetch24hTicker(symbol) {
    return new Promise(function(resolve, reject) {
      uni.request({
        url: BASE + '/ticker/24hr?symbol=' + symbol.toUpperCase(),
        method: 'GET',
        timeout: 10000,
        success: function(res) {
          if (res.statusCode === 200 && res.data && res.data.lastPrice) {
            resolve(parseTicker(res.data));
          } else {
            reject(new Error('fetch24hTicker: invalid response'));
          }
        },
        fail: reject
      });
    });
  }

  // ─── REST: 批量查询多个币种 24h 行情 ─────────────────────────
  _fetchAllTickers(symbols) {
    const self = this;
    return new Promise(function(resolve, reject) {
      uni.request({
        url: BASE + '/ticker/24hr',
        method: 'GET',
        timeout: 10000,
        success: function(res) {
          if (res.statusCode === 200 && Array.isArray(res.data)) {
            const symSet = {};
            symbols.forEach(function(s) { symSet[s.toUpperCase()] = true; });
            const result = [];
            res.data.forEach(function(d) {
              if (symSet[d.symbol]) result.push(parseTicker(d));
            });
            resolve(result);
          } else {
            reject(new Error('_fetchAllTickers: ' + res.statusCode));
          }
        },
        fail: reject
      });
    });
  }

  // ─── 启动轮询 ────────────────────────────────────────────────
  connect(symbols, intervals) {
    this.currentSymbols = symbols;
    this.currentIntervals = intervals;
    this.streams = this._buildStreamNames(symbols, intervals);
    this._startPolling(symbols);
    this.isConnected = true;
    return Promise.resolve({ status: 'connected' });
  }

  reconnect(symbols, intervals) {
    this.close();
    this.connect(symbols, intervals);
  }

  close() {
    this._stopPolling();
    this.isConnected = false;
  }

  _startPolling(symbols) {
    if (this._polling) this._stopPolling();
    this._polling = true;
    const self = this;
    self._doPoll(symbols);
    this._tickerTimer = setInterval(function() {
      self._doPoll(symbols);
    }, 2000);
  }

  _stopPolling() {
    this._polling = false;
    if (this._tickerTimer) {
      clearInterval(this._tickerTimer);
      this._tickerTimer = null;
    }
  }

  _doPoll(symbols) {
    const self = this;
    if (symbols.length === 1) {
      uni.request({
        url: BASE + '/ticker/24hr?symbol=' + symbols[0].toUpperCase(),
        method: 'GET',
        timeout: 8000,
        success: function(res) {
          if (res.statusCode === 200 && res.data && res.data.lastPrice) {
            const ticker = parseTicker(res.data);
            self._emitTicker(ticker);
          }
        },
        fail: function() {}
      });
    } else {
      self._fetchAllTickers(symbols)
        .then(function(tickers) {
          tickers.forEach(function(ticker) { self._emitTicker(ticker); });
        })
        .catch(function() {});
    }

    if ((self.listeners['kline'] || []).length > 0 && self.currentIntervals.length > 0) {
      symbols.forEach(function(symbol) {
        self.currentIntervals.forEach(function(interval) {
          self._pollLatestKline(symbol, interval);
        });
      });
    }
  }

  _pollLatestKline(symbol, interval) {
    const self = this;
    uni.request({
      url: BASE + '/klines?symbol=' + symbol.toUpperCase() + '&interval=' + interval + '&limit=2',
      method: 'GET',
      timeout: 8000,
      success: function(res) {
        if (res.statusCode === 200 && Array.isArray(res.data) && res.data.length > 0) {
          if ((self.listeners['kline'] || []).length === 0) return;
          const k = res.data[res.data.length - 1];
          self._emitKline({
            symbol: symbol.toUpperCase(),
            interval: interval,
            time: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            isClosed: false,
            date: formatDate(k[0])
          });
        }
      },
      fail: function() {}
    });
  }

  _emitTicker(ticker) {
    const cbs = this.listeners['ticker'] || [];
    cbs.forEach(function(cb) { cb(ticker); });
  }

  _emitKline(kline) {
    const cbs = this.listeners['kline'] || [];
    cbs.forEach(function(cb) { cb(kline); });
  }

  _emitKlineClosed(kline) {
    const cbs = this.listeners['klineClosed'] || [];
    cbs.forEach(function(cb) { cb(kline); });
  }

  setOpenPrice(symbol, openPrice) {
    const sym = symbol.toUpperCase();
    if (!this.priceCache[sym]) this.priceCache[sym] = {};
    this.priceCache[sym].openPrice = openPrice;
  }

  _buildStreamNames(symbols, intervals) {
    const names = [];
    symbols.forEach(function(s) {
      names.push(s.toLowerCase() + '@markPrice@1s');
      intervals.forEach(function(i) {
        names.push(s.toLowerCase() + '@kline_' + i);
      });
    });
    return names;
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    if (this.listeners[event].indexOf(callback) === -1) {
      this.listeners[event].push(callback);
    }
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    if (callback) {
      this.listeners[event] = this.listeners[event].filter(function(cb) {
        return cb !== callback;
      });
    } else {
      this.listeners[event] = [];
    }
  }
}

function parseTicker(d) {
  const price = parseFloat(d.lastPrice);
  const priceDec = price >= 1000 ? 2 : price >= 1 ? 4 : 6;
  return {
    symbol: d.symbol,
    closePrice: price,
    displayPrice: price.toFixed(priceDec),
    priceChange: parseFloat(d.priceChange).toFixed(2),
    priceChangePercent: parseFloat(d.priceChangePercent).toFixed(2),
    high: parseFloat(d.highPrice),
    low: parseFloat(d.lowPrice),
    volume: parseFloat(d.volume),
  };
}

function formatDate(ts) {
  const d = new Date(ts);
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return month + '-' + date + ' ' + hours + ':' + minutes;
}

export default new BinanceService();
