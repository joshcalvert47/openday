// Small wrapper around the Go JSON API.

async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// Events use instants in milliseconds in the app, and ISO strings on the wire.
const fromWire = (e) => ({
  ...e,
  start: Date.parse(e.start),
  end: Date.parse(e.end),
  reminders: e.reminders || [],
});
const toWire = (e) => ({
  calendarId: e.calendarId || 0,
  title: e.title,
  description: e.description,
  color: e.color,
  start: new Date(e.start).toISOString(),
  end: new Date(e.end).toISOString(),
  reminders: e.reminders || [],
});

export const api = {
  listEvents: async (start, end) => {
    const q = new URLSearchParams({
      start: new Date(start).toISOString().replace(/\.\d{3}Z$/, 'Z'),
      end: new Date(end).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    });
    return (await request('GET', `/api/events?${q}`)).map(fromWire);
  },
  createEvent: async (e) => fromWire(await request('POST', '/api/events', toWire(e))),
  updateEvent: async (e) => fromWire(await request('PUT', `/api/events/${e.id}`, toWire(e))),
  deleteEvent: (id) => request('DELETE', `/api/events/${id}`),
  listCalendars: () => request('GET', '/api/calendars'),
  createCalendar: (c) => request('POST', '/api/calendars', c),
  // Only the fields in `patch` are changed.
  updateCalendar: (id, patch) => request('PUT', `/api/calendars/${id}`, patch),
  deleteCalendar: (id) => request('DELETE', `/api/calendars/${id}`),
  getSettings: () => request('GET', '/api/settings'),
  updateSettings: (patch) => request('PUT', '/api/settings', patch),
};
