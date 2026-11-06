import { useEffect, useLayoutEffect, useRef } from 'react';

// A floating card placed next to an anchor rectangle ({ left, right, top }).
// Without an anchor it is centered on the screen.
// Presses on the calendar itself ([data-calendar-surface]) are handled by the
// calendar, so they do not close the popover here.
// An element inside with [data-drag-handle] lets the user drag the card by hand.
// Once dragged, the card stays where the user put it.
export default function Popover({ anchor, onClose, className = '', children, label, modal = false }) {
  const ref = useRef(null);
  const dragged = useRef(null); // { left, top } after the user moved the card

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (dragged.current) {
      place(el, dragged.current.left, dragged.current.top);
      return;
    }
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left;
    let top;
    if (vw <= 600) {
      // Phone: centered, near the top, so the on-screen keyboard does not cover it.
      left = (vw - w) / 2;
      top = 8;
    } else if (!anchor) {
      left = (vw - w) / 2;
      top = (vh - h) / 2;
    } else {
      if (anchor.right + 12 + w <= vw - 8) left = anchor.right + 12;
      else if (anchor.left - 12 - w >= 8) left = anchor.left - 12 - w;
      else left = (vw - w) / 2;
      top = anchor.top;
    }
    place(el, left, top);
  });

  const onPointerDown = (e) => {
    if (e.button !== 0 || !e.target.closest('[data-drag-handle]')) return;
    if (e.target.closest('button, input, select, textarea, a')) return;
    e.preventDefault();
    const el = ref.current;
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = el.offsetLeft;
    const startTop = el.offsetTop;
    el.classList.add('dragging');
    const move = (ev) => {
      dragged.current = { left: startLeft + ev.clientX - startX, top: startTop + ev.clientY - startY };
      place(el, dragged.current.left, dragged.current.top);
    };
    const up = () => {
      el.classList.remove('dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

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
    <div ref={ref} className={`popover ${className}`} role="dialog" aria-label={label} data-popover onPointerDown={onPointerDown}>
      {children}
    </div>
  );
}

// Put the card at (left, top), but keep it inside the window.
function place(el, left, top) {
  const maxLeft = window.innerWidth - el.offsetWidth - 8;
  const maxTop = window.innerHeight - el.offsetHeight - 8;
  el.style.left = `${Math.max(8, Math.min(left, maxLeft))}px`;
  el.style.top = `${Math.max(8, Math.min(top, maxTop))}px`;
}
