import { useEffect, useRef, useState } from 'react';
import ColorPicker from './ColorPicker.jsx';
import SearchSelect from './SearchSelect.jsx';
import { unusedColor } from '../colors.js';
import { useExit } from '../motion.js';
import { useMedia, TOUCH } from '../useMedia.js';

// Settings pages for calendars: "Create new calendar" and the settings of one
// calendar (name, description, time zone, color, delete).
// `zoneOptions`: time zones for SearchSelect ('' = same as the primary time zone).

// New calendars start with the primary time zone and a color no other calendar uses.
export function CreateCalendar({ calendars, defaultTimeZone, zoneOptions, autoFocus, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [timeZone, setTimeZone] = useState(defaultTimeZone);
  const [color, setColor] = useState(() => unusedColor(calendars));
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);
  const touch = useMedia(TOUCH);

  useEffect(() => {
    if (autoFocus && !touch) nameRef.current?.focus({ preventScroll: true });
  }, [autoFocus]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const created = await onCreate({ name: name.trim(), description, timeZone, color });
    setBusy(false);
    if (created) {
      setName('');
      setDescription('');
    }
  };

  return (
    <form onSubmit={submit}>
      <label className="field">
        <span className="field-label">Name</span>
        <input
          ref={nameRef}
          className="text-field"
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">Description</span>
        <textarea
          className="text-field"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">Time zone</span>
        <SearchSelect value={timeZone} onChange={setTimeZone} options={zoneOptions} />
      </label>
      <div className="field">
        <span className="field-label">Color</span>
        <ColorPicker value={color} onChange={setColor} label="Calendar color" />
      </div>
      <button type="submit" className="filled-btn" disabled={!name.trim() || busy}>
        Create calendar
      </button>
    </form>
  );
}

// Changes are saved when a field loses focus (Enter in the name too), and
// right away for the time zone and color.
export function CalendarSettings({ calendar, zoneOptions, onUpdate, onDelete }) {
  const [name, setName] = useState(calendar.name);
  const [description, setDescription] = useState(calendar.description);
  const [confirm, setConfirm] = useState(false);
  const confirmExit = useExit(confirm);

  // Follow changes made elsewhere (e.g. the color from the sidebar menu).
  useEffect(() => setName(calendar.name), [calendar.name]);
  useEffect(() => setDescription(calendar.description), [calendar.description]);

  const saveName = () => {
    const v = name.trim();
    if (!v) setName(calendar.name); // a calendar needs a name: put the old one back
    else if (v !== calendar.name) onUpdate({ name: v });
  };
  const saveDescription = () => {
    if (description !== calendar.description) onUpdate({ description });
  };

  return (
    <>
      <section id="calendar-settings">
        <h2 className="cal-heading">
          <span className="cal-dot" style={{ background: calendar.color }} />
          <span className="cal-name">Calendar settings</span>
        </h2>
        <label className="field">
          <span className="field-label">Name</span>
          <input
            className="text-field"
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </label>
        <label className="field">
          <span className="field-label">Description</span>
          <textarea
            className="text-field"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
          />
        </label>
        <label className="field">
          <span className="field-label">Time zone</span>
          <SearchSelect value={calendar.timeZone || ''} onChange={(timeZone) => onUpdate({ timeZone })} options={zoneOptions} />
        </label>
        <div className="field">
          <span className="field-label">Color</span>
          <ColorPicker value={calendar.color} onChange={(color) => onUpdate({ color })} label="Calendar color" />
        </div>
      </section>

      <section id="remove-calendar">
        <h2>Remove calendar</h2>
        {calendar.primary ? (
          <p className="settings-note">
            This is your primary calendar. New events go here unless you pick another calendar. It cannot be deleted.
          </p>
        ) : (
          <>
            <p className="settings-note">Deleting this calendar also deletes all of its events. This cannot be undone.</p>
            <button type="button" className="outline-btn danger" onClick={() => setConfirm(true)}>
              Delete
            </button>
          </>
        )}
      </section>

      {confirmExit.shown && (
        <ConfirmDialog
          key={`confirm-${confirmExit.key}`}
          title="Delete calendar?"
          text={`All events in "${calendar.name}" will be deleted. This cannot be undone.`}
          action="Delete"
          closing={confirmExit.phase === 'exit'}
          onCancel={() => setConfirm(false)}
          onConfirm={async () => {
            setConfirm(false);
            await onDelete();
          }}
        />
      )}
    </>
  );
}

function ConfirmDialog({ title, text, action, closing, onCancel, onConfirm }) {
  const cancelRef = useRef(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div
      className={`modal-backdrop ${closing ? 'closing' : ''}`}
      inert={closing || undefined}
      onPointerDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="modal" role="alertdialog" aria-label={title}>
        <h2>{title}</h2>
        <p className="modal-text">{text}</p>
        <div className="modal-foot">
          <button ref={cancelRef} type="button" className="text-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="text-btn danger" onClick={onConfirm}>
            {action}
          </button>
        </div>
      </div>
    </div>
  );
}
