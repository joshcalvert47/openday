import { useState } from 'react';
import Icon from '../icons.jsx';
import * as T from '../time.js';

const VIEW_ITEMS = [
  { id: 'day', label: 'Day', key: 'D' },
  { id: 'week', label: 'Week', key: 'W' },
  { id: 'month', label: 'Month', key: 'M' },
  { id: 'year', label: 'Year', key: 'Y' },
];

// Shorter title for phones: "Nov 2026" instead of "November 2026".
const shorten = (text) => text.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g, (m) => m.slice(0, 3));

function title(view, cursor) {
  const [y, m, d] = T.ymd(cursor);
  if (view === 'year') return `${y}`;
  if (view === 'day') return `${T.MONTHS[m]} ${d}, ${y}`;
  if (view === 'week') {
    const s = T.startOfWeek(cursor);
    const e = T.addDays(s, 6);
    const [sy, sm] = T.ymd(s);
    const [ey, em] = T.ymd(e);
    if (sm === em) return `${T.MONTHS[sm]} ${sy}`;
    if (sy === ey) return `${T.MONTHS[sm].slice(0, 3)} – ${T.MONTHS[em].slice(0, 3)} ${ey}`;
    return `${T.MONTHS[sm].slice(0, 3)} ${sy} – ${T.MONTHS[em].slice(0, 3)} ${ey}`;
  }
  return `${T.MONTHS[m]} ${y}`;
}

function rectOf(el) {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.bottom + 4, bottom: r.bottom };
}

// Small dropdown menu placed under a button.
function Menu({ anchor, alignRight, onClose, children }) {
  const style = alignRight
    ? { top: anchor.top, right: window.innerWidth - anchor.right }
    : { top: anchor.top, left: anchor.left };
  return (
    <>
      <div className="menu-backdrop" onPointerDown={onClose} />
      <div className="menu" style={style} role="menu" data-popover>
        {children}
      </div>
    </>
  );
}

export default function Header({
  view, cursor, onToggleSidebar, onToday, onPrev, onNext, onView, onOpenSettings, onOpenAppearance,
}) {
  const [viewMenu, setViewMenu] = useState(null);
  const [gearMenu, setGearMenu] = useState(null);
  const unit = { day: 'day', week: 'week', month: 'month', year: 'year' }[view];

  return (
    <header className="header">
      <div className="header-left">
        <button className="icon-btn" aria-label="Main menu" title="Main menu" onClick={onToggleSidebar}>
          <Icon name="menu" />
        </button>
        <img src="/logo.svg" alt="" className="logo" width="40" height="40" />
        <span className="brand">OpenDay</span>
      </div>
      <div className="header-nav">
        <button className="outline-btn" onClick={onToday} title="Today (T)">
          Today
        </button>
        <button className="icon-btn" aria-label={`Previous ${unit}`} title={`Previous ${unit}`} onClick={onPrev}>
          <Icon name="chevronLeft" />
        </button>
        <button className="icon-btn" aria-label={`Next ${unit}`} title={`Next ${unit}`} onClick={onNext}>
          <Icon name="chevronRight" />
        </button>
        <h1 className="header-title">
          <span className="title-long">{title(view, cursor)}</span>
          <span className="title-short">{shorten(title(view, cursor))}</span>
        </h1>
      </div>
      <div className="header-right">
        <button
          className="icon-btn"
          aria-label="Settings menu"
          title="Settings menu"
          onClick={(e) => setGearMenu(rectOf(e.currentTarget))}
        >
          <Icon name="settings" />
        </button>
        <button className="outline-btn view-btn" onClick={(e) => setViewMenu(rectOf(e.currentTarget))}>
          {VIEW_ITEMS.find((v) => v.id === view)?.label}
          <Icon name="arrowDropDown" size={20} />
        </button>
      </div>

      {viewMenu && (
        <Menu anchor={viewMenu} alignRight onClose={() => setViewMenu(null)}>
          {VIEW_ITEMS.map((v) => (
            <button
              key={v.id}
              role="menuitem"
              className={`menu-item ${v.id === view ? 'active' : ''}`}
              onClick={() => {
                onView(v.id);
                setViewMenu(null);
              }}
            >
              <span>{v.label}</span>
              <span className="menu-key">{v.key}</span>
            </button>
          ))}
        </Menu>
      )}
      {gearMenu && (
        <Menu anchor={gearMenu} alignRight onClose={() => setGearMenu(null)}>
          <button
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setGearMenu(null);
              onOpenSettings();
            }}
          >
            Settings
          </button>
          <button
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setGearMenu(null);
              onOpenAppearance();
            }}
          >
            Appearance
          </button>
        </Menu>
      )}
    </header>
  );
}
