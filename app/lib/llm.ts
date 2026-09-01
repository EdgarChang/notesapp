import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Step } from "./checkin";
import type { Moment } from "./retrospect";
import { moodLabel, type Mood } from "./entries";

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
  /** Whatever they wrote unprompted. Becomes the summary verbatim. */
  open: string | null;
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
- Your summary covers \`answersToSummarise\` and nothing else.
- \`alreadyWrittenByTheUser_neverSummarise\` is text the person wrote themselves. It is printed unchanged directly beneath your summary. It is not material for your summary: do not restate it, paraphrase it, draw details from it, or continue it. If you mention the cat they wrote about, the entry says it twice.
- You may read it for the title, tags and people only.
- If \`answersToSummarise\` is null or holds nothing worth a sentence, return an empty summary. An empty summary is correct and expected when someone only wrote their own words.
- title: one short line, lowercase after the first word, no trailing full stop.
- tags: at most four, one or two words each, drawn from what they actually said.
- people: first names only, exactly as they wrote them.`;

function buildDraftContent(answers: CheckinAnswers): string {
  const lines: string[] = [];
  if (answers.mood !== null) {
    lines.push(`How the day landed: ${answers.mood} out of 10 (${moodLabel(answers.mood)})`);
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
    title:
      answers.highlight?.replace(/\.$/, "") ??
      (answers.open ? firstWords(answers.open) : "A day kept"),
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
/** First few words of a longer piece of text, for a fallback title. */
function firstWords(text: string, count = 6): string {
  const words = text.trim().split(/\s+/).slice(0, count).join(" ");
  return words.replace(/[.,;:]$/, "");
}

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

  const answered = buildDraftContent(answers);
  const ownWords = answers.open?.trim() ?? "";
  if (!answered.trim() && !ownWords) return null;

  const content = JSON.stringify(
    {
      answersToSummarise: answered || null,
      // Deliberately a separate key with a name that states the contract. The
      // same instruction inside the answer list was ignored: the model folded
      // this text into its summary, and the entry then said it twice.
      alreadyWrittenByTheUser_neverSummarise: ownWords || null,
    },
    null,
    1,
  );

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
  /**
   * A short reply to what they just said, before the next question. Empty when
   * there is nothing to reply to, such as the very first question.
   */
  acknowledgement: z.string(),
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

const PICKER_SYSTEM = `You reword one question in a nightly journalling check-in so it fits the person being asked.

You are given the step's fixed purpose, what they have already said tonight, and a little history. You may change the wording, the chip labels, and whether to show an adaptive note. You may not change what the step is for.

Voice:
- Warm, plain, direct. Second person. No emoji, no exclamation marks, no therapy-speak.
- Never congratulate them. Never refer to yourself as an AI or assistant.

acknowledgement:
- A brief, human reply to what they just said, at most one short sentence. This is the one place you respond rather than ask.
- React to the substance of their answer, not the fact that they answered. "Four flights of stairs is a lot" beats "Thanks for sharing".
- Match the weight of what they said. A hard day gets a plain, unhurried reply and never a silver lining. A small win can get a light one.
- Do not repeat their words back to them, do not summarise, do not give advice, and never ask a second question here.
- When \`previousAnswer\` is present you must write one. Returning empty is only correct when \`previousAnswer\` is null, which happens on the first question of the night. A one-word answer like "Rough" still deserves a reply, and is the case where it matters most.

question:
- One sentence. A question, not a prompt.

Rules:
- The question must still ask for exactly what \`mustAsk\` describes. If your rewording no longer asks for that thing, it is wrong, however well it reads.
- Do not reuse the framing of a question already asked tonight. Two steps asking what they want to "hold onto" is a failure.
- chips: return an empty array. Suggestions are not offered for these prompts.
- adaptiveNote: set it only when history gives you something specific and true to point at, like a name or a topic that keeps recurring. Otherwise null. Never invent a pattern.
- Refer to tonight's answers only if it makes the question better. Do not restate them back.`;

function buildPickerContent(
  step: Step,
  context: PickerContext,
  answers: CheckinAnswers,
  asked: string[],
  previousAnswer: string | null,
): string {
  const said: string[] = [];
  if (answers.mood !== null) said.push(`mood: ${answers.mood}/10`);
  if (answers.highlight) said.push(`worth remembering: ${answers.highlight}`);
  if (answers.outside !== null) said.push(`got outside: ${answers.outside ? "yes" : "no"}`);
  if (answers.gratitude) said.push(`grateful for: ${answers.gratitude}`);

  return JSON.stringify(
    {
      step: {
        mustAsk: step.prompt.text,
        category: step.prompt.category,
        answerFormat: step.prompt.response_type,
      },
      previousAnswer: previousAnswer ?? null,
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
  step: Step,
  context: PickerContext,
  answers: CheckinAnswers,
  askedTonight: string[] = [],
  previousAnswer: string | null = null,
): Promise<{ step: Step; acknowledgement: string } | null> {
  if (!llmConfigured()) return null;
  // Anchor wording is frozen. Rewording one would break comparability with
  // every answer given to it before, which is the whole reason anchors exist.
  if (step.isAnchor) return null;

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
            content: buildPickerContent(
              step,
              context,
              answers,
              askedTonight,
              previousAnswer,
            ),
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

    return {
      step: {
        ...step,
        prompt: { ...step.prompt, text: parsed.question.trim() },
      },
      acknowledgement: parsed.acknowledgement.trim(),
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


/* ---------------------------------------------------------------------------
 * Re-reading the final text
 * ------------------------------------------------------------------------- */

const MentionsSchema = z.object({
  /** First names of people mentioned, exactly as written. */
  people: z.array(z.string()),
  /** Up to four short labels for what the day was about. */
  tags: z.array(z.string()),
});

const MENTIONS_SYSTEM = `You read one finished journal entry and list what it mentions.

- people: the first names of people the writer mentions, exactly as they spelled them. Only actual people. Not the writer, not pets, not places, not companies. Return an empty array if nobody is named.
- tags: at most four short labels, one or two words each, for what the day was about. Drawn from the text, never invented.

Return nothing else. Do not summarise, interpret or comment.`;

/**
 * Read people and tags out of the summary the user actually kept.
 *
 * Drafting extracts these from the check-in answers, which misses anything added
 * while editing the summary afterwards: an entry ending "I met up with Andy and
 * Amy", typed at the last step, recorded no people at all. The kept summary is
 * the text of record, so it is worth a second look.
 */
export async function extractMentions(
  summary: string,
): Promise<{ people: string[]; tags: string[] } | null> {
  if (!llmConfigured()) return null;
  const text = summary.trim();
  if (!text) return null;

  try {
    const client = new Anthropic();
    const response = await client.messages.parse(
      {
        model: MODEL,
        max_tokens: 1024,
        output_config: { format: zodOutputFormat(MentionsSchema) },
        system: MENTIONS_SYSTEM,
        messages: [{ role: "user", content: text }],
      },
      { timeout: 6000 },
    );

    if (response.stop_reason === "refusal") return null;
    const parsed = response.parsed_output;
    if (!parsed) return null;

    return {
      people: parsed.people.map((p) => p.trim()).filter(Boolean),
      tags: parsed.tags.map((t) => t.trim()).filter(Boolean).slice(0, 4),
    };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`[llm] extractMentions ${error.status}: ${error.message}`);
    } else {
      console.error("[llm] extractMentions failed:", error);
    }
    return null;
  }
}


/* ---------------------------------------------------------------------------
 * Looking back
 * ------------------------------------------------------------------------- */

const RetrospectSchema = z.object({
  /** One line for the whole stretch. */
  headline: z.string(),
  /** A few short paragraphs. */
  narrative: z.string(),
  /** The days worth calling out, newest last. */
  moments: z.array(
    z.object({
      date: z.string(),
      what: z.string(),
      why: z.string(),
    }),
  ),
});

const RETROSPECT_SYSTEM = `You look back over a stretch of someone's journal and tell them what it held.

You are given their entries in date order. Each has a date, a mood from 1 (rough) to 5 (great), and what they wrote.

headline:
- One sentence naming what this stretch was actually about. Specific, not a label. "The month the migration finally shipped" beats "A productive month".

narrative:
- Two or three short paragraphs, second person, past tense.
- Say what happened and what changed across the stretch. Note a shift if there is one: something that started, stopped, got easier, kept recurring.
- Draw on the whole range, not just the last few days.
- Plain and warm. No emoji, no exclamation marks, no therapy-speak, no advice, no praise for journalling.

moments:
- The days genuinely worth remembering, in date order. Usually three to six; fewer if the stretch was quiet, and none if nothing stands out.
- Choose by weight, not by recency or by mood alone: a first, a last, a turning point, a hard day, something they clearly cared about. A pleasant but unremarkable day is not a moment.
- what: one sentence on what happened, in their own terms.
- why: one sentence on why it earned a place, which is where you may connect it to the rest of the stretch.
- date must be the exact date string of the entry it came from.

Rules:
- Invent nothing. Every claim must trace to an entry. If they wrote little, say little.
- Never total up moods or quote statistics. This is a recollection, not a report.
- If the range holds very few entries, a short honest narrative is the right answer.`;

export type RetrospectInput = {
  date: string;
  mood: number | null;
  text: string;
}[];

/**
 * Write the look back. Returns null on any failure so the caller can say so
 * rather than showing an empty screen.
 *
 * Effort is not set: Haiku 4.5 rejects it. A year of entries is the largest
 * prompt in the app, so this streams to avoid the SDK's request timeout.
 */
export async function writeRetrospect(
  entries: RetrospectInput,
  rangeLabel: string,
): Promise<{ headline: string; narrative: string; moments: Moment[] } | null> {
  if (!llmConfigured()) return null;
  if (entries.length === 0) return null;

  const content = JSON.stringify({ range: rangeLabel, entries }, null, 1);

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8192,
      output_config: { format: zodOutputFormat(RetrospectSchema) },
      system: RETROSPECT_SYSTEM,
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      console.error("[llm] writeRetrospect declined:", response.stop_details?.category);
      return null;
    }
    const parsed = response.parsed_output;
    if (!parsed?.headline.trim()) return null;

    const dates = new Set(entries.map((e) => e.date));
    return {
      headline: parsed.headline.trim(),
      narrative: parsed.narrative.trim(),
      // Drop any moment pinned to a date that is not in the range, rather than
      // showing the reader a day that never existed.
      moments: parsed.moments
        .filter((m) => dates.has(m.date))
        .map((m) => ({ date: m.date, what: m.what.trim(), why: m.why.trim() })),
    };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error(`[llm] writeRetrospect ${error.status}: ${error.message}`);
    } else {
      console.error("[llm] writeRetrospect failed:", error);
    }
    return null;
  }
}
