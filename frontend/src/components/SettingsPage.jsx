import { useMemo } from 'react';
import Icon from '../icons.jsx';
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
  const zones = useMemo(() => T.allTimeZones(), []);
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
              <select value={settings.dateFormat} onChange={(e) => onChange({ dateFormat: e.target.value })}>
                {['MDY', 'DMY', 'YMD'].map((f) => (
                  <option key={f} value={f}>
                    {T.formatDate(sample, f)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Time format">
              <select value={settings.timeFormat} onChange={(e) => onChange({ timeFormat: e.target.value })}>
                <option value="12h">{T.formatTime(sample, '12h')}</option>
                <option value="24h">{T.formatTime(sample, '24h')}</option>
              </select>
            </Field>

            <h3>Time zone</h3>
            <Field label="Primary time zone">
              <select value={settings.timeZone} onChange={(e) => onChange({ timeZone: e.target.value })}>
                <option value="">Device time zone ({T.browserTimeZone()})</option>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </Field>

            <h3>Event settings</h3>
            <Field label="Default duration">
              <select
                value={settings.defaultDuration}
                onChange={(e) => onChange({ defaultDuration: Number(e.target.value) })}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d < 60 ? `${d} minutes` : T.formatDuration(d).replace('hr', 'hour')}
                  </option>
                ))}
              </select>
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
