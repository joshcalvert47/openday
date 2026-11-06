import { useLayoutEffect, useRef, useState } from 'react';
import * as T from '../time.js';
import { colorOf, textOn } from '../colors.js';

const ITEM_PX = 22;
const HEAD_PX = 30;

export default function MonthView({
  cursor, events, settings, today, onSurfacePointerDown, onCreate, onEventClick, onEventContext, onDayClick,
}) {
  const days = T.monthGridDays(cursor);
  const weeks = days.length / 7;
  const month = T.ymd(cursor)[1];
  const gridRef = useRef(null);
  const createOk = useRef(false);
  const [maxItems, setMaxItems] = useState(3);

  // How many events fit in a cell depends on the window height.
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return undefined;
    const measure = () => {
      const cellH = el.clientHeight / weeks;
      setMaxItems(Math.max(1, Math.floor((cellH - HEAD_PX - 4) / ITEM_PX)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [weeks]);

  const tf = settings.timeFormat;
  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top };
  };

  return (
    <div className="mv">
      <div className="mv-grid" ref={gridRef} style={{ gridTemplateRows: `repeat(${weeks}, 1fr)` }} data-calendar-surface>
        {days.map((day, i) => {
          const end = T.addDays(day, 1);
          const list = events
            .filter((ev) => ev.ws < end && (ev.we > day || (ev.ws === ev.we && ev.ws === day)))
            .sort((a, b) => a.ws - b.ws || b.we - a.we);
          const overflow = list.length > maxItems;
          const visible = overflow ? list.slice(0, maxItems - 1) : list;
          const [, m, d] = T.ymd(day);
          return (
            <div
              key={day}
              className={`mv-cell ${m !== month ? 'other' : ''}`}
              onPointerDown={(e) => {
                createOk.current = e.button === 0 && !e.target.closest('.mv-ev, .mv-date, .mv-more') && onSurfacePointerDown();
              }}
              onClick={(e) => {
                if (!createOk.current || e.target.closest('.mv-ev, .mv-date, .mv-more')) return;
                createOk.current = false;
                onCreate(day, rectOf(e.currentTarget));
              }}
            >
              <div className="mv-cell-head">
                {i < 7 && <span className="mv-dow">{T.weekdayShort(day).toUpperCase()}</span>}
                <button className={`mv-date ${day === today ? 'today' : ''}`} onClick={() => onDayClick(day)}>
                  {d === 1 ? `${T.MONTHS[m].slice(0, 3)} ${d}` : d}
                </button>
              </div>
              <div className="mv-events">
                {visible.map((ev) => {
                  const color = colorOf(ev);
                  return (
                    <button
                      key={ev.id}
                      className={`mv-ev ${ev.isDraft ? 'draft' : ''} ${ev.we <= today && !ev.isDraft ? 'past' : ''}`}
                      style={ev.isDraft ? { background: color, color: textOn(color) } : undefined}
                      onClick={(e) => onEventClick(ev, rectOf(e.currentTarget))}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        onEventContext(ev, e.clientX, e.clientY);
                      }}
                    >
                      {!ev.isDraft && <span className="mv-dot" style={{ background: color }} />}
                      <span className="mv-ev-time">{T.formatTime(Math.max(ev.ws, day), tf)}</span>
                      <span className="mv-ev-title">{ev.title || '(No title)'}</span>
                    </button>
                  );
                })}
                {overflow && (
                  <button className="mv-more" onClick={() => onDayClick(day)}>
                    {list.length - visible.length} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
