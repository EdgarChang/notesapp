/**
 * The nightly check-in script. Six steps, each with a playful and a brief
 * variant, matching the prototype's `script()` method.
 *
 * The shape here is deliberately the shape of the Claude API question-picker's
 * output schema, so step 7 can swap this constant for a model call without the
 * UI changing.
 */

export type StepKind = "chips" | "text" | "yesno" | "voice" | "photo" | "summary";

export type ScriptStep = {
  kind: StepKind;
  question: string;
  /** Chip labels: the answer set for `chips`, suggestions for `text`. */
  chips?: string[];
  /** The "we keep asking because..." line shown above the question. */
  adaptiveNote?: string;
  /** Short assistant acknowledgement after the answer. Empty means none. */
  ack: string;
};

export type AssistantTone = "Playful" | "Brief";

export function buildScript(tone: AssistantTone): ScriptStep[] {
  const brief = tone === "Brief";
  return [
    {
      kind: "chips",
      question: brief ? "How was today?" : "Evening. How did today actually land?",
      chips: ["Rough", "Meh", "Steady", "Good", "Great"],
      ack: "Noted.",
    },
    {
      kind: "text",
      question: brief
        ? "One thing worth remembering?"
        : "One thing you’d want to remember about it in a year?",
      chips: ["The 6am run", "Dinner with Maya", "Shipped the release"],
      ack: "That’s the one to keep.",
    },
    {
      kind: "yesno",
      question: brief ? "Outside today?" : "Did you get outside at all today?",
      adaptiveNote:
        "You’ve mentioned daylight three nights running, so we keep asking.",
      ack: "Good.",
    },
    {
      kind: "voice",
      question: brief
        ? "Anything you were grateful for?"
        : "Anything you’re grateful for today? Say it out loud, it’s faster than typing.",
      ack: "Filed under things that went right.",
    },
    {
      kind: "photo",
      question: brief
        ? "A photo for today?"
        : "One photo for today. Doesn’t have to be good.",
      ack: "That’ll do nicely.",
    },
    {
      kind: "summary",
      question: brief
        ? "Here’s the draft. Edit anything off."
        : "Here’s your day in three lines. Change anything we got wrong.",
      ack: "",
    },
  ];
}

/** Pacing, from the handoff's "Interactions & behavior" section. */
export const TIMING = {
  /** Before the very first question, so the screen paints first. */
  open: 60,
  /** Assistant "typing" dwell before a question appears. */
  typing: 550,
  /** Acknowledgement lands this long after the user's answer. */
  ack: 380,
  /** Next question starts this long after the answer, with an ack. */
  nextWithAck: 900,
  /** Next question starts this long after the answer, when skipped. */
  nextWithoutAck: 400,
} as const;

/** Static waveform bar heights, in px. Used by voice bubbles. */
export const STATIC_BARS = [8, 14, 20, 11, 18, 22, 9, 16, 21, 13, 19, 10, 15, 7];

/** Live recording waveform: 18 bars, staggered 70ms. */
export const LIVE_BAR_COUNT = 18;
export const LIVE_BAR_STAGGER_MS = 70;

/**
 * Canned voice answer. The prototype fakes recording entirely; step 8 replaces
 * this with MediaRecorder plus a transcription call.
 */
export const CANNED_VOICE = {
  durationSeconds: 14,
  transcript: "Grateful Priya stayed on the call until it was actually fixed.",
};

/** Canned photo caption, matching the prototype. */
export const CANNED_PHOTO_CAPTION = "IMG_2841 · 6:42 PM";

/** The auto-drafted summary the user edits at the last step. */
export const DRAFT_SUMMARY =
  "Ran 6k before the sun was properly up. Shipped the release and nothing broke. Dinner with Maya — she’s set on the trip in October.";
