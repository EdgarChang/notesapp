/**
 * The nightly check-in script. Six steps, each with a playful and a brief
 * variant, following the design's structure.
 *
 * The step shape matches the Claude question-picker's output schema, so a later
 * step can swap this constant for a model call without the UI changing.
 */

export type StepKind = "chips" | "text" | "yesno" | "photo" | "summary";

/**
 * Which answer a step collects. Explicit rather than inferred from `kind`,
 * because two steps are now text inputs and confusing them would file a
 * gratitude line as the day's title.
 */
export type StepField =
  | "mood"
  | "highlight"
  | "outside"
  | "gratitude"
  | "photo"
  | "summary";

export type ScriptStep = {
  kind: StepKind;
  field: StepField;
  question: string;
  /** Chip labels: the answer set for `chips`, suggestions for `text`. */
  chips?: string[];
  /** The "we keep asking because..." line shown above the question. */
  adaptiveNote?: string;
  /** Short assistant acknowledgement after the answer. Empty means none. */
  ack: string;
  /** Placeholder for a text step. */
  placeholder?: string;
};

export type AssistantTone = "Playful" | "Brief";

export function buildScript(tone: AssistantTone): ScriptStep[] {
  const brief = tone === "Brief";
  return [
    {
      kind: "chips",
      field: "mood",
      question: brief ? "How was today?" : "Evening. How did today actually land?",
      chips: ["Rough", "Meh", "Steady", "Good", "Great"],
      ack: "Noted.",
    },
    {
      kind: "text",
      field: "highlight",
      question: brief
        ? "One thing worth remembering?"
        : "One thing you’d want to remember about it in a year?",
      // No written suggestions. The prototype's were fiction about a 6am run and
      // dinner with Maya; the picker proposes real ones from the person's own
      // history, and offers none when there is no history to draw on.
      placeholder: "Type it in a line or two",
      ack: "That’s the one to keep.",
    },
    {
      kind: "yesno",
      field: "outside",
      question: brief ? "Outside today?" : "Did you get outside at all today?",
      // No written adaptive note. The design's example claimed "you've mentioned
      // daylight three nights running", which is an assertion about the reader's
      // history that this app cannot make: nothing tracks per-question answer
      // history yet. The picker sets a note only when it has something true to
      // point at, and otherwise there is none.
      ack: "Good.",
    },
    {
      // Was a simulated voice recording. It now takes typed text, because a fake
      // recorder wrote a canned transcript into the gratitude column for
      // everyone. Real capture, with transcription, is a later step; this then
      // becomes the "type it instead" path rather than being thrown away.
      kind: "text",
      field: "gratitude",
      question: brief
        ? "Anything you were grateful for?"
        : "Anything you’re grateful for today? However small.",
      placeholder: "One line is plenty",
      ack: "Filed under things that went right.",
    },
    {
      kind: "photo",
      field: "photo",
      question: brief
        ? "A photo for today?"
        : "One photo for today. Doesn’t have to be good.",
      ack: "That’ll do nicely.",
    },
    {
      kind: "summary",
      field: "summary",
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
  /**
   * The beat between the answer and the reply, and again between the reply and
   * the assistant starting to type the next question.
   */
  ack: 380,
} as const;

/**
 * Static waveform bar heights, in px. Used by entry detail's voice player,
 * which only renders once an entry has a real recording behind it.
 */
export const STATIC_BARS = [8, 14, 20, 11, 18, 22, 9, 16, 21, 13, 19, 10, 15, 7];

/** Canned photo caption. The photo step still stores no file. */
export const CANNED_PHOTO_CAPTION = "IMG_2841 · 6:42 PM";
