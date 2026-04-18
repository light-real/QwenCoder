class BinanceService {
  constructor() {
    this.ws = null;
    this.callbacks = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 2000;
    this.isConnected = false;
    this.pingInterval = null;
    this.streams = [];
    this.currentSymbols = [];
    this.priceCache = {};
  }

  fetchKlines(symbol, interval, limit) {
    const self = this;
    return new Promise(function(resolve, reject) {
      const url = 'https://api.binance.com/api/v3/klines?symbol=' + symbol.toUpperCase() + '&interval=' + interval + '&limit=' + limit;
      console.log('Calling API:', url);
      
      wx.request({
        url: url,
        method: 'GET',
        timeout: 10000,
        success: function(res) {
          console.log('API Response:', JSON.stringify(res));
          
          if (res.statusCode === 200 && Array.isArray(res.data)) {
            const klines = res.data.map(function(k) {
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
            });
            
            console.log('Parsed klines:', klines.length);
            resolve(klines);
          } else {
            console.error('Invalid response:', res);
            reject(new Error('Invalid API response'));
          }
        },
        fail: function(err) {
          console.error('fetchKlines failed:', err);
          reject(err);
        }
      });
    });
  }

  async fetchInitialPrice(symbol) {
    const self = this;
    return new Promise(function(resolve, reject) {
      const url = 'https://api.binance.com/api/v3/ticker/price?symbol=' + symbol.toUpperCase();
      console.log('Fetching price:', url);
      
      wx.request({
        url: url,
        method: 'GET',
        timeout: 10000,
        success: function(res) {
          console.log('Response:', JSON.stringify(res));
          
          if (res.statusCode === 200 && res.data && res.data.price) {
            const price = parseFloat(res.data.price);
            self.priceCache[symbol] = price;
            resolve(price);
          } else {
            console.error('Invalid response:', res);
            if (self.priceCache && self.priceCache[symbol]) {
              resolve(self.priceCache[symbol]);
            } else {
              reject(new Error('Invalid response'));
            }
          }
        },
        fail: function(err) {
          console.error('Request failed:', err);
          if (self.priceCache && self.priceCache[symbol]) {
            resolve(self.priceCache[symbol]);
          } else {
            reject(err);
          }
        }
      });
    });
  }

  fetchAllPrices(symbols) {
    const self = this;
    const promises = symbols.map(function(s) {
      return self.fetchInitialPrice(s);
    });
    return Promise.all(promises);
  }

  connect(symbols, intervals) {
    const self = this;
    return new Promise(function(resolve, reject) {
      try {
        const streams = self.buildStreamNames(symbols, intervals);
        self.streams = streams;
        self.currentSymbols = symbols;
        const wsUrl = 'wss://stream.binance.com:9443/stream?streams=' + streams.join('/');

        console.log('WebSocket URL:', wsUrl);

        self.ws = wx.connectSocket({
          url: wsUrl
        });

        self.ws.onOpen(function() {
          console.log('WebSocket connected');
          self.isConnected = true;
          const cb = self.callbacks.get('connect');
          if (cb) cb({ status: 'connected' });
          resolve({ status: 'connected' });
        });

        self.ws.onMessage(function(res) {
          try {
            const msg = JSON.parse(res.data);
            if (msg.stream && msg.data) {
              self.dispatchStream(msg.stream, msg.data);
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        });

        self.ws.onClose(function() {
          console.log('WebSocket closed');
          self.isConnected = false;
        });

        self.ws.onError(function(err) {
          console.error('WebSocket error:', err);
        });

      } catch (err) {
        reject(err);
      }
    });
  }

  buildStreamNames(symbols, intervals) {
    const names = [];
    symbols.forEach(function(symbol) {
      const s = symbol.toLowerCase();
      names.push(s + '@miniTicker');
      intervals.forEach(function(int) {
        names.push(s + '@kline_' + int);
      });
      names.push(s + '@aggTrade');
      names.push(s + '@depth20@100ms');
    });
    return names;
  }

  dispatchStream(stream, data) {
    if (stream.indexOf('@kline_') > -1) this.handleKline(data);
    else if (stream.indexOf('@miniTicker') > -1) this.handleTicker(data);
  }

  handleKline(k) {
    const cb = this.callbacks.get('kline');
    if (cb) cb({
      symbol: k.s,
      interval: k.k.i,
      time: k.k.t,
      open: parseFloat(k.k.o),
      high: parseFloat(k.k.h),
      low: parseFloat(k.k.l),
      close: parseFloat(k.k.c),
      volume: parseFloat(k.k.v),
      isClosed: k.k.x,
      date: formatDate(k.k.t)
    });
  }

  handleTicker(t) {
    const cb = this.callbacks.get('ticker');
    if (cb) cb({
      symbol: t.s,
      closePrice: parseFloat(t.c),
      openPrice: parseFloat(t.o),
      high: parseFloat(t.h),
      low: parseFloat(t.l),
      change: parseFloat(t.c) - parseFloat(t.o),
      changePercent: ((parseFloat(t.c) - parseFloat(t.o)) / parseFloat(t.o) * 100).toFixed(2)
    });
  }

  on(event, callback) {
    this.callbacks.set(event, callback);
  }

  close() {
    if (this.ws) {
      wx.closeSocket();
      this.ws = null;
    }
    this.isConnected = false;
    this.callbacks.clear();
  }

  reconnect(symbols, intervals) {
    this.close();
    const self = this;
    setTimeout(function() {
      self.connect(symbols, intervals);
    }, 1000);
  }
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
