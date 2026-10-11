import React, { useState } from 'react';

/* 小型受控部件：全部走 store.setProject 系动作，保持无表单库的简洁 */

export function Section({ title, children, defaultOpen = true, badge = null }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={'sec' + (open ? ' open' : '')}>
      <button type="button" className="sec-h" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="sec-t">{title}</span>
        {badge != null && <span className="sec-badge">{badge}</span>}
        <span className="sec-arrow" aria-hidden="true">▾</span>
      </button>
      {open && <div className="sec-b">{children}</div>}
    </section>
  );
}

export function Row({ children, className = '' }) {
  return <div className={'row ' + className}>{children}</div>;
}

export function Field({ label, children, className = '' }) {
  return (
    <label className={'field ' + className}>
      <span className="f-label">{label}</span>
      {children}
    </label>
  );
}

export function Select({ value, onChange, options, className = '' }) {
  return (
    <select className={'sel ' + className} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function NumIn({ value, onChange, min, max, step, placeholder, className = '' }) {
  return (
    <input
      type="number"
      className={'num ' + className}
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onChange={e => {
        const v = e.target.value === '' ? null : +e.target.value;
        onChange(v);
      }}
    />
  );
}

export function Slider({ value, onChange, min = 0, max = 1, step = 0.01, label, fmt }) {
  return (
    <label className="slider">
      <span className="s-head">
        <span className="f-label">{label}</span>
        <span className="s-val mono">{fmt ? fmt(value) : Math.round(value * 100) + '%'}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)} />
    </label>
  );
}

export function Toggle({ checked, onChange, label, title }) {
  return (
    <label className="toggle" title={title}>
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
      <span className="tg-label">{label}</span>
    </label>
  );
}

/* 原作同款描边小图标 */
export function DiceIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="10.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function RotateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M3 9a9 9 0 0 1 3-4.5M21 15a9 9 0 0 1-3 4.5" strokeLinecap="round" />
      <path d="M6.2 2.6 6 4.5l1.9.2M17.8 21.4l.2-1.9-1.9-.2" strokeLinecap="round" />
    </svg>
  );
}

export function Btn({ children, onClick, kind = '', className = '', disabled = false, title }) {
  return (
    <button type="button" className={`btn ${kind} ${className}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

export function FileBtn({ children, accept, onFile, kind = 'ghost', className = '' }) {
  return (
    <label className={`btn ${kind} file-btn ${className}`}>
      {children}
      <input type="file" accept={accept} hidden onChange={e => { const f = e.target.files && e.target.files[0]; if (f) onFile(f); e.target.value = ''; }} />
    </label>
  );
}
