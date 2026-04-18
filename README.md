# Stock Trading Simulator - WeChat Mini Program

A clean and beautiful stock trading simulation game for WeChat Mini Program.

## Features

- Real-time Market: Simulated stock market with auto-updating prices
- Buy/Sell: Support buying and selling stocks
- Portfolio: View current holdings and profit/loss
- Transaction History: View all trading records
- Rankings: Compare returns with virtual players
- Beginner Friendly: Start with 100,000 virtual cash

## Tech Stack

- WeChat Mini Program (MINA)
- JavaScript ES6+
- WXML + WXSS

## Project Structure

```
StockGame/
 app.js              # Application entry
 app.json            # Application config
 app.wxss            # Global styles
 pages/
    index/         # Market page
    trade/         # Trading page
    portfolio/     # Portfolio page
    history/       # History page
    rank/          # Ranking page
 utils/
    stock.js       # Stock utilities
    date.js        # Date formatting
 sitemap.json       # SEO config
```

## Quick Start

### Requirements

- WeChat Developer Tools
- WeChat Mini Program AppID

### Steps

1. Clone or download project to local

2. Open WeChat Developer Tools
   - Download: https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html

3. Import Project
   - Click "Import Project"
   - Select `StockGame` folder
   - Fill in AppID (can use test ID)
   - Click "Confirm"

4. Build and Run
   - Auto-compile will start
   - Press Ctrl+B or click "Build"
   - View in simulator

## Usage

### Market Page
- View all stocks with real-time prices
- Tap stock to enter trading page

### Trading Page
- Select buy or sell
- Enter quantity
- Quick buttons: 1, 5, 10, All
- Shows fees and total amount
- Confirm to execute trade

### Portfolio Page
- View held stocks
- Shows cost and P/L for each stock
- Tap to trade

### History Page
- View all transactions
- Filter by type (all/buy/sell)
- Shows detailed info

### Ranking Page
- View returns ranking
- Compare with virtual players
- See your position

## Trading Rules

### Fees
- Buy: Commission 0.03% + Stamp 0.1%
- Sell: Commission 0.03% + Stamp 0.1% + Transfer 0.02%

### Initial Capital
- Each user starts with: 100,000

## Notes

1. Data is simulated only - no real market impact
2. Stock prices use random algorithm
3. All data stored locally

## License

MIT License

## Resources

- [WeChat Mini Program Docs](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [WeChat Dev Tools](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
