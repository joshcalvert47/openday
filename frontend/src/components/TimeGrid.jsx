import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as T from '../time.js';
import { colorOf, textOn } from '../colors.js';
import { PHONE } from '../useMedia.js';
import { motionOn } from '../motion.js';

// Day and week views: one column per day, 24 hour rows.

const HOUR_PX = 48;
const PX_PER_MIN = HOUR_PX / 60;
const SNAP = 15; // minutes for drag and resize
const CLICK_SNAP = 30; // minutes for a simple click
const LONG_PRESS_MS = 450; // touch: hold this long to drag an event or open its menu
const TOUCH_SLOP = 8; // touch: moving more than this (px) before the hold means "scroll"

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Place overlapping events in columns, like the classic calendar layout.
// Events that start at about the same time sit side by side; an event that
// starts later is drawn on top, partly covering the one before it.
function layoutDay(segs) {
  const sorted = [...segs].sort((a, b) => a.s - b.s || b.e - a.e);
  const out = [];
  let cluster = [];
  let columns = [];
  let clusterEnd = -1;

  const flush = () => {
    const n = columns.length;
    for (const it of cluster) {
      const free = (col) => columns[col].every((o) => o.ve <= it.s || o.s >= it.ve);
      let span = 1;
      while (it.col + span < n && free(it.col + span)) span++;
      it.left = it.col / n;
      it.width = span / n;
      const next = it.col + span;
      if (next < n) {
        const neighbours = columns[next].filter((o) => o.s < it.ve && o.ve > it.s);
        if (neighbours.every((o) => o.s >= it.s + 30)) {
          it.width = Math.min(1 - it.left, (span / n) * 1.7);
        }
      }
      out.push(it);
    }
    cluster = [];
    columns = [];
    clusterEnd = -1;
  };

  for (const seg of sorted) {
    if (cluster.length && seg.s >= clusterEnd) flush();
    let col = columns.findIndex((c) => c[c.length - 1].ve <= seg.s);
    if (col === -1) {
      col = columns.length;
      columns.push([]);
    }
    columns[col].push(seg);
    seg.col = col;
    cluster.push(seg);
    clusterEnd = Math.max(clusterEnd, seg.ve);
  }
  if (cluster.length) flush();
  return out;
}

export default function TimeGrid({
  days, events, settings, today, nowWall, tzLabel, tzName, extraZones = [], newEventColor,
  onSurfacePointerDown, onCreate, onEventClick, onEventContext, onEventTimeChange, onDayClick, onInteract,
}) {
  const scrollRef = useRef(null);
  const colsRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  const props = useRef(null);
  props.current = { days, onCreate, onEventClick, onEventContext, onEventTimeChange, onSurfacePointerDown, settings };
  const lastPointer = useRef('mouse');
  // After a finger tap opens a card, the browser sends a "ghost" click at the
  // same spot. The card may now be there, so we cancel that click.
  const eatGhostClick = useRef(false);

  // Scroll to a useful hour on first show.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const showsToday = days.includes(today);
    const minute = showsToday ? T.minutesOfDay(nowWall) - 120 : 7 * 60;
    el.scrollTop = Math.max(0, minute * PX_PER_MIN);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Pointer helpers ----
  const locate = (clientX, clientY) => {
    const r = colsRef.current.getBoundingClientRect();
    const n = props.current.days.length;
    const dayIdx = clamp(Math.floor(((clientX - r.left) / r.width) * n), 0, n - 1);
    const min = clamp((clientY - r.top) / PX_PER_MIN, 0, 24 * 60);
    return { dayIdx, min, rect: r };
  };

  const roundTo = (ms, minutes) => Math.round(ms / (minutes * T.MINUTE)) * minutes * T.MINUTE;

  const update = (d, e) => {
    const moved = d.moved || Math.abs(e.clientX - d.x) > 4 || Math.abs(e.clientY - d.y) > 4;
    const { dayIdx, min } = locate(e.clientX, e.clientY);
    const day = props.current.days[dayIdx];
    if (d.type === 'create') {
      return { ...d, moved, curMin: Math.floor(min / SNAP) * SNAP };
    }
    if (d.type === 'move') {
      const pointer = day + min * T.MINUTE;
      const ws = roundTo(pointer - d.grab, SNAP);
      return { ...d, moved, ws, we: ws + (d.ev.we - d.ev.ws) };
    }
    // resize: follow the pointer in the column where the drag started
    const pointer = props.current.days[d.dayIdx] + min * T.MINUTE;
    const we = Math.max(d.ev.ws + SNAP * T.MINUTE, roundTo(pointer, SNAP));
    return { ...d, moved, we };
  };

  const finish = (d, e) => {
    const p = props.current;
    if (d.touch) eatGhostClick.current = true;
    if (d.type === 'create') {
      // Touch: only a tap creates an event. Moving the finger means scrolling.
      if (d.touch && (d.moved || !p.onSurfacePointerDown())) return;
      const day = p.days[d.dayIdx];
      let ws;
      let we;
      if (!d.moved) {
        ws = day + Math.floor(d.rawMin / CLICK_SNAP) * CLICK_SNAP * T.MINUTE;
        we = ws + p.settings.defaultDuration * T.MINUTE;
      } else {
        ws = day + Math.min(d.startMin, d.curMin) * T.MINUTE;
        we = day + (Math.max(d.startMin, d.curMin) + SNAP) * T.MINUTE;
      }
      const r = colsRef.current.getBoundingClientRect();
      const colW = r.width / p.days.length;
      const anchor = {
        left: r.left + colW * d.dayIdx,
        right: r.left + colW * (d.dayIdx + 1),
        top: r.top + T.minutesOfDay(ws) * PX_PER_MIN,
      };
      p.onCreate(ws, we, anchor);
      // Phones: the form is a sheet at the bottom. Scroll so the new event
      // sits near the top, where the sheet does not cover it.
      if (window.matchMedia?.(PHONE).matches) {
        // Wait one frame so the sheet (and the extra scroll room) is on screen.
        requestAnimationFrame(() =>
          scrollRef.current?.scrollTo({ top: Math.max(0, T.minutesOfDay(ws) * PX_PER_MIN - 24), behavior: motionOn() ? 'smooth' : 'auto' }),
        );
      }
    } else if (!d.moved) {
      // Touch: a long press without moving opens the event menu.
      if (d.touch) p.onEventContext(d.ev, d.x, d.y);
      else p.onEventClick(d.ev, { left: d.rect.left, right: d.rect.right, top: d.rect.top });
    } else if (d.type === 'move') {
      if (d.ws !== d.ev.ws) p.onEventTimeChange(d.ev, d.ws, d.we);
    } else if (d.we !== d.ev.we) {
      p.onEventTimeChange(d.ev, d.ev.ws, d.we);
    }
  };

  const begin = (d) => {
    dragRef.current = d;
    setDrag(d);
    const move = (e) => {
      if (!dragRef.current) return;
      dragRef.current = update(dragRef.current, e);
      setDrag(dragRef.current);
    };
    // While dragging an event with a finger, stop the page from scrolling.
    const blockScroll = (e) => e.cancelable && e.preventDefault();
    if (d.touch && d.type !== 'create') window.addEventListener('touchmove', blockScroll, { passive: false });
    const up = (e) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('touchmove', blockScroll);
      const cur = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (cur && e.type === 'pointerup') finish(cur, e);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  useEffect(() => () => {
    dragRef.current = null;
  }, []);

  const onColsPointerDown = (e) => {
    lastPointer.current = e.pointerType;
    if (e.button !== 0 || e.target.closest('.ev')) return;
    const touch = e.pointerType === 'touch';
    // Touch decides on finger up (it may be a scroll). Mouse decides now.
    if (!touch) {
      if (!onSurfacePointerDown()) return;
      e.preventDefault();
    }
    const { dayIdx, min } = locate(e.clientX, e.clientY);
    const startMin = Math.floor(min / SNAP) * SNAP;
    begin({ type: 'create', touch, dayIdx, rawMin: min, startMin, curMin: startMin, moved: false, x: e.clientX, y: e.clientY });
  };

  const onEventPointerDown = (e, ev, dayIdx) => {
    lastPointer.current = e.pointerType;
    if (e.button !== 0) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const base = { ev, dayIdx, rect, moved: false, x: e.clientX, y: e.clientY, ws: ev.ws, we: ev.we };
    const isResize = !!e.target.closest('.ev-resize');
    const { min } = locate(e.clientX, e.clientY);
    const drag = isResize
      ? { ...base, type: 'resize' }
      : { ...base, type: 'move', grab: days[dayIdx] + min * T.MINUTE - ev.ws };

    if (e.pointerType !== 'touch') {
      e.preventDefault();
      if (!ev.isDraft) onInteract?.();
      begin(drag);
      return;
    }

    // Touch: a tap opens the event, a long press starts a drag (or opens the
    // menu if the finger does not move). Moving early means the user scrolls.
    const pointerId = e.pointerId;
    let timer = null;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', cleanup);
    };
    const onMove = (m) => {
      if (m.pointerId !== pointerId) return;
      if (Math.abs(m.clientX - base.x) > TOUCH_SLOP || Math.abs(m.clientY - base.y) > TOUCH_SLOP) cleanup();
    };
    const onUp = (u) => {
      if (u.pointerId !== pointerId) return;
      cleanup();
      eatGhostClick.current = true;
      if (!ev.isDraft) props.current.onEventClick(ev, { left: rect.left, right: rect.right, top: rect.top });
    };
    timer = setTimeout(() => {
      cleanup();
      if (!ev.isDraft) onInteract?.();
      navigator.vibrate?.(15);
      begin({ ...drag, touch: true });
    }, LONG_PRESS_MS);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', cleanup);
  };

  // ---- Build the event blocks for each day ----
  const shown = events.map((ev) =>
    drag && drag.moved && drag.type !== 'create' && drag.ev.id === ev.id
      ? { ...ev, ws: drag.ws, we: drag.we, dragging: true }
      : ev,
  );
  if (drag && drag.type === 'create' && drag.moved) {
    const day = days[drag.dayIdx];
    shown.push({
      id: 'preview',
      title: '',
      color: newEventColor,
      isDraft: true,
      ws: day + Math.min(drag.startMin, drag.curMin) * T.MINUTE,
      we: day + (Math.max(drag.startMin, drag.curMin) + SNAP) * T.MINUTE,
    });
  }

  const columns = days.map((day) => {
    const end = T.addDays(day, 1);
    const segs = [];
    for (const ev of shown) {
      if (ev.ws >= end || ev.we <= day) continue;
      if (ev.ws === ev.we && ev.ws !== day) continue;
      const s = (Math.max(ev.ws, day) - day) / T.MINUTE;
      const e = (Math.min(ev.we, end) - day) / T.MINUTE;
      segs.push({ ev, s, e, ve: Math.max(e, s + 20), endsHere: ev.we <= end });
    }
    return layoutDay(segs);
  });

  const nowMin = T.minutesOfDay(nowWall);
  const tf = settings.timeFormat;

  return (
    <div className="tg">
      <div className="tg-head">
        {extraZones.map((z) => (
          <div key={z.tz} className="tg-gutter-head extra" title={z.tz.replace(/_/g, ' ')}>
            <span className="tg-tz">{z.label}</span>
          </div>
        ))}
        <div className="tg-gutter-head" title={tzName?.replace(/_/g, ' ')}>
          <span className="tg-tz">{tzLabel}</span>
        </div>
        {days.map((d) => (
          <div key={d} className={`tg-day-head ${d === today ? 'today' : ''} ${d < today ? 'past' : ''}`}>
            <span className="tg-dow">{T.weekdayShort(d).toUpperCase()}</span>
            <button className="tg-date" onClick={() => onDayClick(d)} aria-label={`Open ${T.weekdayName(d)}`}>
              {T.ymd(d)[2]}
            </button>
          </div>
        ))}
      </div>

      <div
        className="tg-scroll"
        ref={scrollRef}
        onTouchEnd={(e) => {
          if (eatGhostClick.current && e.cancelable) e.preventDefault();
          eatGhostClick.current = false;
        }}
        onContextMenu={(e) => lastPointer.current === 'touch' && e.preventDefault()}>
        <div className="tg-body" style={{ height: 24 * HOUR_PX }}>
          {/* Other time zones: the time there at each hour line of the primary one. */}
          {extraZones.map((z) => (
            <div key={z.tz} className="tg-gutter extra" aria-hidden="true">
              {Array.from({ length: 23 }, (_, i) => (
                <span key={i} className="tg-hour" style={{ top: (i + 1) * HOUR_PX }}>
                  {T.formatMinuteLabel((i + 1) * 60 + z.shift, tf)}
                </span>
              ))}
            </div>
          ))}
          <div className="tg-gutter">
            {Array.from({ length: 23 }, (_, i) => (
              <span key={i} className="tg-hour" style={{ top: (i + 1) * HOUR_PX }}>
                {T.formatHourLabel(i + 1, tf)}
              </span>
            ))}
          </div>
          <div className="tg-cols" ref={colsRef} onPointerDown={onColsPointerDown} data-calendar-surface>
            {days.map((day, dayIdx) => (
              <div key={day} className="tg-col">
                <div className="tg-col-events">
                  {columns[dayIdx].map((seg) => {
                    const { ev } = seg;
                    const color = colorOf(ev);
                    const heightMin = seg.e - seg.s;
                    const short = heightMin < 45;
                    const zIndex = (ev.isDraft || ev.dragging ? 100 : 1) + seg.col;
                    return (
                      <div
                        key={`${ev.id}-${day}`}
                        className={`ev ${short ? 'ev-short' : ''} ${ev.isDraft ? 'ev-draft' : ''} ${
                          ev.dragging ? 'ev-dragging' : ''
                        } ${ev.we <= nowWall && !ev.isDraft ? 'ev-past' : ''}`}
                        style={{
                          top: seg.s * PX_PER_MIN,
                          height: Math.max(heightMin * PX_PER_MIN - 1, 14),
                          left: `${seg.left * 100}%`,
                          width: `calc(${seg.width * 100}% - 1px)`,
                          background: color,
                          color: textOn(color),
                          zIndex,
                        }}
                        onPointerDown={(e) => onEventPointerDown(e, ev, dayIdx)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          // Touch long press is handled in onEventPointerDown.
                          if (lastPointer.current === 'touch') return;
                          onEventContext(ev, e.clientX, e.clientY);
                        }}
                        title={`${ev.title || '(No title)'}\n${T.formatTimeRange(ev.ws, ev.we, tf)}`}
                      >
                        <div className="ev-title">
                          {ev.title || '(No title)'}
                          {short && <span className="ev-time-inline">, {T.formatTime(ev.ws, tf)}</span>}
                        </div>
                        {!short && <div className="ev-time">{T.formatTimeRange(ev.ws, ev.we, tf)}</div>}
                        {seg.endsHere && ev.id !== 'preview' && <div className="ev-resize" />}
                      </div>
                    );
                  })}
                </div>
                {day === today && (
                  <div className="tg-now" style={{ top: nowMin * PX_PER_MIN }}>
                    <span className="tg-now-dot" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
