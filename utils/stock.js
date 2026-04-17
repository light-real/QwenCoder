const stockList = [
  { code: '600519', name: 'Kweichow Moutai', basePrice: 1800, industry: 'Liquor' },
  { code: '000858', name: 'Wuliangye Yibin', basePrice: 150, industry: 'Liquor' },
  { code: '601318', name: 'Ping An Insurance', basePrice: 45, industry: 'Insurance' },
  { code: '600036', name: 'China Merchants Bank', basePrice: 35, industry: 'Banking' },
  { code: '000001', name: 'Ping An Bank', basePrice: 12, industry: 'Banking' },
  { code: '600276', name: 'Hengrui Medicine', basePrice: 28, industry: 'Pharma' },
  { code: '000333', name: 'Midea Group', basePrice: 55, industry: 'Appliance' },
  { code: '600887', name: 'Inner Mongolia Yili', basePrice: 25, industry: 'Food' },
  { code: '002594', name: 'BYD', basePrice: 180, industry: 'Auto' },
  { code: '300750', name: 'CATL', basePrice: 180, industry: 'New Energy' },
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

function generateKLineData(code, days = 30) {
  const stock = getStockByCode(code);
  if (!stock) return [];
  
  const data = [];
  let price = stock.basePrice;
  const now = new Date();
  
  for (let i = days; i > 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const open = price;
    const changePercent = (Math.random() - 0.5) * 0.08;
    const close = open * (1 + changePercent);
    
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    
    const volume = Math.floor(Math.random() * 10000000) + 1000000;
    
    data.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      open: parseFloat(open.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      volume: volume,
    });
    
    price = close;
  }
  
  return data;
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
  generateKLineData,
  buyStock,
  sellStock,
  calculateProfit,
};
