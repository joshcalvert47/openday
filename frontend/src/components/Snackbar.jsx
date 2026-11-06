import { useEffect, useRef } from 'react';
import Icon from '../icons.jsx';

export default function Snackbar({ text, action, onAction, onClose }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const id = setTimeout(() => close.current(), 6000);
    return () => clearTimeout(id);
  }, [text]);
  return (
    <div className="snackbar" role="status">
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
