/**
 * Onboarding options. These feed two tables once step 6 lands: the chosen
 * topics become `question_profiles.focus_topics`, and the reminder becomes
 * `profiles.reminder_time`.
 */

export const FOCUS_OPTIONS = [
  "Family",
  "Work",
  "Friends",
  "Health",
  "Small wins",
  "People I see",
  "Places I go",
  "Books & films",
] as const;

export type FocusTopic = (typeof FOCUS_OPTIONS)[number];

export type ReminderOption = {
  label: string;
  hint: string;
  /** Maps to `profiles.reminder_time`, a nullable time column. */
  time: string | null;
};

export const REMINDER_OPTIONS: ReminderOption[] = [
  { label: "8:30 PM", hint: "Before the wind-down", time: "20:30" },
  { label: "9:30 PM", hint: "Most people pick this", time: "21:30" },
  { label: "10:30 PM", hint: "Last thing", time: "22:30" },
  { label: "Not now", hint: "We’ll stay quiet", time: null },
];

/** Where the prototype starts each field. */
export const ONBOARDING_DEFAULTS = {
  focus: ["Small wins", "People I see"] as FocusTopic[],
  reminderLabel: "9:30 PM",
};

export const ONBOARDING_STEPS = 3;
