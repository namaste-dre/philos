# Phase 8 Governing Rubric and Consistency Rules

_Fable 5, 2026-07-10. Written before any content generation, per the D86 hard methodology requirement: rubric first, then generation against the rubric, then a dedicated cross-archetype and cross-axis consistency pass before any batch is called done. Authority: D86 (scope and priority), C1/D47 (report architecture, approved at Checkpoint A), D76/D85 (first-name personalization stays), D44/D57 (C01b examination framing). Report prose is outside the instrument governance core (Instrument Governance section 1), so no new measurement-core approval is needed; deploy authority stays with Andre, nothing gets pushed without his go._

---

## 1. Scope of Phase 8 (what ships in this batch set)

Per C1, approved at Checkpoint A and reconfirmed in D86:

1. **Batch 1 - hard-written per-variant texts (60).** `whoYouAre`, `tagline`, and `cardTagline` become fields on each `ARCHETYPES` entry. The AI stops generating them. Existing `description`, `strength`, `failureMode` get a quality pass against this rubric. `strength`/`failureMode` become the rendered source for the report's Core Superpower / Primary Failure Mode patterns (they are currently dead data; the AI-written patterns section they replace is not in C1's keep-AI list).
2. **Batch 2 - growth-edge curated library.** 64 axis entries (32 axes, both poles) plus 42 contradiction-rule entries, selected deterministically from the respondent's actual scores and live contradictions. Replaces the current 3 thin AI sentences.
3. **Batch 3 - report prompt rewrite.** AI keeps exactly what C1 keeps: identity, alignment, world lenses, where the continuous-score nuance lives. OCEAN block dropped from the prompt (reasoning in section 6). Programmatic output validator added. Temperature 0.6 set server-side. D47 report-versioning metadata wired into the save payload.
4. **C01b reframe text** - verify against D44/D57, polish only if below bar.

Not in scope: question stems, options, scores, reversed flags, archetype sigs, contradiction check logic or thresholds, tier assignments. Any of those would require a new dated decision first.

## 2. Global voice rules (every piece of user-facing text in every batch)

1. Second person, present tense. The reader is being described, not addressed with advice-column imperatives.
2. The register is recognition, not verdict. Every sentence must pass the test: does this read as "someone finally sees me" or as "someone is grading me"? Only the first survives.
3. No jargon and no axis names in user-facing prose. A philosophical term may appear only when it is the plainest available word for the thing, and it must carry its meaning in context without a definition.
4. Reading level: understandable by a high school student, satisfying to a PhD. Concretely: sentences average under 22 words, no sentence over 35, no double-embedded clauses.
5. Zero em dashes, zero en dashes, anywhere, including inside prompt strings and code comments touched by this work. Hyphens only in compound words. A dedicated character scan runs after drafting, never trust the draft.
6. No detectable AI patterning:
   - "Not X but Y" and "X is not about Y" constructions: at most one per entry, never as the opening sentence.
   - No rule-of-three adjective stacks ("bold, honest, and unflinching").
   - No summary tails ("In the end, ...", "Ultimately, ...").
   - Vary sentence length within every entry; at least one short sentence (under 8 words) per entry of 3+ sentences.
   - No word appears more than twice in one entry unless it is structural (the, you, and).
7. Neutrality is absolute and two-sided. For every entry, run the explicit test: would a hard determinist atheist AND a libertarian-free-will religious respondent each read this with neither feeling judged? Growth edges are where this bites hardest; see section 4.

## 3. Batch 1 rules - the 60 variant texts

**Field constraints:**

| Field | Constraint |
|---|---|
| `whoYouAre` | Max 55 words AND max 340 characters (card render hard limit). Complete flowing paragraph ending on a complete sentence. No name, no archetype name, no variant name. |
| `tagline` | One sentence. Reads like a line from a novel, not a label. No restatement of the family or variant name. Max 110 characters. |
| `cardTagline` | Exactly two lines separated by `\n`, max 8 words per line. The core tension or signature of this variant. |
| `strength` | 1-2 sentences, the specific capability this variant's pattern produces. Renders under "Core Superpower". |
| `failureMode` | 1-2 sentences, the specific way this pattern fails. Renders under "Primary Failure Mode". Framed as a cost of the strength, never as a character flaw. |
| `description` | Keep current length band (3-5 sentences). Quality pass only where below this rubric's bar. |

**Consistency rules:**

1. **Family coherence.** The 5 variants of a family share the family's core commitments and differ along the variant's distinguishing dimension (mode of engagement, domain of focus, or biographical route). Sibling texts must be tellable apart with the names removed.
2. **Cross-family differentiation.** Same-letter variants across families (all the activist-types, all the quiet-types) must not converge on interchangeable wording.
3. **No phrase of 6 or more consecutive words repeats across any two of the 60 entries** (scripted shingle check, not eyeballed).
4. **Sig fidelity.** Each text must be derivable from the variant's actual sig vector. Nothing in the text may contradict the sig (e.g. describing comfort with uncertainty for a variant whose sig scores low uncertainty tolerance).
5. **Dignity parity.** Faith-anchored, tradition-anchored, and skeptical families get the same warmth and the same depth. Word-count parity across families within 15 percent.

## 4. Batch 2 rules - the growth-edge library

**Entry shape (both kinds):**

```js
{title: 'Short name of the edge, max 6 words',
 text: '2-4 sentences. What the edge is, and why this exact commitment produces it. The edge is a consequence of strength, never a deficiency.',
 practice: 'One concrete sentence. Something the person can actually do or watch for, this month, in real life.'}
```

**Axis entries (64):** keyed `axis + pole`. Written for someone scoring at or beyond 1.5 from midpoint toward that pole.

1. **Pole symmetry is the load-bearing neutrality rule.** The two entries of an axis are drafted together and reviewed as a pair. Each pole's edge must be real, specific, and equally weighty. If the naturalist pole's edge reads as a footnote and the supernatural pole's edge reads as a diagnosis, the pair fails and both are redrafted.
2. The edge names what the commitment makes hard to see or do, not what is wrong with the belief. "Strong trust in scientific consensus" has an edge (deference where the evidence is genuinely thin); so does skepticism of it (discounting hard-won expert convergence). Both get named with the same respect.
3. The practice line is behavioral and observable, never "reflect on" or "consider whether". Name a situation, a habit to interrupt, or a specific thing to try.
4. No overlap with the contradiction cards: axis entries never reference other axes.

**Contradiction entries (42):** keyed by rule id (11 A, 22 B, 9 C).

1. Builds on the tension without restating the tension card's text. The card names the tension; the growth entry names the work.
2. Must be consistent with the rule's existing `questions` but not repeat them verbatim.
3. Tier-appropriate register: A entries treat resolution as genuinely needed, B entries treat alignment as worth checking, C entries treat examination as intrinsically valuable with no implication that the position is broken (the C01b standard, per D44/D57).

**Selection logic (deterministic, no AI):**

1. Rank axes by extremity `|score - 4|`; take the top 3 with extremity >= 1.5, pole entry matching the respondent's side.
2. Add contradiction entries for the top 2 live contradictions by strength (A before B before C at equal strength).
3. Minimum 3 shown, maximum 5. If fewer than 3 qualify (a near-midline profile), backfill from the next most extreme axes regardless of the 1.5 bar, because a moderate profile's edge is real too (its entry pair still applies directionally).
4. Selected entries are written into `report_json.growth` at generation time so the public share page (`api/report.js`) renders identically with no logic change; growth items become `{title, text, practice}` objects, and both renderers are updated in the same batch (report.js currently assumes strings).

## 5. C01b verification checklist (against D44/D57)

1. Tier C. (Confirmed in code, `tier:'C'`.)
2. Libertarian retributivism explicitly named coherent. (Present: "coherent classical position".)
3. Examination framing, not accusation: the text must ask what grounds desert, not imply the answer.
4. Voice rules of section 2 apply (the current text says "It is one of the oldest open questions", check register and dash scan).
5. Growth-edge contradiction entry for C01b (Batch 2) must hold the same line: C-tier register, no implication the respondent should abandon retributivism.

## 6. Batch 3 rules - prompt rewrite, validator, versioning

1. **Keep AI:** `identity` (5 paragraphs), `alignment` (4 items), `world` (5 lenses). These carry the continuous-score nuance per C1.
2. **Remove from AI output schema:** `tagline`, `cardTagline`, `cardWhoYouAre`, `patterns`, `growth`. All now data-driven.
3. **Preserve `${userName}` real first name** in both prompts. D76/D85. Do not reintroduce D6's placeholder token.
4. **OCEAN block: dropped, not downgraded.** Reasoning: O, C, A are inferred from philosophical axes by unvalidated arithmetic, E and N are usually not measured at all, and the block invites the model to write Big Five language the instrument cannot support. C1 offered drop or downgrade; drop is the defensible end of the approved range and removes a claims risk. Revisit trigger: a validated Big Five module ships.
5. **Prompt strings themselves obey the dash rule.** The current prompts contain literal em dashes the model can mirror; they all go.
6. **Programmatic output validator** (client-side, after JSON parse, before render/save):
   - Replace any em/en dash in AI output: ` — ` and ` – ` become `, `; bare `—`/`–` become `, `; numeric ranges get a hyphen.
   - Schema check: required keys present, arrays at required lengths; on failure, one retry, then graceful degradation per existing fallback paths.
   - Length caps: identity paragraphs and lens fields soft-capped at the prompt's stated sizes; over-length text is truncated at the last complete sentence inside the cap, never mid-sentence.
7. **Temperature 0.6 set in `api/generate.js`** (server-side so the client cannot inject it), per C1.
8. **D47 wiring:** save payload gains `report_version` (new constant `REPORT_VERSION = 'r2'`; the pre-Phase-8 pipeline is retroactively r1), `prompt_hash` (SHA-256 of the concatenated prompt templates with the per-user data stripped, computed at build/generation time), `model`, `temperature`, `generated_at`. Columns already exist in `completions`.

## 7. Verification pass (runs per batch, all must pass before a batch is called done)

1. `node --check` on every touched `api/*.js` and on the script block extracted from `index.html`.
2. Structural integrity: 160 questions, 42 contradiction rules (11A/22B/9C), 60 archetypes, 64 axis growth entries, 42 contradiction growth entries, no empty array slots.
3. Dedicated dash scan (ripgrep, both `—` and `–`) on all touched content, with the pre-existing untouched-region count recorded so regressions are distinguishable from backlog.
4. Shingle check: no 6-word phrase shared between any two variant texts or any two growth entries (script, not eyeballed).
5. Pole-symmetry read: all 32 axis-entry pairs reviewed as pairs.
6. Two-sided neutrality spot check on the sensitive axes (religion, moral_authority, politics, economics, animal_ethics, naturalism) by both test readers of Ground Rule 4.
7. Length verification: every `whoYouAre` <= 55 words and <= 340 chars (scripted).
8. Live render smoke test of report + card via local preview where feasible.

## 8. Documentation obligations

Every batch that passes verification gets: a Build Log entry, a dated Decisions Log entry recording what shipped and under which authority (D86 pre-approved scope), and a CLAUDE.md current-state update at session end. Nothing is pushed to main without Andre's explicit go; work is committed locally and flagged.
