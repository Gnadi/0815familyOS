// Starting points for a new tracker. Picking one only pre-fills the form —
// every field stays editable, so the presets are a shortcut, never a schema.
//
// `nameKey` resolves against tracker.preset* in the locale dictionaries.
export const TRACKER_PRESETS = [
  {
    id: 'medicine',
    nameKey: 'tracker.presetMedicine',
    emoji: '💊',
    color: 'rose',
    unit: 'ml',
    trackValue: true,
    dailyGoal: null,
    minIntervalHours: 6,
  },
  {
    id: 'vitamin',
    nameKey: 'tracker.presetVitamin',
    emoji: '☀️',
    color: 'amber',
    unit: '',
    trackValue: false,
    dailyGoal: 1,
    minIntervalHours: null,
  },
  {
    id: 'vomiting',
    nameKey: 'tracker.presetVomiting',
    emoji: '🤢',
    color: 'emerald',
    unit: '',
    trackValue: false,
    dailyGoal: null,
    minIntervalHours: null,
  },
  {
    id: 'fever',
    nameKey: 'tracker.presetFever',
    emoji: '🌡️',
    color: 'rose',
    unit: '°C',
    trackValue: true,
    dailyGoal: null,
    minIntervalHours: null,
  },
  {
    id: 'diaper',
    nameKey: 'tracker.presetDiaper',
    emoji: '🧷',
    color: 'sky',
    unit: '',
    trackValue: false,
    dailyGoal: null,
    minIntervalHours: null,
  },
  {
    id: 'drink',
    nameKey: 'tracker.presetDrink',
    emoji: '🥤',
    color: 'sky',
    unit: 'ml',
    trackValue: true,
    dailyGoal: null,
    minIntervalHours: null,
  },
  {
    id: 'teeth',
    nameKey: 'tracker.presetTeeth',
    emoji: '🪥',
    color: 'brand',
    unit: '',
    trackValue: false,
    dailyGoal: 2,
    minIntervalHours: null,
  },
  {
    id: 'custom',
    nameKey: 'tracker.presetCustom',
    emoji: '⭐',
    color: 'violet',
    unit: '',
    trackValue: false,
    dailyGoal: null,
    minIntervalHours: null,
  },
];

// Emoji offered by the icon picker in the tracker form. Free text is allowed
// too — this is just a one-tap shortlist of what families actually track.
export const TRACKER_EMOJIS = [
  '💊', '☀️', '🤢', '🌡️', '🧷', '🥤', '🪥', '😴',
  '🍼', '💤', '🚽', '🩹', '💉', '🧴', '🏃', '⭐',
];

// Tailwind class sets per color. Written out in full because Tailwind's
// scanner only sees literal class names — never build these by interpolation.
export const TRACKER_COLORS = {
  brand:   { bubble: 'bg-brand-100 text-brand-600',     button: 'bg-brand-500 hover:bg-brand-600',     soft: 'bg-brand-50 text-brand-700',     dot: 'bg-brand-500' },
  rose:    { bubble: 'bg-rose-100 text-rose-600',       button: 'bg-rose-500 hover:bg-rose-600',       soft: 'bg-rose-50 text-rose-700',       dot: 'bg-rose-500' },
  amber:   { bubble: 'bg-amber-100 text-amber-600',     button: 'bg-amber-500 hover:bg-amber-600',     soft: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-500' },
  emerald: { bubble: 'bg-emerald-100 text-emerald-600', button: 'bg-emerald-500 hover:bg-emerald-600', soft: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  sky:     { bubble: 'bg-sky-100 text-sky-600',         button: 'bg-sky-500 hover:bg-sky-600',         soft: 'bg-sky-50 text-sky-700',         dot: 'bg-sky-500' },
  violet:  { bubble: 'bg-violet-100 text-violet-600',   button: 'bg-violet-500 hover:bg-violet-600',   soft: 'bg-violet-50 text-violet-700',   dot: 'bg-violet-500' },
  slate:   { bubble: 'bg-slate-100 text-slate-600',     button: 'bg-slate-500 hover:bg-slate-600',     soft: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-400' },
};

export const TRACKER_COLOR_IDS = Object.keys(TRACKER_COLORS);

export function trackerColor(color) {
  return TRACKER_COLORS[color] || TRACKER_COLORS.brand;
}
