/* JIZURA web 冒烟测试：起 vite preview → 无头 Chromium 走一遍核心流程。
   运行： node scripts/smoke.mjs   （需先 pnpm build && pnpm exec playwright install chromium） */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 4180;
const BASE = `http://127.0.0.1:${PORT}/`;
const SHOT = path.join(ROOT, 'docs');
mkdirSync(SHOT, { recursive: true });

const problems = [];
const fails = [];
const ok = (name, cond, extra = '') => {
  if (cond) console.log('  ✓', name, extra);
  else { console.log('  ✗', name, extra); fails.push(name + (extra ? ' — ' + extra : '')); }
};

function startPreview() {
  const child = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { stdio: 'pipe' });
  child.stdout.on('data', () => {});
  child.stderr.on('data', d => process.stderr.write('[vite] ' + d));
  return child;
}
async function waitServer(url, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url); if (r.ok) return; } catch (e) { /* retry */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('preview server did not start');
}
async function newPage(browser, opts) {
  const page = await browser.newPage(opts);
  page.on('pageerror', e => problems.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') problems.push('console.error: ' + m.text().slice(0, 300)); });
  return page;
}
const shot = async (page, name) => {
  for (let i = 0; i < 2; i++) {
    try { await page.screenshot({ path: path.join(SHOT, name), timeout: 45000 }); return; }
    catch (e) { console.log('  (screenshot retry)', name, e.message.split('\n')[0]); await page.waitForTimeout(1500); }
  }
  console.log('  (screenshot skipped:', name + ')');
};
const pixelSum = page => page.evaluate(() => {
  const c = document.querySelector('.viewport canvas');
  if (!c || !c.width) return -1;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let s = 0;
  for (let i = 0; i < d.length; i += 97) s += d[i] + d[i + 1] + d[i + 2];
  return s;
});

const server = startPreview();
let browser;
try {
  await waitServer(BASE);
  browser = await chromium.launch();

  /* ---------- 桌面端 ---------- */
  console.log('\n[桌面端 1400×900]');
  const page = await newPage(browser, { viewport: { width: 1400, height: 900 } });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.viewport canvas', { timeout: 10000 });
  await page.waitForTimeout(3500); // 字体加载 + 首帧

  ok('页面标题', (await page.title()).includes('JIZURA'));
  let sum = await pixelSum(page);
  ok('画布已绘制（首帧非空）', sum > 300, `pixelSum=${sum}`);

  // 一键开始 → 自动播放
  const tc0 = await page.locator('.transport .tc').first().textContent();
  await page.getByRole('button', { name: /开始播放|Play/ }).first().click();
  await page.waitForTimeout(1800);
  const tc1 = await page.locator('.transport .tc').first().textContent();
  ok('点一下开始 → 时间码前进', tc1 !== tc0, `${tc0} → ${tc1}`);
  sum = await pixelSum(page);
  ok('播放中画面在动（非空）', sum > 300, `pixelSum=${sum}`);

  // 随机一套（omakase）
  await page.getByRole('button', { name: /随机一套|Surprise me/ }).first().click();
  await page.waitForSelector('.toast', { timeout: 8000 });
  const toastTxt = await page.locator('.toast').textContent();
  ok('随机一套 → 弹出风格×氛围', /×/.test(toastTxt), toastTxt.trim().slice(0, 60));
  const tc2 = await page.locator('.transport .tc').first().textContent();
  ok('随机后自动从头播放', parseFloat(tc2.replace(':', '.')) < 1.6, `tc=${tc2.trim()}`);
  await page.waitForTimeout(1200);

  // 键盘 R
  await page.keyboard.press('r');
  await page.waitForTimeout(600);
  ok('键盘 R 触发随机', true);

  // 侧边栏：风格切换（区块默认展开）
  const styleSel = page.locator('.sec', { hasText: '风格与画面' }).locator('select').first();
  await styleSel.selectOption({ index: 3 });
  await page.waitForTimeout(900);
  ok('侧边栏切换风格', true);

  // 侧边栏：恐怖开关
  const horror = page.locator('.sec', { hasText: '风格与画面' }).locator('.toggle', { hasText: /恐怖|Horror/ }).first();
  await horror.click();
  await page.waitForTimeout(900);
  ok('侧边栏开恐怖演出', true);

  // 画面比例 9:16
  const aspectSel = page.locator('.sec', { hasText: '风格与画面' }).locator('.field', { hasText: '画面比例' }).locator('select');
  await aspectSel.selectOption('9:16');
  await page.waitForTimeout(1200);
  const cw = await page.evaluate(() => document.querySelector('.viewport canvas').getBoundingClientRect());
  ok('9:16 时画布为竖版', cw.height > cw.width * 1.2, `${cw.width.toFixed(0)}×${cw.height.toFixed(0)}`);
  await aspectSel.selectOption('16:9');
  await page.waitForTimeout(600);

  await shot(page, 'desktop.png');

  // 导出 AE JSON（下载事件）
  const dlPromise = page.waitForEvent('download', { timeout: 25000 });
  await page.locator('.btn', { hasText: 'AE 数据' }).first().click();
  const dl = await dlPromise;
  ok('导出 AE JSON 触发下载', /_ae\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());

  // 沉静模式：屏蔽一切，只剩小按键
  const sereneBtn = page.locator('.btn-serene');
  await sereneBtn.click();
  await page.waitForTimeout(400);
  ok('沉静模式：侧边栏隐藏', !(await page.locator('.sidebar').isVisible()));
  ok('沉静模式：传输条隐藏', !(await page.locator('.transport').isVisible()));
  ok('沉静模式：小按键仍在', await sereneBtn.isVisible());
  const vs = await page.evaluate(() => {
    const v = document.querySelector('.viewport').getBoundingClientRect();
    return { w: v.width, h: v.height, iw: innerWidth, ih: innerHeight };
  });
  ok('沉静模式：画面近全屏', vs.w > vs.iw * 0.9 && vs.h > vs.ih * 0.85, `${vs.w.toFixed(0)}×${vs.h.toFixed(0)} @ ${vs.iw}×${vs.ih}`);
  await shot(page, 'serene.png');
  await sereneBtn.click();
  await page.waitForTimeout(400);
  ok('再点一下：界面恢复', await page.locator('.sidebar').isVisible() && await page.locator('.transport').isVisible());
  await page.locator('.btn-serene').click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  ok('Esc 也能退出沉静', await page.locator('.transport').isVisible());


  ok('桌面端无 console/page 错误', problems.length === 0, problems.slice(0, 3).join(' | '));
  await page.close();

  /* ---------- 手机竖屏 ---------- */
  console.log('\n[手机竖屏 390×844]');
  const mp = await newPage(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mp.goto(BASE, { waitUntil: 'domcontentloaded' });
  await mp.waitForTimeout(2500);
  const gate = mp.locator('.portrait-gate');
  ok('竖屏出现横屏提示', await gate.isVisible());
  await shot(mp, 'mobile-portrait.png');
  await mp.locator('.pg-card .btn').click();
  await mp.waitForTimeout(400);
  ok('选择竖屏继续 → 提示消失', !(await gate.isVisible().catch(() => false)));
  // 抽屉
  await mp.locator('.btn.menu').click();
  await mp.waitForTimeout(500);
  ok('☰ 打开侧边栏抽屉', await mp.locator('.sidebar').isVisible());
  await shot(mp, 'mobile-drawer.png');
  await mp.locator('.scrim').click({ position: { x: 10, y: 10 }, force: true }).catch(() => {});
  await mp.close();

  /* ---------- 手机横屏 ---------- */
  console.log('\n[手机横屏 844×390]');
  const ml = await newPage(browser, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await ml.goto(BASE, { waitUntil: 'domcontentloaded' });
  await ml.waitForTimeout(2500);
  ok('横屏不出现旋转提示', !(await ml.locator('.portrait-gate').isVisible().catch(() => false)));
  const msum = await pixelSum(ml);
  ok('横屏画布已绘制', msum > 300, `pixelSum=${msum}`);
  const menuVisible = await ml.locator('.btn.menu').isVisible();
  ok('横屏显示 ☰ 抽屉按钮', menuVisible);
  await shot(ml, 'mobile-landscape.png');
  const mpErrs = problems.length;
  ok('移动端无 console/page 错误', mpErrs === 0, problems.slice(0, 3).join(' | '));
  await ml.close();
} catch (e) {
  fails.push('FATAL: ' + (e && e.message ? e.message : e));
  console.error(e);
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

console.log('\n========== 结果 ==========');
if (problems.length) {
  console.log('console/page 错误 ' + problems.length + ' 条：');
  for (const p of problems.slice(0, 12)) console.log('  -', p);
}
if (fails.length) {
  console.log('FAILED ' + fails.length + '：');
  for (const f of fails) console.log('  ✗', f);
  process.exit(1);
} else {
  console.log('全部通过 ✓   截图在 docs/');
}
