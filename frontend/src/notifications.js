// Event notifications (reminders), like the classic calendar:
// - Each event has reminders: minutes before its start.
// - The open calendar tab checks every few seconds which reminders are due,
//   and shows them as desktop notifications or as an alert in the page.
// - Desktop notifications have a "Snooze" button. A snoozed notification shows
//   again "snoozeBefore" minutes before the event.
// Nothing is sent by the server, so notifications only show while a tab is open.

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import * as T from './time.js';

// Choices offered in the event form and in settings (minutes before the event).
export const REMINDER_PRESETS = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080];
export const MAX_REMINDERS = 5; // same limit as the backend

const SHOWN_KEY = 'openday.notified'; // { key: shownAt } (shared by all tabs)
const SNOOZED_KEY = 'openday.snoozed'; // [{ key, at, event }]
const TICK = 10 * 1000;
const REFETCH_EVERY = 5 * T.MINUTE;
const FETCH_AHEAD = 29 * T.DAY; // longest reminder is 4 weeks
const LATE_LIMIT = 10 * T.MINUTE; // don't show reminders that are older than this (tab was closed, computer asleep)
const SNOOZE_LATER = 5 * T.MINUTE; // when the snooze time has already passed

function readStore(key, initial) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? initial : JSON.parse(raw);
  } catch {
    return initial;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage not available: ignore */
  }
}

// ---- Browser permission ----

// "unsupported", "default", "granted" or "denied".
export function notificationPermission() {
  if (typeof Notification === 'undefined' || !window.isSecureContext) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (notificationPermission() === 'unsupported') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

let swRegistration = null;
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register('/sw.js').then(
    (reg) => {
      swRegistration = reg;
    },
    () => {
      /* no service worker: notifications have no Snooze button */
    },
  );
}

// ---- Sound ----

let audio = null;
function audioContext() {
  if (!audio) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audio = new Ctx();
  }
  if (audio.state === 'suspended') audio.resume().catch(() => {});
  return audio;
}

// A short two-note chime, made in code (no sound file to ship).
export function playChime() {
  const ctx = audioContext();
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.05;
  [
    [880, 0],
    [1318.5, 0.18],
  ].forEach(([freq, delay]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + delay);
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.7);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + delay);
    osc.stop(t0 + delay + 0.75);
  });
}

// ---- Showing ----

async function showDesktop(item, body) {
  const { event } = item;
  const title = event.title || '(No title)';
  const options = {
    body,
    tag: item.key,
    icon: '/logo.svg',
    silent: true, // the page plays its own sound (if turned on)
    data: { key: item.key, event },
  };
  if (swRegistration) {
    await swRegistration.showNotification(title, {
      ...options,
      actions: [{ action: 'snooze', title: 'Snooze' }],
    });
    return;
  }
  const n = new Notification(title, options);
  n.onclick = () => {
    window.focus();
    n.close();
  };
}

// The minimal event data kept for a notification (it is stored and sent to the service worker).
const slim = (e) => ({ id: e.id, title: e.title, start: e.start, end: e.end });

// Keeps track of due reminders and shows them.
// describe(event) gives the text under the title ("Friday, 11/6/2026 · 10 – 11am").
// changeKey: anything that changes when events are saved, so the list is loaded again.
export function useNotifications({ settings, describe, changeKey }) {
  const off = settings.notifications === 'off';
  const [alerts, setAlerts] = useState([]); // in-page alerts: [{ key, event }]
  const upcoming = useRef([]);
  const shownHere = useRef(new Set());
  const latest = useRef(null);
  latest.current = { settings, describe };

  // Show each reminder once, also when several tabs are open.
  const claim = (key) => {
    if (shownHere.current.has(key)) return false;
    shownHere.current.add(key);
    const now = Date.now();
    const shown = readStore(SHOWN_KEY, {});
    if (shown[key]) return false;
    for (const k of Object.keys(shown)) if (now - shown[k] > 2 * T.DAY) delete shown[k];
    shown[key] = now;
    writeStore(SHOWN_KEY, shown);
    return true;
  };

  const show = (item) => {
    const { settings: s, describe: d } = latest.current;
    if (s.notificationSound) playChime();
    const toAlert = () => setAlerts((list) => [...list, item]);
    if (s.notifications === 'desktop' && notificationPermission() === 'granted') {
      // If the browser refuses, the user still sees the alert in the page.
      showDesktop(item, d(item.event)).catch(toAlert);
    } else {
      // "Alerts", or desktop notifications that the browser does not allow.
      toAlert();
    }
  };

  const tick = () => {
    if (latest.current.settings.notifications === 'off') return;
    const now = Date.now();
    const due = [];
    for (const e of upcoming.current) {
      for (const m of e.reminders || []) {
        const at = e.start - m * T.MINUTE;
        if (at <= now && now - at < LATE_LIMIT && now < e.end) {
          due.push({ key: `${e.id}:${e.start}:${m}`, event: slim(e) });
        }
      }
    }
    const snoozed = readStore(SNOOZED_KEY, []);
    const waiting = snoozed.filter((s) => s.at > now);
    for (const s of snoozed) {
      if (s.at <= now && now < s.event.end) due.push({ key: `${s.key}:snooze:${s.at}`, event: s.event });
    }
    if (waiting.length !== snoozed.length) writeStore(SNOOZED_KEY, waiting);
    for (const item of due) if (claim(item.key)) show(item);
  };
  const tickRef = useRef(tick);
  tickRef.current = tick;

  const snooze = useCallback((data) => {
    if (!data?.event) return;
    const { event, key } = data;
    const now = Date.now();
    let at = event.start - latest.current.settings.snoozeBefore * T.MINUTE;
    if (at <= now) at = now + SNOOZE_LATER;
    const list = readStore(SNOOZED_KEY, []).filter((s) => s.key !== key);
    list.push({ key, at, event });
    writeStore(SNOOZED_KEY, list);
  }, []);

  // Service worker (for the Snooze button) and unlocking sound on the first click.
  useEffect(() => {
    registerServiceWorker();
    const onMessage = (e) => e.data?.type === 'openday-snooze' && snooze(e.data.data);
    navigator.serviceWorker?.addEventListener('message', onMessage);
    const unlock = () => {
      if (latest.current.settings.notificationSound) audioContext();
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', onMessage);
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
  }, [snooze]);

  // Load the events that can have a reminder soon.
  useEffect(() => {
    if (off) return undefined;
    let cancelled = false;
    const load = () => {
      const now = Date.now();
      api.listEvents(now - T.HOUR, now + FETCH_AHEAD).then(
        (list) => {
          if (cancelled) return;
          upcoming.current = list;
          tickRef.current();
        },
        () => {
          /* offline: keep the last list */
        },
      );
    };
    load();
    const id = setInterval(load, REFETCH_EVERY);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [off, changeKey]);

  useEffect(() => {
    if (off) return undefined;
    const id = setInterval(() => tickRef.current(), TICK);
    return () => clearInterval(id);
  }, [off]);

  // Show the reminder in the tab title too, so it is seen in a background tab.
  useEffect(() => {
    const base = 'OpenDay';
    document.title = alerts.length ? `🔔 ${alerts[0].event.title || '(No title)'} – ${base}` : base;
  }, [alerts]);

  const dismissAlerts = useCallback(() => setAlerts([]), []);
  return { alerts, dismissAlerts };
}
