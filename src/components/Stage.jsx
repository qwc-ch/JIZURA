import React, { useEffect, useRef } from 'react';
import { J } from '../engine.js';
import {
  S, useStore, onTick, resizeView, toggle, seek, cycleLoop, play,
  omakase, histGo, cancelExport, AP, rememberVolume, t,
} from '../store.js';
import { Btn, DiceIcon } from './controls.jsx';

const LOOP_LABEL = () => ({ all: t('loopAll'), line: t('loopLine'), cut: t('loopCut'), off: t('loopOff') });

export default function Stage() {
  useStore();
  const canvasRef = useRef(null);
  const boxRef = useRef(null);
  const timeRef = useRef(null);
  const durRef = useRef(null);
  const scrubRef = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    rendererRef.current = new J.Renderer();
    S.view = { canvas: canvasRef.current, ctx: canvasRef.current.getContext('2d'), container: boxRef.current, renderer: rendererRef.current };
    resizeView();
    const ro = new ResizeObserver(() => resizeView());
    ro.observe(boxRef.current);
    const un = onTick(() => {
      if (timeRef.current) timeRef.current.textContent = J.fmtTime(S.t);
      if (durRef.current && S.plan) durRef.current.textContent = J.fmtTime(S.plan.duration);
      if (scrubRef.current && S.plan && !S.scrubbing) {
        scrubRef.current.value = String(Math.round(S.t / Math.max(0.001, S.plan.duration) * 10000));
      }
    });
    return () => { ro.disconnect(); un(); S.view = null; };
  }, []);

  const loopLabels = LOOP_LABEL();
  const dur = S.plan ? S.plan.duration : 0;
  return (
    <div className="stage">
      <div className="stage-head">
        <div className="stage-title">
          <span className="mark" aria-hidden="true">字面</span>
          <b>JIZURA</b>
          <span className="tag">{t('appTag')}</span>
        </div>
        <div className="stage-actions">
          <Btn kind="primary big" onClick={() => { seek(0); play(); }} title={t('start')}>▶ {t('start')}</Btn>
          <Btn kind="accent" onClick={() => omakase(S.project.themeId)} title={t('omakase') + ' (R)'}><DiceIcon /> {t('omakase')}</Btn>
        </div>
      </div>

      <div className="viewport" ref={boxRef}>
        <canvas ref={canvasRef} width={1280} height={720} aria-label="preview" />
        {S.msg && <div className="overlay-msg">{S.msg}</div>}
      </div>

      <div className="transport">
        <button type="button" className={'btn play ' + (S.playing ? 'on' : '')} onClick={toggle}
          aria-label={S.playing ? t('pause') : t('play')}>{S.playing ? '❚❚' : '▶'}</button>
        <span className="tc mono" ref={timeRef}>00:00.00</span>
        <span className="tc muted">/</span>
        <span className="tc muted mono" ref={durRef}>00:00.00</span>
        <input ref={scrubRef} className="scrub" type="range" min={0} max={10000} defaultValue={0}
          onPointerDown={() => { S.scrubbing = true; }}
          onPointerUp={() => { S.scrubbing = false; }}
          onChange={e => { if (dur) seek((+e.target.value / 10000) * dur); }}
          aria-label="seek" />
        <button type="button" className={'btn small ' + (S.loop ? 'on' : '')} onClick={cycleLoop} title={t('loopAll')}>
          {loopLabels[S.loop === false ? 'off' : S.loop] || t('loopAll')}
        </button>
        <span className="vol">
          <button type="button" className={'btn small ' + (AP.muted ? 'on' : '')}
            onClick={() => { AP.setVol(null, !AP.muted); rememberVolume(); }}>{AP.muted || AP.vol === 0 ? t('muted') : t('volume')}</button>
          <input type="range" min={0} max={100} value={Math.round(AP.vol * 100)}
            onChange={e => { AP.setVol(+e.target.value / 100, false); rememberVolume(); }} aria-label={t('volume')} />
        </span>
        <span className="hist">
          <button type="button" className="btn small" onClick={() => histGo(-1)} aria-label={t('prevSet')}>◀</button>
          <button type="button" className="btn small" onClick={() => histGo(1)} aria-label={t('nextSet')}>▶</button>
        </span>
        <button type="button" className="btn small" onClick={() => shuffle()}>{t('shuffle')}</button>
      </div>

      {S.toast && (
        <div className="toast" role="status">
          {S.toast.colors && S.toast.colors.map((c, i) => <i key={i} className="sw" style={{ background: c }} />)}
          {S.toast.text}
        </div>
      )}

      {S.exporting && (
        <div className="exp-overlay">
          <div className="exp-card">
            <b>{S.exporting.kind === 'png' || S.exporting.kind === 'pnga' ? t('exportPng') : t('exportMp4')}</b>
            <div className="exp-bar"><span style={{ width: (S.exporting.progress * 100).toFixed(1) + '%' }} /></div>
            <p className="mono">{S.exporting.text}</p>
            <Btn onClick={cancelExport}>{t('cancel')}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
