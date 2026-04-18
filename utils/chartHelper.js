class ChartHelper {
  constructor(canvasId) {
    this.canvasId = canvasId;
    this.ctx = null;
    this.data = [];
    this.width = 0;
    this.height = 0;
    this.padding = { top: 20, right: 20, bottom: 40, left: 60 };
  }

  init(ctx) {
    this.ctx = ctx;
    return this;
  }

  setData(klineData) {
    this.data = klineData;
    return this;
  }

  setDimensions(width, height) {
    this.width = width;
    this.height = height;
    return this;
  }

  setPadding(padding) {
    this.padding = { ...this.padding, ...padding };
    return this;
  }

  getChartArea() {
    return {
      width: this.width - this.padding.left - this.padding.right,
      height: this.height - this.padding.top - this.padding.bottom,
      left: this.padding.left,
      top: this.padding.top,
      right: this.padding.right,
      bottom: this.padding.bottom
    };
  }

  calculatePriceRange() {
    if (this.data.length === 0) {
      return { min: 0, max: 0 };
    }

    const prices = this.data.flatMap(d => [d.high, d.low]);
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const buffer = priceRange * 0.1;
    return {
      min: minPrice - buffer,
      max: maxPrice + buffer,
      range: maxPrice - minPrice + buffer * 2
    };
  }

  priceToY(price, priceRange) {
    const chartArea = this.getChartArea();
    const ratio = (priceRange.max - price) / priceRange.range;
    return chartArea.top + ratio * chartArea.height;
  }

  indexToX(index) {
    const chartArea = this.getChartArea();
    const candleWidth = chartArea.width / this.data.length * 0.6;
    const gap = chartArea.width / this.data.length * 0.4;
    return chartArea.left + index * (candleWidth + gap) + gap / 2;
  }

  clearCanvas() {
    if (this.ctx && this.width && this.height) {
      this.ctx.setFillStyle('#18181b');
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  drawGrid(priceRange) {
    if (!this.ctx) return;

    const chartArea = this.getChartArea();

    this.ctx.setStrokeStyle('#3f3f46');
    this.ctx.setLineWidth(1);

    for (let i = 0; i <= 4; i++) {
      const y = chartArea.top + (chartArea.height / 4) * i;
      
      this.ctx.beginPath();
      this.ctx.moveTo(chartArea.left, y);
      this.ctx.lineTo(this.width - chartArea.right, y);
      this.ctx.stroke();

      const price = priceRange.max - (priceRange.range / 4) * i;
      this.ctx.setFillStyle('#71717a');
      this.ctx.setFontSize(10);
      this.ctx.setTextAlign('right');
      this.ctx.fillText(price.toFixed(2), chartArea.left - 5, y + 4);
    }

    for (let i = 0; i < this.data.length; i++) {
      if (i % 5 === 0) {
        const x = this.indexToX(i) + this.getCandleWidth() / 2;
        this.ctx.setFillStyle('#71717a');
        this.ctx.setFontSize(10);
        this.ctx.setTextAlign('center');
        this.ctx.fillText(this.data[i].date || '', x, this.height - 10);
      }
    }
  }

  getCandleWidth() {
    const chartArea = this.getChartArea();
    return chartArea.width / this.data.length * 0.6;
  }

  drawCandles(priceRange) {
    if (!this.ctx || this.data.length === 0) return;

    const candleWidth = this.getCandleWidth();

    for (let i = 0; i < this.data.length; i++) {
      const d = this.data[i];
      const x = this.indexToX(i);

      const isUp = d.close >= d.open;
      const color = isUp ? '#22c55e' : '#ef4444';

      const openY = this.priceToY(d.open, priceRange);
      const closeY = this.priceToY(d.close, priceRange);
      const highY = this.priceToY(d.high, priceRange);
      const lowY = this.priceToY(d.low, priceRange);

      this.ctx.setStrokeStyle(color);
      this.ctx.setLineWidth(1);
      this.ctx.beginPath();
      this.ctx.moveTo(x + candleWidth / 2, highY);
      this.ctx.lineTo(x + candleWidth / 2, lowY);
      this.ctx.stroke();

      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(Math.abs(closeY - openY), 2);

      this.ctx.setFillStyle(color);
      this.ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);
    }
  }

  drawMA(maData, priceRange, color = '#eab308', label = 'MA') {
    if (!this.ctx || !maData || maData.length === 0) return;

    const candleWidth = this.getCandleWidth();

    this.ctx.setStrokeStyle(color);
    this.ctx.setLineWidth(2);
    this.ctx.beginPath();

    let started = false;
    for (let i = 0; i < this.data.length; i++) {
      if (maData[i] && maData[i] !== null) {
        const x = this.indexToX(i) + candleWidth / 2;
        const y = this.priceToY(maData[i], priceRange);

        if (!started) {
          this.ctx.moveTo(x, y);
          started = true;
        } else {
          this.ctx.lineTo(x, y);
        }
      }
    }

    this.ctx.stroke();
  }

  drawVolume() {
    if (!this.ctx || this.data.length === 0) return;

    const maxVolume = Math.max(...this.data.map(d => d.volume || 0));
    if (maxVolume === 0) return;

    const candleWidth = this.getCandleWidth();
    const chartArea = this.getChartArea();
    const volumeHeight = 40;
    const volumeTop = this.height - volumeHeight;

    for (let i = 0; i < this.data.length; i++) {
      const d = this.data[i];
      const x = this.indexToX(i);

      const isUp = d.close >= d.open;
      const volumeRatio = (d.volume || 0) / maxVolume;
      const barHeight = volumeRatio * (volumeHeight - 10);
      const y = volumeTop + (volumeHeight - 10) - barHeight;

      this.ctx.setFillStyle(isUp ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)');
      this.ctx.fillRect(x, y, candleWidth, barHeight);
    }
  }

  drawCrosshair(x, y, priceRange) {
    if (!this.ctx) return;

    this.ctx.setStrokeStyle('rgba(255, 255, 255, 0.5)');
    this.ctx.setLineWidth(1);
    this.ctx.setLineDash([5, 5]);

    this.ctx.beginPath();
    this.ctx.moveTo(this.padding.left, y);
    this.ctx.lineTo(this.width - this.padding.right, y);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(x, this.padding.top);
    this.ctx.lineTo(x, this.height - this.padding.bottom);
    this.ctx.stroke();

    this.ctx.setLineDash([]);

    const price = priceRange.max - ((y - this.padding.top) / (this.height - this.padding.top - this.padding.bottom)) * priceRange.range;
    
    return price;
  }

  render(options = {}) {
    if (!this.ctx || this.data.length === 0) {
      console.log('No data to render');
      return;
    }

    const priceRange = this.calculatePriceRange();

    this.clearCanvas();
    this.drawGrid(priceRange);
    this.drawCandles(priceRange);

    if (options.showMA5) {
      const ma5Data = this.calculateMA(5);
      this.drawMA(ma5Data, priceRange, '#eab308', 'MA5');
    }

    if (options.showMA10) {
      const ma10Data = this.calculateMA(10);
      this.drawMA(ma10Data, priceRange, '#3b82f6', 'MA10');
    }

    if (options.showVolume) {
      this.drawVolume();
    }

    this.ctx.draw();

    return priceRange;
  }

  calculateMA(period) {
    const maData = [];
    
    for (let i = 0; i < this.data.length; i++) {
      if (i < period - 1) {
        maData.push(null);
      } else {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += this.data[i - j].close;
        }
        maData.push(sum / period);
      }
    }
    
    return maData;
  }

  getDataAtX(x) {
    const chartArea = this.getChartArea();
    const candleWidth = this.getCandleWidth();
    const gap = chartArea.width / this.data.length * 0.4;

    if (x < chartArea.left || x > this.width - chartArea.right) {
      return null;
    }

    const index = Math.floor((x - chartArea.left) / (candleWidth + gap));
    
    if (index >= 0 && index < this.data.length) {
      return {
        data: this.data[index],
        index: index
      };
    }

    return null;
  }

  getDataAtIndex(index) {
    if (index >= 0 && index < this.data.length) {
      return this.data[index];
    }
    return null;
  }
}

module.exports = ChartHelper;
