import binanceService from './binanceService.js';

// 默认自选币种（首次使用时）
const DEFAULT_FAVORITES = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'];

// 兜底默认列表（网络失败时使用）
const FALLBACK_LIST = [
  { code: 'BTCUSDT',  name: 'BTC',  symbol: 'BTC',  color: '#f7931a' },
  { code: 'ETHUSDT',  name: 'ETH',  symbol: 'ETH',  color: '#627eea' },
  { code: 'BNBUSDT',  name: 'BNB',  symbol: 'BNB',  color: '#f3ba2f' },
  { code: 'SOLUSDT',  name: 'SOL',  symbol: 'SOL',  color: '#9945ff' },
  { code: 'XRPUSDT',  name: 'XRP',  symbol: 'XRP',  color: '#00aae4' },
  { code: 'DOGEUSDT', name: 'DOGE', symbol: 'DOGE', color: '#c2a633' },
];

// 缓存：全量合约列表
let allSymbolsCache = null;

// 获取全量合约列表（从API动态加载）
async function fetchAllSymbols() {
  if (allSymbolsCache) return allSymbolsCache;
  try {
    const symbols = await binanceService.fetchAllSymbols();
    allSymbolsCache = symbols;
    return symbols;
  } catch (err) {
    console.warn('[stock.js] fetchAllSymbols failed, use fallback:', err);
    return FALLBACK_LIST;
  }
}

// 获取用户自选列表（存储在本地）
function getFavorites() {
  const fav = uni.getStorageSync('favoriteSymbols');
  if (fav && Array.isArray(fav) && fav.length > 0) {
    return fav;
  }
  return DEFAULT_FAVORITES;
}

// 设置用户自选列表
function setFavorites(symbols) {
  uni.setStorageSync('favoriteSymbols', symbols);
}

// 添加自选
function addFavorite(code) {
  const fav = getFavorites();
  if (fav.indexOf(code) === -1) {
    fav.push(code);
    setFavorites(fav);
  }
}

// 移除自选
function removeFavorite(code) {
  const fav = getFavorites().filter(function(s) { return s !== code; });
  setFavorites(fav);
}

// 判断是否已自选
function isFavorite(code) {
  return getFavorites().indexOf(code) !== -1;
}

// 根据自选列表筛选合约
async function getFavoriteStocks() {
  const allSymbols = await fetchAllSymbols();
  const favCodes = getFavorites();
  return allSymbols.filter(function(s) {
    return favCodes.indexOf(s.code) !== -1;
  });
}

// 获取所有合约（带缓存）
async function getAllStocks() {
  return await fetchAllSymbols();
}

// 根据 code 获取单个合约信息
async function getStockByCode(code) {
  const allSymbols = await fetchAllSymbols();
  return allSymbols.find(function(s) { return s.code === code; });
}

// 计算盈亏
function calculateProfit(stocks) {
  let totalCost = 0;
  let totalCurrentValue = 0;
  stocks.forEach(function(stock) {
    totalCost += stock.cost;
    const currentValue = stock.quantity * stock.currentPrice;
    totalCurrentValue += currentValue;
  });
  return {
    profit: totalCurrentValue - totalCost,
    profitRate: totalCost > 0 ? ((totalCurrentValue - totalCost) / totalCost * 100).toFixed(2) : 0,
  };
}

export {
  fetchAllSymbols,
  getFavorites,
  setFavorites,
  addFavorite,
  removeFavorite,
  isFavorite,
  getFavoriteStocks,
  getAllStocks,
  getStockByCode,
  calculateProfit,
  FALLBACK_LIST,
};
