/**
 * Binance 合约行情服务（纯 REST 轮询版）
 *
 * 由于 fstream.binance.com WebSocket 在当前网络环境下无法连接，
 * 改用 REST API 定时轮询实现实时数据更新：
 *   - ticker 价格：每 2 秒轮询一次 /fapi/v1/ticker/24hr
 *   - K线数据：由外部页面按需拉取，不在此轮询
 */

var BASE = 'https://fapi.binance.com/fapi/v1';

class BinanceService {
  constructor() {
    this.listeners = {};           // event -> [callback, ...] 支持多个监听器
    this.isConnected = false;      // 兼容外部判断，轮询中视为 connected
    this.streams = [];             // 兼容外部判断订阅的流
    this.currentSymbols = [];
    this.currentIntervals = [];
    this.priceCache = {};          // symbol -> { openPrice, lastPrice }

    this._tickerTimer = null;      // 价格轮询定时器
    this._polling = false;         // 是否正在轮询
  }

  // ─── REST: K线 ───────────────────────────────────────────────
  fetchKlines(symbol, interval, limit) {
    return new Promise(function(resolve, reject) {
      wx.request({
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

  // ─── REST: 单个币种 24h 行情 ──────────────────────────────────
  fetch24hTicker(symbol) {
    return new Promise(function(resolve, reject) {
      wx.request({
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

  // ─── REST: 批量查询多个币种 24h 行情（无参数时返回全部）────────
  _fetchAllTickers(symbols) {
    const self = this;
    return new Promise(function(resolve, reject) {
      wx.request({
        // 不带 symbol 参数返回全部合约行情，然后客户端过滤
        url: BASE + '/ticker/24hr',
        method: 'GET',
        timeout: 10000,
        success: function(res) {
          if (res.statusCode === 200 && Array.isArray(res.data)) {
            const symSet = {};
            symbols.forEach(function(s) { symSet[s.toUpperCase()] = true; });
            const result = [];
            res.data.forEach(function(d) {
              if (symSet[d.symbol]) {
                result.push(parseTicker(d));
              }
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

  // ─── 启动轮询（对外接口保持 connect 签名）────────────────────
  connect(symbols, intervals) {
    this.currentSymbols = symbols;
    this.currentIntervals = intervals;
    // 构建 streams 列表（供外部判断）
    this.streams = this._buildStreamNames(symbols, intervals);
    this._startPolling(symbols);
    this.isConnected = true;
    return Promise.resolve({ status: 'connected' });
  }

  // 切换订阅（切换币种/周期）
  reconnect(symbols, intervals) {
    this.close();
    this.connect(symbols, intervals);
  }

  // 停止轮询
  close() {
    this._stopPolling();
    this.isConnected = false;
  }

  // ─── 内部：启动/停止轮询 ─────────────────────────────────────
  _startPolling(symbols) {
    if (this._polling) this._stopPolling();
    this._polling = true;
    const self = this;

    // 立即执行一次，然后每 2 秒一次
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
    // 单个币种直接用 symbol 参数（更快），多个币种用批量接口
    if (symbols.length === 1) {
      wx.request({
        url: BASE + '/ticker/24hr?symbol=' + symbols[0].toUpperCase(),
        method: 'GET',
        timeout: 8000,
        success: function(res) {
          if (res.statusCode === 200 && res.data && res.data.lastPrice) {
            const ticker = parseTicker(res.data);
            self._emitTicker(ticker);
          }
        },
        fail: function() { /* 静默失败，下次继续 */ }
      });
    } else {
      self._fetchAllTickers(symbols)
        .then(function(tickers) {
          tickers.forEach(function(ticker) {
            self._emitTicker(ticker);
          });
        })
        .catch(function() { /* 静默失败 */ });
    }

    // K线实时更新：轮询最新一根K线（只在有 kline 监听器时才拉）
    if ((self.listeners['kline'] || []).length > 0 && self.currentIntervals.length > 0) {
      symbols.forEach(function(symbol) {
        self.currentIntervals.forEach(function(interval) {
          self._pollLatestKline(symbol, interval);
        });
      });
    }
  }

  // 拉取最新 2 根K线（用来判断最新一根是否更新）
  _pollLatestKline(symbol, interval) {
    const self = this;
    wx.request({
      url: BASE + '/klines?symbol=' + symbol.toUpperCase() + '&interval=' + interval + '&limit=2',
      method: 'GET',
      timeout: 8000,
      success: function(res) {
        if (res.statusCode === 200 && Array.isArray(res.data) && res.data.length > 0) {
          if ((self.listeners['kline'] || []).length === 0) return;
          // 取最后一根（当前未收盘的K线）
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

  // 触发 ticker 回调（通知所有监听器）
  _emitTicker(ticker) {
    const cbs = this.listeners['ticker'] || [];
    cbs.forEach(function(cb) { cb(ticker); });
  }

  // 触发 kline 回调
  _emitKline(kline) {
    const cbs = this.listeners['kline'] || [];
    cbs.forEach(function(cb) { cb(kline); });
  }

  // 触发 klineClosed 回调
  _emitKlineClosed(kline) {
    const cbs = this.listeners['klineClosed'] || [];
    cbs.forEach(function(cb) { cb(kline); });
  }

  // 设置24h开盘价（外部注入，已有 fetch24hTicker 后可不用）
  setOpenPrice(symbol, openPrice) {
    const sym = symbol.toUpperCase();
    if (!this.priceCache[sym]) this.priceCache[sym] = {};
    this.priceCache[sym].openPrice = openPrice;
  }

  // 构建 streams 标识列表（用于外部判断当前订阅的流）
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

  // 注册事件监听器（支持多个，不会覆盖已有的）
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    // 避免重复注册同一个函数引用
    if (this.listeners[event].indexOf(callback) === -1) {
      this.listeners[event].push(callback);
    }
  }

  // 取消注册事件监听器
  off(event, callback) {
    if (!this.listeners[event]) return;
    if (callback) {
      this.listeners[event] = this.listeners[event].filter(function(cb) {
        return cb !== callback;
      });
    } else {
      // 不传 callback 则清除该事件所有监听器
      this.listeners[event] = [];
    }
  }
}

// 解析 Binance 24hr ticker 响应为统一格式
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

module.exports = new BinanceService();
