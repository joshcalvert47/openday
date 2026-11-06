import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import * as T from './time.js';
import { DEFAULT_COLOR } from './colors.js';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import TimeGrid from './components/TimeGrid.jsx';
import MonthView from './components/MonthView.jsx';
import YearView from './components/YearView.jsx';
import EventEditor from './components/EventEditor.jsx';
import EventDetails from './components/EventDetails.jsx';
import ContextMenu from './components/ContextMenu.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import AppearanceDialog from './components/AppearanceDialog.jsx';
import Snackbar from './components/Snackbar.jsx';
import NotificationAlert from './components/NotificationAlert.jsx';
import { describeWhen } from './components/EventDetails.jsx';
import { useNotifications } from './notifications.js';
import { useMedia, NARROW, PHONE } from './useMedia.js';

const DEFAULT_SETTINGS = {
  dateFormat: 'MDY',
  timeFormat: '12h',
  timeZone: '',
  defaultDuration: 60,
  theme: 'system',
  notifications: 'desktop',
  snoozeBefore: 1,
  notificationSound: true,
  defaultReminder: 30,
};

const VIEWS = ['day', 'week', 'month', 'year'];

// Small per-browser preferences (current view, sidebar open).
function useLocalState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage not available: ignore */
    }
  }, [key, value]);
  return [value, setValue];
}

function useResolvedTheme(theme) {
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);
  return resolved;
}

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const tz = settings.timeZone || T.browserTimeZone();
  useResolvedTheme(settings.theme);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(id);
  }, []);
  const nowWall = T.toWall(now, tz);
  const today = T.startOfDay(nowWall);

  const [view, setViewRaw] = useLocalState('openday.view', 'week');
  const setView = (v) => VIEWS.includes(v) && setViewRaw(v);
  const [cursor, setCursor] = useState(() => T.startOfDay(T.toWall(Date.now(), T.browserTimeZone())));
  const narrow = useMedia(NARROW);
  const phone = useMedia(PHONE);
  // On wide screens the sidebar choice is remembered. On phones the sidebar
  // floats over the calendar, so it always starts closed.
  const [wideSidebar, setWideSidebar] = useLocalState('openday.sidebarOpen', true);
  const [phoneSidebar, setPhoneSidebar] = useState(false);
  const sidebarOpen = narrow ? phoneSidebar : wideSidebar;
  const setSidebarOpen = narrow ? setPhoneSidebar : setWideSidebar;
  useEffect(() => {
    if (!narrow) setPhoneSidebar(false);
  }, [narrow]);
  // The form always opens floating. The user can dock it; it undocks again when closed.
  const [dockedChoice, setDocked] = useState(false);
  // Phones have no docking: the form is a sheet stuck to the bottom.
  const docked = dockedChoice && !phone;
  const [page, setPage] = useState('calendar');

  const [events, setEvents] = useState([]);
  const [draft, setDraft] = useState(null); // event being created (no id) or edited
  const [editorAnchor, setEditorAnchor] = useState(null);
  const [details, setDetails] = useState(null); // { id, anchor }
  const [menu, setMenu] = useState(null); // { id, x, y }
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [snack, setSnack] = useState(null);

  const formOpen = draft !== null;
  useEffect(() => {
    if (!formOpen) setDocked(false);
  }, [formOpen]);

  const describe = (event) => describeWhen(event, tz, settings);
  const { alerts, dismissAlerts } = useNotifications({ settings, describe, changeKey: events });
  const alertBox = alerts.length > 0 && (
    <NotificationAlert alerts={alerts} describe={describe} onClose={dismissAlerts} />
  );

  const showError = useCallback((err) => setSnack({ text: err.message || String(err) }), []);

  // ---- Load settings ----
  useEffect(() => {
    api.getSettings().then((s) => setSettings({ ...DEFAULT_SETTINGS, ...s }), showError);
  }, [showError]);

  const updateSettings = async (patch) => {
    const before = settings;
    setSettings({ ...settings, ...patch });
    try {
      setSettings({ ...DEFAULT_SETTINGS, ...(await api.updateSettings(patch)) });
    } catch (err) {
      setSettings(before);
      showError(err);
    }
  };

  // When the time zone changes, keep showing the same calendar day.
  const prevTz = useRef(tz);
  useEffect(() => {
    if (prevTz.current !== tz) {
      prevTz.current = tz;
      setCursor(T.startOfDay(T.toWall(Date.now(), tz)));
    }
  }, [tz]);

  // ---- Visible range and events ----
  const range = useMemo(() => {
    const day = T.startOfDay(cursor);
    if (view === 'day') return [day, T.addDays(day, 1)];
    if (view === 'week') {
      const s = T.startOfWeek(cursor);
      return [s, T.addDays(s, 7)];
    }
    if (view === 'month') {
      const days = T.monthGridDays(cursor);
      return [days[0], T.addDays(days[days.length - 1], 1)];
    }
    return null;
  }, [view, cursor]);

  const rangeKey = range ? `${range[0]}-${range[1]}-${tz}` : 'none';
  useEffect(() => {
    if (!range) return undefined;
    let cancelled = false;
    api
      .listEvents(T.fromWall(range[0], tz), T.fromWall(range[1], tz))
      .then((list) => !cancelled && setEvents(list), (err) => !cancelled && showError(err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, showError]);

  // Events with wall times, with the draft shown in place of the saved event.
  const shownEvents = useMemo(() => {
    let list = events;
    if (draft) {
      list = draft.id
        ? events.map((e) => (e.id === draft.id ? { ...draft } : e))
        : [...events, { ...draft, id: 'draft' }];
    }
    return list.map((e) => ({
      ...e,
      isDraft: e.id === 'draft',
      ws: T.toWall(e.start, tz),
      we: T.toWall(e.end, tz),
    }));
  }, [events, draft, tz]);

  // ---- Navigation ----
  const go = (dir) => {
    if (view === 'day') setCursor((c) => T.addDays(c, dir));
    else if (view === 'week') setCursor((c) => T.addDays(c, 7 * dir));
    else if (view === 'month') setCursor((c) => T.addMonths(c, dir));
    else setCursor((c) => T.addMonths(c, 12 * dir));
  };
  const openDay = (day) => {
    setCursor(day);
    setView('day');
  };

  // ---- Popups ----
  const closePopups = () => {
    setDetails(null);
    setMenu(null);
  };

  // Called when the user presses on an empty part of the calendar.
  // Returns true if that press should start creating an event.
  const onSurfacePointerDown = () => {
    if (details || menu) {
      closePopups();
      return false;
    }
    if (draft && draft.id && !docked) {
      setDraft(null);
      return false;
    }
    return true;
  };

  // ---- Create / edit ----
  const startDraft = (wallStart, wallEnd, anchor) => {
    closePopups();
    const start = T.fromWall(wallStart, tz);
    const end = T.fromWall(wallEnd, tz);
    setDraft((d) =>
      d && !d.id
        ? { ...d, start, end }
        : {
            title: '',
            description: '',
            color: DEFAULT_COLOR,
            start,
            end,
            reminders: settings.defaultReminder >= 0 ? [settings.defaultReminder] : [],
          },
    );
    setEditorAnchor(anchor || null);
  };

  // Swipe left/right on the calendar to go to the next/previous period (phones).
  const swipe = useRef(null);
  const onTouchStart = (e) => {
    const t = e.touches[0];
    swipe.current =
      e.touches.length === 1 && !e.target.closest('.ev, .mv-ev, [data-popover]')
        ? { x: t.clientX, y: t.clientY, time: Date.now() }
        : null;
  };
  const onTouchEnd = (e) => {
    const s0 = swipe.current;
    swipe.current = null;
    if (!s0 || draft) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s0.x;
    const dy = t.clientY - s0.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy) && Date.now() - s0.time < 700) go(dx < 0 ? 1 : -1);
  };

  const openSettings = () => {
    setDraft(null);
    closePopups();
    setPhoneSidebar(false);
    setPage('settings');
  };

  const createFromButton = () => {
    if (narrow) setPhoneSidebar(false);
    const hour = new Date(nowWall).getUTCHours() + 1;
    const start = T.startOfDay(cursor) + Math.min(hour, 23) * T.HOUR;
    startDraft(start, start + settings.defaultDuration * T.MINUTE, null);
  };

  const editEvent = (id, anchor) => {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    closePopups();
    setDraft({ ...ev });
    setEditorAnchor(anchor || null);
  };

  const saveDraft = async () => {
    const d = draft;
    if (!d) return;
    setDraft(null);
    try {
      if (d.id) {
        const saved = await api.updateEvent(d);
        setEvents((list) => list.map((e) => (e.id === saved.id ? saved : e)));
      } else {
        const saved = await api.createEvent(d);
        setEvents((list) => [...list, saved]);
      }
      setSnack({ text: 'Event saved' });
    } catch (err) {
      setDraft(d);
      showError(err);
    }
  };

  const deleteEvent = async (id) => {
    const ev = events.find((e) => e.id === id);
    closePopups();
    if (draft && draft.id === id) setDraft(null);
    if (!ev) return;
    setEvents((list) => list.filter((e) => e.id !== id));
    try {
      await api.deleteEvent(id);
      setSnack({
        text: 'Event deleted',
        action: 'Undo',
        onAction: async () => {
          try {
            const restored = await api.createEvent(ev);
            setEvents((list) => [...list, restored]);
          } catch (err) {
            showError(err);
          }
        },
      });
    } catch (err) {
      setEvents((list) => [...list, ev]);
      showError(err);
    }
  };

  // Save a change to a saved event right away (drag, resize, color).
  const patchEvent = async (id, patch) => {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    const next = { ...ev, ...patch };
    setEvents((list) => list.map((e) => (e.id === id ? next : e)));
    if (draft && draft.id === id) setDraft((d) => ({ ...d, ...patch }));
    try {
      const saved = await api.updateEvent(next);
      setEvents((list) => list.map((e) => (e.id === id ? saved : e)));
    } catch (err) {
      setEvents((list) => list.map((e) => (e.id === id ? ev : e)));
      showError(err);
    }
  };

  const onEventTimeChange = (ev, wallStart, wallEnd) => {
    const patch = { start: T.fromWall(wallStart, tz), end: T.fromWall(wallEnd, tz) };
    if (ev.isDraft || (draft && draft.id === ev.id)) setDraft((d) => ({ ...d, ...patch }));
    else patchEvent(ev.id, patch);
  };

  const onEventClick = (ev, anchor) => {
    if (ev.isDraft) return;
    if (draft && !docked) setDraft(null);
    if (draft && docked && draft.id === ev.id) return;
    setMenu(null);
    setDetails({ id: ev.id, anchor });
  };

  const onEventContext = (ev, x, y) => {
    if (ev.isDraft) return;
    setDetails(null);
    setMenu({ id: ev.id, x, y });
  };

  // ---- Keyboard shortcuts (like the classic calendar ones) ----
  const keyHandler = useRef(null);
  keyHandler.current = (e) => {
    if (alerts.length) {
      if (e.key === 'Escape') dismissAlerts();
      return;
    }
    if (e.key === 'Escape') {
      if (menu || details) closePopups();
      else if (appearanceOpen) setAppearanceOpen(false);
      else if (draft) setDraft(null);
      return;
    }
    const tag = e.target.tagName;
    if (e.ctrlKey || e.metaKey || e.altKey || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (page !== 'calendar' || draft || appearanceOpen) return;
    const k = e.key.toLowerCase();
    if (k === 'd') setView('day');
    else if (k === 'w') setView('week');
    else if (k === 'm') setView('month');
    else if (k === 'y') setView('year');
    else if (k === 't') setCursor(today);
    else if (k === 'j' || k === 'n') go(1);
    else if (k === 'k' || k === 'p') go(-1);
    else if (k === 'c') createFromButton();
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    const onKey = (e) => keyHandler.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- Render ----
  if (page === 'settings') {
    return (
      <>
        <SettingsPage settings={settings} onChange={updateSettings} onBack={() => setPage('calendar')} />
        {snack && <Snackbar {...snack} onClose={() => setSnack(null)} />}
        {alertBox}
      </>
    );
  }

  const common = {
    settings,
    today,
    nowWall,
    events: shownEvents,
    onSurfacePointerDown,
    onEventClick,
    onEventContext,
    onDayClick: openDay,
  };

  let main;
  if (view === 'day' || view === 'week') {
    const first = view === 'day' ? T.startOfDay(cursor) : T.startOfWeek(cursor);
    const days = Array.from({ length: view === 'day' ? 1 : 7 }, (_, i) => T.addDays(first, i));
    main = (
      <TimeGrid
        {...common}
        key={view}
        days={days}
        tzLabel={gmtLabel(now, nowWall)}
        onCreate={startDraft}
        onEventTimeChange={onEventTimeChange}
        onInteract={closePopups}
      />
    );
  } else if (view === 'month') {
    main = (
      <MonthView
        {...common}
        cursor={cursor}
        onCreate={(day, anchor) => {
          const start = day + 9 * T.HOUR;
          startDraft(start, start + settings.defaultDuration * T.MINUTE, anchor);
        }}
      />
    );
  } else {
    main = <YearView cursor={cursor} today={today} onDayClick={openDay} />;
  }

  const detailsEvent = details && events.find((e) => e.id === details.id);
  const menuEvent = menu && events.find((e) => e.id === menu.id);
  const editor = draft && (
    <EventEditor
      draft={draft}
      settings={settings}
      tz={tz}
      today={today}
      docked={docked}
      anchor={editorAnchor}
      onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      onSave={saveDraft}
      onClose={() => setDraft(null)}
      onDelete={draft.id ? () => deleteEvent(draft.id) : null}
      sheet={phone}
      onToggleDock={phone ? null : () => setDocked(!docked)}
    />
  );

  return (
    <div className="app">
      <Header
        view={view}
        cursor={cursor}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onToday={() => setCursor(today)}
        onPrev={() => go(-1)}
        onNext={() => go(1)}
        onView={setView}
        onOpenSettings={openSettings}
        onOpenAppearance={() => setAppearanceOpen(true)}
      />
      <div className="app-body">
        {/* Docked form takes the sidebar's place on the left, like the classic calendar. */}
        {docked && editor ? (
          <aside className="dock">{editor}</aside>
        ) : (
          sidebarOpen && (
            <>
              {narrow && <div className="sidebar-backdrop" onClick={() => setPhoneSidebar(false)} />}
              <Sidebar
                cursor={cursor}
                today={today}
                onCreate={createFromButton}
                onOpenSettings={openSettings}
                onPick={(d) => {
                  setCursor(d);
                  if (narrow) setPhoneSidebar(false);
                }}
              />
            </>
          )
        )}
        <main className="main" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {main}
        </main>
      </div>

      {!docked && editor}
      {detailsEvent && (
        <EventDetails
          event={detailsEvent}
          tz={tz}
          settings={settings}
          anchor={details.anchor}
          onClose={() => setDetails(null)}
          onEdit={() => editEvent(detailsEvent.id, details.anchor)}
          onDelete={() => deleteEvent(detailsEvent.id)}
        />
      )}
      {menuEvent && (
        <ContextMenu
          event={menuEvent}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onColor={(color) => {
            setMenu(null);
            patchEvent(menuEvent.id, { color });
          }}
          onEdit={() => editEvent(menuEvent.id, { left: menu.x, right: menu.x, top: menu.y })}
          onDelete={() => deleteEvent(menuEvent.id)}
        />
      )}
      {appearanceOpen && (
        <AppearanceDialog
          theme={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
          onClose={() => setAppearanceOpen(false)}
        />
      )}
      {snack && <Snackbar {...snack} onClose={() => setSnack(null)} />}
      {alertBox}
    </div>
  );
}

// "GMT+04", "GMT-05:30", "GMT+00"
function gmtLabel(instant, wall) {
  const mins = Math.round((wall - instant) / T.MINUTE);
  const sign = mins < 0 ? '-' : '+';
  const abs = Math.abs(mins);
  const h = String(Math.floor(abs / 60)).padStart(2, '0');
  const m = abs % 60;
  return `GMT${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}
