const cryptoList = [
  { code: 'BTCUSDT', name: 'Bitcoin', symbol: 'BTC', basePrice: 77222.70, industry: 'Cryptocurrency' },
  { code: 'ETHUSDT', name: 'Ethereum', symbol: 'ETH', basePrice: 2417.63, industry: 'Cryptocurrency' },
];

const marketData = cryptoList.map(crypto => ({
  ...crypto,
  currentPrice: crypto.basePrice,
  change: 0,
  changeAmount: 0,
}));

function updateMarketData() {
  return marketData;
}

function getStockByCode(code) {
  return marketData.find(crypto => crypto.code === code);
}

function generateKLineData(code, days = 30) {
  return [];
}

function buyStock(code, quantity, price) {
  const totalCost = price * quantity;
  const commission = totalCost * 0.001;
  
  return {
    totalCost: totalCost + commission,
    commission,
    totalFee: parseFloat(commission.toFixed(2)),
  };
}

function sellStock(code, quantity, price) {
  const totalAmount = price * quantity;
  const commission = totalAmount * 0.001;
  
  return {
    totalAmount: totalAmount - commission,
    commission,
    totalFee: parseFloat(commission.toFixed(2)),
  };
}

function calculateProfit(stocks) {
  let totalCost = 0;
  let totalCurrentValue = 0;
  
  stocks.forEach(stock => {
    totalCost += stock.cost;
    const currentValue = stock.quantity * stock.currentPrice;
    totalCurrentValue += currentValue;
  });
  
  return {
    profit: totalCurrentValue - totalCost,
    profitRate: totalCost > 0 ? ((totalCurrentValue - totalCost) / totalCost * 100).toFixed(2) : 0,
  };
}

function isCryptoStock(code) {
  return cryptoList.some(crypto => crypto.code === code);
}

function getCryptoStocks() {
  return marketData;
}

function getAllStocks() {
  return marketData;
}

module.exports = {
  cryptoList,
  marketData,
  updateMarketData,
  getStockByCode,
  generateKLineData,
  buyStock,
  sellStock,
  calculateProfit,
  isCryptoStock,
  getCryptoStocks,
  getAllStocks,
};
