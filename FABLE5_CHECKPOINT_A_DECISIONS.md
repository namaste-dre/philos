# Checkpoint A - Decision List for Andre

> **STATUS: RULED 2026-07-06.** Andre ruled on every item in a written review. All rulings are logged as dated Decisions Log entries **D40-D51** in `Phil OS - Decisions Log.md` (vault, 776) - THAT log is now the authority, not this doc. Summary: A1-A6 approved (A4's rationale condition investigated and satisfied - see D43), B approved (batch prepared), C1 approved + report versioning metadata (D47), C2 approved with name-on-card opt-in/OFF-default (D48), D1-D6 all approved with D1-D3 blocking any marketing push (D49). New: Instrument Governance doc required (D50, delivered). The strategic identity question was ruled the same day (D52: "Domain authority defines the construct; psychometrics defines the measurement") and a decision template adopted (D53). **The B batch was pushed by Andre and verified live 2026-07-06.** Phase 7 is unblocked.

_Fable 5, 2026-07-06. Every decision the audit surfaced, in one place. Each has my recommendation and the reasoning in one line; the full evidence lives in `Phil OS - Full Psychometric and Philosophical Audit v4.md` (vault, 776) and `FABLE5_PHASE1_VAULT_AUDIT_2026-07-06.md`. Rule on these in any form you like (voice note, chat, inline notes) - each becomes a dated Decisions Log entry once ruled, and Phase 7 starts after that._

**Grades on the table:** Psychometrics D · Philosophy/neutrality C · Report C · Card C · Data protection D.

---

## A. Instrument decisions (block Phase 7)

**A1. Reversed-item standard - replace locked decision A7.**
New standard: the `reversed` flag is Likert-only; every axis's Likert items must be keyed in both directions. Fix list: 11 axes have all Likerts reverse-keyed, politics needs a second Likert, and the 3 flagged non-Likert `meaning` items get their option scores rewritten natively (no user-visible change).
**Recommend: approve.** The old "uniform 2 per axis (40%)" was only ever true as a count inflated by 15 scoring bugs.

**A2. Liminal classification fix.**
58 of 60 perfect prototypes currently flag "liminal" at zero noise (threshold 1.0 vs second-best overall, which is nearly always a same-family sibling 0.4-0.7 away). The flag is meaningless as shipped.
**Recommend: family-level liminality** (gap to best variant of the second-best family, threshold 1.0), variant-level confidence shown separately or not at all. Recalibrate empirically at N=100+.

**A3. Tier weight (1.5/1.0) - keep or delete.**
Proven doubly inert: cancels inside axis means, and all 13 SIG_AXES share the same weight so archetype distance is unaffected.
**Recommend: keep as recorded metadata (it is written to the responses table and useful later), correct every doc that claims it affects scoring.**

**A4. epistemic_method convention - where does rationalism sit?**
Items score rationalism at 5; archetype sigs put it at 3 (the Kantian). Real rationalists get pulled away from rationalist archetypes.
**Recommend: rationalism = 3 system-wide** (matches the sig calibration and the v3 audit's Kantian reasoning); re-anchor the two items in Phase 7.

**A5. Contradiction rule C01b.**
Fires "hard contradiction" (Tier A) for strong retributivists who are not determinists. Libertarian retributivism is a classical coherent package; as written the rule is philosophically wrong and non-neutral.
**Recommend: demote to Tier C, reframed as an examination prompt** ("what grounds desert on your view?"), or delete. I lean demote-and-reframe.

**A6. The Phase 7 REWRITE/MODIFY list (philosophy).**
4 REWRITEs: t3r03 and t3r05 (religion-axis neutrality failures), t2m02 and t3so04 (already approved as D9, still unpushed). ~12 scoring/accuracy MODIFYs (incl. t1tel06b flag removal - live bug, teleologists score backwards; t15em04; t3mind02; t2fwip01; t3unc02; t1p05 mysterianism reframe; moral_authority consistency). 4 completeness additions (science-denial option on t2s02 - your own example, still live; believer option on t1n03; transcendent-meaning option on t2me02; deterrence option on t3j05). ~7 redundancy dedupes. Bank-wide language simplification to grade <=10 (currently 13.9), all 160 explanations rewritten to grade <=8.
**Recommend: approve the list as Phase 7 scope.** ~82% of items stay as-is; the strong bones (trolley/organ, Sisyphus, meaning-pill, twins, tumor) are untouched.

## B. Mechanical fixes batch (no judgment content - just approve shipping)

One validated batch, pushed together: delete the phantom comma at index.html:7269 (closes 42-vs-43 forever) · remove t1tel06b's reversed flag · gate `api/chat.js` behind an env flag until the feature ships · push the long-approved D9 stem rewrites.
**Recommend: I prepare the batch, you push via GitHub Desktop as usual.**

## C. Report and card architecture (block Phases 8-9)

**C1. Report: hybrid restructure (P5-2).**
Hard-write per variant (60): card "Who You Are" + tagline. Curated library with data-driven selection: Growth Edges (~64 axis entries + ~42 contradiction entries). Keep AI, tightened: identity + world lenses + alignment (the continuous-score nuance lives there). Plus three fixes: programmatic output validator (dash strip, length caps - the no-dash rule is currently enforced by hoping the model listens), temperature ~0.6 for reproducibility, drop or downgrade the pseudo-measured OCEAN block from the prompt.
**Recommend: approve all.**

**C2. Card Phase 9 additions** (on top of your dictated list): user's name on the card (opt-in - the "that's Sarah's result" viral loop needs identity), small QR code in the CTA, 4-6 word tensions blurb, cut text density ~half, fingerprint bars redrawn bidirectional from center (left-pole extremists currently render near-empty bars), icon centered relative to actual text width, consolidate the duplicated rarity map.
**Recommend: approve; format re-locks at 1080x1920 (P7 correction entry - what is live and what stories actually use).**

## D. Data protection package (some items block ANY marketing push)

**D1. Build real account deletion.** The consent text promises Settings-based deletion; the button just signs out. Either build it or stop promising it - building it is the only answer consistent with the product.
**D2. Privacy notice (Art. 13).** None exists. Names controller, purposes, processors (Supabase, Anthropic, Resend, Vercel), transfers, retention, rights. I draft, you approve.
**D3. Consent wording upgrade (Art. 9).** Name that the data reveals religious/philosophical beliefs; name processors; add consent versioning in Supabase.
**D4. Reword "Your data is never sold or shared"** -> "never sold; shared for scientific research only in de-identified form and only if you opt in." (Current text conflicts with your research program.)
**D5. Research-use opt-in (your new requirement).** Separate default-OFF toggle, changeable in Settings anytime: de-identified scores/archetype/age/gender/country to accredited researchers, never name or email. Stored with own timestamp + version; `research_profiles` table is the vehicle. Art. 89 safeguards documented.
**D6. Name minimization.** Stop sending real first names to the Anthropic API; placeholder token, substitute client-side.
**SUPERSEDED 2026-07-07 - see Decisions Log D76 and D85. Do not implement D6 as written.** Andre reviewed this directly and ruled the opposite: first-name personalization to Anthropic is an intentional, disclosed product decision, not a leak, and must NOT be removed. If Phase 8's report-prompt rewrite touches personalization, it must preserve real first-name usage, not substitute a placeholder token.
**Recommend: approve D1-D5; D6 is reversed, D1 + D2 before any marketing push.**

## E. Still owed to you / pending inputs

**E1. Phase 11 DB target architecture doc** - I owe you this design (tables, views, policies, real-time QA-flag writes, research consent storage, view security fixes). Delivered for your approval before Phase 11 executes.
**E2. Sonnet 6B run (items 3-9)** - monitoring/alerting, quota arithmetic, email + share-page surfaces + OG tags, accessibility mechanics, performance, i18n dead-toggle check, licensing facts. The brief is ready in `FABLE5_AUDIT_PLAN.md` Phase 6B - hand it to a Sonnet session whenever convenient. The i18n decision (translate vs remove languages) waits on its answer.

---

## What Andre does now

1. **Read this doc** (you just did) and, if you want depth on anything, the matching finding in the v4 audit doc.
2. **Rule on A1-A6, B, C1-C2, D1-D6** - a voice note or a line per item is enough ("A: all approved except..., C2: no name on card," etc.).
3. **Kick off the Sonnet 6B session** with the Phase 6B brief when convenient (parallel track, nothing blocks on it except i18n).
4. Say the word - I log every ruling as a dated Decisions Log entry and **Phase 7 begins.**
