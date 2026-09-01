import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ScriptStep, StepField } from "./checkin";
import { MOOD_LABELS, type Mood } from "./entries";

/**
 * The provider seam. Everything the app knows about drafting lives behind
 * `draftDay`, so swapping model or provider touches this file only.
 *
 * Runs server-side (`server-only`), so ANTHROPIC_API_KEY never reaches the
 * browser.
 */

/**
 * One model for both calls.
 *
 * Haiku 4.5 predates adaptive thinking and the effort parameter, so neither
 * request sends `thinking` or `output_config.effort`: both are rejected on this
 * model. Structured outputs via `output_config.format` work on every model, so
 * the response shape is still validated rather than trusted.
 */
const MODEL = "claude-haiku-4-5";

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
      max_tokens: 4096,
      output_config: { format: zodOutputFormat(DayDraftSchema) },
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


/* ---------------------------------------------------------------------------
 * Question picking
 * ------------------------------------------------------------------------- */

/** What the picker knows about this person, beyond tonight's answers. */
export type PickerContext = {
  /** Chosen during onboarding. */
  focusTopics: string[];
  /** Titles of the last few entries, newest first. */
  recentTitles: string[];
  /** Names that keep coming up. */
  recurringPeople: string[];
};

const NextQuestionSchema = z.object({
  /** The question to ask, in the assistant's voice. */
  question: z.string(),
  /** Chip labels. Answers for a chips step, suggestions for a text step. */
  chips: z.array(z.string()),
  /**
   * The "we keep asking because..." line, or null. Only worth setting when
   * there is a real pattern to point at.
   */
  adaptiveNote: z.string().nullable(),
});

/**
 * What each step must still ask after rewording.
 *
 * Without this the model drifts: it turned the photo step into "What's one
 * moment from today you want to hold onto?", which no longer asks for a photo
 * while the controls below it still offered camera and camera roll.
 */
const FIELD_PURPOSE: Record<StepField, string> = {
  mood: "How the day felt overall. The five chips are a stored 1-5 scale and must be returned unchanged.",
  highlight: "The one thing from today worth remembering in a year.",
  outside: "Whether they got outside today. Must be answerable with yes or no.",
  gratitude: "What they were grateful for today.",
  photo:
    "Adding a photo from today. The question must explicitly ask for a photo, because the controls below it offer camera and camera roll.",
  summary: "Not asked; a draft is shown instead.",
};

const PICKER_SYSTEM = `You reword one question in a nightly journalling check-in so it fits the person being asked.

You are given the step's fixed purpose, what they have already said tonight, and a little history. You may change the wording, the chip labels, and whether to show an adaptive note. You may not change what the step is for.

Voice:
- Warm, plain, direct. One sentence. A question, not a prompt.
- Second person. No emoji, no exclamation marks, no therapy-speak.
- Never congratulate them. Never refer to yourself as an AI or assistant.

Rules:
- The question must still ask for exactly what \`mustAsk\` describes. If your rewording no longer asks for that thing, it is wrong, however well it reads.
- Do not reuse the framing of a question already asked tonight. Two steps asking what they want to "hold onto" is a failure.
- chips: for a mood step, return the five labels unchanged and in order, since they map to a stored 1-5 scale. For a text step these are optional tap-to-answer suggestions, so each one must read as a short answer the person could plausibly give tonight, not as a category label: "Lunch with Sam" works, "Friends" does not. Draw them from their recent entry titles and the people they name. Focus topics tell you what they care about but are not themselves answers. Return an empty array unless you can offer something specific and true, which for someone with little history means returning none.
- adaptiveNote: set it only when history gives you something specific and true to point at, like a name or a topic that keeps recurring. Otherwise null. Never invent a pattern.
- Refer to tonight's answers only if it makes the question better. Do not restate them back.`;

function buildPickerContent(
  step: ScriptStep,
  context: PickerContext,
  answers: CheckinAnswers,
  asked: string[],
): string {
  const said: string[] = [];
  if (answers.mood !== null) said.push(`mood: ${MOOD_LABELS[answers.mood]}`);
  if (answers.highlight) said.push(`worth remembering: ${answers.highlight}`);
  if (answers.outside !== null) said.push(`got outside: ${answers.outside ? "yes" : "no"}`);
  if (answers.gratitude) said.push(`grateful for: ${answers.gratitude}`);

  return JSON.stringify(
    {
      step: {
        mustAsk: FIELD_PURPOSE[step.field],
        format: step.kind,
        currentQuestion: step.question,
        currentChips: step.chips ?? [],
      },
      alreadyAskedTonight: asked,
      tonightSoFar: said,
      focusTopics: context.focusTopics,
      recentEntryTitles: context.recentTitles,
      recurringPeople: context.recurringPeople,
    },
    null,
    1,
  );
}

/**
 * Reword one step for this person. Returns null on any failure, so the caller
 * falls back to the written script.
 *
 * The step's `kind` and `field` are never model-chosen: each one maps to a
 * stored column, and letting the model reshape the flow could leave mood or
 * gratitude never asked, quietly emptying the Insights screen.
 */
export async function pickNextQuestion(
  step: ScriptStep,
  context: PickerContext,
  answers: CheckinAnswers,
  askedTonight: string[] = [],
): Promise<ScriptStep | null> {
  if (!llmConfigured()) return null;
  // The summary step shows a draft rather than asking anything.
  if (step.field === "summary") return null;

  try {
    const client = new Anthropic();
    const response = await client.messages.parse(
      {
        model: MODEL,
        max_tokens: 2048,
        output_config: { format: zodOutputFormat(NextQuestionSchema) },
        system: PICKER_SYSTEM,
        messages: [
          {
            role: "user",
            content: buildPickerContent(step, context, answers, askedTonight),
          },
        ],
      },
      // The user is watching a typing indicator. Past a few seconds the written
      // question is the better answer.
      { timeout: 4000 },
    );

    if (response.stop_reason === "refusal") return null;
    const parsed = response.parsed_output;
    if (!parsed?.question.trim()) return null;

    // The mood chips map to a stored 1-5 scale, so they are never model-chosen.
    // Elsewhere they are optional suggestions: take up to three, and take none
    // if the model offers none, since there is no fiction left to fall back to.
    const chips =
      step.field === "mood"
        ? step.chips
        : parsed.chips.map((c) => c.trim()).filter(Boolean).slice(0, 3);

    return {
      ...step,
      question: parsed.question.trim(),
      ...(chips?.length ? { chips } : {}),
      ...(parsed.adaptiveNote?.trim()
        ? { adaptiveNote: parsed.adaptiveNote.trim() }
        : {}),
    };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`[llm] pickNextQuestion ${error.status}: ${error.message}`);
    } else {
      console.error("[llm] pickNextQuestion failed:", error);
    }
    return null;
  }
}
