import Icon from '../icons.jsx';
import MiniMonth from './MiniMonth.jsx';
import * as T from '../time.js';
import { withKey } from '../shortcuts.js';

// `phase` comes from useExit (motion.js): 'enter' and 'exit' play the
// opening and closing animations.
export default function Sidebar({ cursor, today, phase, onCreate, onPick, onOpenSettings, shortcuts }) {
  const closing = phase === 'exit';
  return (
    <aside className={`sidebar ${phase === 'enter' ? 'entering' : ''} ${closing ? 'closing' : ''}`} inert={closing || undefined}>
      <button className="create-btn" onClick={onCreate} title={withKey('Create', 'C', shortcuts)}>
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
