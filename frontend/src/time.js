// Date and time helpers.
//
// Two kinds of numbers are used in the app:
//  - "instant": real moment in time, milliseconds since epoch (what the API stores).
//  - "wall":    clock time in the user's chosen time zone, stored as milliseconds
//               and read with the UTC getters (getUTCHours, ...). Wall values make
//               calendar math easy because they have no daylight saving jumps.

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export function allTimeZones() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [browserTimeZone(), 'UTC'];
  }
}

// ---- Time zone conversion ----

const formatters = new Map();
function formatterFor(tz) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    });
    formatters.set(tz, f);
  }
  return f;
}

// Offset of the time zone from UTC at the given instant, in ms.
function offsetAt(instant, tz) {
  const v = {};
  for (const p of formatterFor(tz).formatToParts(new Date(instant))) v[p.type] = p.value;
  const asUTC = Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour % 24, +v.minute, +v.second);
  return asUTC - (instant - (((instant % 1000) + 1000) % 1000));
}

export const toWall = (instant, tz) => instant + offsetAt(instant, tz);

export function fromWall(wall, tz) {
  const guess = wall - offsetAt(wall, tz);
  return wall - offsetAt(guess, tz);
}

// ---- Wall time math ----

export const startOfDay = (w) => w - (((w % DAY) + DAY) % DAY);
export const addDays = (w, n) => w + n * DAY;
export const dayOfWeek = (w) => new Date(w).getUTCDay();
export const startOfWeek = (w) => addDays(startOfDay(w), -dayOfWeek(w));
export const ymd = (w) => {
  const d = new Date(w);
  return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()];
};
export const makeDay = (y, m, d) => Date.UTC(y, m, d);
export const startOfMonth = (w) => {
  const [y, m] = ymd(w);
  return makeDay(y, m, 1);
};
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
export function addMonths(w, n) {
  const [y, m, d] = ymd(w);
  const target = new Date(Date.UTC(y, m + n, 1));
  const ty = target.getUTCFullYear();
  const tm = target.getUTCMonth();
  return makeDay(ty, tm, Math.min(d, daysInMonth(ty, tm))) + (w - startOfDay(w));
}
export const minutesOfDay = (w) => Math.round((w - startOfDay(w)) / MINUTE);
export const sameDay = (a, b) => startOfDay(a) === startOfDay(b);

// Days shown in a month grid: whole weeks covering the month (5 or 6 rows).
export function monthGridDays(w) {
  const first = startOfMonth(w);
  const [y, m] = ymd(first);
  const start = startOfWeek(first);
  const lastDay = makeDay(y, m, daysInMonth(y, m));
  const weeks = Math.ceil((lastDay - start) / DAY / 7 + 1 / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
}

// ---- Formatting (uses the user's settings) ----

const pad = (n) => String(n).padStart(2, '0');

export function formatTime(w, timeFormat, { compact = true } = {}) {
  const d = new Date(w);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  if (timeFormat === '24h') return `${pad(h)}:${pad(m)}`;
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  if (compact && m === 0) return `${h12}${suffix}`;
  return `${h12}:${pad(m)}${suffix}`;
}

// Hour label for the left side of the day/week grid.
export function formatHourLabel(hour, timeFormat) {
  if (timeFormat === '24h') return `${pad(hour)}:00`;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${hour < 12 ? 'AM' : 'PM'}`;
}

// "1 – 2pm", "11am – 1pm", "13:00 – 14:00"
export function formatTimeRange(ws, we, timeFormat) {
  if (timeFormat === '24h') return `${formatTime(ws, timeFormat)} – ${formatTime(we, timeFormat)}`;
  const sameHalf = new Date(ws).getUTCHours() < 12 === new Date(we).getUTCHours() < 12 && sameDay(ws, we);
  const start = formatTime(ws, timeFormat);
  return `${sameHalf ? start.replace(/am|pm/, '') : start} – ${formatTime(we, timeFormat)}`;
}

export function formatDate(w, dateFormat) {
  const [y, m, d] = ymd(w);
  if (dateFormat === 'DMY') return `${pad(d)}/${pad(m + 1)}/${y}`;
  if (dateFormat === 'YMD') return `${y}-${pad(m + 1)}-${pad(d)}`;
  return `${pad(m + 1)}/${pad(d)}/${y}`;
}

export const weekdayName = (w) => WEEKDAYS[dayOfWeek(w)];
export const weekdayShort = (w) => WEEKDAYS[dayOfWeek(w)].slice(0, 3);

export function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} mins`;
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1).replace(/\.0$/, '')} hr${h === 1 ? '' : 's'}`;
}
