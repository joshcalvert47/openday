import { useEffect, useLayoutEffect, useRef } from 'react';

// A floating card placed next to an anchor rectangle ({ left, right, top }).
// Without an anchor it is centered on the screen.
// Presses on the calendar itself ([data-calendar-surface]) are handled by the
// calendar, so they do not close the popover here.
export default function Popover({ anchor, onClose, className = '', children, label, modal = false }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left;
    let top;
    if (!anchor) {
      left = (vw - w) / 2;
      top = (vh - h) / 2;
    } else {
      if (anchor.right + 12 + w <= vw - 8) left = anchor.right + 12;
      else if (anchor.left - 12 - w >= 8) left = anchor.left - 12 - w;
      else left = (vw - w) / 2;
      top = anchor.top;
    }
    el.style.left = `${Math.max(8, Math.min(left, vw - w - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(top, vh - h - 8))}px`;
  });

  useEffect(() => {
    const onDown = (e) => {
      const t = e.target;
      if (ref.current?.contains(t)) return;
      if (!modal && t.closest?.('[data-calendar-surface]')) return;
      if (t.closest?.('[data-popover]')) return;
      onClose?.();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [onClose, modal]);

  return (
    <div ref={ref} className={`popover ${className}`} role="dialog" aria-label={label} data-popover>
      {children}
    </div>
  );
}
