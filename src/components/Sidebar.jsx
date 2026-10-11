import React, { useEffect, useMemo, useState } from 'react';
import { J } from '../engine.js';
import {
  S, setProject, setFx, setTiming, flushSave, omakase, shuffle, rerollStyle,
  loadAudioFile, loadMetingTrack, runExport, openProjectFile, resetAll,
  setUiLang, t, emit,
} from '../store.js';
import { useStore } from '../store.js';
import { SERVERS, METING_TYPES, metingFetch, loadMetingSettings, saveMetingSettings } from '../meting.js';
import { UI_LANGS } from '../i18n.js';
import { Section, Row, Field, Select, NumIn, Slider, Toggle, Btn, FileBtn, DiceIcon } from './controls.jsx';

const ASPECTS = ['16:9', '9:16', '4:3', '3:4', '1:1', '4:5', '21:9'];
const RESES = [720, 1080, 1440, 2160];
const FPSES = [24, 30, 60];
const LYRIC_LANGS = [
  { value: 'auto', label: '自动判定 / Auto' },
  { value: 'ja', label: '日本語' },
  { value: 'zh-Hant', label: '繁體中文' },
  { value: 'zh-Hans', label: '简体中文' },
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
];

function useT() { useStore(); return t; }

/* ---------------- 音乐 ---------------- */
function MusicSection() {
  const T = useT();
  const [settings, setSettings] = useState(loadMetingSettings);
  const [q, setQ] = useState(settings.id || '');
  useStore();
  const st = S.meting;

  const patch = p => { const n = { ...settings, ...p }; setSettings(n); saveMetingSettings(n); };
  const fetchList = async () => {
    if (!q.trim()) { S.meting.error = T('musicNeedId'); S.meting.loading = false; return; }
    patch({ id: q.trim() });
    S.meting.loading = true; S.meting.error = '';
    emit();
    try {
      const items = await metingFetch({ ...settings, id: q.trim() });
      S.meting.items = items;
    } catch (e) {
      S.meting.error = (e && e.message) || String(e);
    } finally {
      S.meting.loading = false;
      emit();
    }
  };
  return (
    <Section title={T('secMusic')}>
      <Row className="gap">
        <Field label={T('musicServer')} className="grow">
          <Select value={settings.server} onChange={v => patch({ server: v })}
            options={SERVERS.map(s => ({ value: s.value, label: s.label }))} />
        </Field>
        <Field label={T('musicType')} className="grow">
          <Select value={settings.type} onChange={v => patch({ type: v })}
            options={METING_TYPES.map(s => ({ value: s.value, label: s.label }))} />
        </Field>
      </Row>
      <Field label={T('musicId')}>
        <div className="id-row">
          <input className="txt" type="text" value={q} placeholder={T('musicIdPh')}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') fetchList(); }} />
          <Btn kind="primary" onClick={fetchList} disabled={st.loading}>{st.loading ? T('musicLoading') : T('musicFetch')}</Btn>
        </div>
      </Field>
      {st.error && <p className="warn">{st.error}</p>}
      {st.items.length > 0 && (
        <div className="tracklist">
          <p className="hint">{T('musicListTip')}</p>
          {st.items.map((it, i) => (
            <button type="button" key={i} className={'track' + (st.track === it.title ? ' active' : '')}
              onClick={() => loadMetingTrack(it, { ...settings, id: q.trim() })}>
              {it.pic ? <img src={it.pic.startsWith('http:') ? 'https:' + it.pic.slice(5) : it.pic} alt="" loading="lazy" /> : <span className="t-dot" />}
              <span className="t-name">{it.title}</span>
              <span className="t-artist">{it.artist}</span>
            </button>
          ))}
        </div>
      )}
      <Row className="gap wrap">
        <FileBtn accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac" onFile={f => loadAudioFile(f)}>{T('musicLocal')}</FileBtn>
        <FileBtn accept=".lrc,.txt,text/plain" onFile={async f => {
          const text = await f.text();
          setProject({ lyrics: text });
        }}>{T('musicLrc')}</FileBtn>
      </Row>
      <p className="hint">{S.audioName ? `♪ ${S.audioName}` : T('musicNone')}</p>
      <p className="hint muted">{T('metingNote')}</p>
    </Section>
  );
}

/* ---------------- 歌词 ---------------- */
function LyricsSection() {
  const T = useT();
  useStore();
  return (
    <Section title={T('secLyrics')}>
      <textarea className="lyrics" rows={8} spellCheck={false} value={S.project.lyrics}
        onChange={e => setProject({ lyrics: e.target.value })} aria-label={T('secLyrics')} />
      <Field label={T('lyricLang')}>
        <Select value={S.project.lang || 'auto'} onChange={v => setProject({ lang: v })} options={LYRIC_LANGS} />
      </Field>
      <details className="syntax">
        <summary>{T('syntaxTitle')}</summary>
        <ul>
          <li>{T('syntax1')}</li>
          <li>{T('syntax2')}</li>
          <li>{T('syntax3')}</li>
          <li>{T('syntax4')}</li>
          <li>{T('syntax5')}</li>
          <li>{T('syntax6')}</li>
          <li>{T('syntax7')}</li>
        </ul>
      </details>
    </Section>
  );
}

/* ---------------- 节拍与时间 ---------------- */
function TimingSection() {
  const T = useT();
  useStore();
  const tm = S.project.timing;
  return (
    <Section title={T('secTiming')}>
      <Row className="gap">
        <Field label={T('bpm')} className="grow">
          <NumIn value={tm.bpm || 0} min={0} max={300} step={0.1} onChange={v => setTiming('bpm', v || 0)} />
        </Field>
        <Field label={T('offset')} className="grow">
          <NumIn value={tm.offset ?? 0} min={0} step={0.05} onChange={v => setTiming('offset', v ?? 0)} />
        </Field>
      </Row>
      <Field label={T('lineScale')}>
        <NumIn value={tm.lineScale ?? 1} min={0.4} max={3} step={0.05} onChange={v => setTiming('lineScale', v ?? 1)} />
      </Field>
      <Toggle checked={tm.snap !== false} onChange={v => setTiming('snap', v)} label={T('snap')} />
    </Section>
  );
}

/* ---------------- 风格与画面 ---------------- */
function LookSection() {
  const T = useT();
  useStore();
  const p = S.project;
  const styleOpts = useMemo(() => J.STYLE_ORDER.map(k => ({ value: k, label: J.STYLES[k] ? J.STYLES[k].name : k })), []);
  const moodOpts = [{ value: '', label: T('moodCustom') }, ...J.MOODS ? Object.keys(J.MOODS).map(k => ({ value: k, label: J.MOODS[k].name })) : []];
  const themeOpts = [
    { value: '', label: T('themeNone') },
    ...Object.keys(J.THEMES || {}).map(k => ({ value: k, label: T('theme' + k[0].toUpperCase() + k.slice(1)) })),
  ];
  const randPalette = () => {
    const st = J.STYLES[p.style];
    const bg = st && st.schemes && st.schemes[0] ? st.schemes[0].bg : '#000';
    Object.assign(p.colors, J.randomPalette(bg, Math.random), { enabled: true, accentOn: true });
    setProject({ colors: { ...p.colors } });
  };
  return (
    <Section title={T('secLook')}>
      <Field label={T('style')}>
        <Select value={p.style} onChange={v => setProject({ style: v, colors: { ...p.colors } })} options={styleOpts} />
      </Field>
      <Row className="gap">
        <Btn onClick={rerollStyle} className="grow">{T('rerollStyle')}</Btn>
        <Btn onClick={() => shuffle()} className="grow">{T('shuffle')}</Btn>
      </Row>
      <Row className="gap">
        <Field label={T('mood')} className="grow">
          <Select value={p.mood || ''} onChange={v => setProject({ mood: v || null })} options={moodOpts} />
        </Field>
        <Field label={T('theme')} className="grow">
          <Select value={p.themeId || ''} onChange={v => setProject({ themeId: v || null })} options={themeOpts} />
        </Field>
      </Row>
      <Field label={T('seed')}>
        <div className="id-row">
          <NumIn value={p.seed} step={1} onChange={v => setProject({ seed: (v | 0) || 0 })} className="grow" />
          <Btn onClick={() => setProject({ seed: (Math.random() * 1e9) | 0 })} title={T('seed')}><DiceIcon /></Btn>
        </div>
      </Field>
      <Row className="gap">
        <Field label={T('aspect')} className="grow">
          <Select value={p.aspect} onChange={v => setProject({ aspect: v })}
            options={ASPECTS.map(a => ({ value: a, label: a }))} />
        </Field>
        <Field label={T('resolution')} className="grow">
          <Select value={String(p.res || 1080)} onChange={v => setProject({ res: +v })}
            options={RESES.map(r => ({ value: String(r), label: r + 'p' }))} />
        </Field>
        <Field label={T('fps')} className="grow">
          <Select value={String(p.fps)} onChange={v => setProject({ fps: +v })}
            options={FPSES.map(f => ({ value: String(f), label: String(f) }))} />
        </Field>
      </Row>
      <Row className="gap">
        <Field label={T('keyBg')} className="grow">
          <Select value={p.keyBg || 'off'} onChange={v => setProject({ keyBg: v })}
            options={[{ value: 'off', label: T('keyOff') }, { value: 'green', label: T('keyGreen') }, { value: 'black', label: T('keyBlack') }]} />
        </Field>
        {p.centerFree && (
          <Field label={T('centerDir')} className="grow">
            <Select value={p.centerDir || 'tb'} onChange={v => setProject({ centerDir: v })}
              options={[{ value: 'tb', label: T('centerTb') }, { value: 'lr', label: T('centerLr') }]} />
          </Field>
        )}
      </Row>
      <Toggle checked={!!p.centerFree} onChange={v => setProject({ centerFree: v })} label={T('centerFree')} />
      <div className="tg-grid">
        <Toggle checked={!!p.extra} onChange={v => setProject({ extra: v })} label={T('tgExtra')} />
        <Toggle checked={p.wa !== false} onChange={v => setProject({ wa: v })} label={T('tgWa')} />
        <Toggle checked={!!p.horror} onChange={v => setProject({ horror: v })} label={T('tgHorror')} />
        <Toggle checked={p.typo !== false} onChange={v => setProject({ typo: v })} label={T('tgTypo')} />
        <Toggle checked={p.kinetic !== false} onChange={v => setProject({ kinetic: v })} label={T('tgKinetic')} />
        <Toggle checked={!!p.unify} onChange={v => setProject({ unify: v })} label={T('tgUnify')} />
        <Toggle checked={!!p.typeset} onChange={v => setProject({ typeset: v })} label={T('tgTypeset')} />
        <Toggle checked={!!p.colors.enabled} onChange={v => setProject({ colors: { ...p.colors, enabled: v } })} label={T('colorsCustom')} />
      </div>
      {p.colors.enabled && <Btn onClick={randPalette}>{T('randPalette')}</Btn>}
    </Section>
  );
}

/* ---------------- 效果强度 ---------------- */
function FxSection() {
  const T = useT();
  useStore();
  const fx = S.project.fx;
  return (
    <Section title={T('secFx')} defaultOpen={false}>
      <Slider label={T('fxMotion')} value={fx.motion} onChange={v => setFx('motion', v)} />
      <Slider label={T('fxGlitch')} value={fx.glitch} onChange={v => setFx('glitch', v)} />
      <Slider label={T('fxChroma')} value={fx.chroma} onChange={v => setFx('chroma', v)} />
      <Slider label={T('fxDecor')} value={fx.decor} onChange={v => setFx('decor', v)} />
      <Slider label={T('fxDensity')} value={fx.density} onChange={v => setFx('density', v)} />
      <Slider label={T('fxTexture')} value={fx.texture} onChange={v => setFx('texture', v)} />
      <Slider label={T('fxBgSwitch')} value={fx.bgSwitch} onChange={v => setFx('bgSwitch', v)} />
      <Row className="gap">
        <Field label={T('fxKoma')} className="grow">
          <Select value={String(fx.koma ?? 12)} onChange={v => setFx('koma', +v)}
            options={[{ value: '12', label: T('koma12') }, { value: '8', label: T('koma8') }, { value: '0', label: T('koma0') }]} />
        </Field>
        <Field label={T('fxHud')} className="grow">
          <Select value={fx.hud || 'auto'} onChange={v => setFx('hud', v)}
            options={[{ value: 'auto', label: T('hudAuto') }, { value: 'on', label: T('hudOn') }, { value: 'off', label: T('hudOff') }]} />
        </Field>
      </Row>
      <div className="tg-grid">
        <Toggle checked={fx.flash !== false} onChange={v => setFx('flash', v)} label={T('fxFlash')} />
        <Toggle checked={!!fx.hideNo} onChange={v => setFx('hideNo', v)} label={T('fxHideNo')} />
        <Toggle checked={!!fx.hideTime} onChange={v => setFx('hideTime', v)} label={T('fxHideTime')} />
      </div>
    </Section>
  );
}

/* ---------------- 标题 ---------------- */
function TitleSection() {
  const T = useT();
  useStore();
  return (
    <Section title={T('secTitle')} defaultOpen={false}>
      <Field label={T('title')}>
        <input className="txt" type="text" value={S.project.title || ''} onChange={e => setProject({ title: e.target.value })} />
      </Field>
      <Field label={T('artist')}>
        <input className="txt" type="text" value={S.project.artist || ''} onChange={e => setProject({ artist: e.target.value })} />
      </Field>
    </Section>
  );
}

/* ---------------- 导出 ---------------- */
function ExportSection() {
  const T = useT();
  useStore();
  const p = S.project;
  const busy = !!S.exporting;
  return (
    <Section title={T('secExport')}>
      <Row className="gap">
        <Field label={T('quality')} className="grow">
          <Select value={p.quality || 'high'} onChange={v => setProject({ quality: v }, { replan: false })}
            options={[{ value: 'high', label: T('qHigh') }, { value: 'mid', label: T('qMid') }, { value: 'max', label: T('qMax') }]} />
        </Field>
        <div className="grow center-self">
          <Toggle checked={p.includeAudio !== false} onChange={v => setProject({ includeAudio: v }, { replan: false })} label={T('includeAudio')} />
        </div>
      </Row>
      <div className="exp-grid">
        <Btn kind="accent" onClick={() => runExport('mp4')} disabled={busy}>{T('exportMp4')}</Btn>
        {typeof window.showSaveFilePicker === 'function' && (
          <Btn onClick={() => runExport('mp4file')} disabled={busy}>{T('exportMp4File')}</Btn>
        )}
        <Btn onClick={() => runExport('png')} disabled={busy}>{T('exportPng')}</Btn>
        <Btn onClick={() => runExport('pnga')} disabled={busy}>{T('exportPngAlpha')}</Btn>
        <Btn onClick={() => runExport('ae')} disabled={busy}>{T('exportAe')}</Btn>
        <Btn onClick={() => runExport('project')} disabled={busy}>{T('saveProject')}</Btn>
        <FileBtn accept=".json,application/json" onFile={f => openProjectFile(f)} disabled={busy}>{T('openProject')}</FileBtn>
        <Btn kind="danger" onClick={() => { if (window.confirm(T('reset') + '?')) resetAll(); }}>{T('reset')}</Btn>
      </div>
      <p className="hint muted">{T('exportNote')}</p>
    </Section>
  );
}

/* ---------------- 界面语言 / 关于 ---------------- */
function LangSection() {
  const T = useT();
  useStore();
  return (
    <Section title={T('secLang')} defaultOpen={false}>
      <Select value={S.uiLang} onChange={setUiLang}
        options={UI_LANGS.map(l => ({ value: l.value, label: l.label }))} />
      <p className="hint muted">{T('about')}</p>
    </Section>
  );
}

export default function Sidebar() {
  useStore();
  return (
    <div className="sidebar-inner">
      <MusicSection />
      <LyricsSection />
      <TimingSection />
      <LookSection />
      <FxSection />
      <TitleSection />
      <ExportSection />
      <LangSection />
    </div>
  );
}
