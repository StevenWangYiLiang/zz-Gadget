(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    root.Calc = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function pvAnnuity(M, n, i) {
    return i === 0 ? M * n : M * (1 - Math.pow(1 + i, -n)) / i;
  }

  function discountSaving(M, n, rAnnual) {
    const monthlyRate = rAnnual / 12;
    const pv = pvAnnuity(M, n, monthlyRate);
    const total = M * n;
    const saving = total - pv;
    const savingRate = total === 0 ? 0 : saving / total;
    return { monthlyRate, pv, total, saving, savingRate };
  }

  function validateDiscount(M, n, rAnnual) {
    if (!(M > 0)) return '请输入大于 0 的月供金额';
    if (!(n > 0)) return '请输入大于 0 的期数';
    if (!Number.isInteger(n)) return '期数请输入整数（月）';
    if (!(rAnnual >= 0)) return '折现率不能为负';
    return null;
  }

  function cagr(V0, V1, N) {
    const multiple = V1 / V0;
    return { cagr: Math.pow(multiple, 1 / N) - 1, multiple, totalReturn: multiple - 1 };
  }

  function validateCagr(V0, V1, N) {
    if (!(V0 > 0)) return '请输入大于 0 的期初金额';
    if (!(N > 0)) return '请输入大于 0 的年数';
    if (!(V1 >= 0)) return '期末金额不能为负';
    return null;
  }

  function fmtMoney(x) {
    return x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtPct(x) {
    return (x * 100).toFixed(2) + '%';
  }

  return { pvAnnuity, discountSaving, validateDiscount, cagr, validateCagr, fmtMoney, fmtPct };
});
