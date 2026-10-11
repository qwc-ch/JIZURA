import React, { useEffect, useState } from 'react';
import { S, useStore, initStore, omakase, toggle, toggleSerene, t } from './store.js';
import { DiceIcon, RotateIcon } from './components/controls.jsx';
import Sidebar from './components/Sidebar.jsx';
import Stage from './components/Stage.jsx';

function PortraitGate({ onContinue }) {
  const T = t;
  return (
    <div className="portrait-gate">
      <div className="pg-card">
        <RotateIcon />
        <h2>{T('rotateTitle')}</h2>
        <p>{T('rotateText')}</p>
        <button type="button" className="btn ghost" onClick={onContinue}>{T('continuePortrait')}</button>
      </div>
    </div>
  );
}

export default function App() {
  useStore();
  const [drawer, setDrawer] = useState(false);
  const [portraitOk, setPortraitOk] = useState(false);

  useEffect(() => { initStore(); }, []);

  useEffect(() => {
    const onKey = e => {
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      else if (e.key === 'Escape' && S.serene) { toggleSerene(); }
      else if (e.key === 'r' || e.key === 'R') { omakase(S.project && S.project.themeId); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 手机竖屏且未选择继续时显示旋转提示
  const isPortrait = () => window.matchMedia('(orientation: portrait)').matches;
  const isNarrow = () => Math.min(window.screen.width, window.screen.height) <= 820 || window.innerWidth < 720;
  const [narrow, setNarrow] = useState(isNarrow());
  useEffect(() => {
    const f = () => setNarrow(isNarrow());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  const showGate = narrow && isPortrait() && !portraitOk;

  if (!S.ready) {
    return (
      <div className="app" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="pg-card">
          <span className="mark">字面</span>
          <p className="muted mono">loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={'app' + (narrow ? ' narrow' : '') + (drawer ? ' drawer-open' : '') + (S.serene ? ' serene' : '')}>
      <header className="topbar">
        <button type="button" className="btn menu" onClick={() => setDrawer(!drawer)} aria-label="menu">{t('menu')}</button>
        <div className="brand">
          <span className="mark">字面</span>
          <span className="word">JIZURA</span>
          <span className="tag">{t('appTag')}</span>
        </div>
        <span className="grow" />
        <button type="button" className={'btn btn-serene' + (S.serene ? ' on' : '')} onClick={toggleSerene} title={t('sereneTip')}>{t('serene')}</button>
        <button type="button" className="btn accent" onClick={() => omakase(S.project && S.project.themeId)}><DiceIcon /> {t('omakase')}</button>
        <button type="button" className="btn primary" onClick={toggle}>{S.playing ? '❚❚' : '▶'}</button>
      </header>
      <div className="main">
        <aside className={'sidebar' + (drawer ? ' show' : '')}>
          <Sidebar />
        </aside>
        {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}
        <Stage />
      </div>
      {showGate && <PortraitGate onContinue={() => setPortraitOk(true)} />}
    </div>
  );
}
