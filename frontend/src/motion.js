import { useEffect, useRef, useState } from 'react';

// Animations. They are CSS only (styles.css). This file keeps closing
// elements on the page until their closing animation has played.

// Longest closing animation in styles.css.
export const EXIT_MS = 200;

const REDUCED = '(prefers-reduced-motion: reduce)';

// True when animations play: the "Animations" setting is on and the device
// does not ask for reduced motion.
export function motionOn() {
  if (document.documentElement.dataset.motion === 'off') return false;
  return !(window.matchMedia?.(REDUCED).matches ?? false);
}

export function deviceReducesMotion() {
  return window.matchMedia?.(REDUCED).matches ?? false;
}

// Keeps something on the page for a short time after it closes, so it can
// play a closing animation.
//
// `value` is what to show (an object or `true`), or a falsy value when closed.
// Returns { shown, phase, key }:
// - shown: `value` while open, the last open value while closing, else null.
// - phase: 'enter' (opened after the first render), 'open' (open since the
//   first render, so no opening animation), or 'exit' (closing).
// - key: changes each time it opens. Use it as a React key, so a quick
//   reopen starts fresh instead of reusing the closing element. Add a
//   prefix ("details-3"), so sibling elements never share a key.
export function useExit(value, ms = EXIT_MS) {
  const open = Boolean(value);
  const last = useRef(value);
  if (open) last.current = value;

  const [state, setState] = useState({ open, phase: open ? 'open' : 'closed', key: 0 });
  let current = state;
  if (open !== state.open) {
    // Opened or closed since the last render. Update the state now
    // (React renders again right away), so nothing unmounts in between.
    if (open) current = { open, phase: 'enter', key: state.key + 1 };
    else current = { open, phase: motionOn() ? 'exit' : 'closed', key: state.key };
    setState(current);
  }

  const exiting = current.phase === 'exit';
  useEffect(() => {
    if (!exiting) return undefined;
    const id = setTimeout(() => setState((s) => (s.phase === 'exit' ? { ...s, phase: 'closed' } : s)), ms);
    return () => clearTimeout(id);
  }, [exiting, ms]);

  if (current.phase === 'closed') return { shown: null, phase: 'closed', key: current.key };
  return { shown: open ? value : last.current, phase: current.phase, key: current.key };
}
