import { useEffect, useMemo, useState } from 'react';
import Icon from '../icons.jsx';
import Select from './Select.jsx';
import SearchSelect from './SearchSelect.jsx';
import { ThemeOptions } from './AppearanceDialog.jsx';
import { CreateCalendar, CalendarSettings } from './CalendarSettings.jsx';
import * as T from '../time.js';
import { deviceReducesMotion } from '../motion.js';
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

// `focus`: id of a section to scroll to when the page opens ("create-calendar", "calendar-3").
export default function SettingsPage({
  settings, onChange, onBack, focus, calendars, onCreateCalendar, onUpdateCalendar, onDeleteCalendar,
}) {
  const zoneOptions = useMemo(
    () => [
      { value: '', label: `Device time zone (${T.browserTimeZone()})` },
      ...T.allTimeZones().map((z) => ({ value: z, label: z.replace(/_/g, ' ') })),
    ],
    [],
  );
  const sample = T.makeDay(2026, 11, 31) + 13 * T.HOUR;
  const [permission, setPermission] = useState(notificationPermission);
  const askPermission = async () => setPermission(await requestNotificationPermission());

  // Scroll to a section: when the page opens, and to a calendar just created.
  const [scrollTo, setScrollTo] = useState(focus);
  useEffect(() => {
    if (!scrollTo) return;
    document.getElementById(scrollTo)?.scrollIntoView({ block: 'start' });
    setScrollTo(null);
  }, [scrollTo]);
  const createCalendar = async (fields) => {
    const created = await onCreateCalendar(fields);
    if (created) setScrollTo(`calendar-${created.id}`);
    return created;
  };

  return (
    <div className="settings">
      <header className="header">
        <div className="header-left">
          <button className="icon-btn" onClick={onBack} aria-label="Back to calendar" title="Back to calendar">
            <Icon name="arrowBack" />
          </button>
          <span className="brand">Settings</span>
        </div>
      </header>
      <div className="settings-body">
        <nav className="settings-nav">
          <a href="#general" className="settings-nav-item">General</a>
          <a href="#notifications" className="settings-nav-item">Notification settings</a>
          <a href="#appearance" className="settings-nav-item">Appearance</a>
          <div className="settings-nav-head">Add calendar</div>
          <a href="#create-calendar" className="settings-nav-item">Create new calendar</a>
          <div className="settings-nav-head">Settings for my calendars</div>
          {calendars.map((c) => (
            <a key={c.id} href={`#calendar-${c.id}`} className="settings-nav-item cal-nav-item" title={c.name}>
              <span className="cal-dot" style={{ background: c.color }} />
              <span className="cal-name">{c.name}</span>
            </a>
          ))}
        </nav>
        <div className="settings-content">
          <section id="general">
            <h2>General</h2>

            <h3>Date and time format</h3>
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

            <h3>Time zone</h3>
            <Field label="Primary time zone">
              <SearchSelect value={settings.timeZone} onChange={(timeZone) => onChange({ timeZone })} options={zoneOptions} />
            </Field>

            <h3>Event settings</h3>
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

          <section id="create-calendar">
            <h2>Create new calendar</h2>
            <CreateCalendar calendars={calendars} autoFocus={focus === 'create-calendar'} onCreate={createCalendar} />
          </section>

          {calendars.map((c) => (
            <section key={c.id} id={`calendar-${c.id}`}>
              <h2 className="cal-heading">
                <span className="cal-dot" style={{ background: c.color }} />
                <span className="cal-name">{c.name}</span>
              </h2>
              <CalendarSettings
                calendar={c}
                onUpdate={(patch) => onUpdateCalendar(c.id, patch)}
                onDelete={() => onDeleteCalendar(c.id)}
              />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
