import { useEffect, useRef, useState } from 'react';
import Icon from '../icons.jsx';
import Popover from './Popover.jsx';
import MiniMonth from './MiniMonth.jsx';
import ColorPicker from './ColorPicker.jsx';
import * as T from '../time.js';

// Form to create or edit an event. Shown as a floating card next to the event,
// or docked as a panel on the right side of the calendar.
export default function EventEditor({
  draft, settings, tz, today, docked, anchor, onChange, onSave, onClose, onDelete, onToggleDock,
}) {
  const titleRef = useRef(null);
  const [picker, setPicker] = useState(false);
  const isNew = !draft.id;

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

  const form = (
    <form className={`editor ${docked ? 'docked' : ''}`} onSubmit={submit}>
      <div className="editor-bar">
        <button
          type="button"
          className="icon-btn sm"
          onClick={onToggleDock}
          aria-label={docked ? 'Undock from side panel' : 'Dock to side panel'}
          title={docked ? 'Undock from side panel' : 'Dock to side panel'}
        >
          <Icon name={docked ? 'popOut' : 'dockLeft'} size={20} />
        </button>
        {docked && <span className="editor-bar-title">{isNew ? 'New event' : 'Edit event'}</span>}
        <span className="spacer" />
        <button type="button" className="icon-btn sm" onClick={onClose} aria-label="Close" title="Close">
          <Icon name="close" size={20} />
        </button>
      </div>

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
              <button type="button" className="field-btn" onClick={() => setPicker(!picker)} aria-label="Date">
                {T.weekdayName(ws)}, {T.formatDate(ws, settings.dateFormat)}
              </button>
              {picker && (
                <div className="date-picker" data-popover>
                  <MiniMonth
                    value={day}
                    today={today}
                    onPick={(d) => {
                      setPicker(false);
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

      <div className="editor-foot">
        {onDelete && (
          <button type="button" className="text-btn danger" onClick={onDelete}>
            Delete
          </button>
        )}
        <span className="spacer" />
        <button type="submit" className="filled-btn">
          Save
        </button>
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
