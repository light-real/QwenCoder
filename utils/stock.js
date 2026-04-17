const stockList = [
  { code: '600519', name: '贵州茅台', basePrice: 1800, industry: '白酒' },
  { code: '000858', name: '五粮液', basePrice: 150, industry: '白酒' },
  { code: '601318', name: '中国平安', basePrice: 45, industry: '保险' },
  { code: '600036', name: '招商银行', basePrice: 35, industry: '银行' },
  { code: '000001', name: '平安银行', basePrice: 12, industry: '银行' },
  { code: '600276', name: '恒瑞医药', basePrice: 28, industry: '医药' },
  { code: '000333', name: '美的集团', basePrice: 55, industry: '家电' },
  { code: '600887', name: '伊利股份', basePrice: 25, industry: '食品' },
  { code: '002594', name: '比亚迪', basePrice: 180, industry: '汽车' },
  { code: '300750', name: '宁德时代', basePrice: 180, industry: '新能源' },
];

const marketStocks = stockList.map(stock => {
  const change = (Math.random() - 0.5) * 0.1;
  const currentPrice = stock.basePrice * (1 + change);
  return {
    ...stock,
    currentPrice: parseFloat(currentPrice.toFixed(2)),
    change: parseFloat((change * 100).toFixed(2)),
    changeAmount: parseFloat((currentPrice - stock.basePrice).toFixed(2)),
  };
});

function updateMarketStocks() {
  marketStocks.forEach(stock => {
    const randomChange = (Math.random() - 0.5) * 0.02;
    const newPrice = stock.currentPrice * (1 + randomChange);
    stock.currentPrice = parseFloat(newPrice.toFixed(2));
    stock.change = parseFloat(((stock.currentPrice - stock.basePrice) / stock.basePrice * 100).toFixed(2));
    stock.changeAmount = parseFloat((stock.currentPrice - stock.basePrice).toFixed(2));
  });
  return marketStocks;
}

function getStockByCode(code) {
  return marketStocks.find(stock => stock.code === code);
}

function buyStock(code, quantity, price) {
  const totalCost = price * quantity;
  const commission = totalCost * 0.0003;
  const stampTax = totalCost * 0.001;
  const totalFee = commission + stampTax;
  
  return {
    totalCost: totalCost + totalFee,
    commission,
    stampTax,
    totalFee: parseFloat(totalFee.toFixed(2)),
  };
}

function sellStock(code, quantity, price) {
  const totalAmount = price * quantity;
  const commission = totalAmount * 0.0003;
  const stampTax = totalAmount * 0.001;
  const transferFee = totalAmount * 0.00002;
  const totalFee = commission + stampTax + transferFee;
  
  return {
    totalAmount: totalAmount - totalFee,
    commission,
    stampTax,
    transferFee,
    totalFee: parseFloat(totalFee.toFixed(2)),
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

module.exports = {
  stockList,
  marketStocks,
  updateMarketStocks,
  getStockByCode,
  buyStock,
  sellStock,
  calculateProfit,
};
