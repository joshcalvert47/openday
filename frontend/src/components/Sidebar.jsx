import Icon from '../icons.jsx';
import MiniMonth from './MiniMonth.jsx';
import * as T from '../time.js';

export default function Sidebar({ cursor, today, onCreate, onPick }) {
  return (
    <aside className="sidebar">
      <button className="create-btn" onClick={onCreate}>
        <Icon name="add" size={28} className="create-plus" />
        <span>Create</span>
      </button>
      <MiniMonth value={T.startOfDay(cursor)} today={today} onPick={onPick} />
    </aside>
  );
}
