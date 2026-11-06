import Icon from '../icons.jsx';
import MiniMonth from './MiniMonth.jsx';
import * as T from '../time.js';

export default function Sidebar({ cursor, today, onCreate, onPick, onOpenSettings }) {
  return (
    <aside className="sidebar">
      <button className="create-btn" onClick={onCreate}>
        <Icon name="add" size={28} className="create-plus" />
        <span>Create</span>
      </button>
      <MiniMonth value={T.startOfDay(cursor)} today={today} onPick={onPick} />
      {/* Phones only (the header has the settings button on bigger screens). */}
      <button className="sidebar-settings" onClick={onOpenSettings}>
        <Icon name="settings" size={22} />
        <span>Settings</span>
      </button>
    </aside>
  );
}
