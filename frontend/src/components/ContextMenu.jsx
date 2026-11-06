import { useEffect, useLayoutEffect, useRef } from 'react';
import Icon from '../icons.jsx';
import ColorPicker from './ColorPicker.jsx';

// Right-click menu on an event: change color, edit or delete.
// `closing`: the menu plays its closing animation and ignores the user.
export default function ContextMenu({ event, x, y, closing, onClose, onColor, onEdit, onDelete }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const left = Math.min(x, window.innerWidth - el.offsetWidth - 8);
    const top = Math.min(y, window.innerHeight - el.offsetHeight - 8);
    el.style.left = `${Math.max(8, left)}px`;
    el.style.top = `${Math.max(8, top)}px`;
    // Grow out of the clicked point, even when the menu is moved to fit.
    el.style.transformOrigin = `${x - el.offsetLeft}px ${y - el.offsetTop}px`;
  }, [x, y]);

  useEffect(() => {
    if (closing) return undefined;
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
  }, [onClose, closing]);

  return (
    <div
      ref={ref}
      className={`ctx-menu ${closing ? 'closing' : ''}`}
      role="menu"
      aria-label="Event options"
      inert={closing || undefined}
      onContextMenu={(e) => e.preventDefault()}
    >
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
