import Icon from '../icons.jsx';
import TimeInput from './TimeInput.jsx';
import { REMINDER_PRESETS, MAX_REMINDERS } from '../notifications.js';
import * as T from '../time.js';

// The notification rows in the event form: "30 minutes before  ✕", "Add notification".
// Like the event times: pick from the list, or type any time ("45", "90 min",
// "2 hours", "3 days", "1 week"; up to 4 weeks). See parseReminder in time.js.
export default function ReminderList({ value, defaultReminder, onChange }) {
  const options = (current) =>
    [...new Set([...REMINDER_PRESETS, current])]
      .sort((a, b) => a - b)
      .map((m) => ({ value: m, label: T.formatReminder(m), text: T.formatReminder(m) }));

  const add = () => {
    const wanted = [defaultReminder, 30, 10, 60, 1440, ...REMINDER_PRESETS];
    const next = wanted.find((m) => m >= 0 && !value.includes(m));
    if (next !== undefined) onChange([...value, next]);
  };

  return (
    <div className="reminders">
      {value.map((m, i) => (
        <div key={i} className="reminder">
          <TimeInput
            className="field-btn time-input reminder-input"
            aria-label="Notification time"
            value={m}
            options={options(m)}
            resolve={T.parseReminder}
            format={T.formatReminder}
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
