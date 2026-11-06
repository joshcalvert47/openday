import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// The open list of a dropdown (used by Select and TimeInput).
// It is drawn in document.body, so cards with scrolling or rounded corners
// never cut it off. It sits under the anchor, or above it when there is
// not enough room below.
// The active option (keyboard or typed text) is scrolled into the middle.
export default function DropdownList({ id, anchorRef, options, activeIndex, selectedValue, onPick }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const update = () => {
      const a = anchorRef.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      const vv = window.visualViewport;
      const vh = vv ? vv.height + vv.offsetTop : window.innerHeight;
      const below = vh - r.bottom - 8;
      const above = r.top - 8;
      const up = below < 200 && above > below;
      const maxHeight = Math.max(80, Math.min(256, up ? above : below));
      setPos({
        left: Math.max(8, Math.min(r.left, window.innerWidth - 8 - Math.max(r.width, 120))),
        minWidth: r.width,
        maxHeight,
        top: up ? undefined : r.bottom + 4,
        bottom: up ? window.innerHeight - r.top + 4 : undefined,
      });
    };
    update();
    const onScroll = (e) => {
      if (ref.current?.contains(e.target)) return;
      update();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [anchorRef]);

  // Keep the active option in view (centered), without scrolling the page.
  useEffect(() => {
    const list = ref.current;
    const item = list?.children[activeIndex];
    if (!item) return;
    list.scrollTop = item.offsetTop - list.clientHeight / 2 + item.offsetHeight / 2;
  }, [activeIndex, pos]);

  return createPortal(
    <ul
      ref={ref}
      id={id}
      role="listbox"
      className="dd-list"
      data-popover
      style={pos ? { ...pos, position: 'fixed' } : { visibility: 'hidden', position: 'fixed' }}
      // Keep focus on the field while the user clicks or scrolls the list.
      onMouseDown={(e) => e.preventDefault()}
    >
      {options.map((o, i) => (
        <li
          key={o.value}
          id={`${id}-${i}`}
          role="option"
          aria-selected={o.value === selectedValue}
          className={`dd-item ${i === activeIndex ? 'active' : ''} ${o.value === selectedValue ? 'selected' : ''}`}
          onClick={() => onPick(o.value)}
        >
          {o.label}
        </li>
      ))}
    </ul>,
    document.body,
  );
}
