// Event colors. Similar to the classic calendar palette.
export const COLORS = [
  { name: 'Red', value: '#d50000' },
  { name: 'Pink', value: '#e67c73' },
  { name: 'Orange', value: '#f4511e' },
  { name: 'Yellow', value: '#f6bf26' },
  { name: 'Light green', value: '#33b679' },
  { name: 'Green', value: '#0b8043' },
  { name: 'Blue', value: '#039be5' },
  { name: 'Indigo', value: '#3f51b5' },
  { name: 'Lavender', value: '#7986cb' },
  { name: 'Purple', value: '#8e24aa' },
  { name: 'Gray', value: '#616161' },
];

export const DEFAULT_COLOR = '#039be5';

export const colorOf = (e) => e.color || DEFAULT_COLOR;

// Pick dark or light text so it is readable on the event color.
export function textOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 186 ? '#1f1f1f' : '#ffffff';
}
