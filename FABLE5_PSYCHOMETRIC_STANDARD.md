# Phil OS - The Validation Standard (Fable 5, Phase 2)

_Written 2026-07-06 by Fable 5 acting as psychometrician and philosopher for the A-Z audit (`FABLE5_AUDIT_PLAN.md` Phase 2). This document defines the exact methodology, terminology, formulas, and thresholds the Phase 3-6 audit will apply and the Phase 7-9 rebuild must satisfy. It is the reverse-engineering contract: the targets here are the source of truth, and the instrument is built backward from them. Companion vault doc: `Phil OS - Full Psychometric and Philosophical Audit v4.md` (776), which will hold the graded findings._

_Builds on, and where stated supersedes, the prior groundwork: Psychometric Validity Audit v1 (2026-05-26, C+), v2 Post-Fix (B-), Full Audit v3 (B+, provisional), and Item Analysis and Question Standards Part 1 (the Five Laws, still canonical)._

---

## 0. Approach decision (required by Phase 2, step 2)

**Decision: one agent holding both disciplines, running a fixed dual-lens protocol per item, then per axis, then instrument-wide. Not a multi-agent team.**

Reasoning: the failure mode this project has actually suffered is not lack of expertise, it is loss of coherence at handoffs (D6's fix violating D7's rule from the same session; the Architecture doc contradicting the live code it was verified against). A psychometrician agent and a philosopher agent communicating through messages would reintroduce exactly that seam at every one of 160 items. The two disciplines do not need to negotiate; they need to be simultaneously satisfied, which is a conjunction a single evaluator applies. The protocol below makes the two lenses explicit and separately logged, so the discipline separation survives without the handoff cost.

**Per-item protocol (applied to every one of the 160 items in Phase 3/4):**
1. Psychometric lens: construct match to its axis, keying direction vs `AXIS_META`, option-score range and spacing, format appropriateness, redundancy vs siblings, readability metric.
2. Philosophical lens: accuracy (PhilPapers-defensible), completeness of the option set for that construct, neutrality (two-sided test), jargon check.
3. Verdict: PASS / MODIFY / REWRITE, with the reason logged. Both lenses must pass for PASS.

Aggregate protocol: after all 5 items of an axis are judged, the axis is judged as a scale (coverage of both poles, reversal balance, redundancy pattern, alpha prognosis); after all 32 axes, the instrument is judged as a system (archetype geometry, contradiction net, distribution behavior).

---

## 1. Normative references

The standard applies these sources, by name, as a working psychometrician would:

- **AERA/APA/NCME, Standards for Educational and Psychological Testing (2014)** - the governing framework: validity as a unified argument built from content, response process, internal structure, relations to other variables, and consequences.
- **DeVellis (2016), Scale Development** - item writing, scale length, alpha interpretation.
- **Nunnally and Bernstein (1994), Psychometric Theory** - reliability thresholds.
- **Clark and Watson (1995; 2019 update), Constructing Validity** - inter-item correlation bands, construct homogeneity.
- **Paulhus (1991); Weijters, Baumgartner and Schillewaert (2013)** - response styles and reversed-item design.
- **Podsakoff et al. (2003)** - method bias controls.
- **Willis (2005), Cognitive Interviewing** - comprehension standards.
- **Horn (1965) parallel analysis; Hu and Bentler (1999) fit cutoffs; Vandenberg and Lance (2000) invariance** - structural validity.
- **McDonald (1999)** - omega as the preferred reliability coefficient.
- **Samejima (1969) graded response model** - IRT calibration for polytomous items.
- **PhilPapers Surveys (Bourget and Chalmers 2014; 2020)** - philosophical content benchmark and prevalence priors.
- **Established neighbor instruments for convergent validity:** FAD-Plus (Paulhus and Carey 2011: free will and determinism beliefs), MFQ-2 (Graham et al./Atari et al. 2023: moral foundations), Oxford Utilitarianism Scale (Kahane et al. 2018), Big Five/IPIP Openness, CRT (Frederick 2005) as a discriminant marker.

---

## 2. Construct and content validity standard

1. **Every axis carries a construct card**: one-sentence construct definition, both pole definitions with the philosophical positions each pole includes, the PhilPapers survey anchor where one exists, and the named traditions that must be able to score at each pole and at the midpoint. Phase 3 builds these from the Architecture doc + live `AXIS_META`; Phase 7 items are written against them.
2. **Content blueprint per axis**: 5 items covering distinct facets of the construct (no near-duplicate wording except a declared reliability pair, maximum one such pair per axis, never referenced in explanations per D23).
3. **Midpoint semantics**: 4 means a genuine philosophical position (agnosticism, pluralism, compatibilism-style synthesis) named in the construct card, never "confused."
4. **Completeness test**: for each item's option set, every major position on that axis's construct card must have an option it can honestly select (the "science denier" test). Completeness is achieved inside 3-5 options by making options represent position classes, not individual philosophers.
5. **Neutrality test, operationalized**: for each item, write down the two most opposed real-world respondents on that axis (for example: devout libertarian-free-will theist vs hard-determinist anti-theist). The item fails if either would experience any option as a caricature, an accusation, or the "obviously stupid" choice. Loaded verbs ("admit," "deny," "cling to"), scare quotes, and asymmetric sophistication of option wording are automatic fails.

## 3. Item-writing standard

Carries forward the Five Laws (Item Analysis Part 1) unchanged, plus:

1. **Readability**: question stems and options at or below US grade 10 reading level (Flesch-Kincaid grade computed programmatically); hover explanations at or below grade 8. No philosophical jargon in stems or options; jargon lives in reports with hover definitions.
2. **Option counts**: scenario/tradeoff items have 3-5 options; Likert items use the 1-7 scale with pole labels.
3. **Option score coverage**: every scenario/tradeoff item reaches ≤3 and ≥5 (post-reversal where applicable); across the 5 items of an axis, both poles (≤2 and ≥6) must be reachable.
4. **Option spacing**: no two options within an item closer than 1 scale point; the score assignments must be defensible orderings of the positions expressed.
5. **No stem may presuppose the answer to another axis** (cross-axis contamination check).
6. **Writing style**: human, concrete, no em or en dashes anywhere, no AI-flavored constructions ("delve," "tapestry," triadic flourishes). A dedicated dash-and-style verification pass runs after any content change (the Sonnet self-catch proved a careful first draft is not enough).

## 4. Reversed-item and keying standard (supersedes A7 and the D8 recount)

1. **The `reversed:true` flag is exclusively a Likert mechanism** (reaffirms D7). Scenario/tradeoff items express polarity only through natively-authored option scores. The three current exceptions (t2me02, t2me03, t2me05) are scheduled for Phase 7 conversion: rewrite their option scores to native polarity, drop the flags. No respondent-visible change; removes the double-inversion fragility that caused the 18-item bug class.
2. **Acquiescence control is defined over the Likert subset per axis**, because agreement bias operates on agree/disagree formats (Paulhus 1991; Weijters 2013). Standard: **each axis's Likert items are keyed in both directions wherever the axis has 2+ Likert items** - at least one poleL-keyed and one poleR-keyed. An axis with only one Likert item cannot be balanced within-format and must compensate with option-design bidirectionality in its scenario/tradeoff items (an option where agreeing with an attractive-sounding statement scores toward the pole an acquiescent respondent would not otherwise reach).
3. **Instrument-level target**: 30-50% of all Likert items reverse-keyed, distributed so no axis's Likert subset is single-direction. The current live state (49 of 72 Likert items reversed = 68%) is over-corrected in aggregate and unbalanced per axis; Phase 3 computes the exact per-axis keying table and Phase 7 rebalances against this standard.
4. **A7 is to be formally amended at Checkpoint A** with a dated Decisions Log entry stating the new standard in the terms above (per-axis balanced Likert keying), retiring the "2 reversed per axis (40%), identical" formulation that never described a bug-free state.

## 5. Scoring model standard

1. Reversal transform `8 - raw` on flagged Likert items, applied before accumulation: correct, keep.
2. Weighted mean per axis: keep, but **no inert parameters presented as design features**. The 1.5/1.0 tier weight currently cancels within every axis (D14). Phase 3 must model both options (wire the weight into archetype distance and re-run the full inter-family separation analysis, or remove the weight and re-document tier priority as narrative structure) and present the choice at Checkpoint A. The standard itself takes no side; it forbids the current state where documentation claims an effect the code does not produce.
3. All scores reported on the 1-7 scale with 4 as the genuine midpoint; no hidden rescaling.
4. Fingerprint: deviation from 4 with the sqrt(n/maxItems) precision term (currently a no-op at uniform n=5, retained for the planned daily-question feature) and deterministic tiebreak: correct, keep.

## 6. Reliability standard

- **Design-stage (now, pre-data)**: Spearman-Brown prognosis per axis, alpha = k*rbar / (1 + (k-1)*rbar), with k=5 and rbar assumed 0.30-0.40 for attitude scales: prognosis 0.68-0.77. Design target: every axis constructed so rbar 0.15-0.50 (Clark and Watson) is plausible - facets distinct enough to avoid bloated-specific pairs, homogeneous enough to cohere.
- **Empirical (N ≥ 300)**: report McDonald's omega alongside Cronbach's alpha per axis. Targets: omega/alpha ≥ 0.70 target, ≥ 0.65 provisional floor for a 5-item broad philosophical construct with a documented revision plan, < 0.60 mandates item revision. Corrected item-total correlation ≥ 0.30 per item; < 0.20 revise or drop.
- **Test-retest (50 volunteers, 2-4 week interval)**: ICC(2,1) ≥ 0.75 per axis; archetype assignment agreement ≥ 80%, liminal cases counted as agreement if either assignment matches.
- **Honesty rule**: until empirical data exists, every published reliability figure is labeled a design prognosis, never "validated."

## 7. Structural, convergent, and criterion validity standard (empirical roadmap)

- **N ≥ 300**: EFA on axis scores (KMO ≥ 0.80, extraction by parallel analysis) testing whether the 32 axes behave as distinct-but-correlated dimensions; the specific watch-list pairs from v3 Ph1 (knowledge vs epistemic_method; society vs social_ontology vs politics; responsibility vs self vs freewill_practice; physicalism vs mind_consciousness) get explicit inter-axis r checks: r > 0.80 forces merge-or-differentiate.
- **N ≥ 1000**: CFA of the tier model (CFI ≥ 0.90, RMSEA ≤ 0.06, SRMR ≤ 0.08); measurement invariance across item formats and key demographics (configural, metric, scalar; ΔCFI ≤ 0.01 per step); Samejima GRM calibration for item discrimination/difficulty.
- **Convergent/discriminant (any N ≥ 150 with an added module)**: determinism axis vs FAD-Plus (predicted r ≥ 0.60 convergent); ethics axis vs Oxford Utilitarianism Scale (r ≥ 0.50); moral_scope/animal_ethics vs MFQ-2 care/sanctity patterns; naturalism vs religiosity measures (strong negative). Discriminant: no axis should correlate ≥ 0.60 with CRT or vocabulary (the instrument must not be an intelligence test in disguise).
- **Prevalence claims**: rarity percentages remain labeled as estimates from published survey priors until N ≥ 500, then switch to empirical counts (the SQL is one GROUP BY).

## 8. Response-quality and bias standard

1. Acquiescence: handled by Section 4 keying balance.
2. Midpoint overuse: monitor per item post-launch; an item where > 40% select 4 (or the midpoint option) is functioning as an avoidance option and gets revised (Law 3).
3. Extreme response style: monitor per respondent (share of 1/7 answers); flagged in analytics, not scored against the user.
4. Social desirability: controlled by design through the neutrality standard (no option may be the socially "correct" one); no lie scale in a consumer instrument.
5. Data quality signals (feeds Phase 13 PostHog spec): per-item dwell time (comprehension flag at consistent ≥ 2 min), total completion time floor, straight-lining detector over consecutive Likert runs.

## 9. Classification (archetype) standard

1. **Feature space**: 13 SIG_AXES, Euclidean distance normalized by axis count. Distances computed on the same 1-7 scale as scores.
2. **Separation**: minimum inter-family prototype distance ≥ 1.5 for at least 94% of pairs (current state), with every sub-threshold pair explicitly justified as genuine philosophical overlap; minimum intra-family variant spread ≥ 0.30.
3. **Stability under measurement error (new, runnable now with zero users)**: Monte Carlo perturbation test. Simulate respondents at each of the 60 prototype vectors plus midpoint and liminal-boundary profiles; add per-axis noise at SEM = 0.4 scale points; archetype assignment must be stable ≥ 90% at prototypes, and liminal flags must fire in the boundary band. This converts the liminal threshold (1.0) from an argued number into a tested one before any real data arrives.
4. **Reachability**: all 60 archetypes reachable from valid answer patterns (dev-panel integrity check already covers count/uniqueness; Phase 3 adds reachability-under-noise).
5. **Honesty rule**: the archetype reflects the 13 foundational axes; user-facing copy must not claim it summarizes all 32 (v1 audit F10 stands).

## 10. Contradiction engine standard

1. Every rule carries a documented grounding class: Tier A = direct inconsistency (Harman 1986), Tier B = coherence strain (Rawls 1971 reflective equilibrium), Tier C = dialectical tension (Bourget and Chalmers). The tier taxonomy is philosophically correct and locked (A3).
2. Thresholds anchored to scale semantics (strong pole ≥ 5.5 / ≤ 2.5 for A; ≥ 5.0 / ≤ 3.0 for B), strength continuous in [0,1], sorted tier-then-strength. Current mechanism passes; the 2026-06-22 fix is regression-tested.
3. **Coverage audit (Phase 3)**: all 42 rules re-derived against the axis construct cards; the two candidate rules from v3 P7 (physicalism + meaning realism; meta-humility) checked against the live set (C41/C42 were added 2026-05-26 and may already cover them); bidirectionality table re-verified; false-positive test: an all-midpoint profile must fire zero rules.
4. Framing standard: user-facing contradiction copy is an invitation to refine reasoning, never a judgment (this is also the landing-page positioning per Phase 10f).

## 11. Reverse-engineering targets (the Phase 7 contract)

Every axis, after the rebuild, must satisfy this table by construction:

| Property | Target |
|---|---|
| Items | Exactly 5: 2-3 Likert, 2-3 scenario/tradeoff |
| Likert keying | Both directions represented wherever the axis has 2+ Likert items; `reversed:true` on Likert only |
| Option counts | 3-5 per scenario/tradeoff item |
| Pole coverage | Both poles reachable at ≤2 and ≥6 across the axis; every item reaches ≤3 and ≥5 |
| Facets | 5 distinct facets of the construct card; max one declared reliability pair |
| Readability | Stems and options ≤ grade 10; explanations ≤ grade 8 (computed, not eyeballed) |
| Neutrality | Passes the two-sided test in Section 2.5, logged per item |
| Completeness | Every construct-card position class has an honest option somewhere in the axis |
| Alpha prognosis | Spearman-Brown ≥ 0.70 at rbar = 0.35; inter-item r design band 0.15-0.50 |
| Style | Zero em/en dashes, human register, verified in a dedicated post-pass |

Instrument-level, after rebuild: archetype geometry per Section 9 including the Monte Carlo stability test; contradiction net per Section 10; all-midpoint profile fires zero contradictions and lands liminal in a centrist family; simulated prototype respondents (one per archetype) each receive their own archetype.

## 12. Grading rubric (used in Phases 3-6 and again in Phase 15)

- **A**: meets every applicable design standard above; empirical items pending data are correctly labeled as pending; no honesty-rule violations.
- **B**: meets the core standards with isolated, enumerated deviations that have documented remediation plans.
- **C**: systematic deviation in one major standard (for example keying imbalance across many axes) or several minor ones; instrument usable but claims must be qualified.
- **D**: a defect that contaminates scores or claims (a scoring bug, a false validity claim) present in live code or live copy.
- **F**: construct failure; the measured thing is not the claimed thing.

Grades are assigned per domain: psychometric design, philosophical accuracy/neutrality, report content, card content (Phases 3, 4, 5, 6 respectively), then re-assigned in Phase 15 for the before/after comparison Andre requires.

## 13. What is checkable now vs later (so nobody confuses the two)

**Now, with zero additional users:** every design standard above; full 160-item dual-lens audit; readability metrics; keying tables; archetype Monte Carlo stability; contradiction grid analysis; simulated-respondent behavior; all honesty-rule checks on live copy.

**Only with data:** alpha/omega, item-total correlations, EFA/CFA, invariance, IRT, test-retest, convergent validity, empirical prevalence, empirical liminal calibration. Milestones: N=100 (distributions, floor/ceiling), N=300 (reliability, EFA, watch-list correlations), N=1000 (CFA, invariance, IRT). These integrate with the PostHog instrumentation decided for Phase 13.

_End of standard. Phase 3 (psychometric audit of the current instrument against this standard) is next._
