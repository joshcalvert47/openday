import Icon from '../icons.jsx';
import { COLORS, DEFAULT_COLOR, textOn } from '../colors.js';

export default function ColorPicker({ value, onChange, size = 'md' }) {
  const current = value || DEFAULT_COLOR;
  return (
    <div className={`colors colors-${size}`} role="radiogroup" aria-label="Event color">
      {COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={current === c.value}
          aria-label={c.name}
          title={c.name}
          className="swatch"
          style={{ background: c.value, color: textOn(c.value) }}
          onClick={() => onChange(c.value)}
        >
          {current === c.value && <Icon name="check" size={14} />}
        </button>
      ))}
    </div>
  );
}
