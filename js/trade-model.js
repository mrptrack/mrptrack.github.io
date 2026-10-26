// Shared closed-trade arithmetic. The caller supplies the EUR conversion.
export function calculateTrade(t, fx = 1) {
  const grossPL = t.totalShares * (t.sellPrice - t.avgBuy) * fx;
  const divN = (t.dividends || 0) * fx;
  const inv = t.totalShares * t.avgBuy * fx;
  const net = grossPL + divN;
  return {
    grossPL, divN, inv, net,
    pct: inv > 0 ? (net / inv) * 100 : 0,
    ret: inv + net, fx,
    cur: t.currency,
    rawBuy: t.avgBuy,
    rawSell: t.sellPrice,
    rawInv: t.totalShares * t.avgBuy,
    rawGross: t.totalShares * (t.sellPrice - t.avgBuy)
  };
}
