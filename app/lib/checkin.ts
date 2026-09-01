import type { Prompt, ResponseType } from "./prompts";
import { PROMPT_VERSION } from "./prompts";
import type { Selection } from "./selection";

/**
 * One question in the night's flow, built from the prompt bank.
 *
 * Replaces the written six-step script. The set now comes from
 * `selectPrompts`, so the specifics rotate while the anchors stay fixed.
 */
export type Step = {
  prompt: Prompt;
  /** Anchors are frozen: never reworded, never reordered, never skipped past. */
  isAnchor: boolean;
  placeholder?: string;
};

export type AssistantTone = "Playful" | "Brief";

export { PROMPT_VERSION };

const PLACEHOLDERS: Partial<Record<ResponseType, string>> = {
  single_word: "One word",
  short_text: "A line or two",
  long_text: "Say as much or as little as you like",
  people_picker: "Names, separated by commas",
};

/**
 * The night's steps: anchors first, then the rotating prompts, then the slow
 * tier if one is due. The summary is not a prompt; it is the closing screen.
 */
export function buildSteps(selection: Selection): Step[] {
  const steps: Step[] = selection.anchors.map((prompt) => ({
    prompt,
    isAnchor: true,
    ...(PLACEHOLDERS[prompt.response_type]
      ? { placeholder: PLACEHOLDERS[prompt.response_type] }
      : {}),
  }));

  for (const prompt of selection.rotating) {
    steps.push({
      prompt,
      isAnchor: false,
      ...(PLACEHOLDERS[prompt.response_type]
        ? { placeholder: PLACEHOLDERS[prompt.response_type] }
        : {}),
    });
  }

  if (selection.slow) {
    steps.push({
      prompt: selection.slow,
      isAnchor: false,
      placeholder: PLACEHOLDERS.long_text,
    });
  }

  return steps;
}

/** Pacing, from the design handoff's "Interactions & behavior" section. */
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
