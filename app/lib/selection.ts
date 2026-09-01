import { dayOfWeek } from "./entries";
import {
  ANCHORS,
  CLOSERS,
  MONTHLY,
  POOL,
  WEEKLY,
  type Prompt,
} from "./prompts";

/**
 * Choosing the night's prompts, per the selection algorithm in JOURNAL_SPEC.md.
 *
 * The shape is one anchor screen plus two rotating prompts, under ninety
 * seconds. Completion collapses past that, and an abandoned journal preserves
 * nothing, so the budget is a design constraint rather than a preference.
 *
 * The spec's fourteen day no-repeat rule is deliberately not implemented. With
 * day bias, the one-category-per-session rule and cold-start filtering already
 * narrowing the pool, barring anything seen recently thinned it further than it
 * was worth. Weighting still spreads prompts out, and repeated skipping still
 * down-weights, so the same question can now recur sooner. That is the tradeoff.
 */

export type SelectionInput = {
  today: string;
  /** Prompt ids skipped more often than answered, down-weighted rather than barred. */
  oftenSkipped: string[];
  /** 0 = Sunday. The weekly tier fires on this day. */
  weeklyDay: number;
  /** True when this is the last active day of the month. */
  monthlyDue: boolean;
  /** Entries kept so far. A brand new user gets the gentler categories. */
  entryCount: number;
  /** Deterministic per user per night, so the set holds for the whole session. */
  seed: string;
};

export type Selection = {
  anchors: Prompt[];
  /** Two rotating prompts, plus a closer when the second is negative. */
  rotating: Prompt[];
  /** The weekly or monthly prompt, when one is due. */
  slow: Prompt | null;
};

/* ---------------------------------------------------------------------------
 * Seeded randomness, so a reload does not reshuffle the night's questions.
 * ------------------------------------------------------------------------- */

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: string): () => number {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weighted pick without replacement. */
function pickWeighted(items: Prompt[], rand: () => number): Prompt | null {
  const total = items.reduce((sum, p) => sum + (p.weight ?? 1), 0);
  if (total <= 0) return null;
  let r = rand() * total;
  for (const p of items) {
    r -= p.weight ?? 1;
    if (r <= 0) return p;
  }
  return items[items.length - 1] ?? null;
}

/**
 * First-week prompts should be playful and ephemera rather than probing: asking
 * someone what they are avoiding on day one is a good way to lose them.
 */
const COLD_START_ENTRIES = 7;
const COLD_START_CATEGORIES = new Set(["playful", "ephemera"]);

export function selectPrompts(input: SelectionInput): Selection {
  const rand = rng(input.seed);
  const weekend = [0, 6].includes(dayOfWeek(input.today));
  const skipped = new Set(input.oftenSkipped);
  const coldStart = input.entryCount < COLD_START_ENTRIES;

  const eligible = POOL.filter((p) => {
    // Tuesday deserves "what did you eat", Saturday "the best twenty minutes".
    if (p.day_bias === "weekend" && !weekend) return false;
    if (p.day_bias === "weekday" && weekend) return false;
    if (coldStart && !COLD_START_CATEGORIES.has(p.category)) return false;
    return true;
  });

  // Repeated skipping is a signal, not a ban: halve the weight rather than
  // removing a prompt someone might answer on a different kind of day.
  const weighted = eligible.map((p) =>
    skipped.has(p.id) ? { ...p, weight: Math.max(1, (p.weight ?? 1) / 2) } : p,
  );

  // The slow tier is a long_text prompt worth about forty seconds, so on those
  // nights one rotating prompt keeps the session inside the ninety second
  // budget. Two plus a weekly ran to two minutes, which is where completion
  // falls away.
  const slowDue =
    input.monthlyDue || dayOfWeek(input.today) === input.weeklyDay;
  const rotatingTarget = slowDue ? 1 : 2;

  const rotating: Prompt[] = [];
  const usedCategories = new Set<string>();
  let negatives = 0;

  let remaining = weighted;
  while (rotating.length < rotatingTarget && remaining.length > 0) {
    const candidates = remaining.filter((p) => {
      if (usedCategories.has(p.category)) return false;
      // At most one negative-valence prompt in a session.
      if (p.valence === "negative" && negatives >= 1) return false;
      // On a slow-tier night there is no room for a closer, so a negative
      // prompt would have nowhere safe to land. Skip them entirely.
      if (slowDue && p.valence === "negative") return false;
      return true;
    });
    if (candidates.length === 0) break;

    const chosen = pickWeighted(candidates, rand);
    if (!chosen) break;

    rotating.push(chosen);
    usedCategories.add(chosen.category);
    if (chosen.valence === "negative") negatives++;
    remaining = remaining.filter((p) => p.id !== chosen.id);
  }

  // Hard rule: a session never ends on a negative prompt. If the last one is
  // negative, a forward-looking prompt is appended as the closer, so the last
  // thing someone reads before closing the app is not the worst of their day.
  const last = rotating[rotating.length - 1];
  if (last?.valence === "negative") {
    const closer =
      CLOSERS.filter((c) => !usedCategories.has(c.category))[0] ?? CLOSERS[0];
    if (closer) rotating.push(closer);
  }

  return {
    anchors: ANCHORS,
    rotating,
    slow: input.monthlyDue
      ? (pickWeighted(MONTHLY, rand) ?? null)
      : slowDue
        ? (pickWeighted(WEEKLY, rand) ?? null)
        : null,
  };
}

/**
 * Roughly how long the night's set should take, for the ninety second budget.
 *
 * Excludes the open invitation appended after these: it is skippable in one
 * tap, and time someone chooses to spend writing is not time the app is asking
 * of them.
 */
export function estimateSeconds(selection: Selection): number {
  const perType: Record<string, number> = {
    scale_0_10: 4,
    single_word: 6,
    people_picker: 10,
    short_text: 20,
    long_text: 40,
  };
  const all = [...selection.anchors, ...selection.rotating];
  if (selection.slow) all.push(selection.slow);
  return all.reduce((sum, p) => sum + (perType[p.response_type] ?? 15), 0);
}
