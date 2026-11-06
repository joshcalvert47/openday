import { useEffect, useState } from 'react';

// True while the CSS media query matches. Breakpoints match styles.css.
export const NARROW = '(max-width: 900px)'; // tablets and phones
export const PHONE = '(max-width: 600px)'; // phones

export function useMedia(query) {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    setMatches(mq.matches);
    const onChange = (e) => setMatches(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
