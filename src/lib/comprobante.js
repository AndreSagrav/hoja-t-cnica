// Totals calculation used by editor/comprobante
import { fmtMoney } from './utils.js';

export function calcTotals(state) {
  const currency = state?.currency?.code || 'CRC';
  const grossNum = (state.lines || []).reduce((acc,l) => acc + (Number(l.qty)||0) * (Number(l.price)||0), 0);
  const discountRate = state?.discount?.enabled ? (Number(state.discount.value)||0)/100 : 0;
  const base = grossNum * (1 - discountRate);
  const ivaRate = state?.iva?.enabled ? (Number(state.iva.value)||0)/100 : 0;
  const iva = base * ivaRate;
  const total = base + iva;
  return {
    gross: fmtMoney(grossNum, currency),
    discount: fmtMoney(grossNum - base, currency),
    iva: fmtMoney(iva, currency),
    total: fmtMoney(total, currency),
    grossNum, totalNum: total
  };
}
