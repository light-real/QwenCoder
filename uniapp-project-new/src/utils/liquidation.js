/**
 * 强平（爆仓）检测与执行 — 公共逻辑
 *
 * 规则：当某个持仓的浮动亏损达到 保证金 × (1 - 维持保证金率) 时，
 * 视为保证金即将亏光，触发强制平仓（返还 0 USDT）。
 *
 * 使用方（首页 / 交易页）需在拿到最新行情价格后，调用 checkAndLiquidate()
 * 传入 userData 和 markPrice 的获取方式，若发生强平会返回更新后的 userData
 * 及被强平的仓位列表，调用方可据此弹窗提示用户。
 */

import { getCurrentDateTime } from './date.js';

export const TAKER_FEE_RATE = 0.001;
export const MAINT_MARGIN_RATE = 0.005;

/**
 * 计算某个持仓的浮动盈亏
 */
export function calcPnl(position, markPrice) {
  const avgPrice = position.quantity > 0 ? position.cost / position.quantity : 0;
  return position.tradeType === 'buy'
    ? (markPrice - avgPrice) * position.quantity
    : (avgPrice - markPrice) * position.quantity;
}

/**
 * 判断某个持仓是否触发强平
 */
export function isLiquidated(position, markPrice) {
  const margin = position.margin || 0;
  if (margin <= 0) return false;
  const pnl = calcPnl(position, markPrice);
  return pnl <= -margin * (1 - MAINT_MARGIN_RATE);
}

/**
 * 遍历 userData.stocks，用 getMarkPrice(position) => number 获取每个仓位的最新价，
 * 找出所有触发强平的仓位，执行强制平仓（保证金亏光，不返还资金），
 * 写入爆仓历史记录，更新 cash/totalAssets/profit。
 *
 * 返回 { userData, liquidatedList }
 *   liquidatedList: [{ symbol, code, liqPrice }]，为空表示没有发生强平
 *
 * 注意：调用方需要自行调用 app.updateUserData(userData) 持久化。
 */
export function checkAndLiquidate(userData, getMarkPrice) {
  if (!userData || !Array.isArray(userData.stocks) || userData.stocks.length === 0) {
    return { userData, liquidatedList: [] };
  }

  const toLiquidate = [];
  userData.stocks.forEach((s) => {
    const markPrice = getMarkPrice(s);
    if (!markPrice) return;
    if (isLiquidated(s, markPrice)) {
      toLiquidate.push({ pos: s, liqPrice: markPrice });
    }
  });

  if (toLiquidate.length === 0) {
    return { userData, liquidatedList: [] };
  }

  const now = getCurrentDateTime();
  const liquidatedList = [];

  toLiquidate.forEach(({ pos, liqPrice }) => {
    const idx = userData.stocks.findIndex((s) => s === pos);
    if (idx === -1) return;

    const fee = pos.quantity * liqPrice * TAKER_FEE_RATE;

    userData.stocks.splice(idx, 1);

    userData.history.unshift({
      type: pos.tradeType === 'buy' ? 'close_buy' : 'close_sell',
      code: pos.code,
      name: pos.name,
      symbol: pos.symbol,
      quantity: pos.quantity,
      price: liqPrice,
      avgPrice: pos.quantity > 0 ? pos.cost / pos.quantity : 0,
      pnl: -(pos.margin || 0),
      closeFee: fee,
      returnAmount: 0,
      leverage: pos.leverage,
      isPartial: false,
      isLiquidation: true,
      openTime: pos.buyTime || '--',
      time: now,
    });

    liquidatedList.push({ symbol: pos.symbol, code: pos.code, liqPrice });
  });

  const totalMargin = userData.stocks.reduce((sum, s) => sum + (s.margin || 0), 0);
  userData.totalAssets = userData.cash + totalMargin;
  userData.profit = userData.totalAssets - 10000;

  return { userData, liquidatedList };
}
