import Icon from '../icons.jsx';
import Select from './Select.jsx';
import { REMINDER_PRESETS, MAX_REMINDERS } from '../notifications.js';
import * as T from '../time.js';

// The notification rows in the event form: "30 minutes before  ✕", "Add notification".
export default function ReminderList({ value, defaultReminder, onChange }) {
  const options = (current) =>
    [...new Set([...REMINDER_PRESETS, current])]
      .sort((a, b) => a - b)
      .map((m) => ({ value: m, label: T.formatReminder(m) }));

  const add = () => {
    const wanted = [defaultReminder, 30, 10, 60, 1440, ...REMINDER_PRESETS];
    const next = wanted.find((m) => m >= 0 && !value.includes(m));
    if (next !== undefined) onChange([...value, next]);
  };

  return (
    <div className="reminders">
      {value.map((m, i) => (
        <div key={i} className="reminder">
          <Select
            className="reminder-select"
            aria-label="Notification time"
            value={m}
            options={options(m)}
            onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))}
          />
          <button
            type="button"
            className="icon-btn sm"
            aria-label="Remove notification"
            title="Remove notification"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      ))}
      {value.length < MAX_REMINDERS && (
        <button type="button" className="text-btn add-reminder" onClick={add}>
          Add notification
        </button>
      )}
    </div>
  );
}
