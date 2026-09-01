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
  /** Whatever they feel like writing. Kept verbatim as the day's summary. */
  | "open"
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
  /** Render a textarea rather than a single-line input. */
  multiline?: boolean;
};

export type AssistantTone = "Playful" | "Brief";

/* ---------------------------------------------------------------------------
 * Order
 *
 * Mood stays first: it anchors the 1-5 scale and colours how the rest of the
 * night reads. Photo and summary stay last, since the summary drafts from
 * everything before it. The middle four rotate, so the check-in does not feel
 * like the same form every evening.
 *
 * The shuffle is seeded rather than random. A random order would reshuffle on
 * every re-render and could reorder the questions underneath someone mid
 * check-in; seeding on the user and the date gives one stable order per person
 * per night.
 * ------------------------------------------------------------------------- */

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small deterministic PRNG, enough for ordering four items. */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], seed: string): T[] {
  const rand = mulberry32(hashSeed(seed));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/**
 * @param seed Stable per user per day, so the order holds for the whole
 * check-in. Pass an empty string to keep the written order.
 */
export function buildScript(tone: AssistantTone, seed = ""): ScriptStep[] {
  const brief = tone === "Brief";

  const first: ScriptStep = {
    kind: "chips",
    field: "mood",
    question: brief ? "How was today?" : "Evening. How did today actually land?",
    chips: ["Rough", "Meh", "Steady", "Good", "Great"],
    ack: "Noted.",
  };

  const middle: ScriptStep[] = [
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
      // Open-ended. Whatever they write here becomes the day's summary word for
      // word: when someone has taken the trouble to write it themselves, the
      // model has no business rewording it.
      kind: "text",
      field: "open",
      question: brief
        ? "Anything else?"
        : "Anything else you want to put down, in your own words?",
      placeholder: "Say as much or as little as you like",
      multiline: true,
      ack: "Kept, exactly as you wrote it.",
    },
  ];

  const last: ScriptStep[] = [
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

  return [first, ...(seed ? shuffled(middle, seed) : middle), ...last];
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
