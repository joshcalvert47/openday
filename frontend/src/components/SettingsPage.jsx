import { useMemo } from 'react';
import Icon from '../icons.jsx';
import Select from './Select.jsx';
import SearchSelect from './SearchSelect.jsx';
import { ThemeOptions } from './AppearanceDialog.jsx';
import * as T from '../time.js';

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];

function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export default function SettingsPage({ settings, onChange, onBack }) {
  const zoneOptions = useMemo(
    () => [
      { value: '', label: `Device time zone (${T.browserTimeZone()})` },
      ...T.allTimeZones().map((z) => ({ value: z, label: z.replace(/_/g, ' ') })),
    ],
    [],
  );
  const sample = T.makeDay(2026, 11, 31) + 13 * T.HOUR;

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
          <a href="#appearance" className="settings-nav-item">Appearance</a>
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
          </section>

          <section id="appearance">
            <h2>Appearance</h2>
            <h3>Theme</h3>
            <ThemeOptions theme={settings.theme} onChange={(theme) => onChange({ theme })} name="theme-settings" />
          </section>
        </div>
      </div>
    </div>
  );
}
