import MiniMonth from './MiniMonth.jsx';
import * as T from '../time.js';

export default function YearView({ cursor, today, onDayClick }) {
  const year = T.ymd(cursor)[0];
  return (
    <div className="yv">
      <div className="yv-grid">
        {T.MONTHS.map((name, m) => (
          <MiniMonth key={name} month={T.makeDay(year, m, 1)} today={today} onPick={onDayClick} variant="year" />
        ))}
      </div>
    </div>
  );
}
