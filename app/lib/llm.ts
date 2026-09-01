import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { MOOD_LABELS, type Mood } from "./entries";

/**
 * The provider seam. Everything the app knows about drafting lives behind
 * `draftDay`, so swapping model or provider touches this file only.
 *
 * Runs server-side (`server-only`), so ANTHROPIC_API_KEY never reaches the
 * browser.
 */

const MODEL = "claude-opus-5";

/** What the six steps collected. */
export type CheckinAnswers = {
  mood: Mood | null;
  /** The one thing worth remembering. */
  highlight: string | null;
  /** Did they get outside. */
  outside: boolean | null;
  gratitude: string | null;
};

const DayDraftSchema = z.object({
  /** One line, used in Home and Timeline lists. */
  title: z.string(),
  /** The three lines the user can edit. */
  summary: z.string(),
  /** Up to four short labels. */
  tags: z.array(z.string()),
  /** Names mentioned, feeding question_profiles.recurring_people. */
  people: z.array(z.string()),
});

export type DayDraft = z.infer<typeof DayDraftSchema>;

const SYSTEM_PROMPT = `You write a single day's journal entry on someone's behalf, from the short answers they gave during a nightly check-in.

Voice:
- First person, past tense, as if they wrote it themselves.
- Plain and warm. Concrete over abstract. Specific over summarising.
- Three sentences at most for the summary. Short is better than complete.
- Never inflate. If they gave you very little, write very little.
- No emoji, ever. No exclamation marks. No therapy-speak, no "grateful for the journey", no "today was a day of".

Rules:
- Invent nothing. Every detail must come from their answers. If they mentioned no people, return an empty people array.
- title: one short line, lowercase after the first word, no trailing full stop.
- tags: at most four, one or two words each, drawn from what they actually said.
- people: first names only, exactly as they wrote them.`;

function buildUserContent(answers: CheckinAnswers): string {
  const lines: string[] = [];
  if (answers.mood !== null) {
    lines.push(`How the day landed: ${MOOD_LABELS[answers.mood]}`);
  }
  if (answers.highlight) {
    lines.push(`Worth remembering: ${answers.highlight}`);
  }
  if (answers.outside !== null) {
    lines.push(`Got outside: ${answers.outside ? "yes" : "no"}`);
  }
  if (answers.gratitude) {
    lines.push(`Grateful for: ${answers.gratitude}`);
  }
  return lines.join("\n");
}

/**
 * Plainly assembled from the user's own words, used when the model is
 * unavailable or declines.
 *
 * Deliberately not a constant. The previous placeholder was a fabricated day
 * about a 6k run and dinner with Maya, which every user received; a fallback
 * that invents content is worse than one that is merely plain.
 */
export function composeFallbackDraft(answers: CheckinAnswers): DayDraft {
  const sentences: string[] = [];
  if (answers.highlight) sentences.push(`${answers.highlight.replace(/\.$/, "")}.`);
  if (answers.outside === true) sentences.push("Got outside at some point.");
  if (answers.gratitude) sentences.push(`Grateful for ${asSentenceTail(answers.gratitude)}`);

  const tags: string[] = [];
  if (answers.outside === true) tags.push("Outside");

  return {
    title: answers.highlight?.replace(/\.$/, "") ?? "A day kept",
    summary: sentences.join(" ").trim(),
    tags,
    people: [],
  };
}

/**
 * Tidy the user's text onto the end of a sentence without altering their words.
 *
 * An earlier version lowercased the first letter, which read better for
 * "The tide being out" but turned "Priya not giving up" into "priya not giving
 * up". Mangling a name is worse than an awkward capital, so the text is left
 * exactly as written and only the full stop is normalised.
 */
function asSentenceTail(text: string): string {
  const trimmed = text.trim();
  return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
}

/** True when a key is configured. Lets callers skip the round trip entirely. */
export function llmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Draft the day. Returns null on any failure so the caller falls back rather
 * than surfacing an error into someone's journal.
 *
 * A refusal is a real possibility here, not a theoretical one: people write
 * about hard things. Rather than chain to a second model, a decline falls back
 * to the composed draft, which is built entirely from the user's own words and
 * so is always safe to show.
 */
export async function draftDay(answers: CheckinAnswers): Promise<DayDraft | null> {
  if (!llmConfigured()) return null;

  const content = buildUserContent(answers);
  if (!content.trim()) return null;

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: zodOutputFormat(DayDraftSchema),
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      console.error("[llm] draftDay declined:", response.stop_details?.category);
      return null;
    }

    const parsed = response.parsed_output;
    if (!parsed) return null;

    return { ...parsed, tags: parsed.tags.slice(0, 4) };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`[llm] draftDay API error ${error.status}: ${error.message}`);
    } else {
      console.error("[llm] draftDay failed:", error);
    }
    return null;
  }
}
