import bank from "./prompts.json";

/**
 * The prompt bank from JOURNAL_SPEC.md.
 *
 * Anchors are asked identically every day and feed the trend line; the pool
 * rotates and feeds the memory. Anchor text must not be edited without
 * incrementing the version, because changing it breaks longitudinal
 * comparability with everything answered before.
 */

export type ResponseType =
  | "scale_0_10"
  | "single_word"
  | "short_text"
  | "long_text"
  | "people_picker";

export type Valence = "positive" | "neutral" | "negative" | "mixed";
export type Tone = "neutral" | "playful" | "reflective" | "probing";
export type Cadence = "anchor" | "daily_pool" | "weekly" | "monthly";

export type Category =
  | "anchor"
  | "day_reconstruction"
  | "ephemera"
  | "social"
  | "meaning"
  | "playful"
  | "future_facing";

export type Prompt = {
  id: string;
  text: string;
  cadence: Cadence;
  category: Category;
  response_type: ResponseType;
  tone: Tone;
  valence: Valence;
  weight?: number;
  day_bias?: "weekday" | "weekend";
  /** May be used to close a session after a negative prompt. */
  closer_eligible?: boolean;
  resurface_value?: string;
  source?: string;
  notes?: string;
};

export const PROMPT_VERSION: string = bank.version;

export const ANCHORS = bank.anchors as Prompt[];
export const POOL = bank.pool as Prompt[];
export const WEEKLY = bank.weekly as Prompt[];
export const MONTHLY = bank.monthly as Prompt[];

const BY_ID = new Map<string, Prompt>(
  [...ANCHORS, ...POOL, ...WEEKLY, ...MONTHLY].map((p) => [p.id, p]),
);

export function promptById(id: string): Prompt | undefined {
  return BY_ID.get(id);
}

/**
 * Prompts that may safely end a session.
 *
 * The guardrail is that the final screen must be forward-looking, appreciative
 * or neutral, so this is wider than the explicitly flagged ones: any positive
 * prompt qualifies. Restricting it to `closer_eligible` left only two, which
 * then had to repeat inside the fourteen day window to satisfy the hard rule
 * about never ending on a negative note.
 *
 * Ordered so the flagged and forward-looking ones are preferred.
 */
export const CLOSERS: Prompt[] = POOL.filter(
  (p) => p.valence === "positive" || p.closer_eligible === true,
)
  .filter((p) => p.valence !== "negative")
  .sort((a, b) => {
    const rank = (p: Prompt) =>
      p.closer_eligible ? 0 : p.category === "future_facing" ? 1 : 2;
    return rank(a) - rank(b);
  });
