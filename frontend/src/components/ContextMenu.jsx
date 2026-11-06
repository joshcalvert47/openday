import { useEffect, useLayoutEffect, useRef } from 'react';
import Icon from '../icons.jsx';
import ColorPicker from './ColorPicker.jsx';

// Right-click menu on an event: change color, edit or delete.
export default function ContextMenu({ event, x, y, onClose, onColor, onEdit, onDelete }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const left = Math.min(x, window.innerWidth - el.offsetWidth - 8);
    const top = Math.min(y, window.innerHeight - el.offsetHeight - 8);
    el.style.left = `${Math.max(8, left)}px`;
    el.style.top = `${Math.max(8, top)}px`;
  }, [x, y]);

  useEffect(() => {
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    const onScroll = () => onClose();
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="ctx-menu" role="menu" aria-label="Event options" onContextMenu={(e) => e.preventDefault()}>
      <button role="menuitem" className="menu-item" onClick={onEdit}>
        <Icon name="edit" size={20} /> Edit
      </button>
      <button role="menuitem" className="menu-item" onClick={onDelete}>
        <Icon name="delete" size={20} /> Delete
      </button>
      <div className="menu-divider" />
      <div className="ctx-colors">
        <ColorPicker value={event.color} onChange={onColor} size="sm" />
      </div>
    </div>
  );
}
