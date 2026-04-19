import FormatData from './formatData.js';

class ChartHelper {
  constructor(canvasId) {
    this.canvasId = canvasId;
    this.ctx = null;
    this.data = [];
    this.width = 0;
    this.height = 0;
    // bottom 留给时间轴(30) + 成交量区(50)
    this.padding = { top: 20, right: 20, bottom: 30, left: 65 };
    this.VOLUME_HEIGHT = 50; // 成交量区高度
    this.interval = '5m';

    // 可见区间 [startIndex, endIndex)，null 表示显示全部
    this.visibleStart = 0;
    this.visibleCount = 60; // 默认可见 60 根
    this.MIN_VISIBLE = 10;
    this.MAX_VISIBLE = 300;
  }

  init(ctx) {
    this.ctx = ctx;
    return this;
  }

  setData(klineData) {
    this.data = klineData;
    // 重置可见区间到最新数据
    if (klineData.length > 0) {
      this.visibleCount = Math.min(this.visibleCount, klineData.length);
      this.visibleStart = Math.max(0, klineData.length - this.visibleCount);
    }
    return this;
  }

  setInterval(interval) {
    this.interval = interval;
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

  // ── 可见区间管理 ──────────────────────────────────────────

  getVisibleData() {
    const end = Math.min(this.visibleStart + this.visibleCount, this.data.length);
    return this.data.slice(this.visibleStart, end);
  }

  getVisibleCount() {
    return Math.min(this.visibleCount, this.data.length - this.visibleStart);
  }

  // 缩放：以 centerRatio (0~1) 为中心缩放，delta > 0 放大（减少可见数），delta < 0 缩小
  zoom(delta, centerRatio = 0.5) {
    if (this.data.length === 0) return false;
    const oldCount = this.getVisibleCount();
    const centerIndex = this.visibleStart + Math.round(oldCount * centerRatio);

    let newCount = Math.round(oldCount * (1 - delta * 0.15));
    newCount = Math.max(this.MIN_VISIBLE, Math.min(this.MAX_VISIBLE, newCount, this.data.length));

    if (newCount === oldCount) return false;

    // 保持中心点不变
    let newStart = Math.round(centerIndex - newCount * centerRatio);
    newStart = Math.max(0, Math.min(this.data.length - newCount, newStart));

    this.visibleStart = newStart;
    this.visibleCount = newCount;
    return true;
  }

  // 平移：正数向右（往历史方向），负数向左（往最新方向）
  pan(deltaIndex) {
    if (this.data.length === 0) return false;
    const count = this.getVisibleCount();
    let newStart = this.visibleStart + deltaIndex;
    newStart = Math.max(0, Math.min(this.data.length - count, newStart));
    if (newStart === this.visibleStart) return false;
    this.visibleStart = newStart;
    return true;
  }

  // ── 图表区域 ────────────────────────────────────────────

  getChartArea() {
    // K线区：留出底部时间轴 + 成交量区
    const totalBottom = this.padding.bottom + this.VOLUME_HEIGHT + 8;
    return {
      width: this.width - this.padding.left - this.padding.right,
      height: this.height - this.padding.top - totalBottom,
      left: this.padding.left,
      top: this.padding.top,
      right: this.padding.right,
      bottom: totalBottom
    };
  }

  calculatePriceRange() {
    const visible = this.getVisibleData();
    if (visible.length === 0) return { min: 0, max: 0, range: 1 };
    // 只基于可见 K 线的 high/low 计算，确保所有蜡烛始终在图内
    let maxPrice = -Infinity, minPrice = Infinity;
    for (const d of visible) {
      if (d.high > maxPrice) maxPrice = d.high;
      if (d.low < minPrice) minPrice = d.low;
    }
    const priceRange = maxPrice - minPrice || maxPrice * 0.01 || 1;
    // 上下各留 8% buffer，保证影线不贴边
    const buffer = priceRange * 0.08;
    return {
      min: minPrice - buffer,
      max: maxPrice + buffer,
      range: priceRange + buffer * 2
    };
  }

  priceToY(price, priceRange) {
    const chartArea = this.getChartArea();
    const ratio = (priceRange.max - price) / priceRange.range;
    return chartArea.top + ratio * chartArea.height;
  }

  // 将可见区间内的第 i 根 K 线映射到 x 坐标
  indexToX(visibleIndex) {
    const chartArea = this.getChartArea();
    const count = this.getVisibleCount();
    const step = chartArea.width / count;
    const candleWidth = step * 0.7;
    const gap = step * 0.3;
    return chartArea.left + visibleIndex * step + gap / 2;
  }

  getCandleWidth() {
    const chartArea = this.getChartArea();
    const count = this.getVisibleCount();
    return (chartArea.width / count) * 0.7;
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
    const chartWidth = this.width - chartArea.right;
    const visible = this.getVisibleData();

    this.ctx.setStrokeStyle('#2a2a3e');
    this.ctx.setLineWidth(1);

    // K线区水平网格线（5条，含顶底）
    for (let i = 0; i <= 4; i++) {
      const y = chartArea.top + (chartArea.height / 4) * i;
      this.ctx.beginPath();
      this.ctx.moveTo(chartArea.left, y);
      this.ctx.lineTo(chartWidth, y);
      this.ctx.stroke();

      const price = priceRange.max - (priceRange.range / 4) * i;
      const decimals = price >= 1000 ? 2 : price >= 1 ? 4 : 6;
      const priceStr = price.toFixed(decimals);
      this.ctx.setFillStyle('#71717a');
      this.ctx.setFontSize(10);
      this.ctx.setTextAlign('right');
      this.ctx.fillText(priceStr, chartArea.left - 4, y + 4);
    }

    // 成交量区分隔线
    const volSepY = this.height - this.padding.bottom - this.VOLUME_HEIGHT;
    this.ctx.setStrokeStyle('#2a2a3e');
    this.ctx.setLineWidth(0.5);
    this.ctx.beginPath();
    this.ctx.moveTo(chartArea.left, volSepY);
    this.ctx.lineTo(chartWidth, volSepY);
    this.ctx.stroke();

    // 时间轴标签（紧贴底部）
    const total = visible.length;
    const step = Math.max(1, Math.ceil(total / 6));
    const timeY = this.height - this.padding.bottom + 14;
    for (let i = 0; i < total; i++) {
      if (i % step === 0) {
        const x = this.indexToX(i) + this.getCandleWidth() / 2;
        const ts = visible[i].time;
        const label = ts
          ? FormatData.formatKlineDateByInterval(ts, this.interval)
          : (visible[i].date || '');
        this.ctx.setFillStyle('#71717a');
        this.ctx.setFontSize(10);
        this.ctx.setTextAlign('center');
        this.ctx.fillText(label, x, timeY);
      }
    }
  }

  drawCandles(priceRange) {
    if (!this.ctx) return;
    const visible = this.getVisibleData();
    if (visible.length === 0) return;
    const candleWidth = this.getCandleWidth();

    for (let i = 0; i < visible.length; i++) {
      const d = visible[i];
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

  drawMA(maData, priceRange, color = '#eab308') {
    if (!this.ctx || !maData || maData.length === 0) return;
    const visible = this.getVisibleData();
    const candleWidth = this.getCandleWidth();

    this.ctx.setStrokeStyle(color);
    this.ctx.setLineWidth(1.5);
    this.ctx.beginPath();

    let started = false;
    for (let i = 0; i < visible.length; i++) {
      const globalIdx = this.visibleStart + i;
      if (maData[globalIdx] != null) {
        const x = this.indexToX(i) + candleWidth / 2;
        const y = this.priceToY(maData[globalIdx], priceRange);
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
    if (!this.ctx) return;
    const visible = this.getVisibleData();
    if (visible.length === 0) return;

    const maxVolume = Math.max(...visible.map(d => d.volume || 0));
    if (maxVolume === 0) return;

    const candleWidth = this.getCandleWidth();
    // 成交量区：紧贴时间轴上方，高度 = VOLUME_HEIGHT
    const volumeBottom = this.height - this.padding.bottom;     // 时间轴顶部
    const volumeTop    = volumeBottom - this.VOLUME_HEIGHT;     // 成交量区顶部
    const usableHeight = this.VOLUME_HEIGHT - 4;

    for (let i = 0; i < visible.length; i++) {
      const d = visible[i];
      const x = this.indexToX(i);
      const isUp = d.close >= d.open;
      const volumeRatio = (d.volume || 0) / maxVolume;
      const barHeight = Math.max(volumeRatio * usableHeight, 1);
      const y = volumeBottom - barHeight;
      this.ctx.setFillStyle(isUp ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)');
      this.ctx.fillRect(x, y, candleWidth, barHeight);
    }
  }

  // 画十字光标 + 高亮选中K线
  drawCrosshair(visibleIndex, priceRange) {
    if (!this.ctx || visibleIndex < 0) return;
    const visible = this.getVisibleData();
    if (visibleIndex >= visible.length) return;

    const candleWidth = this.getCandleWidth();
    const x = this.indexToX(visibleIndex) + candleWidth / 2;
    const d = visible[visibleIndex];
    const closeY = this.priceToY(d.close, priceRange);

    const chartArea = this.getChartArea();
    const chartWidth = this.width - chartArea.right;

    // 高亮选中蜡烛背景
    this.ctx.setFillStyle('rgba(255,255,255,0.06)');
    const barX = this.indexToX(visibleIndex);
    this.ctx.fillRect(barX - 2, chartArea.top, candleWidth + 4, chartArea.height);

    // 横线
    this.ctx.setStrokeStyle('rgba(255,255,255,0.45)');
    this.ctx.setLineWidth(1);
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(chartArea.left, closeY);
    this.ctx.lineTo(chartWidth, closeY);
    this.ctx.stroke();

    // 竖线
    this.ctx.beginPath();
    this.ctx.moveTo(x, chartArea.top);
    this.ctx.lineTo(x, this.height - chartArea.bottom);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // 右侧价格标签
    const decimals = d.close >= 1000 ? 2 : d.close >= 1 ? 4 : 6;
    const priceLabel = d.close.toFixed(decimals);
    const labelW = priceLabel.length * 7 + 10;
    const labelH = 18;
    const labelX = chartWidth + 1;
    const labelY = closeY - labelH / 2;

    const isUp = d.close >= d.open;
    this.ctx.setFillStyle(isUp ? '#22c55e' : '#ef4444');
    this.ctx.fillRect(labelX, labelY, labelW, labelH);
    this.ctx.setFillStyle('#ffffff');
    this.ctx.setFontSize(10);
    this.ctx.setTextAlign('left');
    this.ctx.fillText(priceLabel, labelX + 4, labelY + 13);
  }

  render(options = {}) {
    if (!this.ctx || this.data.length === 0) return;
    const priceRange = this.calculatePriceRange();
    this.clearCanvas();
    this.drawGrid(priceRange);
    this.drawCandles(priceRange);

    if (options.showMA5) {
      const ma5Data = this.calculateMA(5);
      this.drawMA(ma5Data, priceRange, '#eab308');
    }
    if (options.showMA10) {
      const ma10Data = this.calculateMA(10);
      this.drawMA(ma10Data, priceRange, '#3b82f6');
    }
    if (options.showVolume) {
      this.drawVolume();
    }
    if (options.crosshairIndex != null && options.crosshairIndex >= 0) {
      this.drawCrosshair(options.crosshairIndex, priceRange);
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

  // 根据 canvas x 坐标找可见区间内的 index
  getVisibleIndexAtX(x) {
    const chartArea = this.getChartArea();
    const count = this.getVisibleCount();
    if (count === 0) return -1;
    const step = chartArea.width / count;
    if (x < chartArea.left || x > this.width - chartArea.right) return -1;
    const idx = Math.floor((x - chartArea.left) / step);
    return idx >= 0 && idx < count ? idx : -1;
  }

  // 返回可见区间内某 visibleIndex 对应的原始数据
  getDataAtVisibleIndex(visibleIndex) {
    const visible = this.getVisibleData();
    if (visibleIndex >= 0 && visibleIndex < visible.length) {
      return visible[visibleIndex];
    }
    return null;
  }

  // 兼容老接口
  getDataAtX(x) {
    const visibleIndex = this.getVisibleIndexAtX(x);
    if (visibleIndex < 0) return null;
    const d = this.getDataAtVisibleIndex(visibleIndex);
    return d ? { data: d, index: this.visibleStart + visibleIndex } : null;
  }

  getDataAtIndex(index) {
    if (index >= 0 && index < this.data.length) return this.data[index];
    return null;
  }
}

export default ChartHelper;
