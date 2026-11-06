// Service worker for event notifications.
// - Shows reminders pushed by the server (Web Push), even when no tab is open.
// - Gives notifications a "Snooze" button (browsers only allow buttons on
//   notifications shown by a service worker).
// The open tab also checks reminders (src/notifications.js) as a fallback.

const MINUTE = 60 * 1000;
const SNOOZE_LATER = 5 * MINUTE; // when the snooze time has already passed

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// ---- Text under the title: "Friday, 11/06/2026 · 1:00 – 2:00pm" ----
// A small copy of describeWhen (src/components/EventDetails.jsx). An empty
// time zone means this browser's own zone, like in the app.

function parts(ms, timeZone) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || undefined,
    weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: 'numeric', minute: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { weekday: p.weekday, y: p.year, m: p.month, d: p.day, h: Number(p.hour) % 24, min: p.minute };
}

function fmtDate(p, dateFormat) {
  if (dateFormat === 'DMY') return `${p.d}/${p.m}/${p.y}`;
  if (dateFormat === 'YMD') return `${p.y}-${p.m}-${p.d}`;
  return `${p.m}/${p.d}/${p.y}`;
}

function fmtTime(p, timeFormat) {
  if (timeFormat === '24h') return `${String(p.h).padStart(2, '0')}:${p.min}`;
  const h12 = p.h % 12 || 12;
  return `${h12}${p.min === '00' ? '' : `:${p.min}`}${p.h < 12 ? 'am' : 'pm'}`;
}

function describe(d) {
  const s = parts(d.event.start, d.timeZone);
  const e = parts(d.event.end, d.timeZone);
  const date = (p) => `${p.weekday}, ${fmtDate(p, d.dateFormat)}`;
  if (s.y === e.y && s.m === e.m && s.d === e.d) {
    return `${date(s)} · ${fmtTime(s, d.timeFormat)} – ${fmtTime(e, d.timeFormat)}`;
  }
  return `${date(s)}, ${fmtTime(s, d.timeFormat)} – ${date(e)}, ${fmtTime(e, d.timeFormat)}`;
}

// ---- Push from the server ----

self.addEventListener('push', (e) => {
  let d;
  try {
    d = e.data.json();
  } catch {
    return;
  }
  e.waitUntil(
    self.registration.showNotification(d.event.title || '(No title)', {
      body: describe(d),
      tag: d.key,
      icon: '/logo.svg',
      silent: !d.sound,
      data: { key: d.key, event: d.event, snoozeBefore: d.snoozeBefore },
      actions: [{ action: 'snooze', title: 'Snooze' }],
    }),
  );
});

// ---- Clicks ----

async function snooze(data) {
  const { key, event } = data;
  const now = Date.now();
  let at = event.start - (data.snoozeBefore ?? 1) * MINUTE;
  if (at <= now) at = now + SNOOZE_LATER;
  // Tell the server (works with no tab open) and the open tabs (works offline).
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of list) c.postMessage({ type: 'openday-snooze', data: { key, at, event } });
  try {
    await fetch('/api/push/snooze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, at, eventId: event.id, eventStart: event.start }),
    });
  } catch {
    /* offline: the open tab (if any) still has it */
  }
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  e.waitUntil(
    (async () => {
      if (e.action === 'snooze') {
        if (data.event) await snooze(data);
        return;
      }
      // Click on the notification itself: bring the calendar to the front.
      const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (list.length) await list[0].focus();
      else await self.clients.openWindow('/');
    })(),
  );
});
