/* ============================================================
   JIZURA web — 全局状态与动作（原 12_ui.js 的核心逻辑移植）
   S 是单一可变状态对象；React 通过 useStore() 订阅版本号。
   高频的时间码不走 React，直接由 tick 更新 DOM ref。
   ============================================================ */
import { J } from './engine.js';
import { applyUiLabels, t } from './i18n.js';
export { t };
import { fetchLrcText, fetchAudioFile } from './meting.js';

const LS_KEY = 'jizura.web.project.v1';
const LS_LANG = 'jizura.web.lang';
const LS_VOL = 'jizura.web.volume';
export const HUD_CHARS = '0123456789:./-_()【】・No.LYRICRECUNTITLEDXYlinebpminterlude—─／ ';

export const SAMPLE_LYRICS_ZH = `[间奏 5]
# 示例歌词，可随意修改（记法见「歌词」区）
夜色把灯牌/一盏盏熄灭
*未完的旋律*还在跳动!
巷口的猫/踩碎了月光
[间奏 4]
把名字写进/退潮的浪花里
如果时间/肯为我停留!
就在这首歌里/重新出发!`;

/* ---------------- 可订阅 store ---------------- */
import { useSyncExternalStore } from 'react';
const subs = new Set();
let version = 0;
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export function getVersion() { return version; }
export function emit() { version++; for (const fn of subs) fn(); }
export function useStore() {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return S;
}

export const S = {
  ready: false,
  project: null,
  plan: null,
  audio: null,
  audioName: '',
  playing: false,
  t: 0,
  loop: 'all',
  need: true,
  slow: false,
  exporting: null,          // {kind,label,progress,text,ac}
  msg: null,
  uiLang: 'zh-Hans',
  view: null,               // {canvas, ctx, container} — Stage 挂载时写入
  meting: { items: [], loading: false, error: '', track: '' },
  hist: { list: [], i: -1 },
  toast: null,
  scrubbing: false,
  serene: false,            // 沉静模式：屏蔽全部设置，只留画面
};

/* ---------------- WebAudio 预览播放 ---------------- */
export const AP = {
  ctx: null, src: null, startAt: 0, base: 0, rate: 1, gain: null, vol: 0.8, muted: false,
  play(buffer, offset, rate = 1) {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.stop();
    if (!this.gain) { this.gain = this.ctx.createGain(); this.gain.connect(this.ctx.destination); this.applyVol(); }
    const s = this.ctx.createBufferSource(); s.buffer = buffer; s.connect(this.gain);
    const off = Math.max(0, Math.min(offset, buffer.duration - 0.01));
    this.rate = rate > 0 ? rate : 1; s.playbackRate.value = this.rate;
    s.start(0, off); this.src = s; this.startAt = this.ctx.currentTime; this.base = off;
  },
  stop() { if (this.src) { try { this.src.stop(); } catch (e) {} try { this.src.disconnect(); } catch (e) {} this.src = null; } },
  time() { return this.ctx ? this.base + (this.ctx.currentTime - this.startAt) * this.rate : 0; },
  setVol(v, muted) { if (v != null) this.vol = Math.max(0, Math.min(1, v)); if (muted != null) this.muted = !!muted; this.applyVol(); },
  applyVol() {
    if (!this.gain) return;
    const v = this.muted ? 0 : this.vol * this.vol;
    try { this.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.015); } catch (e) { this.gain.gain.value = v; }
  },
};
export function initVolume() {
  try {
    const o = JSON.parse(localStorage.getItem(LS_VOL) || 'null');
    if (o) AP.setVol(+o.v || 0.8, !!o.m);
  } catch (e) { /* ignore */ }
}
export function rememberVolume() {
  try { localStorage.setItem(LS_VOL, JSON.stringify({ v: AP.vol, m: AP.muted })); } catch (e) { /* ignore */ }
}

/* ---------------- 工程合并 / 持久化 ---------------- */
export function defaultProject() {
  const p = J.defaultProject();
  p.lyrics = SAMPLE_LYRICS_ZH;
  p.quality = 'high';
  p.includeAudio = true;
  return p;
}
export function mergeProject(p) {
  const d = defaultProject();
  const o = Object.assign(d, p || {});
  o.fx = Object.assign(defaultProject().fx, (p && p.fx) || {});
  o.timing = Object.assign(defaultProject().timing, (p && p.timing) || {});
  const en = defaultProject().enabled;
  for (const g of Object.keys(en)) en[g] = Object.assign(en[g], ((p && p.enabled) || {})[g] || {});
  o.enabled = en;
  o.overrides = (p && p.overrides) || {};
  o.locks = { tech: {}, params: {} };
  for (const [g, on] of Object.entries((p && p.locks && p.locks.tech) || {})) if (on === true && /^[\w-]+$/.test(g)) o.locks.tech[g] = true;
  for (const [k, on] of Object.entries((p && p.locks && p.locks.params) || {})) if (on === true && /^[\w-]+$/.test(k)) o.locks.params[k] = true;
  delete o.appVersion;
  o.colors = { enabled: !!(p && p.colors && p.colors.enabled) };
  for (const [k, v] of Object.entries((p && p.colors) || {})) {
    if (k === 'enabled') continue;
    if (typeof v === 'boolean') o.colors[k] = v;
    else if (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v)) o.colors[k] = v;
  }
  o.themeId = p && typeof p.themeId === 'string' && J.THEMES[p.themeId] ? p.themeId : null;
  o.fonts = {};
  for (const [role, k] of Object.entries((p && p.fonts) || {})) if (typeof k === 'string' && J.FONTS[k] && /^[\w-]+$/.test(role)) o.fonts[role] = k;
  if (!o.quality) o.quality = 'high';
  if (o.includeAudio === undefined) o.includeAudio = true;
  return o;
}
function loadLocal() {
  try { const s = localStorage.getItem(LS_KEY); if (s) return mergeProject(JSON.parse(s)); } catch (e) { /* ignore */ }
  return mergeProject(null);
}
let saveTimer = 0;
export function flushSave() {
  clearTimeout(saveTimer);
  try { localStorage.setItem(LS_KEY, JSON.stringify(S.project)); } catch (e) { /* ignore */ }
}
export function autosave() { clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 700); }
window.addEventListener('pagehide', () => { if (S.project) flushSave(); });

/* ---------------- 计划 ---------------- */
export function audioLike() {
  const T = S.project.timing;
  if (S.audio) {
    const a = Object.assign({}, S.audio);
    if (T.bpm > 0) a.beats = J.beatGrid(T.bpm, T.beatOffset || 0, S.audio.duration);
    return a;
  }
  if (T.bpm > 0) return { beats: J.beatGrid(T.bpm, T.beatOffset || 0, 600) };
  return null;
}
let fontKey = '';
export async function ensureFonts() {
  const txt = S.project.lyrics + (S.project.title || '') + (S.project.artist || '') + HUD_CHARS;
  const keys = J.fontsOfPlan(S.plan);
  const key = txt + '|' + keys.join(',') + '|' + Object.keys(J.FONTS).length + '|' + J.lang;
  if (key === fontKey) return;
  fontKey = key;
  showMsg(t('fontsLoading'));
  try { await J.ensureFonts(txt, keys); } catch (e) { /* offline: fallback faces */ }
  showMsg(null); S.need = true;
}
let replanTimer = 0;
export function replan() {
  S.plan = J.plan(S.project, audioLike());
  for (const [i, o] of Object.entries(S.project.overrides || {})) {
    if (o && o.lock && !Array.isArray(o.lockedCuts)) { const snap = J.lineSnapshot(S.plan, +i); if (snap) o.lockedCuts = snap; }
  }
  if (S.t > S.plan.duration) S.t = 0;
  resizeView();
  S.need = true; autosave(); ensureFonts();
}
export function replanSoon(ms = 220) { clearTimeout(replanTimer); replanTimer = setTimeout(replan, ms); }

/* ---------------- project 变更 ---------------- */
export function setProject(patch, opts = {}) {
  Object.assign(S.project, patch);
  emit();
  if (opts.replan !== false) replanSoon(opts.delay ?? 220);
  autosave();
}
export function setFx(k, v) {
  S.project.fx[k] = v;
  emit(); replanSoon(); autosave();
}
export function setTiming(k, v) {
  S.project.timing[k] = v;
  emit(); replanSoon(); autosave();
}

/* ---------------- 播放 ---------------- */
export function loopRange(t) {
  const T = t != null ? t : S.t;
  const endAll = S.plan.duration;
  const cutAround = tt => J.cutAt(S.plan, tt);
  if (S.loop === 'cut') {
    const c = cutAround(T);
    return c ? { start: c.start, end: c.end } : { start: 0, end: endAll };
  }
  if (S.loop === 'line') {
    const c = cutAround(T);
    if (!c || c.line < 0) return c ? { start: c.start, end: c.end } : { start: 0, end: endAll };
    const same = S.plan.cuts.filter(x => x.line === c.line && x.layout !== 'interlude' && x.layout !== 'title');
    if (!same.length) return { start: c.start, end: c.end };
    return { start: same[0].start, end: same[same.length - 1].end };
  }
  return { start: 0, end: endAll };
}
let loopHold = null;
function refreshLoopHold() { loopHold = (S.loop === 'line' || S.loop === 'cut') ? loopRange(S.t) : null; }
function activeLoopRange() {
  if ((S.loop === 'line' || S.loop === 'cut') && loopHold) return loopHold;
  return loopRange(S.t);
}
export function play() {
  if (!S.plan) return;
  refreshLoopHold();
  if (S.audio) AP.play(S.audio.buffer, S.t);
  else { AP.ctxT0 = performance.now() - S.t * 1000; }
  S.playing = true; emit();
}
export function pause() {
  S.playing = false; AP.stop();
  S.need = true; emit();
}
export function toggle() { S.playing ? pause() : play(); }
export function seek(t) {
  S.t = J.clamp(t, 0, Math.max(0, S.plan.duration - 1e-3));
  if (S.audio) { if (S.playing) AP.play(S.audio.buffer, S.t); }
  else AP.ctxT0 = performance.now() - S.t * 1000;
  refreshLoopHold();
  S.need = true;
}

export function cycleLoop() {
  const order = ['all', 'line', 'cut', false];
  S.loop = order[(order.indexOf(S.loop) + 1) % order.length];
  refreshLoopHold(); S.need = true; emit();
}

/* ---------------- 绘制循环 ---------------- */
const tickSubs = new Set();
export function onTick(fn) { tickSubs.add(fn); return () => tickSubs.delete(fn); }
let rafId = 0;
function draw() {
  const v = S.view; if (!v || !S.plan) return;
  const t0 = performance.now();
  try { v.renderer.frame(v.ctx, S.plan, S.t, { scale: v.canvas.width / S.plan.W, fast: S.playing && S.slow }); } catch (e) { /* keep playing */ }
  const dt = performance.now() - t0;
  S.slow = S.playing ? (dt > 30 ? true : dt < 14 ? false : S.slow) : false;
}
function tick(now) {
  rafId = requestAnimationFrame(tick);
  if (S.exporting) return;
  if (S.playing) {
    let t = Math.max(0, S.audio ? AP.time() : (now - (AP.ctxT0 || now)) / 1000);
    const range = activeLoopRange();
    if (t >= range.end - 1e-3) {
      if (S.loop) { seek(range.start); t = range.start; }
      else { pause(); t = Math.min(t, S.plan.duration - 1e-3); }
    }
    S.t = t; S.need = true;
  }
  if (S.need) { S.need = false; draw(); for (const fn of tickSubs) fn(); }
}
export function resizeView() {
  const v = S.view; if (!v || !S.plan) return;
  const ar = S.plan.W / S.plan.H;
  const cw = v.container.clientWidth || 640, chh = v.container.clientHeight || 360;
  let cssW = cw, cssH = cssW / ar;
  if (cssH > chh) { cssH = chh; cssW = cssH * ar; }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pw = Math.round(Math.min(S.plan.W, cssW * dpr)), ph = Math.round(pw / ar);
  if (v.canvas.width !== pw) v.canvas.width = pw;
  if (v.canvas.height !== ph) v.canvas.height = ph;
  v.canvas.style.width = cssW + 'px';
  v.canvas.style.height = cssH + 'px';
  S.need = true;
}

/* ---------------- 消息 / 提示 ---------------- */
let msgTimer = 0, toastTimer = 0;
export function showMsg(m) {
  clearTimeout(msgTimer);
  if (S.msg === m) return;
  S.msg = m; emit();
}
export function toast(text, colors = null) {
  S.toast = { text, colors };
  emit();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { S.toast = null; emit(); }, 3200);
}

/* ---------------- 历史（方案快照） ---------------- */
export function histRemember() {
  try {
    const snap = JSON.stringify(S.project);
    const H = S.hist;
    if (H.list[H.i] === snap) return;
    H.list = H.list.slice(0, H.i + 1);
    H.list.push(snap);
    if (H.list.length > 40) H.list.shift();
    H.i = H.list.length - 1;
  } catch (e) { /* ignore */ }
}
export function histGo(d) {
  const H = S.hist;
  const i = H.i + d;
  if (i < 0 || i >= H.list.length) return;
  H.i = i;
  try {
    S.project = mergeProject(JSON.parse(H.list[i]));
    replan(); emit();
  } catch (e) { /* ignore */ }
}

/* ---------------- 随机 ---------------- */
export function omakase(themeId) {
  if (S.exporting) return;
  histRemember();
  const th = themeId && J.THEMES[themeId] ? themeId : null;
  const r = th ? J.omakase(S.project, Math.random, th) : J.omakase(S.project);
  Object.assign(S.project, r);
  fontKey = '';
  replan(); flushSave(); emit();
  const styleName = J.STYLES[r.style] ? J.STYLES[r.style].name : r.style;
  const moodName = J.MOODS[r.mood] ? J.MOODS[r.mood].name : r.mood;
  toast(t('toastOmakase') + `${styleName} × ${moodName}`, r.colors && r.colors.accentOn ? [r.colors.accent, r.colors.ghostA, r.colors.ghostB] : null);
  seek(0); play();
}
export function shuffle() {
  if (S.exporting) return;
  histRemember();
  S.project.seed = (Math.random() * 1e9) | 0;
  replan(); flushSave(); emit();
  toast(t('toastShuffle'));
}
export function rerollStyle() {
  histRemember();
  let pool = J.STYLE_ORDER.filter(k => k !== S.project.style && (!J.randomOk || J.randomOk(S.project, 'style', k)));
  if (!pool.length) pool = J.STYLE_ORDER.filter(k => k !== S.project.style);
  S.project.style = pool[Math.floor(Math.random() * pool.length)];
  S.project.colors.enabled = false;
  fontKey = '';
  replan(); flushSave(); emit();
}

/* ---------------- 音乐载入 ---------------- */
export async function loadAudioFile(file, { autoplay = false } = {}) {
  showMsg(t('msgAnalyzing'));
  try {
    const a = await J.analyzeAudio(file);
    S.audio = a;
    S.audioName = file.name;
    S.project.audioName = file.name;
    if (autoplay) { replan(); seek(0); play(); }
    else replan();
    emit();
  } catch (e) {
    toast(t('msgAnalyzingFail') + ' ' + (e && e.message ? e.message : e));
  } finally { showMsg(null); }
}

/* Meting：下载音频 + 歌词 → 自动建时间轴 → 自动播放 */
export async function loadMetingTrack(item, settings) {
  if (S.exporting) return;
  S.meting.track = item.title;
  S.meting.error = '';
  histRemember();
  showMsg(t('msgLoadingTrack'));
  emit();
  let gotAudio = false, gotLrc = false, warn = '';
  const jobs = [];
  jobs.push((async () => {
    try {
      const { file } = await fetchAudioFile(item, settings.server, settings, note => showMsg(note));
      showMsg(t('msgAnalyzing'));
      const a = await J.analyzeAudio(file);
      S.audio = a; S.audioName = file.name;
      S.project.audioName = file.name;
      gotAudio = true;
    } catch (e) {
      warn = t('musicAudioFail');
    }
  })());
  jobs.push((async () => {
    try {
      const lrc = await fetchLrcText(item);
      if (lrc && /\[\d{1,2}:\d{1,2}/.test(lrc)) {
        S.project.lyrics = lrc;
        S.project.title = item.title || '';
        S.project.artist = item.artist || '';
        gotLrc = true;
      }
    } catch (e) { /* 无歌词也可以 */ }
  })());
  await Promise.all(jobs);
  fontKey = '';
  replan();
  showMsg(null);
  S.meting.track = '';
  if (gotAudio || gotLrc) {
    seek(0); play();
    toast((gotLrc ? t('toastLoaded') + item.title : item.title) + (warn ? ' — ' + warn : ''));
  } else {
    S.meting.error = t('musicLoadFail') + ' — ' + (item.title || '');
    toast(S.meting.error);
  }
  emit();
}

/* ---------------- 导出 ---------------- */
export function baseName() {
  const k = J.keyMode(S.project);
  return ((S.project.title || 'jizura').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 60) || 'jizura') + (k ? (k === 'green' ? '_greenback' : '_blackback') : '');
}
const canPickFile = () => typeof window.showSaveFilePicker === 'function' && typeof VideoEncoder !== 'undefined';

export async function runExport(kind) {
  if (S.exporting || !S.plan) return;
  let file = null;
  if (kind === 'mp4file') {
    if (!canPickFile()) { toast(t('codecUnsupported')); return; }
    try {
      const hnd = await window.showSaveFilePicker({
        suggestedName: baseName() + '.mp4',
        types: [{ description: 'MP4', accept: { 'video/mp4': ['.mp4'] } }],
      });
      file = await hnd.createWritable();
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      toast(t('exportError') + ': ' + (e && e.message ? e.message : e));
      return;
    }
  }
  pause();
  const ac = new AbortController();
  S.exporting = { kind, progress: 0, text: t('exportPreparing'), ac };
  emit();
  const onProgress = (p, m) => { S.exporting.progress = p; S.exporting.text = m; emit(); };
  let wake = null;
  try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) { wake = null; }
  const t0 = performance.now();
  try {
    await ensureFonts();
    if (kind === 'mp4' || kind === 'mp4file') {
      // 手机导出上限 1080p（内存与编码器时间）
      const isPhone = Math.min(window.screen.width, window.screen.height) <= 820;
      const proj = isPhone && (S.project.res || 1080) > 1080 ? Object.assign({}, S.project, { res: 1080 }) : S.project;
      const r = await J.exportMP4({
        plan: S.plan, project: proj,
        audio: S.project.includeAudio !== false ? S.audio : null,
        quality: S.project.quality || 'high',
        onProgress, signal: ac.signal, range: null, file,
      });
      file = null;
      const size = r.blob ? ` ${(r.blob.size / 1048576).toFixed(1)}MB` : '';
      S.exporting.text = `${t('done')}${size} · ${r.codec}${r.audio ? ' + ' + r.audio.toUpperCase() : ''} · ${((performance.now() - t0) / 1000).toFixed(0)}s`;
      S.exporting.progress = 1;
      if (r.blob) await J.saveFile(baseName() + '.mp4', r.blob);
      else S.exporting.text += ` · ${t('savedTo')}`;
      if (r.audioWanted && r.audio !== 'aac') {
        await J.saveFile(baseName() + '_audio.wav', J.audioWav(S.audio.buffer, J.exportSpan(S.plan, null).dur, 0));
      }
    } else if (kind === 'png' || kind === 'pnga') {
      const blob = await J.exportPNGZip({ plan: S.plan, project: S.project, transparent: kind === 'pnga', onProgress, signal: ac.signal, range: null });
      S.exporting.progress = 1;
      S.exporting.text = `${t('done')} ${(blob.size / 1048576).toFixed(1)}MB`;
      await J.saveFile(baseName() + (kind === 'pnga' ? '_alpha' : '') + '_png.zip', blob);
    } else if (kind === 'ae') {
      S.exporting.progress = 1;
      S.exporting.text = t('done');
      await J.saveFile(baseName() + '_ae.json', JSON.stringify(J.planForAE(S.plan, S.project, null), null, 1));
    } else if (kind === 'project') {
      S.exporting.progress = 1;
      S.exporting.text = t('done');
      await J.saveFile(baseName() + '_project.json', JSON.stringify(S.project, null, 1));
    }
    emit();
  } catch (e) {
    S.exporting.text = `${t('exportError')}: ` + (e && e.message ? e.message : e);
    emit();
    if (file) { try { await file.abort(); } catch (e2) { /* ignore */ } }
  } finally {
    S.exporting = null; S.need = true;
    try { if (wake) await wake.release(); } catch (e) { /* ignore */ }
    emit();
  }
}
export function cancelExport() {
  if (S.exporting && S.exporting.ac) S.exporting.ac.abort();
}

export async function openProjectFile(file) {
  try {
    const obj = JSON.parse(await file.text());
    histRemember();
    S.project = mergeProject(obj);
    fontKey = '';
    replan(); flushSave(); emit();
    toast(t('toastLoaded'));
  } catch (e) {
    toast(t('exportError') + ': ' + (e && e.message ? e.message : e));
  }
}
export function resetAll() {
  try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
  S.project = defaultProject();
  S.audio = null; S.audioName = '';
  S.hist = { list: [], i: -1 };
  fontKey = '';
  replan(); flushSave(); seek(0); emit();
}

/* ---------------- 初始化 ---------------- */
export async function initStore() {
  if (S.ready) return;
  let lang = 'zh-Hans';
  try { lang = localStorage.getItem(LS_LANG) || 'zh-Hans'; } catch (e) { /* ignore */ }
  S.uiLang = lang;
  J.setLang(lang === 'zh-Hant' ? 'zh-Hant' : lang === 'ko' ? 'ko' : lang === 'en' ? 'en' : lang === 'ja' ? 'ja' : 'zh-Hans');
  S.project = loadLocal();
  replan();
  applyUiLabels(lang).then(() => { fontKey = ''; S.need = true; replanSoon(50); });
  initVolume();
  S.ready = true;
  emit();
  rafId = requestAnimationFrame(tick);
  if (S.plan && S.plan.duration > 0) { S.t = 0; S.need = true; }
}

/* ---------------- 沉静模式 ---------------- */
export function toggleSerene() {
  S.serene = !S.serene;
  S.need = true;
  emit();
}

/* ---------------- 界面语言 ---------------- */
export async function setUiLang(lang) {
  S.uiLang = lang;
  try { localStorage.setItem(LS_LANG, lang); } catch (e) { /* ignore */ }
  J.setLang(lang === 'zh-Hant' ? 'zh-Hant' : lang === 'ko' ? 'ko' : lang === 'en' ? 'en' : lang === 'ja' ? 'ja' : 'zh-Hans');
  fontKey = '';
  await applyUiLabels(lang);
  replan(); emit();
}
