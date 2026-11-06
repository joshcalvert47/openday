import { useEffect, useRef } from 'react';
import Icon from '../icons.jsx';

export default function Snackbar({ text, action, onAction, onClose, closing }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (closing) return undefined;
    const id = setTimeout(() => close.current(), 6000);
    return () => clearTimeout(id);
  }, [text, closing]);
  return (
    <div className={`snackbar ${closing ? 'closing' : ''}`} role="status" inert={closing || undefined}>
      <span>{text}</span>
      {action && (
        <button
          className="snackbar-action"
          onClick={() => {
            onAction();
            onClose();
          }}
        >
          {action}
        </button>
      )}
      <button className="icon-btn sm snackbar-close" onClick={onClose} aria-label="Dismiss">
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
