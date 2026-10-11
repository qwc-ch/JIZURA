/* ============================================================
   JIZURA web — Meting 音乐源
   与 Firefly 相同的 Meting API 约定：
   GET {api}?server=:server&type=:type&id=:id&r=:r
   → [{ title|name, author|artist, url(音频), pic|cover, lrc }]
   lrc 可能是 URL，也可能直接是歌词文本。
   ============================================================ */

const DEFAULT_APIS = [
  'https://api.qijieya.cn/meting/?server=:server&type=:type&id=:id&r=:r',
  'https://api.injahow.cn/meting/?server=:server&type=:type&id=:id&r=:r',
  'https://api.moeyao.cn/meting/?server=:server&type=:type&id=:id&r=:r',
];

const LS_KEY = 'jizura.meting.settings.v1';

export const SERVERS = [
  { value: 'netease', label: '网易云音乐' },
  { value: 'tencent', label: 'QQ 音乐' },
  { value: 'kugou', label: '酷狗音乐' },
  { value: 'baidu', label: '百度音乐' },
];

export const METING_TYPES = [
  { value: 'search', label: '搜索' },
  { value: 'song', label: '单曲' },
  { value: 'playlist', label: '歌单' },
  { value: 'album', label: '专辑' },
];

export function loadMetingSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (s && typeof s === 'object') return { server: 'netease', type: 'search', id: '', customApis: [], ...s };
  } catch (e) { /* ignore */ }
  return { server: 'netease', type: 'search', id: '', customApis: [] };
}

export function saveMetingSettings(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

const httpsify = u => (typeof u === 'string' ? u.replace(/^http:\/\//i, 'https://') : u);

async function fetchWithTimeout(url, ms = 20000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { signal: ac.signal, redirect: 'follow' });
  } finally { clearTimeout(timer); }
}

function apiList(settings) {
  const custom = (settings.customApis || []).filter(Boolean);
  return [...custom, ...DEFAULT_APIS];
}

/* 拉取曲目列表（歌单 / 单曲 / 搜索 / 专辑） */
export async function metingFetch(settings) {
  const id = String(settings.id || '').trim();
  if (!id) throw new Error('EMPTY_ID');
  const qs = settings.type === 'search' ? encodeURIComponent(id) : id.replace(/\s+/g, '');
  const errors = [];
  for (const base of apiList(settings)) {
    try {
      const url = base
        .replace(':server', settings.server)
        .replace(':type', settings.type)
        .replace(':id', qs)
        .replace(':r', String(Math.random()));
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        return data.map(it => ({
          title: it.title || it.name || '未知曲名',
          artist: it.author || it.artist || '',
          url: it.url || '',
          pic: it.pic || it.cover || '',
          lrc: it.lrc || '',
        }));
      }
      errors.push(base.split('/')[2] + ': 空结果');
    } catch (e) {
      errors.push(base.split('/')[2] + ': ' + (e && e.message ? e.message : e));
    }
  }
  throw new Error('所有 Meting 接口都失败了 — ' + errors.join('；'));
}

/* lrc 字段可能是 URL，也可能是内联文本 */
export async function fetchLrcText(item) {
  if (!item.lrc) return '';
  if (!/^(https?:)?\/\//i.test(item.lrc) && !item.lrc.startsWith('/')) return item.lrc; // 内联
  const res = await fetchWithTimeout(httpsify(item.lrc));
  if (!res.ok) throw new Error('LRC HTTP ' + res.status);
  return await res.text();
}

function songIdFromUrl(u) {
  const m = String(u || '').match(/[?&]id=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

/* 拉取音频并包成 File（交给 J.analyzeAudio 解码 / 检测节拍） */
export async function fetchAudioFile(item, server, settings, onNote = () => {}) {
  const name = ((item.title || 'track') + (item.artist ? ' - ' + item.artist : '')).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
  const candidates = [];
  if (item.url) candidates.push(item.url);
  // 主接口的音频地址常因跨域/混合内容失败：改用各接口的 type=url 代理重取
  const sid = songIdFromUrl(item.url) || (settings.type === 'song' ? String(settings.id).trim() : '');
  if (sid) for (const base of apiList(settings)) candidates.push({ api: base, sid });
  const tried = [];
  for (const cand of candidates) {
    try {
      let url;
      if (typeof cand === 'string') url = cand;
      else url = cand.api.replace(':server', server).replace(':type', 'url').replace(':id', cand.sid).replace(':r', String(Math.random()));
      onNote('正在下载音频…');
      const res = await fetchWithTimeout(httpsify(url), 60000);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 4096) throw new Error('音频内容过小');
      const ext = (/\.(\w{2,5})(\?|$)/.exec(url) || [, 'mp3'])[1].toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
      return { file: new File([buf], name + '.' + ext, { type: 'audio/mpeg' }), size: buf.byteLength };
    } catch (e) {
      tried.push((typeof cand === 'string' ? '原始地址' : cand.api.split('/')[2]) + ': ' + (e && e.message ? e.message : e));
    }
  }
  throw new Error('音频下载失败（跨域或链接失效）— ' + tried.join('；'));
}
