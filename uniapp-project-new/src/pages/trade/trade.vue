<template>
  <view class="container">

    <!-- ① 顶部行情栏 -->
    <view class="top-bar">
      <view class="top-coin" @tap="openSymbolModal">
        <text class="top-coin-name">{{ stock ? stock.code : '' }}</text>
        <text class="top-coin-sub">永续</text>
        <text class="top-coin-arrow">▾</text>
      </view>
      <view class="top-change-only">
        <text :class="['top-change', priceChangePercent >= 0 ? 'up' : 'down']">
          {{ priceChangePercent >= 0 ? '+' : '' }}{{ priceChangePercent }}%
        </text>
      </view>
    </view>

    <!-- ② 核心区：左侧下单 + 右侧盘口 -->
    <view class="main-body">

      <!-- 左：下单区 -->
      <view class="order-panel">

        <!-- 做多 / 做空 Tab -->
        <view class="trade-tabs">
          <view
            :class="['trade-tab', tradeType === 'buy' ? 'active-buy' : '']"
            @tap="switchTradeType('buy')"
          >做多</view>
          <view
            :class="['trade-tab', tradeType === 'sell' ? 'active-sell' : '']"
            @tap="switchTradeType('sell')"
          >做空</view>
        </view>

        <!-- 杠杆选择 -->
        <view class="leverage-section">
          <view class="leverage-header">
            <text class="leverage-label">杠杆倍数</text>
            <text class="leverage-hint">1 - 150</text>
          </view>
          <view class="lev-input-box">
            <input
              class="lev-input"
              type="number"
              :value="leverage"
              @input="onLeverageInput"
              @blur="onLeverageBlur"
              placeholder="输入杠杆"
              maxlength="3"
            />
            <text class="lev-input-unit">x</text>
          </view>
        </view>

        <!-- 开仓金额输入框（USDT）-->
        <view class="input-row">
          <text class="input-hint">开仓金额 (USDT)</text>
          <view class="input-box">
            <input
              class="qty-input"
              type="digit"
              :value="notionalInput"
              @input="inputMargin"
              placeholder="0.00"
            />
            <text class="input-unit">USDT</text>
          </view>
        </view>

        <!-- 百分比快捷 -->
        <view class="pct-row">
          <view :class="['pct-btn', pctIndex === 0 ? 'pct-active' : '']" @tap="setPctMargin(0.25, 0)">25%</view>
          <view class="pct-line"></view>
          <view :class="['pct-btn', pctIndex === 1 ? 'pct-active' : '']" @tap="setPctMargin(0.5, 1)">50%</view>
          <view class="pct-line"></view>
          <view :class="['pct-btn', pctIndex === 2 ? 'pct-active' : '']" @tap="setPctMargin(0.75, 2)">75%</view>
          <view class="pct-line"></view>
          <view :class="['pct-btn', pctIndex === 3 ? 'pct-active' : '']" @tap="setPctMargin(1, 3)">100%</view>
        </view>

        <!-- 可用余额 -->
        <view class="avail-row">
          <text class="avail-label">可用余额</text>
          <text class="avail-value">{{ cashDisplay }} USDT</text>
        </view>

        <!-- 计算汇总 -->
        <view class="summary-block">
          <view class="summary-row">
            <text class="sum-label">所需保证金</text>
            <text class="sum-val">{{ marginValue }} USDT</text>
          </view>
          <view class="summary-row">
            <text class="sum-label">开仓数量</text>
            <text class="sum-val">{{ openQty }} {{ stock ? stock.symbol : '' }}</text>
          </view>
          <view class="summary-row">
            <text class="sum-label">手续费</text>
            <text class="sum-val">{{ commission }} USDT</text>
          </view>
          <view class="summary-row highlight">
            <text class="sum-label">预计强平价</text>
            <text :class="['sum-val liq-price', tradeType === 'buy' ? 'down' : 'up']">{{ liqPrice }}</text>
          </view>
        </view>

        <!-- 下单按钮 -->
        <button
          :class="['submit-btn', tradeType]"
          :disabled="!canTrade"
          @tap="confirmTrade"
        >
          {{ tradeType === 'buy' ? '做多' : '做空' }} {{ stock ? stock.symbol : '' }}  {{ leverage }}x
        </button>

      </view>

      <!-- 右：盘口 -->
      <view class="orderbook-panel">
        <view class="ob-header">
          <text class="ob-col-label">价格(USDT)</text>
          <text class="ob-col-label right">数量</text>
        </view>

        <!-- 卖单（红，从高到低展示） -->
        <view v-for="(item, idx) in asks" :key="'ask'+idx" class="ob-row ask">
          <text class="ob-price ask-price">{{ item.price }}</text>
          <text class="ob-qty">{{ item.qty }}</text>
        </view>

        <!-- 最新成交价 -->
        <view class="ob-mid">
          <text :class="['ob-mid-price', priceChangePercent >= 0 ? 'up' : 'down']">{{ currentPrice }}</text>
        </view>

        <!-- 买单（绿，从高到低） -->
        <view v-for="(item, idx) in bids" :key="'bid'+idx" class="ob-row bid">
          <text class="ob-price bid-price">{{ item.price }}</text>
          <text class="ob-qty">{{ item.qty }}</text>
        </view>
      </view>

    </view>

    <!-- ③ K线图区（展开状态） -->
    <view class="kline-section" v-if="klineExpanded">
      <!-- 展开状态的 header -->
      <view class="kline-header" @tap="toggleKline">
        <view class="kline-header-left">
          <text class="kline-header-title">{{ stock ? stock.code : '' }} K线图表</text>
        </view>
        <text class="kline-toggle-icon expanded">▾</text>
      </view>

      <!-- 周期选择 -->
      <view class="interval-bar">
        <view
          v-for="item in intervalList"
          :key="item.val"
          :class="['interval-btn', klineInterval === item.val ? 'active' : '']"
          @tap="switchKlineInterval(item.val)"
        >{{ item.label }}</view>
      </view>

      <!-- MA 值指示行 -->
      <view class="ma-legend" v-if="showMA5 || showMA10">
        <text class="ma-item ma5" v-if="showMA5">MA5</text>
        <text class="ma-item ma10" v-if="showMA10">MA10</text>
      </view>

      <!-- K线 Canvas -->
      <view class="kline-wrap">
        <canvas
          canvas-id="klineCanvas"
          class="kline-canvas"
          @touchstart="onKLineTouchStart"
          @touchmove="onKLineTouchMove"
          @touchend="onKLineTouchEnd"
          @touchcancel="onKLineTouchEnd"
        ></canvas>

        <!-- 缩放提示（右上角）-->
        <view class="kline-zoom-hint" v-if="zoomHintVisible">
          <text class="kline-zoom-hint-text">{{ zoomHintText }}</text>
        </view>

        <!-- 长按 OHLC 浮层 tooltip（悬浮在图表左上角）-->
        <view class="kline-tooltip" v-if="klineInfo">
          <view class="tooltip-row-top">
            <text class="tooltip-date">{{ klineInfo.date }}</text>
            <text :class="['tooltip-chg', klineInfo.isUp ? 'up' : 'down']">
              {{ klineInfo.isUp ? '▲' : '▼' }} {{ klineInfo.changeStr }}%
            </text>
          </view>
          <view class="tooltip-grid">
            <view class="tooltip-item">
              <text class="tooltip-label">开</text>
              <text class="tooltip-val">{{ klineInfo.open }}</text>
            </view>
            <view class="tooltip-item">
              <text class="tooltip-label">高</text>
              <text class="tooltip-val up">{{ klineInfo.high }}</text>
            </view>
            <view class="tooltip-item">
              <text class="tooltip-label">低</text>
              <text class="tooltip-val down">{{ klineInfo.low }}</text>
            </view>
            <view class="tooltip-item">
              <text class="tooltip-label">收</text>
              <text :class="['tooltip-val', klineInfo.isUp ? 'up' : 'down']">{{ klineInfo.close }}</text>
            </view>
            <view class="tooltip-item">
              <text class="tooltip-label">量</text>
              <text class="tooltip-val vol">{{ klineInfo.volumeStr }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 指标切换 -->
      <view class="tools-bar">
        <view :class="['tool-btn', showMA5 ? 'active' : '']" @tap="toggleMA5">MA5</view>
        <view :class="['tool-btn', showMA10 ? 'active' : '']" @tap="toggleMA10">MA10</view>
        <view :class="['tool-btn', showVolume ? 'active' : '']" @tap="toggleVolume">成交量</view>
      </view>
    </view>

    <!-- ④ 持仓区（K线收起时显示） -->
    <view class="position-section" v-if="!klineExpanded">

      <!-- Tab 栏 -->
      <view class="pos-tabs">
        <view :class="['pos-tab', posTab === 'holding' ? 'pos-tab-active' : '']" @tap="switchPosTab('holding')">
          持有仓位 ({{ currentPositions.length }})
        </view>
        <view :class="['pos-tab', posTab === 'orders' ? 'pos-tab-active' : '']" @tap="switchPosTab('orders')">
          当前委托 (0)
        </view>
        <view :class="['pos-tab', posTab === 'history' ? 'pos-tab-active' : '']" @tap="switchPosTab('history')">
          仓位历史
        </view>
      </view>

      <!-- 持有仓位列表 -->
      <view v-if="posTab === 'holding'">
        <view class="pos-empty" v-if="currentPositions.length === 0">
          <text class="pos-empty-text">暂无持仓</text>
        </view>
        <view v-for="item in currentPositions" :key="item.code" class="pos-card">
          <view class="pos-card-top">
            <view class="pos-card-left">
              <text class="pos-code">{{ item.code }}</text>
              <view :class="['pos-side-badge', item.tradeType === 'buy' ? 'badge-long' : 'badge-short']">
                {{ item.tradeType === 'buy' ? '做多' : '做空' }} {{ item.leverage }}x
              </view>
            </view>
            <view class="pos-card-right">
              <text :class="['pos-pnl', item.pnl >= 0 ? 'up' : 'down']">
                {{ item.pnl >= 0 ? '+' : '' }}{{ item.pnlStr }} USDT
              </text>
              <text :class="['pos-pnl-pct', item.pnl >= 0 ? 'up' : 'down']">({{ item.pnlPctStr }}%)</text>
            </view>
          </view>
          <view class="pos-card-body">
            <view class="pos-info-col">
              <text class="pos-info-label">数量</text>
              <text class="pos-info-val">{{ item.qtyStr }} {{ item.symbol }}</text>
            </view>
            <view class="pos-info-col">
              <text class="pos-info-label">开仓均价</text>
              <text class="pos-info-val">{{ item.avgPriceStr }}</text>
            </view>
            <view class="pos-info-col">
              <text class="pos-info-label">标记价格</text>
              <text class="pos-info-val">{{ currentPrice }}</text>
            </view>
            <view class="pos-info-col">
              <text class="pos-info-label">保证金</text>
              <text class="pos-info-val">{{ item.marginStr }} USDT</text>
            </view>
            <view class="pos-info-col">
              <text class="pos-info-label">强平价</text>
              <text class="pos-info-val down">{{ item.liqPrice }}</text>
            </view>
            <view class="pos-info-col">
              <text class="pos-info-label">名义价值</text>
              <text class="pos-info-val">{{ item.notionalStr }} USDT</text>
            </view>
          </view>
          <!-- 平仓操作栏 -->
          <view class="pos-close-bar">
            <view class="pos-close-info">
              <text class="pos-close-fee-label">可平数量</text>
              <text class="pos-close-fee-val">{{ item.qtyStr }} {{ item.symbol }}</text>
            </view>
            <view
              :class="['pos-close-btn', item.tradeType === 'buy' ? 'close-sell' : 'close-buy']"
              @tap="openCloseModal(item)"
            >
              {{ item.tradeType === 'buy' ? '平多' : '平空' }}
            </view>
          </view>
        </view>
      </view>

      <!-- 当前委托（暂无内容） -->
      <view v-if="posTab === 'orders'">
        <view class="pos-empty">
          <text class="pos-empty-text">暂无委托</text>
        </view>
      </view>

      <!-- 仓位历史 -->
      <view v-if="posTab === 'history'">
        <view class="pos-empty" v-if="closedPositions.length === 0">
          <text class="pos-empty-text">暂无平仓记录</text>
        </view>
        <view v-for="(item, idx) in closedPositions" :key="idx" class="closed-card">
          <!-- 卡头：方向 + 合约 + 杠杆 + 平仓类型 -->
          <view class="closed-card-top">
            <view class="closed-card-left">
              <view :class="['closed-side-tag', item.tradeType === 'buy' ? 'tag-long' : 'tag-short']">
                {{ item.tradeType === 'buy' ? '买' : '卖' }}
              </view>
              <text class="closed-code">{{ item.code }}</text>
              <text class="closed-perp">永续</text>
              <view class="closed-lev-tag">全仓 {{ item.leverage }}x</view>
            </view>
            <text class="closed-type-label">{{ item.isPartial ? '部分平仓' : '完全平仓' }}</text>
          </view>

          <!-- 数据网格 -->
          <view class="closed-grid">
            <view class="closed-grid-item">
              <text class="closed-grid-label">已实现盈亏 (USDT)</text>
              <text :class="['closed-grid-val', item.pnl >= 0 ? 'up' : 'down']">{{ item.pnl >= 0 ? '' : '' }}{{ item.pnlStr }}</text>
            </view>
            <view class="closed-grid-item">
              <text class="closed-grid-label">回报率</text>
              <text :class="['closed-grid-val', item.pnl >= 0 ? 'up' : 'down']">{{ item.roiStr }}</text>
            </view>
            <view class="closed-grid-item align-right">
              <text class="closed-grid-label">已平仓量 (USDT)</text>
              <text class="closed-grid-val">{{ item.closeNotionalStr }}</text>
            </view>

            <view class="closed-grid-item">
              <text class="closed-grid-label">开仓价格</text>
              <text class="closed-grid-val neutral">{{ item.avgPriceStr }}</text>
            </view>
            <view class="closed-grid-item">
              <text class="closed-grid-label">平仓均价</text>
              <text class="closed-grid-val neutral">{{ item.closePriceStr }}</text>
            </view>
            <view class="closed-grid-item align-right">
              <text class="closed-grid-label">最高 OI (USDT)</text>
              <text class="closed-grid-val neutral">{{ item.closeNotionalStr }}</text>
            </view>
          </view>

          <!-- 时间行 -->
          <view class="closed-time-section">
            <view class="closed-time-row">
              <text class="closed-time-label">开仓时间</text>
              <text class="closed-time-val">{{ item.openTime }}</text>
            </view>
            <view class="closed-time-row">
              <text class="closed-time-label">全部平仓时间</text>
              <text class="closed-time-val">{{ item.time }}</text>
            </view>
          </view>
        </view>
      </view>

    </view>

    <!-- 收起时的占位 -->
    <view class="kline-collapsed-placeholder"></view>

  </view>

  <!-- ══ 币种选择弹窗 ══ -->
  <view class="sym-modal-mask" v-if="symbolModal.visible" @tap.self="symbolModal.visible = false">
    <view class="sym-modal">
      <!-- 标题 -->
      <view class="sym-modal-header">
        <text class="sym-modal-title">选择交易对</text>
        <text class="sym-modal-close" @tap="symbolModal.visible = false">✕</text>
      </view>
      <!-- Tab 切换 -->
      <view class="sym-tabs">
        <view
          :class="['sym-tab', symbolModal.tab === 'favorite' ? 'sym-tab-active' : '']"
          @tap="switchSymTab('favorite')"
        >自选</view>
        <view
          :class="['sym-tab', symbolModal.tab === 'all' ? 'sym-tab-active' : '']"
          @tap="switchSymTab('all')"
        >全部</view>
      </view>
      <!-- 搜索框 -->
      <view class="sym-search-wrap">
        <text class="sym-search-icon">🔍</text>
        <input
          class="sym-search-input"
          type="text"
          :value="symbolModal.query"
          @input="onSymbolSearch"
          placeholder="搜索币种，如 BTC"
          placeholder-class="sym-search-placeholder"
        />
      </view>
      <!-- 列表 -->
      <scroll-view class="sym-list" scroll-y="true">
        <view v-if="symbolModal.loading" class="sym-loading">
          <text class="sym-loading-text">加载中...</text>
        </view>
        <view v-else-if="symbolModal.filteredList.length === 0" class="sym-empty">
          <text class="sym-empty-text">未找到相关币种</text>
        </view>
        <view
          v-else
          v-for="item in symbolModal.filteredList"
          :key="item.code"
          :class="['sym-item', item.code === (stock ? stock.code : '') ? 'sym-item-active' : '']"
          @tap="switchSymbol(item)"
        >
          <!-- 左：币种名 + 成交额 -->
          <view class="sym-item-left">
            <view class="sym-item-name-row">
              <text class="sym-item-code">{{ item.code }}</text>
              <text class="sym-item-tag" v-if="item.code === (stock ? stock.code : '')">当前</text>
            </view>
            <text class="sym-item-vol" v-if="symbolModal.tickerMap[item.code]">成交额 {{ symbolModal.tickerMap[item.code].quoteVolumeStr }}</text>
          </view>
          <!-- 右：价格 + 涨跌幅 -->
          <view class="sym-item-right">
            <template v-if="symbolModal.tickerMap[item.code]">
              <text class="sym-item-price">{{ symbolModal.tickerMap[item.code].displayPrice }}</text>
              <text
                :class="['sym-item-pct', parseFloat(symbolModal.tickerMap[item.code].priceChangePercent) >= 0 ? 'sym-up' : 'sym-down']"
              >{{ parseFloat(symbolModal.tickerMap[item.code].priceChangePercent) >= 0 ? '+' : '' }}{{ symbolModal.tickerMap[item.code].priceChangePercent }}%</text>
            </template>
            <text v-else class="sym-item-loading">--</text>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>

  <!-- ══ 平仓弹窗 ══ -->
  <view class="close-modal-mask" v-if="closeModal.visible" @tap.self="closeModal.visible = false">
    <view class="close-modal">
      <!-- 标题 -->
      <view class="close-modal-header">
        <text class="close-modal-title">{{ closeModal.tradeType === 'buy' ? '平多仓' : '平空仓' }}</text>
        <text class="close-modal-sub">{{ closeModal.code }}</text>
      </view>

      <!-- 当前价 -->
      <view class="close-modal-price-row">
        <text class="close-modal-label">当前价格</text>
        <text :class="['close-modal-price', priceChangePercent >= 0 ? 'up' : 'down']">{{ currentPrice }}</text>
      </view>

      <!-- 金额输入（USDT） -->
      <view class="close-modal-input-section">
        <view class="close-modal-input-header">
          <text class="close-modal-label">平仓金额 (USDT)</text>
          <text class="close-modal-max">最多 {{ closeModal.maxUsdtStr }} USDT</text>
        </view>
        <view class="close-modal-input-wrap">
          <input
            class="close-modal-input"
            type="digit"
            :value="closeModal.usdtInput"
            @input="onCloseUsdtInput"
            placeholder="输入 USDT 金额"
          />
          <text class="close-modal-input-unit">USDT</text>
        </view>
        <!-- 换算数量提示 -->
        <text class="close-modal-qty-hint" v-if="closeModal.estQtyStr">≈ {{ closeModal.estQtyStr }} {{ closeModal.symbol }}</text>
      </view>

      <!-- 快捷比例 -->
      <view class="close-modal-pct-row">
        <view
          v-for="(p, i) in [{pct:0.25,label:'25%'},{pct:0.5,label:'50%'},{pct:0.75,label:'75%'},{pct:1,label:'全仓'}]"
          :key="i"
          :class="['close-pct-btn', closeModal.pctIdx === i ? 'close-pct-active' : '']"
          @tap="setClosePct(p.pct, i)"
        >{{ p.label }}</view>
      </view>

      <!-- 预计结算 -->
      <view class="close-modal-summary">
        <view class="close-sum-row">
          <text class="close-sum-label">平仓比例</text>
          <text class="close-sum-val">{{ closeModal.pctDisplay }}%</text>
        </view>
        <view class="close-sum-row">
          <text class="close-sum-label">预计盈亏</text>
          <text :class="['close-sum-val', closeModal.estPnl >= 0 ? 'up' : 'down']">
            {{ closeModal.estPnl >= 0 ? '+' : '-' }}{{ closeModal.estPnlStr }} USDT
          </text>
        </view>
        <view class="close-sum-row">
          <text class="close-sum-label">平仓手续费</text>
          <text class="close-sum-val">{{ closeModal.estFeeStr }} USDT</text>
        </view>
        <view class="close-sum-row">
          <text class="close-sum-label">返还保证金</text>
          <text class="close-sum-val">{{ closeModal.estReturnStr }} USDT</text>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="close-modal-actions">
        <view class="close-modal-cancel" @tap="closeModal.visible = false">取消</view>
        <view
          :class="['close-modal-confirm', closeModal.tradeType === 'buy' ? 'confirm-sell' : 'confirm-buy', !closeModal.canClose ? 'confirm-disabled' : '']"
          @tap="confirmClosePosition"
        >
          {{ closeModal.tradeType === 'buy' ? '确认平多' : '确认平空' }}
        </view>
      </view>
    </view>
  </view>

  <!-- 收起状态：吸底栏 -->
  <view class="kline-bottom-bar" v-if="!klineExpanded" @tap="toggleKline">
    <text class="kline-bottom-title">{{ stock ? stock.code : '' }} 永续 K线图表</text>
    <text class="kline-bottom-arrow">▲</text>
  </view>
</template>

<script>
import { getStockByCode, getAllStocks, getFavoriteStocks } from '../../utils/stock.js';
import { getCurrentDateTime } from '../../utils/date.js';
import binanceService from '../../utils/binanceService.js';
import ChartHelper from '../../utils/chartHelper.js';
import FormatData from '../../utils/formatData.js';

const TAKER_FEE_RATE = 0.001;
const MAINT_MARGIN_RATE = 0.005;

export default {
  data() {
    return {
      stock: null,
      userData: null,
      tradeType: 'buy',

      leverage: 1,
      leverageRisk: '',

      notionalInput: '',

      cashDisplay: '0.00',
      marginValue: '0.00',
      openQty: '0.000000',
      commission: '0.00',
      liqPrice: '--',
      canTrade: false,

      klineData: [],
      klineInfo: null,
      crosshairIndex: -1,
      currentPrice: 0,
      priceChange: 0,
      priceChangePercent: 0,
      showVolume: false,
      showMA5: false,
      showMA10: false,
      klineInterval: '5m',
      klineExpanded: true,
      zoomHintVisible: false,
      zoomHintText: '',

      asks: [],
      bids: [],

      pctIndex: -1,

      posTab: 'holding',
      currentPositions: [],
      closedPositions: [],

      // 平仓弹窗状态
      closeModal: {
        visible: false,
        code: '',
        symbol: '',
        tradeType: 'buy',
        maxQty: 0,       // 最大可平数量（币种单位）
        maxUsdt: 0,      // 最大可平金额 (USDT)
        maxUsdtStr: '0', // 显示用
        usdtInput: '',   // 用户输入的 USDT 金额
        estQtyStr: '',   // 换算得到的币种数量提示
        pctIdx: -1,
        pctDisplay: '0.00',
        avgPrice: 0,
        margin: 0,
        estPnl: 0,
        estPnlStr: '0.00',
        estFeeStr: '0.00',
        estReturnStr: '0.00',
        canClose: false,
      },

      intervalList: [
        { val: '5m', label: '5m' },
        { val: '15m', label: '15m' },
        { val: '30m', label: '30m' },
        { val: '1h', label: '1时' },
        { val: '4h', label: '4时' },
        { val: '8h', label: '8时' },
        { val: '1d', label: '日' },
        { val: '1w', label: '周' },
        { val: '1M', label: '月' },
      ],

      // 币种选择弹窗
      symbolModal: {
        visible: false,
        loading: false,
        tab: 'favorite',  // 'favorite' | 'all'
        query: '',
        favoriteList: [], // 自选列表
        allList: [],      // 完整列表
        filteredList: [], // 当前展示（过滤后）
        tickerMap: {},    // code → ticker（行情缓存）
        tickerLoading: false,
      },
    };
  },

  created() {
    this.orderBookTimer = null;
    this.chartHelper = null;
    this.currentSymbol = null;
    this._winWidth = 375;
    this._canvasHeight = 230; // canvas 初始估算值，会在首次绘制时动态更新
    this._canvasSizeReady = false; // 是否已通过 SelectorQuery 获取到真实尺寸
    this._tickerHandler = null;
    this._klineHandler = null;
    this._klineClosedHandler = null;

    // 手势状态
    this._gesture = {
      mode: 'none',         // 'none' | 'pan' | 'pinch' | 'longpress'
      startX: 0,
      startPinchDist: 0,
      startVisibleStart: 0,
      startVisibleCount: 60,
      lastX: 0,
      longPressTimer: null,
      panThreshold: 3,      // px，超过才算平移
    };
    this._zoomHintTimer = null;
  },

  async onLoad(options) {
    const code = options.code;
    const stock = await getStockByCode(code);
    const app = getApp();
    const userData = app.getUserData();

    const savedLeverage = uni.getStorageSync('lastLeverage') || 1;
    const savedKlineExpanded = uni.getStorageSync('klineExpanded');
    const klineExpanded = savedKlineExpanded === false ? false : true;

    this.stock = stock;
    this.userData = userData;
    this.cashDisplay = parseFloat(userData.cash || 0).toFixed(2);
    this.notionalInput = '';
    this.currentPrice = stock.currentPrice;
    this.priceChange = 0;
    this.priceChangePercent = 0;
    this.leverage = savedLeverage;
    this.klineExpanded = klineExpanded;

    this.currentSymbol = code;
    this.initChart();
    this.refreshPositions(stock.currentPrice);

    binanceService.fetch24hTicker(code).then((ticker) => {
      this.currentPrice = ticker.displayPrice;
      this.priceChange = ticker.priceChange;
      this.priceChangePercent = parseFloat(ticker.priceChangePercent);
      if (this.stock) this.stock = Object.assign({}, this.stock, { currentPrice: ticker.closePrice });
      binanceService.setOpenPrice(code, ticker.closePrice - parseFloat(ticker.priceChange));
      this.generateOrderBook();
      this.calculateCost();
    }).catch((err) => {
      console.warn('⚠️ fetch24hTicker failed:', err);
    });

    this.loadKlineData(code);
    this.initWebSocket(code);
    this.startOrderBookTimer();
  },

  onReady() {
    setTimeout(() => { this.drawKLine(); }, 200);
  },

  onShow() {
    const app = getApp();
    const userData = app.getUserData();
    this.userData = userData;
    this.cashDisplay = parseFloat(userData.cash || 0).toFixed(2);
    this.calculateCost();
  },

  onUnload() {
    if (this._tickerHandler) binanceService.off('ticker', this._tickerHandler);
    if (this._klineHandler) binanceService.off('kline', this._klineHandler);
    if (this._klineClosedHandler) binanceService.off('klineClosed', this._klineClosedHandler);
    this.closeWebSocket();
    if (this.orderBookTimer) clearInterval(this.orderBookTimer);
  },

  methods: {
    // ── 币种选择弹窗 ─────────────────────────────────
    async openSymbolModal() {
      const m = this.symbolModal;
      m.query = '';
      m.visible = true;

      // 并行加载自选 + 全量（有缓存则跳过）
      const needFav = m.favoriteList.length === 0;
      const needAll = m.allList.length === 0;
      if (!needFav && !needAll) {
        this._applySymFilter();
        return;
      }

      m.loading = true;
      try {
        const tasks = [];
        if (needFav) tasks.push(getFavoriteStocks().then(l => { m.favoriteList = l; }));
        if (needAll) tasks.push(getAllStocks().then(l => { m.allList = l; }));
        await Promise.all(tasks);
      } catch (e) {
        // 容错：不清空已有数据
      } finally {
        m.loading = false;
      }
      this._applySymFilter();
    },

    switchSymTab(tab) {
      this.symbolModal.tab = tab;
      this.symbolModal.query = '';
      this._applySymFilter();
    },

    _applySymFilter() {
      const m = this.symbolModal;
      const src = m.tab === 'favorite' ? m.favoriteList : m.allList;
      const q = (m.query || '').trim().toUpperCase();
      if (!q) {
        m.filteredList = src;
      } else {
        m.filteredList = src.filter(item =>
          item.code.toUpperCase().includes(q) || (item.symbol && item.symbol.toUpperCase().includes(q))
        );
      }
      // 拉取当前列表的行情（未缓存的才请求）
      this._fetchSymbolTickers(m.filteredList);
    },

    async _fetchSymbolTickers(list) {
      if (!list || list.length === 0) return;
      const m = this.symbolModal;
      // 过滤出尚未缓存的
      const uncached = list.filter(item => !m.tickerMap[item.code]);
      if (uncached.length === 0) return;
      if (m.tickerLoading) return;
      m.tickerLoading = true;
      try {
        const codes = uncached.map(item => item.code);
        const tickers = await binanceService.fetchTickersBatch(codes);
        const map = Object.assign({}, m.tickerMap);
        tickers.forEach(t => { map[t.symbol] = t; });
        m.tickerMap = map;
      } catch (e) {
        // 拉取失败不阻断 UI
      } finally {
        m.tickerLoading = false;
      }
    },

    onSymbolSearch(e) {
      this.symbolModal.query = e.detail.value;
      this._applySymFilter();
    },

    async switchSymbol(item) {
      if (!item || item.code === (this.stock ? this.stock.code : '')) {
        this.symbolModal.visible = false;
        return;
      }
      this.symbolModal.visible = false;

      // 停止旧的 WebSocket 和定时器
      if (this._tickerHandler) binanceService.off('ticker', this._tickerHandler);
      if (this._klineHandler) binanceService.off('kline', this._klineHandler);
      if (this._klineClosedHandler) binanceService.off('klineClosed', this._klineClosedHandler);
      binanceService.close();
      if (this.orderBookTimer) { clearInterval(this.orderBookTimer); this.orderBookTimer = null; }

      // 加载新币种
      const newCode = item.code;
      const newStock = await getStockByCode(newCode);

      this.stock = newStock;
      this.currentPrice = newStock ? newStock.currentPrice : 0;
      this.priceChange = 0;
      this.priceChangePercent = 0;
      this.klineData = [];
      this.klineInfo = null;
      this.notionalInput = '';
      this.pctIndex = -1;
      this.currentSymbol = newCode;

      // 重新拉行情 + K线
      binanceService.fetch24hTicker(newCode).then((ticker) => {
        this.currentPrice = ticker.displayPrice;
        this.priceChange = ticker.priceChange;
        this.priceChangePercent = parseFloat(ticker.priceChangePercent);
        if (this.stock) this.stock = Object.assign({}, this.stock, { currentPrice: ticker.closePrice });
        binanceService.setOpenPrice(newCode, ticker.closePrice - parseFloat(ticker.priceChange));
        this.generateOrderBook();
        this.calculateCost();
      }).catch(() => {});

      this.loadKlineData(newCode);
      this.initWebSocket(newCode);
      this.startOrderBookTimer();
      this.refreshPositions(this.currentPrice);
    },

    // ── 生成模拟盘口 ─────────────────────────────────
    generateOrderBook() {
      const price = parseFloat(this.currentPrice) || parseFloat(this.stock ? this.stock.currentPrice : 1) || 1;
      const tickSize = price >= 10000 ? 0.1 : price >= 1000 ? 0.01 : price >= 1 ? 0.001 : 0.0001;
      const asks = [];
      const bids = [];
      for (let i = 5; i >= 1; i--) {
        const p = parseFloat((price + tickSize * i).toFixed(4));
        const qty = (Math.random() * 5 + 0.001).toFixed(3);
        asks.push({ price: p, qty });
      }
      for (let i = 1; i <= 5; i++) {
        const p = parseFloat((price - tickSize * i).toFixed(4));
        const qty = (Math.random() * 5 + 0.001).toFixed(3);
        bids.push({ price: p, qty });
      }
      this.asks = asks;
      this.bids = bids;
    },

    startOrderBookTimer() {
      this.generateOrderBook();
      this.orderBookTimer = setInterval(() => { this.generateOrderBook(); }, 1500);
    },

    // ── K线 ──────────────────────────────────────────
    async loadKlineData(code) {
      try {
        uni.showLoading({ title: '加载中...', mask: true });
        const klines = await binanceService.fetchKlines(code, this.klineInterval, 200);
        this.klineData = klines;
        this.drawKLine();
        uni.hideLoading();
      } catch (err) {
        uni.hideLoading();
        console.error('❌ Failed to load kline data:', err);
        uni.showToast({ title: '图表加载失败', icon: 'none' });
      }
    },

    initChart() {
      const ctx = uni.createCanvasContext('klineCanvas', this);
      this.chartHelper = new ChartHelper('klineCanvas').init(ctx);
      try {
        const info = uni.getWindowInfo ? uni.getWindowInfo() : null;
        if (info && info.windowWidth) {
          this._winWidth = info.windowWidth;
          // rpx → px：屏幕宽度对应 750rpx，canvas 高度 460rpx
          this._canvasHeight = Math.round(460 * info.windowWidth / 750);
        } else {
          uni.getSystemInfo({
            success: (s) => {
              this._winWidth = s.windowWidth;
              this._canvasHeight = Math.round(460 * s.windowWidth / 750);
            }
          });
        }
      } catch (e) {
        uni.getSystemInfo({
          success: (s) => {
            this._winWidth = s.windowWidth;
            this._canvasHeight = Math.round(460 * s.windowWidth / 750);
          }
        });
      }
    },

    initWebSocket(code) {
      this._tickerHandler = (ticker) => { this.handleTickerUpdate(ticker); };
      this._klineHandler = (kline) => { this.handleKlineUpdate(kline); };
      this._klineClosedHandler = (kline) => { this.handleKlineClosed(kline); };

      binanceService.on('ticker', this._tickerHandler);
      binanceService.on('kline', this._klineHandler);
      binanceService.on('klineClosed', this._klineClosedHandler);

      const symbol = code.toLowerCase();
      binanceService.connect([symbol], [this.klineInterval])
        .catch((err) => { console.error('✗ WS init failed:', err); });
    },

    handleTickerUpdate(ticker) {
      if (!this.stock) return;
      const stockCode = this.stock.code.toUpperCase();
      if (ticker.symbol !== stockCode) return;

      const price = ticker.closePrice;
      const changePercent = parseFloat(ticker.priceChangePercent);

      this.currentPrice = ticker.displayPrice;
      this.priceChange = ticker.priceChange;
      this.priceChangePercent = changePercent;
      if (this.stock) this.stock = Object.assign({}, this.stock, { currentPrice: price, change: changePercent });

      this.calculateCost();
      this.refreshPositions(price);
    },

    intervalToMs(interval) {
      const map = {
        '1m': 60000, '3m': 180000, '5m': 300000, '15m': 900000,
        '30m': 1800000, '1h': 3600000, '2h': 7200000, '4h': 14400000,
        '6h': 21600000, '8h': 28800000, '12h': 43200000,
        '1d': 86400000, '3d': 259200000, '1w': 604800000, '1M': 2592000000,
      };
      return map[interval] || 60000;
    },

    handleKlineUpdate(kline) {
      if (!this.stock) return;
      const stockCode = this.stock.code.toUpperCase();
      if (kline.symbol !== stockCode) return;
      if (kline.interval !== this.klineInterval) return;

      let klineData = [...this.klineData];
      const intervalMs = this.intervalToMs(this.klineInterval);

      if (klineData.length > 0) {
        const lastKline = klineData[klineData.length - 1];
        if (kline.time - lastKline.time < intervalMs) {
          klineData[klineData.length - 1] = kline;
        } else {
          klineData.push(kline);
          if (klineData.length > 200) klineData = klineData.slice(-200);
        }
      } else {
        klineData.push(kline);
      }

      this.klineData = klineData;

      if (this.chartHelper) {
        this.drawKLine();
      }
    },

    handleKlineClosed(kline) {
      if (!this.stock) return;
      const stockCode = this.stock.code.toUpperCase();
      if (kline.symbol !== stockCode) return;

      let klineData = [...this.klineData];
      klineData.push(kline);
      if (klineData.length > 200) klineData = klineData.slice(-200);
      this.klineData = klineData;
      this.drawKLine();
    },

    closeWebSocket() {
      binanceService.close();
    },

    drawKLine() {
      const klineData = this.klineData;
      if (!klineData || klineData.length === 0) return;
      if (!this.chartHelper) this.initChart();

      // 首次或尺寸未初始化时，异步查询 canvas 真实尺寸（flex 撑满时高度是动态的）
      if (!this._canvasSizeReady) {
        const query = uni.createSelectorQuery().in(this);
        query.select('.kline-canvas').boundingClientRect((rect) => {
          if (rect && rect.width > 0 && rect.height > 0) {
            this._canvasHeight = rect.height;
            this._winWidth = rect.width;
            this._canvasSizeReady = true;
          }
          this._doDrawKLine(klineData);
        }).exec();
      } else {
        this._doDrawKLine(klineData);
      }
    },

    _doDrawKLine(klineData) {
      // 保留当前可见区间，仅追加新数据时滚动到最新
      const prevLen = this.chartHelper.data.length;
      const prevStart = this.chartHelper.visibleStart;
      const prevCount = this.chartHelper.visibleCount || 60;

      this.chartHelper.data = klineData;
      this.chartHelper.setInterval(this.klineInterval);
      this.chartHelper.setDimensions(this._winWidth, this._canvasHeight);

      // 如果是新数据加载（数据量大幅变化），重置到最新
      if (prevLen === 0 || Math.abs(klineData.length - prevLen) > 10) {
        const initCount = Math.min(60, klineData.length);
        this.chartHelper.visibleCount = initCount;
        this.chartHelper.visibleStart = Math.max(0, klineData.length - initCount);
      } else if (klineData.length > prevLen) {
        // 正常追加，尾随最新
        const atEnd = (prevStart + prevCount >= prevLen);
        if (atEnd) {
          this.chartHelper.visibleStart = Math.max(0, klineData.length - prevCount);
        }
      }

      this.chartHelper.render({
        showVolume: this.showVolume,
        showMA5: this.showMA5,
        showMA10: this.showMA10,
        crosshairIndex: this.crosshairIndex,
      });
    },

    // ── K线手势：TouchStart ──────────────────────────────────
    onKLineTouchStart(e) {
      if (!this.chartHelper || !this.klineData || this.klineData.length === 0) return;
      const g = this._gesture;
      const touches = e.touches;

      if (touches.length === 1) {
        // 单指：准备平移 or 长按
        const t = touches[0];
        g.mode = 'none';
        g.startX = t.x;
        g.lastX = t.x;
        g.startVisibleStart = this.chartHelper.visibleStart;
        g.startVisibleCount = this.chartHelper.visibleCount;

        // 长按计时器：400ms
        if (g.longPressTimer) clearTimeout(g.longPressTimer);
        g.longPressTimer = setTimeout(() => {
          if (g.mode === 'none' || g.mode === 'longpress') {
            g.mode = 'longpress';
            this._showCrosshair(t.x);
          }
        }, 400);

      } else if (touches.length === 2) {
        // 双指：捏合缩放
        g.mode = 'pinch';
        if (g.longPressTimer) clearTimeout(g.longPressTimer);
        const dx = touches[1].x - touches[0].x;
        const dy = touches[1].y - touches[0].y;
        g.startPinchDist = Math.sqrt(dx * dx + dy * dy);
        g.startVisibleCount = this.chartHelper.getVisibleCount();
        g.startVisibleStart = this.chartHelper.visibleStart;
        // 捏合中心比例
        const midX = (touches[0].x + touches[1].x) / 2;
        const chartArea = this.chartHelper.getChartArea();
        g.pinchCenterRatio = Math.max(0, Math.min(1,
          (midX - chartArea.left) / chartArea.width
        ));
      }
    },

    // ── K线手势：TouchMove ──────────────────────────────────
    onKLineTouchMove(e) {
      if (!this.chartHelper || !this.klineData || this.klineData.length === 0) return;
      const g = this._gesture;
      const touches = e.touches;

      if (touches.length === 2 || g.mode === 'pinch') {
        // 捏合缩放
        if (g.longPressTimer) { clearTimeout(g.longPressTimer); g.longPressTimer = null; }
        g.mode = 'pinch';
        if (touches.length < 2) return;

        const dx = touches[1].x - touches[0].x;
        const dy = touches[1].y - touches[0].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ratio = dist / g.startPinchDist;

        // 基于初始状态重新计算可见数量
        const newCount = Math.round(g.startVisibleCount / ratio);
        const clampedCount = Math.max(
          this.chartHelper.MIN_VISIBLE,
          Math.min(this.chartHelper.MAX_VISIBLE, newCount, this.klineData.length)
        );
        // 保持捏合中心不变
        let newStart = Math.round(g.startVisibleStart + g.startVisibleCount * g.pinchCenterRatio - clampedCount * g.pinchCenterRatio);
        newStart = Math.max(0, Math.min(this.klineData.length - clampedCount, newStart));

        const changed = (newStart !== this.chartHelper.visibleStart || clampedCount !== this.chartHelper.visibleCount);
        this.chartHelper.visibleStart = newStart;
        this.chartHelper.visibleCount = clampedCount;

        if (changed) {
          this.drawKLine();
          this._showZoomHint(clampedCount);
        }

      } else if (touches.length === 1) {
        const t = touches[0];
        const deltaX = t.x - g.startX;

        if (g.mode === 'longpress') {
          // 长按模式：移动十字光标
          this._showCrosshair(t.x);
          return;
        }

        if (g.mode === 'none' && Math.abs(deltaX) > g.panThreshold) {
          // 开始平移，取消长按
          g.mode = 'pan';
          if (g.longPressTimer) { clearTimeout(g.longPressTimer); g.longPressTimer = null; }
        }

        if (g.mode === 'pan') {
          // 平移：计算移动了几根K线
          const chartArea = this.chartHelper.getChartArea();
          const count = this.chartHelper.getVisibleCount();
          const step = chartArea.width / count;
          const deltaIndex = -Math.round(deltaX / step);

          let newStart = g.startVisibleStart + deltaIndex;
          newStart = Math.max(0, Math.min(this.klineData.length - count, newStart));

          if (newStart !== this.chartHelper.visibleStart) {
            this.chartHelper.visibleStart = newStart;
            this.drawKLine();
          }
        }
      }
    },

    // ── K线手势：TouchEnd ────────────────────────────────────
    onKLineTouchEnd(e) {
      const g = this._gesture;
      if (g.longPressTimer) { clearTimeout(g.longPressTimer); g.longPressTimer = null; }

      if (g.mode === 'longpress') {
        // 长按抬手：保留tooltip一段时间后消失
        setTimeout(() => {
          this.klineInfo = null;
          this.crosshairIndex = -1;
          this.drawKLine();
        }, 2500);
      } else if (g.mode === 'none') {
        // 单次点击，清除tooltip
        if (this.klineInfo) {
          this.klineInfo = null;
          this.crosshairIndex = -1;
          this.drawKLine();
        }
      }

      g.mode = 'none';
    },

    // ── 内部：显示十字光标 ───────────────────────────────────
    _showCrosshair(x) {
      if (!this.chartHelper) return;
      const visibleIndex = this.chartHelper.getVisibleIndexAtX(x);
      if (visibleIndex < 0) return;
      const d = this.chartHelper.getDataAtVisibleIndex(visibleIndex);
      if (!d) return;

      this.crosshairIndex = visibleIndex;
      const isUp = d.close >= d.open;
      const change = d.open !== 0 ? ((d.close - d.open) / d.open * 100) : 0;
      this.klineInfo = {
        ...d,
        isUp,
        changeStr: change >= 0 ? '+' + change.toFixed(2) : change.toFixed(2),
        open: FormatData.formatPrice(d.open),
        high: FormatData.formatPrice(d.high),
        low: FormatData.formatPrice(d.low),
        close: FormatData.formatPrice(d.close),
        volumeStr: FormatData.formatVolume(d.volume),
      };
      this.drawKLine();
    },

    // ── 内部：显示缩放提示 ───────────────────────────────────
    _showZoomHint(count) {
      this.zoomHintText = `${count} 根`;
      this.zoomHintVisible = true;
      if (this._zoomHintTimer) clearTimeout(this._zoomHintTimer);
      this._zoomHintTimer = setTimeout(() => {
        this.zoomHintVisible = false;
      }, 1200);
    },

    // ── 交易类型切换 ────────────────────────────────
    switchTradeType(type) {
      this.tradeType = type;
      this.pctIndex = -1;
      this.calculateCost();
    },

    // ── 杠杆控制 ───────────────────────────────────
    onLeverageInput(e) {
      const raw = e.detail.value;
      const val = parseInt(raw);
      if (!isNaN(val) && val >= 1 && val <= 150) {
        this.leverage = val;
        uni.setStorageSync('lastLeverage', val);
        this.calculateCost();
      }
    },

    onLeverageBlur(e) {
      let val = parseInt(e.detail.value);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 150) val = 150;
      this.leverage = val;
      uni.setStorageSync('lastLeverage', val);
      this.calculateCost();
    },

    // ── 开仓金额输入 ────────────────────────────────
    inputMargin(e) {
      this.notionalInput = e.detail.value;
      this.pctIndex = -1;
      this.calculateCost();
    },

    setPctMargin(pct, idx) {
      const { userData } = this;
      const leverage = parseInt(this.leverage) || 1;
      const maxNotional = userData.cash * leverage;
      const notionalInput = parseFloat((maxNotional * pct).toFixed(2));
      this.notionalInput = String(notionalInput);
      this.pctIndex = idx;
      this.calculateCost();
    },

    // ── 核心计算 ────────────────────────────────────
    calculateCost() {
      const { tradeType, userData } = this;
      if (!userData) return;
      const leverage = parseInt(this.leverage) || 1;
      const currentPrice = parseFloat(this.currentPrice) || 0;
      const notional = parseFloat(this.notionalInput) || 0;

      if (notional <= 0 || currentPrice <= 0) {
        this.marginValue = '0.00';
        this.openQty = '0.000000';
        this.commission = '0.00';
        this.liqPrice = '--';
        this.canTrade = false;
        return;
      }

      const margin = notional / leverage;
      const qty = notional / currentPrice;
      const fee = notional * TAKER_FEE_RATE;

      const cash = userData.cash || 0;
      const lossRatio = cash / notional;
      const priceDec = currentPrice >= 1000 ? 2 : currentPrice >= 1 ? 4 : 6;
      let liqPrice;
      if (tradeType === 'buy') {
        liqPrice = currentPrice * (1 - lossRatio + MAINT_MARGIN_RATE);
      } else {
        liqPrice = currentPrice * (1 + lossRatio - MAINT_MARGIN_RATE);
      }
      const liqPriceStr = (tradeType === 'buy' && liqPrice <= 0)
        ? '不会强平'
        : liqPrice > 0 ? liqPrice.toFixed(priceDec) : '--';

      const leverageRisk = leverage >= 50 ? 'extreme'
        : leverage >= 20 ? 'high'
        : leverage >= 5  ? 'mid'
        : 'low';

      const canTrade = margin <= userData.cash && notional > 0;

      this.marginValue = margin.toFixed(2);
      this.openQty = qty.toFixed(6);
      this.commission = fee.toFixed(2);
      this.liqPrice = liqPriceStr;
      this.leverageRisk = leverageRisk;
      this.canTrade = canTrade;
    },

    // ── 确认下单 ────────────────────────────────────
    confirmTrade() {
      const { stock, tradeType, notionalInput, marginValue, leverage, openQty, currentPrice } = this;
      const notional = parseFloat(notionalInput) || 0;
      const margin = parseFloat(marginValue) || 0;

      if (notional <= 0) {
        uni.showToast({ title: '请输入开仓金额', icon: 'none' });
        return;
      }
      if (!this.canTrade) {
        uni.showToast({ title: '余额不足', icon: 'none' });
        return;
      }

      const action = tradeType === 'buy' ? '做多' : '做空';
      const priceStr = FormatData.formatPrice(currentPrice);
      const msg = `${action} ${stock.symbol}\n杠杆：${leverage}x\n开仓金额：${notional} USDT\n保证金：${margin} USDT\n开仓数量：${openQty}\n当前价：${priceStr}`;

      uni.showModal({
        title: '确认开仓',
        content: msg,
        success: (res) => {
          if (res.confirm) this.executeTrade();
        },
      });
    },

    executeTrade() {
      const { stock, tradeType, notionalInput, marginValue, leverage, openQty, commission, currentPrice, liqPrice } = this;
      const notional = parseFloat(notionalInput);
      const margin = parseFloat(marginValue);
      const fee = parseFloat(commission);
      const qty = parseFloat(openQty);
      const price = parseFloat(currentPrice);

      const app = getApp();
      let userData = app.getUserData();
      const now = getCurrentDateTime();

      userData.cash -= margin;

      const existingIndex = userData.stocks.findIndex(s => s.code === stock.code);
      if (existingIndex > -1) {
        const existing = userData.stocks[existingIndex];
        const totalQty = existing.quantity + qty;
        const newCost = existing.cost + price * qty;
        userData.stocks[existingIndex] = {
          ...existing,
          quantity: totalQty,
          cost: newCost,
          currentPrice: price,
          leverage,
          margin: (existing.margin || 0) + margin,
          tradeType,
          liqPrice,
        };
      } else {
        userData.stocks.push({
          code: stock.code,
          name: stock.name,
          symbol: stock.symbol,
          quantity: qty,
          cost: price * qty,
          currentPrice: price,
          buyPrice: price,
          leverage,
          margin,
          tradeType,
          liqPrice,
          buyTime: now, // 开仓时间
        });
      }

      userData.history.unshift({
        type: tradeType,
        code: stock.code,
        name: stock.name,
        symbol: stock.symbol,
        quantity: qty,
        price,
        margin,
        leverage,
        amount: notional,
        notional: margin * leverage,
        time: now,
      });

      const totalMargin = userData.stocks.reduce((sum, s) => sum + (s.margin || 0), 0);
      userData.totalAssets = userData.cash + totalMargin;
      userData.profit = userData.totalAssets - 10000;

      app.updateUserData(userData);

      const freshUserData = app.getUserData();
      this.userData = freshUserData;
      this.cashDisplay = parseFloat(freshUserData.cash || 0).toFixed(2);
      this.notionalInput = '';
      this.pctIndex = -1;
      this.calculateCost();
      this.refreshPositions(price);
      uni.showToast({ title: '开仓成功', icon: 'success', duration: 1500 });
    },

    // ── K线周期 / 指标切换 ──────────────────────────
    switchKlineInterval(interval) {
      if (interval === this.klineInterval) return;
      this.klineInterval = interval;
      this.klineData = [];
      this.klineInfo = null;
      this.crosshairIndex = -1;
      // 切换周期时重置可见区间
      if (this.chartHelper) {
        this.chartHelper.visibleStart = 0;
        this.chartHelper.visibleCount = 60;
      }

      const symbol = this.stock.code;
      binanceService.reconnect([symbol.toLowerCase()], [interval]);
      this.loadKlineData(symbol);
    },

    toggleVolume() {
      this.showVolume = !this.showVolume;
      this.drawKLine();
    },

    toggleMA5() {
      this.showMA5 = !this.showMA5;
      this.drawKLine();
    },

    toggleMA10() {
      this.showMA10 = !this.showMA10;
      this.drawKLine();
    },

    toggleKline() {
      const expanded = !this.klineExpanded;
      this.klineExpanded = expanded;
      uni.setStorageSync('klineExpanded', expanded);
      if (expanded) {
        // 展开时重新查询 canvas 尺寸（尺寸可能因 flex 变化而改变）
        this._canvasSizeReady = false;
        setTimeout(() => { this.drawKLine(); }, 50);
      }
    },

    // ── 持仓区 ─────────────────────────────────────
    switchPosTab(tab) {
      this.posTab = tab;
    },

    // ── 平仓弹窗 ──────────────────────────────────
    openCloseModal(pos) {
      const m = this.closeModal;
      const price = parseFloat(this.currentPrice) || 0;
      m.code = pos.code;
      m.symbol = pos.symbol;
      m.tradeType = pos.tradeType;
      m.maxQty = pos.quantity;
      m.maxUsdt = parseFloat((pos.quantity * price).toFixed(2));
      m.maxUsdtStr = m.maxUsdt.toFixed(2);
      m.avgPrice = pos.quantity > 0 ? pos.cost / pos.quantity : 0;
      m.margin = pos.margin || 0;
      m.usdtInput = '';
      m.estQtyStr = '';
      m.pctIdx = -1;
      m.pctDisplay = '0.00';
      m.estPnl = 0;
      m.estPnlStr = '0.00';
      m.estFeeStr = '0.00';
      m.estReturnStr = '0.00';
      m.canClose = false;
      m.visible = true;
    },

    onCloseUsdtInput(e) {
      this.closeModal.usdtInput = e.detail.value;
      this.closeModal.pctIdx = -1;
      this._recalcCloseModal();
    },

    setClosePct(pct, idx) {
      const usdt = parseFloat((this.closeModal.maxUsdt * pct).toFixed(2));
      this.closeModal.usdtInput = String(usdt);
      this.closeModal.pctIdx = idx;
      this._recalcCloseModal();
    },

    _recalcCloseModal() {
      const m = this.closeModal;
      const price = parseFloat(this.currentPrice) || 0;
      const closeUsdt = parseFloat(m.usdtInput) || 0;

      if (closeUsdt <= 0 || closeUsdt > m.maxUsdt + 0.01 || price <= 0) {
        m.estQtyStr = '';
        m.pctDisplay = '0.00';
        m.estPnl = 0;
        m.estPnlStr = '0.00';
        m.estFeeStr = '0.00';
        m.estReturnStr = '0.00';
        m.canClose = false;
        return;
      }

      // USDT 金额 → 币种数量
      const closeQty = closeUsdt / price;
      const ratio = closeQty / m.maxQty;
      const closedMargin = m.margin * ratio;
      const fee = closeUsdt * TAKER_FEE_RATE;

      // 盈亏 = (平仓价 - 开仓均价) × 数量（做多），做空反向
      const pnl = m.tradeType === 'buy'
        ? (price - m.avgPrice) * closeQty
        : (m.avgPrice - price) * closeQty;
      const pnlNet = pnl - fee;
      const returnAmount = Math.max(0, closedMargin + pnlNet);

      m.estQtyStr = closeQty.toFixed(6);
      m.pctDisplay = (ratio * 100).toFixed(2);
      m.estPnl = pnlNet;
      m.estPnlStr = Math.abs(pnlNet).toFixed(2);
      m.estFeeStr = fee.toFixed(2);
      m.estReturnStr = returnAmount.toFixed(2);
      m.canClose = true;
    },

    confirmClosePosition() {
      const m = this.closeModal;
      if (!m.canClose) return;

      const price = parseFloat(this.currentPrice) || 0;
      const closeUsdt = parseFloat(m.usdtInput) || 0;
      if (closeUsdt <= 0 || price <= 0) return;

      // USDT → 数量
      const closeQty = closeUsdt / price;

      const app = getApp();
      let userData = app.getUserData();
      const idx = userData.stocks.findIndex(s => s.code === m.code);
      if (idx === -1) return;

      const pos = userData.stocks[idx];
      const maxQty = pos.quantity;
      const ratio = closeQty / maxQty;
      const closedMargin = (pos.margin || 0) * ratio;
      const notional = closeQty * price;
      const pnl = pos.tradeType === 'buy'
        ? (price - m.avgPrice) * closeQty
        : (m.avgPrice - price) * closeQty;
      const fee = notional * TAKER_FEE_RATE;
      const pnlNet = pnl - fee;
      const returnAmount = Math.max(0, closedMargin + pnlNet);

      const isFullClose = Math.abs(closeQty - maxQty) < 0.000001;

      if (isFullClose) {
        // 全部平仓：直接移除仓位
        userData.stocks.splice(idx, 1);
      } else {
        // 部分平仓：更新剩余仓位
        const remainQty = maxQty - closeQty;
        const remainRatio = remainQty / maxQty;
        userData.stocks[idx] = {
          ...pos,
          quantity: remainQty,
          cost: pos.cost * remainRatio,
          margin: (pos.margin || 0) * remainRatio,
        };
      }

      userData.cash += returnAmount;

      const now = getCurrentDateTime();
      userData.history.unshift({
        type: pos.tradeType === 'buy' ? 'close_buy' : 'close_sell',
        code: pos.code,
        name: pos.name,
        symbol: pos.symbol,
        quantity: closeQty,
        price,
        avgPrice: m.avgPrice,
        pnl: pnlNet,
        closeFee: fee,
        returnAmount,
        leverage: pos.leverage,
        isPartial: !isFullClose,
        openTime: pos.buyTime || '--',
        time: now,
      });

      const totalMargin = userData.stocks.reduce((sum, s) => sum + (s.margin || 0), 0);
      userData.totalAssets = userData.cash + totalMargin;
      userData.profit = userData.totalAssets - 10000;

      app.updateUserData(userData);

      m.visible = false;

      const latestUserData = app.getUserData();
      this.userData = latestUserData;
      this.cashDisplay = parseFloat(latestUserData.cash || 0).toFixed(2);
      this.refreshPositions(price);

      const label = isFullClose ? '全部平仓' : '部分平仓';
      const toast = pnlNet >= 0
        ? `${label} 盈利 +${pnlNet.toFixed(2)}`
        : `${label} 亏损 ${pnlNet.toFixed(2)}`;
      uni.showToast({ title: toast, icon: pnlNet >= 0 ? 'success' : 'none', duration: 2000 });
    },

    refreshPositions(latestPrice) {
      if (!this.stock) return;
      const price = parseFloat(latestPrice) || parseFloat(this.currentPrice) || 0;
      if (!price) return;
      const app = getApp();
      const userData = app.getUserData();
      const code = this.stock.code;
      if (!code || !userData || !userData.stocks) {
        this.currentPositions = [];
        return;
      }

      const positions = userData.stocks
        .filter(s => s.code === code)
        .map(s => {
          const avgPrice = s.quantity > 0 ? s.cost / s.quantity : 0;
          const notional = s.quantity * price;
          const pnl = s.tradeType === 'buy'
            ? (price - avgPrice) * s.quantity
            : (avgPrice - price) * s.quantity;
          const margin = s.margin || 1;
          const pnlPct = (pnl / margin) * 100;
          const closeFee = notional * TAKER_FEE_RATE;

          return {
            ...s,
            qtyStr: s.quantity.toFixed(6),
            avgPriceStr: avgPrice.toFixed(2),
            marginStr: margin.toFixed(2),
            notionalStr: notional.toFixed(2),
            pnl,
            pnlStr: Math.abs(pnl).toFixed(2),
            pnlPctStr: (pnl >= 0 ? '+' : '-') + Math.abs(pnlPct).toFixed(2),
            closeFeeStr: closeFee.toFixed(2),
          };
        });

      this.currentPositions = positions;

      // ── 加载平仓历史 ──────────────────────────────
      const closeTypes = new Set(['close_buy', 'close_sell']);
      const closeHistory = (userData.history || [])
        .filter(h => closeTypes.has(h.type) && h.code === code)
        .map(h => {
          const margin = h.quantity * h.avgPrice / (h.leverage || 1);
          const roi = margin > 0 ? (h.pnl / margin * 100) : 0;
          return {
            ...h,
             tradeType: h.type === 'close_buy' ? 'buy' : 'sell',
             pnlStr: (h.pnl >= 0 ? '+' : '') + Math.abs(h.pnl).toFixed(2),
             roiStr: (roi >= 0 ? '+' : '') + roi.toFixed(2) + '%',
             qtyStr: (h.quantity || 0).toFixed(6).replace(/\.?0+$/, m => m === '.' ? '' : m),
             closeNotionalStr: ((h.quantity || 0) * (h.price || 0)).toFixed(2),
             avgPriceStr: FormatData.formatPrice(h.avgPrice),
             closePriceStr: FormatData.formatPrice(h.price),
             openTime: h.openTime || '--',
          };
        });
      this.closedPositions = closeHistory;
    },
  },
};
</script>

<style>
/* ══════════════════════════════════════════════
   交易页  —  高质感暗色 v2
   ══════════════════════════════════════════════ */

.container {
  background: #080a0f;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.up   { color: #10b981; }
.down { color: #ef4444; }

/* ── 顶部栏 ─────────────────────────────────── */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx 18rpx;
  background: linear-gradient(180deg, #0d1117 0%, #111827 100%);
  border-bottom: 1rpx solid rgba(255,255,255,0.06);
}

.top-coin {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.top-coin-name {
  font-size: 34rpx;
  font-weight: 800;
  color: #f1f5f9;
  letter-spacing: 0.01em;
}

.top-coin-sub {
  font-size: 18rpx;
  color: #64748b;
  background: rgba(255,255,255,0.06);
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  letter-spacing: 0.04em;
  border: 1rpx solid rgba(255,255,255,0.07);
}

.top-change-only {
  display: flex;
  align-items: center;
}

.top-change {
  font-size: 21rpx;
  font-weight: 600;
  letter-spacing: 0.01em;
}

/* ── 主体：委托 + 盘口 ───────────────────────── */
.main-body {
  display: flex;
  align-items: stretch;
  background: #0d1117;
  border-bottom: 1rpx solid rgba(255,255,255,0.06);
}

.order-panel {
  flex: 1;
  padding: 16rpx 16rpx 20rpx;
  border-right: 1rpx solid rgba(255,255,255,0.06);
  min-width: 0;
}

.trade-tabs {
  display: flex;
  margin-bottom: 16rpx;
  background: rgba(255,255,255,0.04);
  border-radius: 10rpx;
  padding: 3rpx;
  border: 1rpx solid rgba(255,255,255,0.05);
}

.trade-tab {
  flex: 1;
  padding: 12rpx 0;
  text-align: center;
  font-size: 24rpx;
  font-weight: 600;
  color: #64748b;
  border-radius: 8rpx;
  letter-spacing: 0.02em;
}

.trade-tab.active-buy  { background: #10b981; color: #064e3b; }
.trade-tab.active-sell { background: #ef4444; color: #ffffff; }

.leverage-section { margin-bottom: 14rpx; }

.leverage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.leverage-label { font-size: 20rpx; color: #64748b; font-weight: 500; }
.leverage-hint  { font-size: 18rpx; color: #334155; }

.lev-input-box {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.04);
  border: 1rpx solid rgba(255,255,255,0.08);
  border-radius: 8rpx;
  padding: 12rpx 14rpx;
}

.lev-input {
  flex: 1;
  font-size: 30rpx;
  font-weight: 700;
  color: #fbbf24;
  font-variant-numeric: tabular-nums;
}

.lev-input-unit {
  font-size: 22rpx;
  font-weight: 700;
  color: #fbbf24;
  margin-left: 4rpx;
  flex-shrink: 0;
}

.input-row { margin-bottom: 12rpx; }

.input-hint {
  font-size: 18rpx;
  color: #64748b;
  margin-bottom: 7rpx;
  display: block;
}

.input-box {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.04);
  border: 1rpx solid rgba(255,255,255,0.08);
  border-radius: 8rpx;
  padding: 14rpx 14rpx;
}

.qty-input {
  flex: 1;
  font-size: 26rpx;
  font-weight: 600;
  color: #e2e8f0;
}

.input-unit {
  font-size: 19rpx;
  color: #64748b;
  font-weight: 600;
  margin-left: 8rpx;
  flex-shrink: 0;
}

.pct-row {
  display: flex;
  align-items: center;
  margin-bottom: 14rpx;
  background: rgba(255,255,255,0.03);
  border-radius: 8rpx;
  overflow: hidden;
  border: 1rpx solid rgba(255,255,255,0.05);
}

.pct-btn {
  flex: 1;
  font-size: 18rpx;
  color: #64748b;
  padding: 8rpx 0;
  text-align: center;
  font-weight: 500;
}

.pct-btn.pct-active {
  color: #fbbf24;
  background: rgba(251,191,36,0.1);
  font-weight: 700;
}

.pct-line {
  width: 1rpx;
  height: 28rpx;
  background: rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.avail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}

.avail-label { font-size: 19rpx; color: #64748b; }
.avail-value { font-size: 19rpx; color: #e2e8f0; font-weight: 600; font-variant-numeric: tabular-nums; }

.summary-block {
  background: rgba(255,255,255,0.03);
  border-radius: 8rpx;
  padding: 10rpx 12rpx;
  margin-bottom: 14rpx;
  border: 1rpx solid rgba(255,255,255,0.05);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5rpx 0;
}

.summary-row.highlight {
  padding-top: 9rpx;
  margin-top: 4rpx;
  border-top: 1rpx solid rgba(255,255,255,0.06);
}

.sum-label { font-size: 18rpx; color: #64748b; }
.sum-val { font-size: 19rpx; color: #e2e8f0; font-weight: 600; font-variant-numeric: tabular-nums; }
.liq-price { font-size: 20rpx; font-weight: 700; }

.submit-btn {
  width: 100%;
  margin-top: 2rpx;
  padding: 18rpx 0;
  border-radius: 10rpx;
  font-size: 26rpx;
  font-weight: 700;
  text-align: center;
  border: none;
  letter-spacing: 0.04em;
}

.submit-btn.buy  { background: linear-gradient(135deg, #10b981, #059669); color: #ecfdf5; box-shadow: 0 4rpx 16rpx rgba(16,185,129,0.3); }
.submit-btn.sell { background: linear-gradient(135deg, #ef4444, #dc2626); color: #ffffff; box-shadow: 0 4rpx 16rpx rgba(239,68,68,0.3); }
.submit-btn[disabled] { opacity: 0.3; box-shadow: none; }

/* ── 盘口面板 ──────────────────────────────────────── */
.orderbook-panel {
  width: 210rpx;
  flex-shrink: 0;
  padding: 16rpx 12rpx 20rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.ob-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6rpx;
  padding-bottom: 6rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.05);
}

.ob-col-label       { font-size: 17rpx; color: #334155; }
.ob-col-label.right { text-align: right; }

.ob-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4rpx 0;
  position: relative;
}

.ob-row.ask::before {
  content: '';
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 30%;
  background: rgba(239,68,68,0.07);
  border-radius: 2rpx;
}

.ob-row.bid::before {
  content: '';
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 30%;
  background: rgba(16,185,129,0.07);
  border-radius: 2rpx;
}

.ob-price {
  font-size: 20rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  position: relative;
  z-index: 1;
}

.ask-price { color: #f87171; }
.bid-price { color: #34d399; }

.ob-qty {
  font-size: 18rpx;
  color: #475569;
  font-variant-numeric: tabular-nums;
  position: relative;
  z-index: 1;
}

.ob-mid {
  padding: 7rpx 2rpx;
  border-top: 1rpx solid rgba(255,255,255,0.05);
  border-bottom: 1rpx solid rgba(255,255,255,0.05);
  margin: 3rpx 0;
  background: rgba(255,255,255,0.02);
  border-radius: 4rpx;
}

.ob-mid-price {
  font-size: 27rpx;
  font-weight: 800;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  display: block;
  text-align: left;
}

/* ── K线图区 ──────────────────────────────────────── */
.kline-section {
  flex: 1;
  background: #080a0f;
  border-top: 1rpx solid rgba(255,255,255,0.05);
  display: flex;
  flex-direction: column;
}

.kline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 20rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.05);
  background: #0d1117;
}

.kline-header-left {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.kline-header-title { font-size: 22rpx; font-weight: 600; color: #64748b; }
.kline-toggle-icon  { font-size: 22rpx; color: #334155; }

.kline-bottom-bar {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 24rpx env(safe-area-inset-bottom, 0);
  min-height: 80rpx;
  background: #0d1117;
  border-top: 1rpx solid rgba(255,255,255,0.06);
  box-shadow: 0 -8rpx 24rpx rgba(0,0,0,0.5);
}

.kline-bottom-title { font-size: 25rpx; font-weight: 600; color: #94a3b8; }
.kline-bottom-arrow { font-size: 20rpx; color: #334155; }

/* 收起时指标栏占位，高度匹配吸底栏实际占用 */
.kline-collapsed-placeholder {
  height: 80rpx;
  background: #080a0f;
}

/* ── 持仓区 ──────────────────────────────────────── */
.position-section {
  background: #080a0f;
  border-top: 1rpx solid rgba(255,255,255,0.05);
}

.pos-tabs {
  display: flex;
  border-bottom: 1rpx solid rgba(255,255,255,0.05);
  padding: 0 16rpx;
  background: #0d1117;
}

.pos-tab {
  padding: 18rpx 16rpx 14rpx;
  font-size: 22rpx;
  color: #64748b;
  position: relative;
  font-weight: 500;
  margin-right: 4rpx;
}

.pos-tab-active { color: #e2e8f0; font-weight: 700; }

.pos-tab-active::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 3rpx;
  background: linear-gradient(90deg, #fbbf24, #f59e0b);
  border-radius: 2rpx 2rpx 0 0;
}

.pos-empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 80rpx 0 60rpx;
  gap: 16rpx;
}

.pos-empty-text { font-size: 24rpx; color: #334155; }

.pos-card {
  margin: 12rpx 16rpx;
  background: rgba(15,20,30,0.9);
  border-radius: 16rpx;
  overflow: hidden;
  border: 1rpx solid rgba(255,255,255,0.07);
  box-shadow: 0 4rpx 24rpx rgba(0,0,0,0.4);
}

.pos-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16rpx 18rpx 12rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.02);
}

.pos-card-left { display: flex; align-items: center; gap: 10rpx; }
.pos-code { font-size: 26rpx; font-weight: 700; color: #e2e8f0; }

.pos-side-badge { font-size: 18rpx; font-weight: 700; padding: 4rpx 12rpx; border-radius: 6rpx; }
.badge-long  { background: rgba(16,185,129,0.15); color: #34d399; border: 1rpx solid rgba(16,185,129,0.2); }
.badge-short { background: rgba(239,68,68,0.15); color: #f87171; border: 1rpx solid rgba(239,68,68,0.2); }

.pos-card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 3rpx; }
.pos-pnl { font-size: 27rpx; font-weight: 700; font-variant-numeric: tabular-nums; }
.pos-pnl-pct { font-size: 18rpx; font-variant-numeric: tabular-nums; }

.pos-card-body {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  padding: 12rpx 18rpx 14rpx;
}

.pos-info-col { display: flex; flex-direction: column; gap: 5rpx; padding: 8rpx 0; }
.pos-info-label { font-size: 17rpx; color: #64748b; }
.pos-info-val { font-size: 20rpx; color: #e2e8f0; font-weight: 600; font-variant-numeric: tabular-nums; }

.pos-close-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 18rpx 16rpx;
  border-top: 1rpx solid rgba(255,255,255,0.05);
}

.pos-close-info { display: flex; align-items: center; gap: 8rpx; }
.pos-close-fee-label { font-size: 18rpx; color: #64748b; }
.pos-close-fee-val { font-size: 18rpx; color: #e2e8f0; font-weight: 600; font-variant-numeric: tabular-nums; }

.pos-close-btn { padding: 10rpx 28rpx; border-radius: 8rpx; font-size: 21rpx; font-weight: 700; letter-spacing: 0.02em; }
.pos-close-btn.close-sell { background: rgba(239,68,68,0.12); color: #f87171; border: 1rpx solid rgba(239,68,68,0.3); }
.pos-close-btn.close-buy  { background: rgba(16,185,129,0.12); color: #34d399; border: 1rpx solid rgba(16,185,129,0.3); }

/* ── K线周期栏 ────────────────────────────────────── */
.interval-bar {
  display: flex;
  padding: 6rpx 8rpx 8rpx;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  background: #0d1117;
  border-bottom: 1rpx solid rgba(255,255,255,0.05);
}

.interval-bar::-webkit-scrollbar { display: none; }

.interval-btn {
  flex-shrink: 0;
  padding: 7rpx 16rpx;
  background: transparent;
  border-radius: 6rpx;
  font-size: 21rpx;
  font-weight: 500;
  color: #64748b;
  text-align: center;
}

.interval-btn.active { color: #fbbf24; background: rgba(251,191,36,0.08); font-weight: 700; border: 1rpx solid rgba(251,191,36,0.2); }

.ma-legend { display: flex; gap: 20rpx; padding: 4rpx 16rpx 6rpx; }
.ma-item   { font-size: 18rpx; font-weight: 600; }
.ma5       { color: #fbbf24; }
.ma10      { color: #a78bfa; }

.kline-wrap { flex: 1; background: #080a0f; width: 100%; position: relative; display: flex; flex-direction: column; }
.kline-canvas { flex: 1; width: 100%; min-height: 300rpx; display: block; }

/* 缩放根数提示 */
.kline-zoom-hint {
  position: absolute;
  top: 16rpx;
  right: 24rpx;
  background: rgba(0,0,0,0.7);
  border-radius: 8rpx;
  padding: 6rpx 16rpx;
  pointer-events: none;
  border: 1rpx solid rgba(255,255,255,0.1);
}
.kline-zoom-hint-text {
  font-size: 20rpx;
  color: #fbbf24;
  font-weight: 600;
}

.tools-bar {
  display: flex;
  gap: 8rpx;
  padding: 10rpx 16rpx 12rpx;
  background: #0d1117;
  border-top: 1rpx solid rgba(255,255,255,0.05);
}

.tool-btn {
  padding: 6rpx 16rpx;
  background: rgba(255,255,255,0.04);
  border-radius: 6rpx;
  font-size: 19rpx;
  font-weight: 600;
  color: #64748b;
  border: 1rpx solid rgba(255,255,255,0.07);
}

.tool-btn.active { color: #fbbf24; background: rgba(251,191,36,0.08); border-color: rgba(251,191,36,0.25); }

.kline-tooltip {
  position: absolute;
  top: 10rpx;
  left: 10rpx;
  z-index: 10;
  background: rgba(8,10,15,0.92);
  border-radius: 12rpx;
  padding: 12rpx 16rpx;
  border: 1rpx solid rgba(255,255,255,0.1);
  pointer-events: none;
  min-width: 300rpx;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.6);
}

.tooltip-row-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10rpx;
}

.tooltip-date {
  font-size: 19rpx;
  color: #64748b;
}

.tooltip-chg {
  font-size: 19rpx;
  font-weight: 600;
}
.tooltip-chg.up   { color: #10b981; }
.tooltip-chg.down { color: #ef4444; }

.tooltip-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4rpx;
}

.tooltip-item  { text-align: center; }
.tooltip-label { font-size: 16rpx; color: #334155; display: block; margin-bottom: 4rpx; }
.tooltip-val   { font-size: 17rpx; font-weight: 600; color: #e2e8f0; display: block; font-variant-numeric: tabular-nums; }
.tooltip-val.up   { color: #10b981; }
.tooltip-val.down { color: #ef4444; }
.tooltip-val.vol  { color: #a78bfa; }

/* ── 平仓弹窗 ──────────────────────────────────────── */
.close-modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(8rpx);
  -webkit-backdrop-filter: blur(8rpx);
  z-index: 500;
  display: flex;
  align-items: flex-end;
}

.close-modal {
  width: 100%;
  background: linear-gradient(180deg, #111827 0%, #0d1117 100%);
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx 32rpx 60rpx;
  border-top: 1rpx solid rgba(255,255,255,0.08);
  box-shadow: 0 -20rpx 60rpx rgba(0,0,0,0.6);
}

.close-modal-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 28rpx;
}

.close-modal-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #f1f5f9;
}

.close-modal-sub {
  font-size: 21rpx;
  color: #64748b;
  background: rgba(255,255,255,0.05);
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  border: 1rpx solid rgba(255,255,255,0.07);
}

.close-modal-price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
  background: rgba(255,255,255,0.03);
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  border: 1rpx solid rgba(255,255,255,0.05);
}

.close-modal-label {
  font-size: 22rpx;
  color: #64748b;
}

.close-modal-price {
  font-size: 32rpx;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.close-modal-input-section {
  margin-bottom: 20rpx;
}

.close-modal-input-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10rpx;
}

.close-modal-max {
  font-size: 21rpx;
  color: #475569;
}

.close-modal-qty-hint {
  display: block;
  font-size: 19rpx;
  color: #64748b;
  margin-top: 8rpx;
  padding-left: 4rpx;
}

.close-modal-input-wrap {
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.05);
  border: 1rpx solid rgba(255,255,255,0.09);
  border-radius: 12rpx;
  padding: 20rpx 20rpx;
}

.close-modal-input {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  color: #e2e8f0;
}

.close-modal-input-unit {
  font-size: 21rpx;
  color: #64748b;
  font-weight: 600;
  margin-left: 10rpx;
  flex-shrink: 0;
}

.close-modal-pct-row {
  display: flex;
  gap: 12rpx;
  margin-bottom: 28rpx;
}

.close-pct-btn {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  background: rgba(255,255,255,0.04);
  border-radius: 10rpx;
  font-size: 23rpx;
  font-weight: 600;
  color: #64748b;
  border: 1rpx solid rgba(255,255,255,0.07);
}

.close-pct-btn.close-pct-active {
  color: #fbbf24;
  background: rgba(251,191,36,0.1);
  border-color: rgba(251,191,36,0.3);
}

.close-modal-summary {
  background: rgba(255,255,255,0.03);
  border-radius: 14rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 28rpx;
  border: 1rpx solid rgba(255,255,255,0.06);
}

.close-sum-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8rpx 0;
}

.close-sum-label {
  font-size: 21rpx;
  color: #64748b;
}

.close-sum-val {
  font-size: 23rpx;
  font-weight: 600;
  color: #e2e8f0;
  font-variant-numeric: tabular-nums;
}

.close-modal-actions {
  display: flex;
  gap: 16rpx;
}

.close-modal-cancel {
  flex: 1;
  padding: 28rpx 0;
  text-align: center;
  background: rgba(255,255,255,0.05);
  border-radius: 14rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #64748b;
  border: 1rpx solid rgba(255,255,255,0.08);
}

.close-modal-confirm {
  flex: 2;
  padding: 28rpx 0;
  text-align: center;
  border-radius: 14rpx;
  font-size: 28rpx;
  font-weight: 700;
}

.confirm-sell { background: linear-gradient(135deg, #ef4444, #dc2626); color: #ffffff; box-shadow: 0 4rpx 16rpx rgba(239,68,68,0.3); }
.confirm-buy  { background: linear-gradient(135deg, #10b981, #059669); color: #ecfdf5; box-shadow: 0 4rpx 16rpx rgba(16,185,129,0.3); }

.confirm-disabled {
  opacity: 0.35;
  pointer-events: none;
}

/* ── 顶部币种点击效果 ──────────────────────────────── */
.top-coin-arrow {
  font-size: 20rpx;
  color: #64748b;
  margin-left: 4rpx;
  line-height: 1;
}

/* ── 币种选择弹窗 ──────────────────────────────────── */
.sym-modal-mask {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.72);
  backdrop-filter: blur(10rpx);
  -webkit-backdrop-filter: blur(10rpx);
  z-index: 600;
  display: flex;
  align-items: flex-end;
}

.sym-modal {
  width: 100%;
  height: 72vh;
  background: linear-gradient(180deg, #111827 0%, #0d1117 100%);
  border-radius: 32rpx 32rpx 0 0;
  display: flex;
  flex-direction: column;
  padding-bottom: 40rpx;
  border-top: 1rpx solid rgba(255,255,255,0.08);
  box-shadow: 0 -20rpx 60rpx rgba(0,0,0,0.7);
}

.sym-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 32rpx 20rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.sym-modal-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #f1f5f9;
}

.sym-tabs {
  display: flex;
  flex-direction: row;
  padding: 0 24rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.sym-tab {
  flex: 1;
  text-align: center;
  font-size: 25rpx;
  color: #64748b;
  padding: 18rpx 0 14rpx;
  border-bottom: 3rpx solid transparent;
  font-weight: 500;
}

.sym-tab-active {
  color: #fbbf24;
  border-bottom-color: #fbbf24;
  font-weight: 700;
}

.sym-modal-close {
  font-size: 30rpx;
  color: #475569;
  padding: 8rpx 12rpx;
}

.sym-search-wrap {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin: 18rpx 24rpx;
  background: rgba(255,255,255,0.05);
  border-radius: 20rpx;
  padding: 16rpx 24rpx;
  flex-shrink: 0;
  border: 1rpx solid rgba(255,255,255,0.07);
}

.sym-search-icon {
  font-size: 24rpx;
  color: #64748b;
}

.sym-search-input {
  flex: 1;
  font-size: 25rpx;
  color: #e2e8f0;
  background: transparent;
}

.sym-search-placeholder {
  color: #334155;
}

.sym-list {
  flex: 1;
  overflow: hidden;
  padding: 0 8rpx;
}

.sym-loading,
.sym-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80rpx 0;
}

.sym-loading-text,
.sym-empty-text {
  font-size: 25rpx;
  color: #475569;
}

.sym-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 24rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.04);
  transition: background 0.15s;
}

.sym-item:active {
  background: rgba(255,255,255,0.04);
}

.sym-item-active {
  background: rgba(251,191,36,0.05);
}

.sym-item-left {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.sym-item-name-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.sym-item-code {
  font-size: 27rpx;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: 0.01em;
}

.sym-item-tag {
  font-size: 17rpx;
  color: #fbbf24;
  background: rgba(251,191,36,0.12);
  padding: 3rpx 10rpx;
  border-radius: 8rpx;
  border: 1rpx solid rgba(251,191,36,0.2);
}

.sym-item-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6rpx;
  min-width: 150rpx;
}

.sym-item-price {
  font-size: 25rpx;
  font-weight: 600;
  color: #e2e8f0;
  font-variant-numeric: tabular-nums;
}

.sym-item-pct {
  font-size: 21rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.sym-up   { color: #34d399; }
.sym-down { color: #f87171; }

.sym-item-vol {
  font-size: 18rpx;
  color: #475569;
}

.sym-item-loading {
  font-size: 21rpx;
  color: #334155;
}

/* ══ 仓位历史 closed-card ══════════════════════ */
.closed-card {
  margin: 12rpx 16rpx;
  background: rgba(15,20,30,0.92);
  border-radius: 16rpx;
  border: 1rpx solid rgba(255,255,255,0.07);
  box-shadow: 0 4rpx 24rpx rgba(0,0,0,0.4);
  overflow: hidden;
}

.closed-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 18rpx 12rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.025);
}

.closed-card-left {
  display: flex;
  align-items: center;
  gap: 10rpx;
  flex-wrap: wrap;
}

/* 买/卖 方向标签 */
.closed-side-tag {
  font-size: 17rpx;
  font-weight: 700;
  width: 36rpx;
  height: 36rpx;
  line-height: 36rpx;
  text-align: center;
  border-radius: 8rpx;
}
.tag-long  { background: #10b981; color: #fff; }
.tag-short { background: #ef4444; color: #fff; }

.closed-code {
  font-size: 28rpx;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: 0.5rpx;
}
.closed-perp {
  font-size: 19rpx;
  color: #64748b;
  margin-left: 2rpx;
}
.closed-lev-tag {
  font-size: 18rpx;
  color: #94a3b8;
  background: rgba(255,255,255,0.06);
  border: 1rpx solid rgba(255,255,255,0.1);
  border-radius: 8rpx;
  padding: 3rpx 10rpx;
}
.closed-type-label {
  font-size: 20rpx;
  color: #64748b;
  white-space: nowrap;
}

/* 数据网格 3列 */
.closed-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0;
  padding: 16rpx 18rpx 8rpx;
  row-gap: 18rpx;
}
.closed-grid-item {
  display: flex;
  flex-direction: column;
  gap: 5rpx;
}
.closed-grid-item.align-right {
  align-items: flex-end;
}
.closed-grid-label {
  font-size: 17rpx;
  color: #475569;
  line-height: 1.3;
}
.closed-grid-val {
  font-size: 25rpx;
  font-weight: 600;
  color: #e2e8f0;
  font-variant-numeric: tabular-nums;
}
.closed-grid-val.neutral { color: #cbd5e1; }

/* 时间区 */
.closed-time-section {
  padding: 10rpx 18rpx 16rpx;
  border-top: 1rpx solid rgba(255,255,255,0.05);
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.closed-time-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.closed-time-label {
  font-size: 19rpx;
  color: #475569;
}
.closed-time-val {
  font-size: 19rpx;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}
</style>
