import Icon from '../icons.jsx';
import Popover from './Popover.jsx';
import { colorOf } from '../colors.js';
import * as T from '../time.js';

export function describeWhen(event, tz, settings) {
  const ws = T.toWall(event.start, tz);
  const we = T.toWall(event.end, tz);
  const date = (w) => `${T.weekdayName(w)}, ${T.formatDate(w, settings.dateFormat)}`;
  if (T.sameDay(ws, we) || we === T.addDays(T.startOfDay(ws), 1)) {
    return `${date(ws)} · ${T.formatTimeRange(ws, we, settings.timeFormat)}`;
  }
  return `${date(ws)}, ${T.formatTime(ws, settings.timeFormat)} – ${date(we)}, ${T.formatTime(we, settings.timeFormat)}`;
}

export default function EventDetails({ event, tz, settings, anchor, onClose, onEdit, onDelete }) {
  return (
    <Popover anchor={anchor} onClose={onClose} className="details" label="Event details">
      <div className="details-bar">
        <button className="icon-btn sm" onClick={onEdit} aria-label="Edit event" title="Edit event">
          <Icon name="edit" size={20} />
        </button>
        <button className="icon-btn sm" onClick={onDelete} aria-label="Delete event" title="Delete event">
          <Icon name="delete" size={20} />
        </button>
        <button className="icon-btn sm" onClick={onClose} aria-label="Close" title="Close">
          <Icon name="close" size={20} />
        </button>
      </div>
      <div className="details-row">
        <span className="details-color" style={{ background: colorOf(event) }} />
        <div>
          <div className="details-title">{event.title || '(No title)'}</div>
          <div className="details-when">{describeWhen(event, tz, settings)}</div>
        </div>
      </div>
      {event.description && (
        <div className="details-row">
          <Icon name="notes" size={20} className="row-icon" />
          <div className="details-desc">{event.description}</div>
        </div>
      )}
    </Popover>
  );
}
