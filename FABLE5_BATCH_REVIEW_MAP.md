# Risk-Boundary Review Map for the D93-D100 Batch

_Fable 5, 2026-07-10, per D102 priority 3. Commits under review: `0d7efd9` (Phase 8), `4cc13f8` (10c), `301a14a` (Phase 15 doc), `1ffc8bb` (10f doc), `5e71c51` (400 fix). Ranked by launch risk. Boundaries 1-3 are where reviewer judgment is genuinely needed; 4-8 are cheaper checks. Anything not listed is mechanical (renderers, selector code, versioning wiring) and is covered by the passing QA run plus a Sonnet code read if desired._

## 1. Growth-edge axis entries - pole moralizing (HIGHEST RISK)

- **Where:** `index.html`, `GROWTH_EDGES_AXIS`, 64 entries as 32 L/R pairs.
- **Launch criterion at stake:** "growth edges do not moralize one pole over another."
- **Test:** read each pair TOGETHER and ask: do both poles get an edge of equal weight and dignity, or does one read as a flaw and the other as a footnote? Priority pairs (belief-sensitive): religion, naturalism, moral_authority, epistemic_method, knowledge, science, politics, economics, animal_ethics, determinism, freewill_practice. My own flag for extra scrutiny: the L (faith/tradition/skeptic-of-science) entries - I wrote them for equal dignity, but I am the wrong person to certify that.
- **Reviewer:** GPT full pass on the 11 priority pairs, spot-check the rest; Andre rules on any flagged pair.

## 2. Growth-edge contradiction entries - tier register (HIGH)

- **Where:** `index.html`, `GROWTH_EDGES_CONTRA`, 42 entries.
- **At stake:** C-tier entries must treat coherent positions as coherent (the D44/D57 C01b standard), not as problems to fix. A-tier may say resolution is needed; C-tier may not.
- **Test:** read the 9 C-tier entries (C01b, C08b, C11, C12, C12b, C22b, C26, C27, C28) against the rule: does any imply the respondent should abandon the position? Then spot-check 5 of the 22 B-tier for the same drift.
- **Reviewer:** GPT; Andre rules on flags.

## 3. Hover explanations - answer steering (HIGH)

- **Where:** `index.html`, `QUESTION_EXPLANATIONS`, all 160 rewritten.
- **At stake:** "hover explanations do not steer answers" (D21 standalone test). Scripted checks (FK grade, hint words, sibling refs) passed; the residual risk is subtle steering scripts cannot see.
- **Test:** for each entry on the sensitive axes (religion, moral_authority, naturalism, politics, economics, animal_ethics, moral_ground: 35 entries), read the explanation ALONE, without the question, and ask whether it points toward an answer. Then 15 random entries from the rest.
- **Reviewer:** GPT runs the standalone test; anything ambiguous goes to Andre with both readings stated.

## 4. Archetype whoYouAre/taglines - sig fidelity and dignity parity (MEDIUM)

- **Where:** `index.html`, `ARCHETYPES`, 60 entries, new fields tagline/cardTagline/whoYouAre.
- **At stake:** report interpretation. Two failure modes: text contradicting the variant's sig vector, and warmer writing for worldviews resembling mine than for families 9 (Spiritual Naturalist) and 10 (Conservative Traditionalist).
- **Test:** read families 9 and 10 in full against families 1 (Determined Humanist) and 12 (Nihilist Reductionist) and judge warmth parity. Sig fidelity: spot-check 6 variants (one per riskiest family) against their sig arrays.
- **Reviewer:** GPT for parity read; Andre gut-check on families 9/10 (he knows the believer audience better than either model).

## 5. Report prompt rewrite - restraint (MEDIUM)

- **Where:** `index.html`, prompt1/prompt2 in `generateReport()`.
- **At stake:** psychometric restraint. Ruled items are already settled (first names D76, OCEAN drop D94); the residual judgment call is mine: I replaced the "holy shit it knows me" instruction with a recognition-framed line, and the identity spec still asks for confident second-person claims about the respondent.
- **Test:** read prompt1's WRITING RULES and identity schema and ask: does this push the model toward stated-as-fact psychological claims the instrument cannot support? Compare one generated report (from Andre's QA run) against that bar.
- **Reviewer:** GPT on the prompt text; Andre on the actual QA report output.

## 6. Claims-boundaries doc - public positioning (MEDIUM, unshipped)

- **Where:** `FABLE5_10F_CLAIMS_BOUNDARIES.md` (doc only; nothing live changed).
- **Test:** full read, 2 pages. Two deliberate calls to confirm: "we know of no other instrument" instead of "no comparable tool exists anywhere" (weaker than Andre's original dictation, on defensibility grounds), and the instruction to de-name MBTI/Enneagram/Human Design from the live page.
- **Reviewer:** Andre directly; it is his public voice.

## 7. Phase 15 re-audit grades - self-grading (LOW, provisional)

- **Where:** `FABLE5_PHASE15_REAUDIT_2026-07-10.md`.
- **Test:** treat all grades of my own work (Report B conditional, Explanations A-) as claims pending boundaries 1-5 above; if those pass, the grades stand, if not, they drop. The blockers list (section 2) is worth an independent completeness check: is anything launch-blocking missing?
- **Reviewer:** GPT for the completeness check.

## 8. C01b card text - already ruled (LOWEST)

- **Where:** `index.html`, CONTRADICTIONS C01b. Verified against D44/D57 this session, no change made. One-minute confirm if desired.

## Not in review scope (mechanical, QA-run-covered)

Renderer back-compat (3 files), `selectGrowthEdges()` determinism, validator dash-strip, capture whitelist columns, sketch gate, `/report` rewrite, version endpoint. Evidence: passing scripted checks + the end-to-end QA run. Sonnet can code-read these if wanted; no Fable or GPT judgment needed.
