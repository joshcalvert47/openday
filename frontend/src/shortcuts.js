// The keyboard shortcuts, grouped like the classic calendar's help dialog.
// App.jsx handles the keys; ShortcutsDialog.jsx shows this list.
export const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    items: [
      { keys: ['T'], label: 'Go to today' },
      { keys: ['J', 'N'], label: 'Next period' },
      { keys: ['K', 'P'], label: 'Previous period' },
    ],
  },
  {
    title: 'Views',
    items: [
      { keys: ['D'], label: 'Day' },
      { keys: ['W'], label: 'Week' },
      { keys: ['M'], label: 'Month' },
      { keys: ['Y'], label: 'Year' },
    ],
  },
  {
    title: 'Actions',
    items: [
      { keys: ['C'], label: 'Create event' },
      { keys: ['Esc'], label: 'Close card, menu, dialog or form' },
    ],
  },
  {
    title: 'Application',
    items: [{ keys: ['?'], label: 'Show keyboard shortcuts' }],
  },
];

// "Next week (J)" when shortcuts are on, "Next week" when off.
export const withKey = (label, key, on) => (on ? `${label} (${key})` : label);
