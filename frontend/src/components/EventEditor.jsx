import { useEffect, useRef, useState } from 'react';
import Icon from '../icons.jsx';
import Popover from './Popover.jsx';
import MiniMonth from './MiniMonth.jsx';
import ColorPicker from './ColorPicker.jsx';
import * as T from '../time.js';

// Form to create or edit an event. Shown as a floating card next to the event,
// or docked as a panel on the right side of the calendar.
export default function EventEditor({
  draft, settings, tz, today, docked, sheet, anchor, onChange, onSave, onClose, onDelete, onToggleDock,
}) {
  const titleRef = useRef(null);
  const [picker, setPicker] = useState(null); // fixed position of the date picker, or null when closed
  const isNew = !draft.id;

  // The picker uses fixed positioning so the scrolling form does not crop it.
  // Close it when anything scrolls or the window resizes, so it never floats away from its button.
  useEffect(() => {
    if (!picker) return;
    const close = (e) => {
      if (e.target?.closest?.('.date-picker')) return;
      setPicker(null);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [picker]);

  useEffect(() => {
    titleRef.current?.focus();
  }, [draft.id, docked]);

  const ws = T.toWall(draft.start, tz);
  const we = T.toWall(draft.end, tz);
  const day = T.startOfDay(ws);
  const tf = settings.timeFormat;

  const setWall = (newWs, newWe) => onChange({ start: T.fromWall(newWs, tz), end: T.fromWall(newWe, tz) });

  // Start time options: every 15 minutes of the day.
  const startOptions = [];
  for (let m = 0; m < 24 * 60; m += 15) startOptions.push(day + m * T.MINUTE);
  if (!startOptions.includes(ws)) startOptions.push(ws);
  startOptions.sort((a, b) => a - b);

  // End time options: up to 24 hours after the start, with the duration shown.
  const endOptions = [];
  for (let m = 15; m <= 24 * 60; m += 15) endOptions.push(ws + m * T.MINUTE);
  if (!endOptions.includes(we)) endOptions.push(we);
  endOptions.sort((a, b) => a - b);

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
            <button type="button" className="field-btn" onClick={(e) => setPicker(picker ? null : pickerPos(e.currentTarget))} aria-label="Date">
              {T.weekdayName(ws)}, {T.formatDate(ws, settings.dateFormat)}
            </button>
            {picker && (
              <div className="date-picker" data-popover style={picker}>
                <MiniMonth
                  value={day}
                  today={today}
                  onPick={(d) => {
                    setPicker(null);
                    setWall(d + (ws - day), d + (we - day));
                  }}
                />
              </div>
            )}
          </div>
          <div className="time-fields">
            <select
              className="field-btn"
              aria-label="Start time"
              value={ws}
              onChange={(e) => {
                const s = Number(e.target.value);
                setWall(s, s + (we - ws));
              }}
            >
              {startOptions.map((t) => (
                <option key={t} value={t}>
                  {T.formatTime(t, tf, { compact: false })}
                </option>
              ))}
            </select>
            <span>–</span>
            <select
              className="field-btn"
              aria-label="End time"
              value={we}
              onChange={(e) => setWall(ws, Number(e.target.value))}
            >
              {endOptions.map((t) => (
                <option key={t} value={t}>
                  {T.formatTime(t, tf, { compact: false })} ({T.formatDuration(Math.round((t - ws) / T.MINUTE))})
                </option>
              ))}
            </select>
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

// Place the date picker below its button, or above it when there is no room below.
// Keep it inside the window.
const PICKER_W = 248;
const PICKER_H = 300;
function pickerPos(btn) {
  const r = btn.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = r.bottom + 4;
  if (top + PICKER_H > vh - 8 && r.top - 4 - PICKER_H >= 8) top = r.top - 4 - PICKER_H;
  top = Math.max(8, Math.min(top, vh - 8 - PICKER_H));
  const left = Math.max(8, Math.min(r.left, vw - 8 - PICKER_W));
  return { top, left };
}
