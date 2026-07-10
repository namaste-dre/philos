# 10c Governing Rubric - Question Hover-Explanation Rewrite

_Fable 5, 2026-07-10. Written before generation per D86. Authority: D45 (locked 10c scope: all explanations to FK grade <= 8), D21 (hard neutrality rules for the feature), D23 (no sibling references, standing rule), audit plan 10c (explain the underlying situation, junior-high level, variable length). Baseline measured this session: 160/160 coverage, zero dashes, average FK 14.1, 154 of 160 over grade 8. The bank is accurate and neutral but written at college level; the rewrite is a reading-level and depth rewrite, not a correction pass._

## 1. What an explanation is for

The reader is someone who tapped "?" because the question confused them. The explanation's only job is to remove the confusion: say plainly what situation or idea the question puts in front of them, and what kind of thing they are being asked. It is a translator, not a tutor and not a judge.

## 2. Hard rules (all inherited, all still binding)

1. **Never interpret what the question is "really asking" and never hint at which answer fits which position** (D21). For tradeoff/scenario items, describe the setup and the general issue, never the individual options.
2. **The standalone test** (D21): shown the explanation alone, a reader must not be able to guess which answer it favours. Run it on every rewrite.
3. **No reference to any other item, ever** (D23), even where near-pairs are real and deliberate.
4. **Neutrality is two-sided** (Ground Rule 4): the religious libertarian and the determinist atheist both read it and neither feels nudged or judged.
5. **Zero em dashes, zero en dashes** (Ground Rule 5). Scripted scan after drafting.
6. British spellings where the app already uses them (behaviour, organise).

## 3. New bar this pass adds

1. **FK grade <= 8.0 on every entry**, computed programmatically, not estimated. In practice: sentences average 10 to 14 words, no sentence over 20, and polysyllabic philosophy words are either dropped or paid for with very short sentences around them.
2. **Break the idea down, do not restate it.** The old failure mode was rewording the question in different word order. The rewrite names the concrete situation underneath the abstraction. Where the question is a thought experiment, say what the experiment imagines and what it is testing, in plain words.
3. **Length follows need** (audit plan 10c): a plain Likert statement may need one or two short sentences; a layered thought experiment may need four or five. No fixed-length blurbs.
4. **Plain-word substitutions, used consistently:** "physical explanation" over "physicalist account", "made of" over "constituted by", "beyond the physical" over "supernatural/non-physical" where possible, "inner life" or "felt experience" over "phenomenal consciousness/qualia", "right and wrong" over "morality/moral facts" where the sentence allows. Terms the question itself uses may be reused; never introduce a harder term than the question did.

## 4. Per-item disposition

Every item gets one of: KEEP (already at bar, 6 or fewer expected), SIMPLIFY (same content, plainer words and shorter sentences), or REBUILD (content also failed the break-it-down bar). Dispositions are implicit in the diff; anything REBUILD-level gets a line in the batch notes if the content changed direction.

## 5. Verification pass (scripted plus read-through)

1. Coverage: 160/160 keys, no orphans, ids match the live question bank exactly.
2. FK grade <= 8.0 on all 160 (the check_explanations.js scorer).
3. Dash scan: zero em, zero en.
4. Sibling-reference and hint-word scans clean.
5. `node --check` on the extracted script.
6. Standalone-test read on every REBUILD and a sample of SIMPLIFYs, plus the six sensitive axes (religion, moral_authority, politics, economics, animal_ethics, naturalism) read in full with the two-sided test.
