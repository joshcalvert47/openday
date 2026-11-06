// Event notifications (reminders), like the classic calendar:
// - Each event has reminders: minutes before its start.
// - The open calendar tab checks every few seconds which reminders are due,
//   and shows them as desktop notifications or as an alert in the page.
// - Desktop notifications have a "Snooze" button. A snoozed notification shows
//   again "snoozeBefore" minutes before the event.
// - Web Push: when desktop notifications are allowed, this browser subscribes
//   to the server's push. The server then sends due reminders itself, so they
//   show even when no tab is open (backend/push.go, public/sw.js).
//   The tab is the fallback: it waits PUSH_GRACE after a reminder is due, asks
//   the server if it was pushed, and shows it itself if not (no internet on the
//   server, plain HTTP, browser without push...).

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
const PUSH_GRACE = 45 * 1000; // the server checks every 15 seconds

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

// ---- Web Push ----

let pushActive = false; // this browser is subscribed to the server's push
let pushTried = false; // ensurePush finished at least once (until then, wait)

function keyBytes(base64url) {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function sameBytes(a, b) {
  if (!a || !b) return false;
  const x = new Uint8Array(a);
  return x.length === b.length && x.every((v, i) => v === b[i]);
}

// Subscribe this browser to push and tell the server. Safe to call often.
let pushing = null;
export function ensurePush() {
  if (pushing) return pushing;
  pushing = (async () => {
    if (notificationPermission() !== 'granted') return false;
    const reg = await registerServiceWorker();
    if (!reg?.pushManager) return false;
    const key = keyBytes(await api.pushKey());
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameBytes(sub.options?.applicationServerKey, key)) {
      // The server has new keys (e.g. a new database): subscribe again.
      await sub.unsubscribe();
      sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await api.savePushSubscription(sub.toJSON());
    return true;
  })().then(
    (ok) => {
      pushActive = ok;
      pushTried = true;
      pushing = null;
      return ok;
    },
    () => {
      pushActive = false;
      pushTried = true;
      pushing = null;
      return false;
    },
  );
  return pushing;
}

// Resolves to the service worker registration, or null if there is none
// (then notifications have no Snooze button).
let swReady = null;
function registerServiceWorker() {
  if (swReady) return swReady;
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    swReady = Promise.resolve(null);
  } else {
    swReady = navigator.serviceWorker
      .register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .catch(() => null);
  }
  return swReady;
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
    data: { key: item.key, event, snoozeBefore: item.snoozeBefore },
  };
  const reg = await registerServiceWorker();
  if (reg) {
    await reg.showNotification(title, {
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
  const asking = useRef(new Set()); // keys we are asking the server about
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

  // With push, the server shows desktop notifications. The tab only steps in
  // when the server did not push one shortly after it was due.
  const showUnlessPushed = (item, now) => {
    if (now - item.at < PUSH_GRACE || asking.current.has(item.key) || shownHere.current.has(item.key)) return;
    asking.current.add(item.key);
    api.pushSent(item.key).then(
      (sent) => {
        asking.current.delete(item.key);
        if (sent) shownHere.current.add(item.key);
        else if (claim(item.key)) show(item);
      },
      () => {
        asking.current.delete(item.key);
        if (claim(item.key)) show(item); // server not reachable: show it here
      },
    );
  };

  const tick = () => {
    const s = latest.current.settings;
    if (s.notifications === 'off') return;
    const now = Date.now();
    const due = [];
    const snoozeBefore = s.snoozeBefore;
    for (const e of upcoming.current) {
      for (const m of e.reminders || []) {
        const at = e.start - m * T.MINUTE;
        if (at <= now && now - at < LATE_LIMIT && now < e.end) {
          due.push({ key: `${e.id}:${e.start}:${m}`, at, event: slim(e), snoozeBefore });
        }
      }
    }
    const snoozed = readStore(SNOOZED_KEY, []);
    // Keep due snoozes a little longer, while the tab waits for the server's push.
    const keep = snoozed.filter((x) => now - x.at < LATE_LIMIT && now < x.event.end);
    for (const x of keep) {
      if (x.at <= now) due.push({ key: `${x.key}:snooze:${x.at}`, at: x.at, event: x.event, snoozeBefore });
    }
    if (keep.length !== snoozed.length) writeStore(SNOOZED_KEY, keep);
    const desktop = s.notifications === 'desktop' && notificationPermission() === 'granted';
    // Push setup still running: wait, so the tab and the server don't both show it.
    if (desktop && !pushTried) {
      ensurePush();
      return;
    }
    const viaPush = desktop && pushActive;
    for (const item of due) {
      if (viaPush) showUnlessPushed(item, now);
      else if (claim(item.key)) show(item);
    }
  };
  const tickRef = useRef(tick);
  tickRef.current = tick;

  const snooze = useCallback((data) => {
    if (!data?.event) return;
    const { event, key } = data;
    const now = Date.now();
    let at = data.at; // set by the service worker, so the server uses the same time
    if (!at) {
      at = event.start - latest.current.settings.snoozeBefore * T.MINUTE;
      if (at <= now) at = now + SNOOZE_LATER;
    }
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
    if (settings.notifications === 'desktop') ensurePush();
    const id = setInterval(() => {
      load();
      if (latest.current.settings.notifications === 'desktop' && !pushActive) ensurePush();
    }, REFETCH_EVERY);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [off, changeKey, settings.notifications]);

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
