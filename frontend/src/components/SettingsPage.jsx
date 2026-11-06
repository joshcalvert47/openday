import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../icons.jsx';
import Select from './Select.jsx';
import SearchSelect from './SearchSelect.jsx';
import { ThemeOptions } from './AppearanceDialog.jsx';
import { CreateCalendar, CalendarSettings } from './CalendarSettings.jsx';
import * as T from '../time.js';
import { deviceReducesMotion } from '../motion.js';
import { useMedia, NARROW } from '../useMedia.js';
import { REMINDER_PRESETS, notificationPermission, requestNotificationPermission, playChime } from '../notifications.js';

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];
const SNOOZE_OPTIONS = [0, 1, 5, 10, 15, 30];

const NOTIFY_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'desktop', label: 'Desktop notifications' },
  { value: 'alerts', label: 'Alerts' },
];

// Explains why desktop notifications cannot show, and offers to allow them.
function PermissionNote({ permission, onAllow }) {
  if (permission === 'granted') return null;
  if (permission === 'default') {
    return (
      <p className="settings-note">
        Your browser needs your permission to show notifications.{' '}
        <button type="button" className="text-btn inline" onClick={onAllow}>
          Allow notifications
        </button>
      </p>
    );
  }
  return (
    <p className="settings-note">
      {permission === 'denied'
        ? 'Notifications are blocked for this site in your browser settings.'
        : 'This browser cannot show desktop notifications here (it needs HTTPS or localhost).'}{' '}
      Reminders are shown as alerts in the page instead.
    </p>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

// One group of the left menu ("General", "Add calendar", ...), like the
// classic calendar: a header that opens or closes it, and its items.
function NavGroup({ title, active, open, onToggle, onTitle, children }) {
  return (
    <div className="settings-nav-group">
      <div className={`settings-nav-head ${active ? 'active' : ''}`}>
        <button type="button" className="settings-nav-title" onClick={onTitle ?? onToggle}>
          {title}
        </button>
        <button
          type="button"
          className="icon-btn sm"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? `Close ${title}` : `Open ${title}`}
        >
          <Icon name={open ? 'expandLess' : 'expandMore'} size={20} />
        </button>
      </div>
      {open && <div className="settings-nav-sub">{children}</div>}
    </div>
  );
}

function NavItem({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      className={`settings-nav-item ${active ? 'active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}

// The settings are split into pages, like the classic calendar:
// - "general": date and time, time zone, events, notifications, appearance,
//   keyboard shortcuts (one scrolling page; the menu jumps to each part).
// - "create-calendar": the form to add a calendar.
// - "calendar-<id>": the settings of one calendar.
// On tablets and phones the menu is a page of its own; the back arrow returns to it.
// `focus`: the page to open first ("create-calendar", "calendar-3"), or null.
export default function SettingsPage({
  settings, onChange, onBack, focus, calendars, onCreateCalendar, onUpdateCalendar, onDeleteCalendar,
  showShortcuts, onViewShortcuts,
}) {
  const narrow = useMedia(NARROW);
  const primaryZone = settings.timeZone || T.browserTimeZone();
  const allZones = useMemo(() => T.allTimeZones().map((z) => ({ value: z, label: z.replace(/_/g, ' ') })), []);
  const zoneOptions = useMemo(
    () => [{ value: '', label: `Device time zone (${T.browserTimeZone()})` }, ...allZones],
    [allZones],
  );
  const calendarZoneOptions = useMemo(
    () => [{ value: '', label: `Same as primary time zone (${primaryZone.replace(/_/g, ' ')})` }, ...allZones],
    [allZones, primaryZone],
  );
  const sample = T.makeDay(2026, 11, 31) + 13 * T.HOUR;
  const [permission, setPermission] = useState(notificationPermission);
  const askPermission = async () => setPermission(await requestNotificationPermission());

  const [page, setPage] = useState(focus || 'general');
  // Tablets and phones: show the menu instead of a page.
  const [menuShown, setMenuShown] = useState(!focus);
  const [groups, setGroups] = useState({ general: true, add: true, mine: true });
  const toggleGroup = (g) => setGroups((s) => ({ ...s, [g]: !s[g] }));

  // A deleted calendar's page falls back to the general page.
  const calendarId = page.startsWith('calendar-') ? Number(page.slice('calendar-'.length)) : null;
  const calendar = calendarId !== null ? calendars.find((c) => c.id === calendarId) : null;
  const shown = calendarId !== null && !calendar ? 'general' : page;

  const sections = [
    { id: 'date-time', title: 'Date and time format' },
    { id: 'time-zone', title: 'Time zone' },
    { id: 'event-settings', title: 'Event settings' },
    { id: 'notifications', title: 'Notification settings' },
    { id: 'appearance', title: 'Appearance' },
    ...(showShortcuts ? [{ id: 'shortcuts', title: 'Keyboard shortcuts' }] : []),
  ];

  // Open a page. `section`: a part of the general page to scroll to.
  const contentRef = useRef(null);
  const [scrollTarget, setScrollTarget] = useState(null);
  const go = (next, section = null) => {
    pinned.current = section;
    if (section) setCurrent(section);
    setPage(next);
    setMenuShown(false);
    setScrollTarget(section || 'top');
  };
  useEffect(() => {
    const el = contentRef.current;
    if (!scrollTarget || !el) return;
    if (scrollTarget === 'top') el.scrollTop = 0;
    else document.getElementById(scrollTarget)?.scrollIntoView({ block: 'start' });
    setScrollTarget(null);
  }, [scrollTarget, shown, menuShown]);

  // On the general page, the menu marks the part that is scrolled into view.
  // A part picked in the menu stays marked until the user scrolls by hand
  // (it may be too short to reach the top of the page).
  const [current, setCurrent] = useState(sections[0].id);
  const pinned = useRef(null);
  const unpin = () => {
    pinned.current = null;
  };
  const onScroll = () => {
    const el = contentRef.current;
    if (!el || shown !== 'general' || pinned.current) return;
    const top = el.getBoundingClientRect().top + 24;
    let id = sections[0].id;
    for (const s of sections) {
      const sec = document.getElementById(s.id);
      if (sec && sec.getBoundingClientRect().top <= top) id = s.id;
    }
    // At the very bottom, the last part counts (it may be too short to reach the top).
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) id = sections[sections.length - 1].id;
    setCurrent(id);
  };

  const createCalendar = async (fields) => {
    const created = await onCreateCalendar(fields);
    if (created) go(`calendar-${created.id}`);
    return created;
  };

  const inPage = narrow && !menuShown;
  const back = inPage ? () => setMenuShown(true) : onBack;
  const pageTitle =
    shown === 'general' ? 'General' : shown === 'create-calendar' ? 'Create new calendar' : calendar?.name;

  const nav = (
    <nav className="settings-nav" aria-label="Settings">
      <NavGroup
        title="General"
        active={!narrow && shown === 'general'}
        open={groups.general}
        onToggle={() => toggleGroup('general')}
        onTitle={() => go('general')}
      >
        {sections.map((s) => (
          <NavItem key={s.id} active={!narrow && shown === 'general' && current === s.id} onClick={() => go('general', s.id)}>
            {s.title}
          </NavItem>
        ))}
      </NavGroup>
      <NavGroup title="Add calendar" open={groups.add} onToggle={() => toggleGroup('add')}>
        <NavItem active={!narrow && shown === 'create-calendar'} onClick={() => go('create-calendar')}>
          Create new calendar
        </NavItem>
      </NavGroup>
      <NavGroup title="Settings for my calendars" open={groups.mine} onToggle={() => toggleGroup('mine')}>
        {calendars.map((c) => (
          <NavItem key={c.id} active={!narrow && shown === `calendar-${c.id}`} onClick={() => go(`calendar-${c.id}`)} title={c.name}>
            <span className="cal-dot" style={{ background: c.color }} />
            <span className="cal-name">{c.name}</span>
          </NavItem>
        ))}
      </NavGroup>
    </nav>
  );

  let content;
  if (shown === 'create-calendar') {
    content = (
      <section id="create-calendar">
        <h2>Create new calendar</h2>
        <CreateCalendar
          calendars={calendars}
          defaultTimeZone={primaryZone}
          zoneOptions={calendarZoneOptions}
          autoFocus
          onCreate={createCalendar}
        />
      </section>
    );
  } else if (calendar) {
    content = (
      <CalendarSettings
        key={calendar.id}
        calendar={calendar}
        zoneOptions={calendarZoneOptions}
        onUpdate={(patch) => onUpdateCalendar(calendar.id, patch)}
        onDelete={() => onDeleteCalendar(calendar.id)}
      />
    );
  } else {
    content = (
      <>
        <section id="date-time">
          <h2>Date and time format</h2>
          <Field label="Date format">
            <Select
              value={settings.dateFormat}
              onChange={(dateFormat) => onChange({ dateFormat })}
              options={['MDY', 'DMY', 'YMD'].map((f) => ({ value: f, label: T.formatDate(sample, f) }))}
            />
          </Field>
          <Field label="Time format">
            <Select
              value={settings.timeFormat}
              onChange={(timeFormat) => onChange({ timeFormat })}
              options={['12h', '24h'].map((f) => ({ value: f, label: T.formatTime(sample, f) }))}
            />
          </Field>
        </section>

        <section id="time-zone">
          <h2>Time zone</h2>
          <Field label="Primary time zone">
            <SearchSelect value={settings.timeZone} onChange={(timeZone) => onChange({ timeZone })} options={zoneOptions} />
          </Field>
        </section>

        <section id="event-settings">
          <h2>Event settings</h2>
          <Field label="Default duration">
            <Select
              value={settings.defaultDuration}
              onChange={(defaultDuration) => onChange({ defaultDuration })}
              options={DURATIONS.map((d) => ({
                value: d,
                label: d < 60 ? `${d} minutes` : T.formatDuration(d).replace('hr', 'hour'),
              }))}
            />
          </Field>
          <Field label="Default notification">
            <Select
              value={settings.defaultReminder}
              onChange={(defaultReminder) => onChange({ defaultReminder })}
              options={[
                { value: -1, label: 'No notification' },
                ...REMINDER_PRESETS.map((m) => ({ value: m, label: T.formatReminder(m) })),
              ]}
            />
          </Field>
        </section>

        <section id="notifications">
          <h2>Notification settings</h2>
          <Field label="Notifications">
            <Select
              value={settings.notifications}
              onChange={(notifications) => {
                onChange({ notifications });
                if (notifications === 'desktop' && permission === 'default') askPermission();
              }}
              options={NOTIFY_OPTIONS}
            />
          </Field>
          {settings.notifications === 'desktop' && <PermissionNote permission={permission} onAllow={askPermission} />}
          <Field label="Show snoozed notifications">
            <Select
              value={settings.snoozeBefore}
              onChange={(snoozeBefore) => onChange({ snoozeBefore })}
              options={SNOOZE_OPTIONS.map((m) => ({
                value: m,
                label: m === 0 ? 'At time of event' : `${m} minute${m === 1 ? '' : 's'} before event`,
              }))}
            />
          </Field>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.notificationSound}
              onChange={(e) => {
                onChange({ notificationSound: e.target.checked });
                if (e.target.checked) playChime();
              }}
            />
            <span>Play notification sounds</span>
          </label>
        </section>

        <section id="appearance">
          <h2>Appearance</h2>
          <h3>Theme</h3>
          <ThemeOptions theme={settings.theme} onChange={(theme) => onChange({ theme })} name="theme-settings" />

          <h3>Motion</h3>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.animations}
              onChange={(e) => onChange({ animations: e.target.checked })}
            />
            <span>Show animations</span>
          </label>
          {settings.animations && deviceReducesMotion() && (
            <p className="settings-note">Your device is set to reduce motion, so animations are not shown.</p>
          )}
        </section>

        {showShortcuts && (
          <section id="shortcuts">
            <h2>Keyboard shortcuts</h2>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={settings.keyboardShortcuts}
                onChange={(e) => onChange({ keyboardShortcuts: e.target.checked })}
              />
              <span>Enable keyboard shortcuts</span>
            </label>
            <p className="settings-note">
              {settings.keyboardShortcuts ? (
                <>Press <kbd>?</kbd> in the calendar to see the list of shortcuts.</>
              ) : (
                'Single-key shortcuts like D, W and C are off. Esc still closes things.'
              )}{' '}
              <button type="button" className="text-btn inline" onClick={onViewShortcuts}>
                View shortcuts
              </button>
            </p>
          </section>
        )}
      </>
    );
  }

  return (
    <div className="settings">
      <header className="header">
        <div className="header-left">
          <button
            className="icon-btn"
            onClick={back}
            aria-label={inPage ? 'Back to settings' : 'Back to calendar'}
            title={inPage ? 'Back to settings' : 'Back to calendar'}
          >
            <Icon name="arrowBack" />
          </button>
          <span className="brand">{inPage ? pageTitle : 'Settings'}</span>
        </div>
      </header>
      <div className={`settings-body ${narrow && menuShown ? 'show-menu' : ''}`}>
        {nav}
        <div
          className="settings-content"
          ref={contentRef}
          onScroll={onScroll}
          onWheel={unpin}
          onTouchStart={unpin}
          onKeyDown={unpin}
          onPointerDown={unpin}
        >
          {content}
        </div>
      </div>
    </div>
  );
}
