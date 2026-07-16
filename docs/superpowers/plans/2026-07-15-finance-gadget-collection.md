# 金融小工具集（zz-Gadget）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个移动端网页金融小工具集，含「免息价值折现器」与「CAGR 计算器」两个工具，并搭好可扩展骨架。

**Architecture:** 计算逻辑放在纯函数模块 `calc.js`（UMD 双导出：浏览器 `window.Calc` + Node `require`），由 `index.html` 通过 `<script>` 引入并渲染界面；哈希路由 + `TOOLS` 注册表驱动首页菜单与页面切换。纯函数用 Node 内置测试跑器自动化测试，UI 用浏览器手动验证。

**Tech Stack:** 纯 HTML/CSS/JS（无框架、无 npm 依赖、无构建）；测试用 `node --test`（Node v18+ 内置，本机 v24 已确认）。

## Global Constraints

以下为全项目约束，每个任务都隐含遵守：

- 无外部依赖、不联网、无构建步骤；本地 `file://` 打开 `index.html` 即可运行、离线可用。
- 移动端优先，扁平简洁风格：单列布局、留白充足、单一强调色、系统字体，不用重阴影/渐变/拟物。
- 免息折现器：月折现率 `i = 年化率 r / 12`；普通年金（期末支付，首期在第 1 个月末）。
- 交互：输入变化即时计算，无需点按钮。
- 金额显示：千分位分隔、保留 2 位小数；比例/增长率显示为百分比、保留 2 位小数。
- 结构约定：新增工具 = 在 `calc.js` 加纯函数 + 在 `index.html` 加一个 `renderXxx` + 在 `TOOLS` 注册；不改动路由等其它代码。
- 版本控制为可选项：若用户未启用 git，跳过所有 `commit` 步骤（不影响功能）。

## File Structure

```
zz-Gadget/
├─ index.html            # UI：样式 + 哈希路由 + TOOLS 注册表 + 各 render 函数 + 自测页
├─ calc.js               # 纯函数：pvAnnuity / discountSaving / validateDiscount / cagr / validateCagr / fmtMoney / fmtPct
├─ test/
│  └─ calc.test.js       # node --test 断言纯函数
└─ README.md             # 使用说明 + 新增工具模板
```

- `calc.js` 只做计算与格式化，不碰 DOM；是唯一被自动化测试的单元。
- `index.html` 只做界面与路由；计算一律调 `Calc.*`，不内联数学公式。

---

### Task 1: calc.js — 折现器纯函数与校验

**Files:**
- Create: `calc.js`
- Create: `test/calc.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `pvAnnuity(M, n, i) -> number`：普通年金现值；`i === 0` 时返回 `M * n`。
  - `discountSaving(M, n, rAnnual) -> { monthlyRate, pv, total, saving, savingRate }`：`monthlyRate = rAnnual/12`，`total = M*n`，`saving = total - pv`，`savingRate = saving/total`。
  - `validateDiscount(M, n, rAnnual) -> string | null`：不合法返回中文错误串，合法返回 `null`。规则：`M > 0`、`n > 0` 且为整数、`rAnnual >= 0`，任一为 `NaN` 视为不合法。
  - 模块以 UMD 形式双导出：浏览器 `window.Calc`，Node `module.exports`。

- [ ] **Step 1: 写失败测试**

创建 `test/calc.test.js`：

```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/calc.test.js`
Expected: FAIL，报错类似 `Cannot find module '../calc.js'`。

- [ ] **Step 3: 写最小实现**

创建 `calc.js`（本任务先放折现相关函数 + UMD 外壳；`return` 里预留后续函数名以免任务乱序时漏加——本任务只需实现折现三个函数）：

```js
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

  return { pvAnnuity, discountSaving, validateDiscount };
});
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test test/calc.test.js`
Expected: PASS，4 个测试全绿。

- [ ] **Step 5: 提交（如启用 git）**

```bash
git add calc.js test/calc.test.js
git commit -m "feat: add discount annuity pure functions with tests"
```

---

### Task 2: calc.js — CAGR 纯函数与校验

**Files:**
- Modify: `calc.js`（新增函数并加入导出对象）
- Modify: `test/calc.test.js`（追加测试）

**Interfaces:**
- Consumes: Task 1 的 UMD 外壳与导出对象。
- Produces:
  - `cagr(V0, V1, N) -> { cagr, multiple, totalReturn }`：`multiple = V1/V0`，`cagr = multiple^(1/N) - 1`，`totalReturn = multiple - 1`。
  - `validateCagr(V0, V1, N) -> string | null`：规则 `V0 > 0`、`N > 0`、`V1 >= 0`，NaN 视为不合法。

- [ ] **Step 1: 写失败测试**

在 `test/calc.test.js` 末尾追加：

```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/calc.test.js`
Expected: FAIL，新增测试报 `Calc.cagr is not a function`。

- [ ] **Step 3: 写最小实现**

在 `calc.js` 的 `validateDiscount` 之后、`return` 之前插入：

```js
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
```

并把 `return` 语句改为：

```js
  return { pvAnnuity, discountSaving, validateDiscount, cagr, validateCagr };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test test/calc.test.js`
Expected: PASS，全部测试通过。

- [ ] **Step 5: 提交（如启用 git）**

```bash
git add calc.js test/calc.test.js
git commit -m "feat: add cagr pure functions with tests"
```

---

### Task 3: calc.js — 格式化函数

**Files:**
- Modify: `calc.js`
- Modify: `test/calc.test.js`

**Interfaces:**
- Consumes: Task 2 后的 `calc.js`。
- Produces:
  - `fmtMoney(x) -> string`：千分位、保留 2 位小数、无货币符号，如 `11807.2538 -> "11,807.25"`、`-192.75 -> "-192.75"`。
  - `fmtPct(x) -> string`：入参为小数比率，`×100` 后保留 2 位小数并加 `%`，如 `0.016062 -> "1.61%"`、`1 -> "100.00%"`。

- [ ] **Step 1: 写失败测试**

在 `test/calc.test.js` 末尾追加：

```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test test/calc.test.js`
Expected: FAIL，报 `Calc.fmtMoney is not a function`。

- [ ] **Step 3: 写最小实现**

在 `calc.js` 的 `validateCagr` 之后、`return` 之前插入：

```js
  function fmtMoney(x) {
    return x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtPct(x) {
    return (x * 100).toFixed(2) + '%';
  }
```

并把 `return` 语句改为：

```js
  return { pvAnnuity, discountSaving, validateDiscount, cagr, validateCagr, fmtMoney, fmtPct };
```

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test test/calc.test.js`
Expected: PASS，全部 8 个测试通过。

- [ ] **Step 5: 提交（如启用 git）**

```bash
git add calc.js test/calc.test.js
git commit -m "feat: add money and percent formatters with tests"
```

---

### Task 4: index.html — 应用外壳（样式 + 路由 + 首页菜单）

**Files:**
- Create: `index.html`

**Interfaces:**
- Consumes: `calc.js`（通过 `<script src>`，本任务尚未调用其函数）。
- Produces:
  - `TOOLS` 数组：`[{ id, name, desc, render }]`，本任务注册两个工具，`render` 指向 `renderDiscount` / `renderCagr` 的**占位实现**。
  - 全局函数 `renderHome(app)`、`renderDiscount(app)`（占位）、`renderCagr(app)`（占位）、`router()`。
  - 样式类约定：`.card`、`.big`、`.sub`、`.err`、`.field`、`.back`，供后续任务复用。

- [ ] **Step 1: 写外壳（HTML + 扁平样式 + 路由 + 首页 + 占位工具页）**

创建 `index.html`：

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>金融小工具</title>
  <style>
    :root {
      --bg: #f5f6f8; --card: #ffffff; --text: #1c1d21; --muted: #6b6f76;
      --accent: #2f6df6; --border: #e6e8ec; --err: #d64545;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; background: var(--bg); color: var(--text);
      font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif;
      -webkit-text-size-adjust: 100%;
    }
    .wrap { max-width: 560px; margin: 0 auto; padding: 20px 16px 48px; }
    h1 { font-size: 20px; margin: 4px 0 16px; font-weight: 600; }
    .back { display: inline-block; color: var(--muted); text-decoration: none; font-size: 14px; margin-bottom: 8px; }
    .card {
      display: block; background: var(--card); border: 1px solid var(--border);
      border-radius: 12px; padding: 16px; margin-bottom: 12px; text-decoration: none; color: inherit;
    }
    .card .name { font-size: 16px; font-weight: 600; }
    .card .desc { font-size: 13px; color: var(--muted); margin-top: 4px; }
    .field { display: flex; flex-direction: column; margin-bottom: 14px; }
    .field label { font-size: 13px; color: var(--muted); margin-bottom: 6px; }
    .field input {
      font-size: 18px; padding: 12px; border: 1px solid var(--border);
      border-radius: 10px; background: #fff; color: var(--text); width: 100%;
    }
    .field input:focus { outline: none; border-color: var(--accent); }
    .result { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-top: 8px; }
    .big { font-size: 26px; font-weight: 700; }
    .sub { list-style: none; padding: 0; margin: 12px 0 0; }
    .sub li { font-size: 14px; color: var(--muted); padding: 4px 0; display: flex; justify-content: space-between; }
    .err { color: var(--err); font-size: 14px; margin: 0; }
  </style>
</head>
<body>
  <div class="wrap"><div id="app"></div></div>

  <script src="calc.js"></script>
  <script>
    'use strict';

    function renderDiscount(app) { app.innerHTML = '<a class="back" href="#/">← 返回</a><h1>免息价值折现器</h1><p class="err">施工中</p>'; }
    function renderCagr(app) { app.innerHTML = '<a class="back" href="#/">← 返回</a><h1>CAGR 计算器</h1><p class="err">施工中</p>'; }

    var TOOLS = [
      { id: 'discount', name: '免息价值折现器', desc: '算免息分期省下的时间价值', render: renderDiscount },
      { id: 'cagr', name: 'CAGR 计算器', desc: '按期初、期末与年数算年化增长率', render: renderCagr }
    ];

    function renderHome(app) {
      app.innerHTML = '<h1>金融小工具</h1>' + TOOLS.map(function (t) {
        return '<a class="card" href="#/' + t.id + '">' +
               '<div class="name">' + t.name + '</div>' +
               '<div class="desc">' + t.desc + '</div></a>';
      }).join('');
    }

    function router() {
      var app = document.getElementById('app');
      var id = location.hash.replace(/^#\/?/, '');
      if (!id) return renderHome(app);
      var tool = TOOLS.find(function (t) { return t.id === id; });
      if (tool) return tool.render(app);
      return renderHome(app);
    }

    window.addEventListener('hashchange', router);
    window.addEventListener('DOMContentLoaded', router);
  </script>
</body>
</html>
```

- [ ] **Step 2: 浏览器手动验证**

用浏览器打开 `index.html`（双击或拖入浏览器）。
Expected:
- 首页显示标题「金融小工具」和两张卡片（免息价值折现器 / CAGR 计算器）。
- 点第一张卡片 → 地址变 `#/discount`，页面显示「免息价值折现器」+「施工中」+「← 返回」。
- 点「← 返回」回到首页；点第二张卡片同理进入 CAGR 占位页。
- 手机上（或浏览器移动模拟）为单列、留白舒适的扁平样式。

- [ ] **Step 3: 提交（如启用 git）**

```bash
git add index.html
git commit -m "feat: add app shell with flat styling, hash router and home menu"
```

---

### Task 5: index.html — 免息折现器页面

**Files:**
- Modify: `index.html`（替换 `renderDiscount` 占位实现）

**Interfaces:**
- Consumes: `Calc.validateDiscount`、`Calc.discountSaving`、`Calc.fmtMoney`、`Calc.fmtPct`；样式类 `.field/.result/.big/.sub/.err/.back`。
- Produces: 可用的免息折现器页面（即时计算）。

- [ ] **Step 1: 替换 renderDiscount**

把 Task 4 中的占位 `renderDiscount` 整行替换为：

```js
    function renderDiscount(app) {
      app.innerHTML =
        '<a class="back" href="#/">← 返回</a>' +
        '<h1>免息价值折现器</h1>' +
        '<div class="field"><label>月供（元）</label><input id="d-M" inputmode="decimal" placeholder="如 1000"></div>' +
        '<div class="field"><label>期数（月）</label><input id="d-n" inputmode="numeric" placeholder="如 12"></div>' +
        '<div class="field"><label>年化折现率（%）</label><input id="d-r" inputmode="decimal" value="3"></div>' +
        '<div class="result" id="d-out"></div>';

      var M = document.getElementById('d-M');
      var n = document.getElementById('d-n');
      var r = document.getElementById('d-r');
      var out = document.getElementById('d-out');

      function update() {
        var mv = parseFloat(M.value), nv = parseFloat(n.value), rv = parseFloat(r.value) / 100;
        var err = Calc.validateDiscount(mv, nv, rv);
        if (err) { out.innerHTML = '<p class="err">' + err + '</p>'; return; }
        var res = Calc.discountSaving(mv, nv, rv);
        out.innerHTML =
          '<div class="big">省下 ¥' + Calc.fmtMoney(res.saving) + '</div>' +
          '<ul class="sub">' +
          '<li><span>现值 PV</span><span>¥' + Calc.fmtMoney(res.pv) + '</span></li>' +
          '<li><span>直接支出总价</span><span>¥' + Calc.fmtMoney(res.total) + '</span></li>' +
          '<li><span>节省比例</span><span>' + Calc.fmtPct(res.savingRate) + '</span></li>' +
          '<li><span>所用月率</span><span>' + Calc.fmtPct(res.monthlyRate) + '</span></li>' +
          '</ul>';
      }

      [M, n, r].forEach(function (e) { e.addEventListener('input', update); });
      update();
    }
```

- [ ] **Step 2: 浏览器手动验证**

刷新浏览器，进入 `#/discount`。
Expected:
- 折现率默认填 `3`。月供空时结果区提示「请输入大于 0 的月供金额」。
- 输入 月供 `1000`、期数 `12`、折现率 `3` → 大字显示「省下 ¥192.75」；辅助行：现值 ¥11,807.25、直接支出总价 ¥12,000.00、节省比例 1.61%、所用月率 0.25%。
- 折现率改成 `0` → 显示「省下 ¥0.00」。
- 期数输入 `12.5` → 提示「期数请输入整数（月）」。

- [ ] **Step 3: 提交（如启用 git）**

```bash
git add index.html
git commit -m "feat: implement discount calculator view"
```

---

### Task 6: index.html — CAGR 计算器页面

**Files:**
- Modify: `index.html`（替换 `renderCagr` 占位实现）

**Interfaces:**
- Consumes: `Calc.validateCagr`、`Calc.cagr`、`Calc.fmtMoney`、`Calc.fmtPct`；同套样式类。
- Produces: 可用的 CAGR 计算器页面（即时计算）。

- [ ] **Step 1: 替换 renderCagr**

把 Task 4 中的占位 `renderCagr` 整行替换为：

```js
    function renderCagr(app) {
      app.innerHTML =
        '<a class="back" href="#/">← 返回</a>' +
        '<h1>CAGR 计算器</h1>' +
        '<div class="field"><label>期初金额</label><input id="c-v0" inputmode="decimal" placeholder="如 100"></div>' +
        '<div class="field"><label>期末金额</label><input id="c-v1" inputmode="decimal" placeholder="如 200"></div>' +
        '<div class="field"><label>年数</label><input id="c-n" inputmode="decimal" placeholder="如 5"></div>' +
        '<div class="result" id="c-out"></div>';

      var v0 = document.getElementById('c-v0');
      var v1 = document.getElementById('c-v1');
      var n = document.getElementById('c-n');
      var out = document.getElementById('c-out');

      function update() {
        var a = parseFloat(v0.value), b = parseFloat(v1.value), N = parseFloat(n.value);
        var err = Calc.validateCagr(a, b, N);
        if (err) { out.innerHTML = '<p class="err">' + err + '</p>'; return; }
        var res = Calc.cagr(a, b, N);
        out.innerHTML =
          '<div class="big">CAGR ' + Calc.fmtPct(res.cagr) + '</div>' +
          '<ul class="sub">' +
          '<li><span>总增长倍数</span><span>' + Calc.fmtMoney(res.multiple) + '×</span></li>' +
          '<li><span>总涨幅</span><span>' + Calc.fmtPct(res.totalReturn) + '</span></li>' +
          '<li><span>年数</span><span>' + N + '</span></li>' +
          '</ul>';
      }

      [v0, v1, n].forEach(function (e) { e.addEventListener('input', update); });
      update();
    }
```

- [ ] **Step 2: 浏览器手动验证**

刷新浏览器，进入 `#/cagr`。
Expected:
- 空输入时提示「请输入大于 0 的期初金额」。
- 期初 `100`、期末 `200`、年数 `1` → 大字「CAGR 100.00%」；总增长倍数 2.00×、总涨幅 100.00%、年数 1。
- 期初 `100`、期末 `121`、年数 `2` → 「CAGR 10.00%」；总增长倍数 1.21×、总涨幅 21.00%。
- 期末填 `-5` → 提示「期末金额不能为负」。

- [ ] **Step 3: 提交（如启用 git）**

```bash
git add index.html
git commit -m "feat: implement cagr calculator view"
```

---

### Task 7: 页内自测页 + README

**Files:**
- Modify: `index.html`（新增 `renderSelfTest` 与路由分支）
- Create: `README.md`

**Interfaces:**
- Consumes: `Calc.*`。
- Produces: `#/selftest` 页展示几组已知算例的 ✓/✗；README 说明使用与新增工具模板。

- [ ] **Step 1: 加自测页**

在 `index.html` 的 `router` 函数中，`if (!id) return renderHome(app);` 之后加一行分支：

```js
      if (id === 'selftest') return renderSelfTest(app);
```

并在 `router` 定义之前新增函数：

```js
    function renderSelfTest(app) {
      var cases = [
        ['折现 PV(1000,12,3%)', Math.abs(Calc.discountSaving(1000, 12, 0.03).saving - 192.74615870109665) < 1e-6],
        ['折现 零利率省 0', Calc.discountSaving(1000, 12, 0).saving === 0],
        ['CAGR(100,200,1)=100%', Math.abs(Calc.cagr(100, 200, 1).cagr - 1) < 1e-9],
        ['CAGR(100,121,2)=10%', Math.abs(Calc.cagr(100, 121, 2).cagr - 0.1) < 1e-9],
        ['fmtMoney', Calc.fmtMoney(12000) === '12,000.00'],
        ['fmtPct', Calc.fmtPct(1) === '100.00%']
      ];
      app.innerHTML = '<a class="back" href="#/">← 返回</a><h1>自测</h1><ul class="sub">' +
        cases.map(function (c) {
          return '<li><span>' + c[0] + '</span><span>' + (c[1] ? '✓' : '✗') + '</span></li>';
        }).join('') + '</ul>';
    }
```

- [ ] **Step 2: 浏览器手动验证**

访问 `index.html#/selftest`。
Expected: 6 行算例全部显示 ✓。

- [ ] **Step 3: 写 README**

创建 `README.md`：

````markdown
# 金融小工具集（zz-Gadget）

移动端网页小工具集，手机浏览器打开 `index.html` 即用，可「添加到主屏幕」。零依赖、离线可用。

## 工具
- **免息价值折现器**：输入月供、期数、年化折现率（默认 3%），算出免息分期相对当期直接支出（月供×期数）省下的时间价值。月率 = 年化率 / 12，普通年金（期末支付）。
- **CAGR 计算器**：输入期初、期末金额与年数，算年化增长率，附总增长倍数与总涨幅。

## 使用
双击 `index.html` 用浏览器打开即可；`index.html` 与 `calc.js` 需放在同一文件夹。
手机上用浏览器打开后可「添加到主屏幕」当 App 用。

## 测试
```bash
node --test        # 运行 calc.js 纯函数测试
```
浏览器内访问 `#/selftest` 可看页内自测。

## 新增一个工具（三步）
1. 在 `calc.js` 写纯计算函数（不碰 DOM），加进导出对象。
2. 在 `index.html` 写 `renderXxx(app)` 函数：渲染表单 + 绑定 `input` 事件即时计算 + 输出结果。
3. 在 `TOOLS` 数组注册 `{ id, name, desc, render: renderXxx }`。

首页卡片与路由会自动接入，无需改动其它代码。
````

- [ ] **Step 4: 提交（如启用 git）**

```bash
git add index.html README.md
git commit -m "feat: add in-page selftest view and README"
```

---

## Self-Review

**1. Spec coverage**
- 单文件自包含/离线/零构建 → File Structure + Task 4（改为 index.html + calc.js 两文件，已在 Architecture 注明，仍满足离线/零构建/零依赖）。
- 哈希路由 + TOOLS 注册表 → Task 4。
- 折现器公式/口径/输出/边界 → Task 1（计算）+ Task 5（界面/边界提示）。
- CAGR 公式/输出/边界 → Task 2 + Task 6。
- 扁平简洁移动端界面 + 即时计算 + 金额/百分比格式 → Task 4（样式）+ Task 3（格式化）+ Task 5/6。
- 测试算例 → Task 1/2/3（node）+ Task 7（页内自测）。
- 扩展模板 → Task 7（README）。
- 折现率可改（默认 3%）→ Task 5（input value="3"）。

**2. Placeholder scan**：无 TBD/TODO；每个代码步骤均给出完整代码；边界处理给出具体错误文案；UI 任务给出具体手动验证期望值。

**3. Type consistency**：`Calc.pvAnnuity/discountSaving/validateDiscount/cagr/validateCagr/fmtMoney/fmtPct` 全程一致；`discountSaving` 返回 `{monthlyRate,pv,total,saving,savingRate}` 与 Task 5 引用一致；`cagr` 返回 `{cagr,multiple,totalReturn}` 与 Task 6 引用一致；`fmtPct` 入参为小数比率，各处传入的 `savingRate/monthlyRate/cagr/totalReturn` 均为小数，一致。

**已知设计偏差（需告知用户）**：spec 写「单个自包含 index.html」，实现改为 `index.html` + 同目录 `calc.js`（+ `test/`），以便纯函数被 Node 自动化测试；离线、零构建、零依赖、可加主屏等特性不变。
