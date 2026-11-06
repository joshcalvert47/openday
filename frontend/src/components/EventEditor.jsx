import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../icons.jsx';
import Popover from './Popover.jsx';
import MiniMonth from './MiniMonth.jsx';
import ColorPicker from './ColorPicker.jsx';
import TimeInput from './TimeInput.jsx';
import * as T from '../time.js';

// Form to create or edit an event. Shown as a floating card next to the event,
// or docked as a panel on the right side of the calendar.
export default function EventEditor({
  draft, settings, tz, today, docked, sheet, anchor, onChange, onSave, onClose, onDelete, onToggleDock,
}) {
  const titleRef = useRef(null);
  const [picker, setPicker] = useState(false);
  const dateBtnRef = useRef(null);
  const isNew = !draft.id;

  // Close the date picker on a press outside it and its button.
  useEffect(() => {
    if (!picker) return;
    const outside = (e) => {
      if (e.target?.closest?.('.date-field, .date-picker')) return;
      setPicker(false);
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [picker]);

  useEffect(() => {
    titleRef.current?.focus();
  }, [draft.id, docked]);

  const ws = T.toWall(draft.start, tz);
  const we = T.toWall(draft.end, tz);
  const day = T.startOfDay(ws);
  const tf = settings.timeFormat;

  const setWall = (newWs, newWe) => onChange({ start: T.fromWall(newWs, tz), end: T.fromWall(newWe, tz) });

  const fmt = (t) => T.formatTime(t, tf, { compact: false });

  // Start time options: every 15 minutes of the day.
  const startOptions = [];
  for (let m = 0; m < 24 * 60; m += 15) startOptions.push(day + m * T.MINUTE);
  const startList = startOptions.map((t) => ({ value: t, label: fmt(t), text: fmt(t) }));

  // End time options: up to 24 hours after the start, with the duration shown.
  const endList = [];
  for (let m = 15; m <= 24 * 60; m += 15) {
    const t = ws + m * T.MINUTE;
    endList.push({ value: t, label: `${fmt(t)} (${T.formatDuration(m)})`, text: fmt(t) });
  }

  // Typed start time: on the same day. "3" in 12h format is 3am or 3pm,
  // whichever is closer to the current start.
  const resolveStart = (text, partial) => {
    const c = T.parseTime(text, tf, partial);
    if (!c) return null;
    const ts = c.map((m) => day + m * T.MINUTE);
    return ts.reduce((a, b) => (Math.abs(b - ws) < Math.abs(a - ws) ? b : a));
  };
  // Typed end time: the first such time after the start (can be the next day).
  const resolveEnd = (text, partial) => {
    const c = T.parseTime(text, tf, partial);
    if (!c) return null;
    const ts = c.map((m) => {
      let t = day + m * T.MINUTE;
      while (t <= ws) t += T.DAY;
      return t;
    });
    return Math.min(...ts);
  };

  const submit = (e) => {
    e.preventDefault();
    onSave();
  };

  const body = (
    <div className="editor-body">
      <input
        ref={titleRef}
        className="editor-title"
        placeholder="Add title"
        aria-label="Title"
        value={draft.title}
        maxLength={1000}
        onChange={(e) => onChange({ title: e.target.value })}
      />

      <div className="editor-row">
        <Icon name="schedule" className="row-icon" size={20} />
        <div className="editor-when">
          <div className="date-field">
            <button type="button" className="field-btn" ref={dateBtnRef} onClick={() => setPicker(!picker)} aria-label="Date">
              {T.weekdayName(ws)}, {T.formatDate(ws, settings.dateFormat)}
            </button>
            {picker && (
              <DatePicker anchorRef={dateBtnRef}>
                <MiniMonth
                  value={day}
                  today={today}
                  onPick={(d) => {
                    setPicker(false);
                    setWall(d + (ws - day), d + (we - day));
                  }}
                />
              </DatePicker>
            )}
          </div>
          <div className="time-fields">
            <TimeInput
              aria-label="Start time"
              value={ws}
              options={startList}
              resolve={resolveStart}
              format={fmt}
              onChange={(s) => setWall(s, s + (we - ws))}
            />
            <span>–</span>
            <TimeInput
              aria-label="End time"
              value={we}
              options={endList}
              resolve={resolveEnd}
              format={fmt}
              onChange={(e) => setWall(ws, e)}
            />
          </div>
        </div>
      </div>

      <div className="editor-row">
        <Icon name="notes" className="row-icon" size={20} />
        <textarea
          className="editor-desc"
          placeholder="Add description"
          aria-label="Description"
          rows={docked ? 6 : 3}
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>

      <div className="editor-row">
        <Icon name="palette" className="row-icon" size={20} />
        <ColorPicker value={draft.color} onChange={(color) => onChange({ color })} />
      </div>
    </div>
  );

  const closeButton = (
    <button type="button" className="icon-btn sm" onClick={onClose} aria-label="Close" title="Close">
      <Icon name="close" size={20} />
    </button>
  );
  const saveButton = (
    <button type="submit" className="filled-btn">
      Save
    </button>
  );

  // Phones: the form is a bottom sheet. Close (left) and Save (right) sit in
  // the top bar, so the on-screen keyboard never hides Save.
  if (sheet) {
    return (
      <Popover anchor={anchor} onClose={onClose} className="editor-popover" label={isNew ? 'New event' : 'Edit event'}>
        <form className="editor" onSubmit={submit}>
          <div className="editor-bar">
            {closeButton}
            <span className="spacer" />
            {saveButton}
          </div>
          {body}
          {onDelete && (
            <div className="editor-foot">
              <button type="button" className="text-btn danger" onClick={onDelete}>
                Delete
              </button>
            </div>
          )}
        </form>
      </Popover>
    );
  }

  const form = (
    <form className={`editor ${docked ? 'docked' : ''}`} onSubmit={submit}>
      <div className="editor-bar" data-drag-handle={docked ? undefined : true}>
        {onToggleDock && (
          <button
            type="button"
            className="icon-btn sm"
            onClick={onToggleDock}
            aria-label={docked ? 'Undock from side panel' : 'Dock to side panel'}
            title={docked ? 'Undock from side panel' : 'Dock to side panel'}
          >
            <Icon name={docked ? 'popOut' : 'dockLeft'} size={20} />
          </button>
        )}
        {docked && <span className="editor-bar-title">{isNew ? 'New event' : 'Edit event'}</span>}
        <span className="spacer" />
        {closeButton}
      </div>

      {body}

      <div className="editor-foot">
        {onDelete && (
          <button type="button" className="text-btn danger" onClick={onDelete}>
            Delete
          </button>
        )}
        <span className="spacer" />
        {saveButton}
      </div>
    </form>
  );

  if (docked) return form;
  return (
    <Popover anchor={anchor} onClose={onClose} className="editor-popover" label={isNew ? 'New event' : 'Edit event'}>
      {form}
    </Popover>
  );
}

// The open date picker. Like DropdownList, it is drawn in document.body so the
// scrolling form never cuts it off, and it follows the date button every frame
// (form dragged, docked, scrolled, window resized). It sits under the button,
// or above it when there is not enough room below.
const PICKER_W = 248;
const PICKER_H = 300;
function DatePicker({ anchorRef, children }) {
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    let last = '';
    let frame = 0;
    const update = () => {
      const a = anchorRef.current;
      if (a) {
        const r = a.getBoundingClientRect();
        const vv = window.visualViewport;
        const vh = vv ? vv.height + vv.offsetTop : window.innerHeight;
        const vw = window.innerWidth;
        const key = `${r.left},${r.top},${r.bottom},${vw},${vh}`;
        if (key !== last) {
          last = key;
          let top = r.bottom + 4;
          if (top + PICKER_H > vh - 8 && r.top - 4 - PICKER_H >= 8) top = r.top - 4 - PICKER_H;
          top = Math.max(8, Math.min(top, vh - 8 - PICKER_H));
          setPos({ top, left: Math.max(8, Math.min(r.left, vw - 8 - PICKER_W)) });
        }
      }
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [anchorRef]);

  return createPortal(
    <div className="date-picker" data-popover style={pos || { visibility: 'hidden' }}>
      {children}
    </div>,
    document.body,
  );
}
