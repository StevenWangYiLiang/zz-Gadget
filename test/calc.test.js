const test = require('node:test');
const assert = require('node:assert');
const Calc = require('../calc.js');

const approx = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~= ${b}`);

test('pvAnnuity 普通年金现值', () => {
  approx(Calc.pvAnnuity(1000, 12, 0.0025), 11807.253841298903);
});

test('pvAnnuity 零利率退化为本金和', () => {
  assert.strictEqual(Calc.pvAnnuity(1000, 12, 0), 12000);
});

test('discountSaving 组合输出', () => {
  const r = Calc.discountSaving(1000, 12, 0.03);
  approx(r.monthlyRate, 0.0025);
  approx(r.pv, 11807.253841298903);
  assert.strictEqual(r.total, 12000);
  approx(r.saving, 192.74615870109665);
  approx(r.savingRate, 0.016062179891758056);
});

test('validateDiscount 规则', () => {
  assert.strictEqual(Calc.validateDiscount(1000, 12, 0.03), null);
  assert.ok(Calc.validateDiscount(0, 12, 0.03));      // 月供须 > 0
  assert.ok(Calc.validateDiscount(1000, 0, 0.03));    // 期数须 > 0
  assert.ok(Calc.validateDiscount(1000, 12.5, 0.03)); // 期数须为整数
  assert.ok(Calc.validateDiscount(1000, 12, -0.01));  // 折现率须 >= 0
  assert.ok(Calc.validateDiscount(NaN, 12, 0.03));    // NaN 不合法
});

test('cagr 翻倍一年 = 100%', () => {
  const r = Calc.cagr(100, 200, 1);
  approx(r.cagr, 1);
  approx(r.multiple, 2);
  approx(r.totalReturn, 1);
});

test('cagr 五年不变 = 0%', () => {
  approx(Calc.cagr(100, 100, 5).cagr, 0);
});

test('cagr 两年 21% = 10% 年化', () => {
  const r = Calc.cagr(100, 121, 2);
  approx(r.cagr, 0.1, 1e-9);
  approx(r.multiple, 1.21);
  approx(r.totalReturn, 0.21);
});

test('validateCagr 规则', () => {
  assert.strictEqual(Calc.validateCagr(100, 200, 1), null);
  assert.ok(Calc.validateCagr(0, 200, 1));    // 期初须 > 0
  assert.ok(Calc.validateCagr(100, 200, 0));  // 年数须 > 0
  assert.ok(Calc.validateCagr(100, -5, 1));   // 期末不可为负
  assert.ok(Calc.validateCagr(NaN, 200, 1));  // NaN 不合法
});

test('fmtMoney 千分位两位小数', () => {
  assert.strictEqual(Calc.fmtMoney(11807.2538), '11,807.25');
  assert.strictEqual(Calc.fmtMoney(12000), '12,000.00');
  assert.strictEqual(Calc.fmtMoney(-192.75), '-192.75');
});

test('fmtPct 百分比两位小数', () => {
  assert.strictEqual(Calc.fmtPct(0.016062179891758056), '1.61%');
  assert.strictEqual(Calc.fmtPct(1), '100.00%');
  assert.strictEqual(Calc.fmtPct(0), '0.00%');
});
