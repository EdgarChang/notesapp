-- Two changes.
--
-- 1. Store the question as it was actually asked, alongside the answer.
--
-- prompt_id and prompt_version identify the canonical wording, but the picker
-- rewords prompts per person and per night, so the canonical text is not what
-- anyone was asked. Reading an old answer without the question that produced it
-- means guessing, and the whole point of the rotating prompts is that they are
-- specific. Backfilled where the wording is recoverable, null where it is not.
update entries
set prompt_responses = (
  select jsonb_agg(
    case
      when r ? 'question_text' then r
      else r || jsonb_build_object('question_text', null)
    end
  )
  from jsonb_array_elements(prompt_responses) r
)
where jsonb_array_length(prompt_responses) > 0;

-- 2. Drop prompt_history.
--
-- It existed to enforce the fourteen day no-repeat rule, which is being removed.
-- Everything else it held is already in entries.prompt_responses: the prompt id,
-- whether it was answered or skipped, and the date via the entry itself. Keeping
-- a second copy of derivable facts is what put a count of three against a single
-- entry in the people tally, and there is no reason to repeat that here.
drop table if exists prompt_history;
