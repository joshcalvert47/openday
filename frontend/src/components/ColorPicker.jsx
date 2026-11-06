import Icon from '../icons.jsx';
import { COLORS, DEFAULT_COLOR, textOn } from '../colors.js';

// Color swatches. For an event, pass its `calendar`: the first swatch is then
// "Calendar color" (value ''), so the event follows its calendar's color.
export default function ColorPicker({ value, onChange, calendar, size = 'md', label = 'Event color' }) {
  const choices = calendar
    ? [{ name: `Calendar color (${calendar.name})`, value: '', show: calendar.color }, ...COLORS]
    : COLORS;
  const current = calendar ? value || '' : value || DEFAULT_COLOR;
  return (
    <div className={`colors colors-${size}`} role="radiogroup" aria-label={label}>
      {choices.map((c) => {
        const bg = c.show || c.value;
        return (
          <button
            key={c.value || 'calendar'}
            type="button"
            role="radio"
            aria-checked={current === c.value}
            aria-label={c.name}
            title={c.name}
            className={`swatch ${c.value === '' ? 'swatch-calendar' : ''}`}
            style={{ background: bg, color: textOn(bg) }}
            onClick={() => onChange(c.value)}
          >
            {current === c.value && <Icon name="check" size={14} />}
          </button>
        );
      })}
    </div>
  );
}
