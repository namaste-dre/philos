# Sonnet 5 — Pre-Audit Fixes and Fact-Finding, 2026-07-06

Andre asked Sonnet 5 to knock out any items from `FABLE5_AUDIT_PLAN.md` that could be done with full confidence (pure engineering, no psychometric/philosophical judgment required), then run a fact-finding pass across the rest of the plan so Fable 5 doesn't have to re-derive ground truth from an 11,896-line single-file app.

All changes below are local edits to `C:\philos\index.html` only. Nothing has been pushed (deploy is still the existing manual GitHub Desktop -> main -> Vercel flow). JS syntax was validated with `node --check` on the extracted inline `<script>` block after every fix (see bottom of this doc).

Companion document: `FABLE5_FACT_FINDING.md` (the full fact-finding dossier, mapped to every phase of the audit plan).

---

## FIXES APPLIED (full confidence, done)

### 1. Randomizer/resume bug — root cause found and fixed

**This was the actual Phase 10a bug**, and it was not where Andre's description first pointed (question navigation itself). `nextQ()`/`prevQ()` (around line 6124) just move an index and re-render — no reshuffle happens there.

**Real cause:** `saveProgress()` persisted `answers`, `current_q`, and `qa_flags` to Supabase's `assessment_progress` table, but never saved the shuffled question order. `restoreProgress()` then called `buildShuffledOrder()` fresh on every resume, generating a brand-new random order while reusing the OLD `current_q` index and `answers` dict. Different shuffle + same position index = exactly the reported symptom (going back shows unanswered questions, going forward re-shows answered ones).

**Fix:** `saveProgress()` now writes the shuffled question-ID order into the existing `answers` jsonb payload under a reserved key (`__shuffleOrder`) — no database schema change needed, since `answers` is already a flexible jsonb column keyed by question id, and nothing in the codebase iterates its keys assuming every one is a real question id (verified: every read is `state.answers[q.id]`, never a blind `Object.keys` walk that dereferences into `QUESTIONS`). `restoreProgress()` now reconstructs `shuffledQuestions` from that saved order when present, and strips `__shuffleOrder` back out before it's used as live app state. Falls back to the old fresh-shuffle behavior only for legacy rows saved before this fix shipped (self-healing after their next save).

**Residual, not fixed:** answer-OPTION order within a question is still regenerated fresh on resume (a smaller version of the same class of bug — the options a person sees for a given question could differ slightly on resume vs. first pass). Fixing this fully would mean also persisting per-question option order, which I scoped out to keep this change small and verifiable. Flagging for Fable/backlog.

**Also could not verify:** whether the `assessment_progress` table might already have unused columns intended for this (I could not confirm the real schema — see "Supabase access" note below), so I built the fix to need zero schema changes rather than assume a column exists.

### 2. "Worldview Strength" renamed to "Conviction Strength"

Fixed in all 3 places it appeared: the in-app report stat tooltip (label + description text), the shareable card's stat block label, and the code comment describing the underlying metric. No other occurrences found (verified via search — the metric's internal variable name was already `convPctSt`, suggesting a partial rename was done previously and never finished).

### 3. Redundant shareable-card footer removed

The card had a footer block below the call-to-action that just repeated it ("PHIL/OS · thelifepm.com"), duplicating the URL pill already shown in the CTA block directly above. Removed entirely, per Andre's request to free up space on an already-tight 1080x1920 card. Canvas dimensions were left untouched (fixed social-story format, per the Ground Rules) — the freed space just becomes a bit more breathing room before the card's bottom edge rather than being redistributed, since every block in this renderer flows top-down rather than being pinned to a fixed bottom position.

**Bonus fix while in this block:** the CTA text said "34 belief axes." The actual system has 32 axes (confirmed: `AXIS_META` has exactly 32 keys, matching `CLAUDE.md` and the archetype engine). Corrected to 32.

### 4. Fingerprint axis labels no longer truncate

Root cause confirmed exactly: `meta.label.length>14 ? meta.label.slice(0,13)+'.' : meta.label` — a hard 13-character slice. This is exactly what produced Andre's examples: "Epistemic Method" -> "Epistemic Met." and "Social Ontology" -> "Social Ontolo." (his transcribed "epistetic met" and "social ontolo" match this mechanism precisely once you account for dictation/transcription of what he saw on screen).

**Fix:** replaced the hard truncation with a measure-then-shrink-then-wrap approach (the same technique already used elsewhere in this file for the archetype name auto-sizing): try the full label at 21px; if it doesn't fit the label column width, retry at 17px; if it still doesn't fit, wrap it across two lines at 15px on the second line, breaking at a word boundary. Every axis name now always renders in full — nothing is ever cut off regardless of length.

### 5. Nav placement — My Profile / Resources moved next to Settings

Confirmed the exact layout bug: `#nav-links` (containing "My Profile" and "Resources") sat right after the logo/home button near the left, separated by the entire flexible progress-bar spacer from `.nav-right` (Sign In + Settings) on the far right — exactly Andre's complaint that these felt like they were floating alone at top-center. Moved the `#nav-links` markup into `.nav-right`, positioned directly before the Settings dropdown. `.nav-right` already had `display:flex; gap:16px` in its CSS class, so no new styling was needed beyond dropping the now-irrelevant `margin-left:20px` that was tailored to the old position.

**Left untouched, per Andre's explicit note:** the mobile bottom nav (Home / My Profile / Resources / Settings) — he confirmed that one already works well.

### 6. Own writing held to the no-dash rule

While adding code comments to document fixes 1-5 above, I initially used em dashes in four of my own new comments — a direct violation of the rule I'm supposed to be enforcing app-wide. Caught and corrected all four during this same pass (verified via `rg` search restricted to my own added text). Noting this transparently rather than quietly fixing it, since it's a useful data point: this class of mistake is easy to make even when actively trying to avoid it, which matters for Phase 7/10j — a single find-and-fix pass on the question bank content won't be enough; it needs a dedicated verification pass afterward too.

---

## FOUND BUT NOT FIXED (needs Fable's eyes, or live/visual verification I couldn't do from static code)

### Card icon centering (Phase 9)

Read the full canvas rendering logic (`renderCardToCanvas`, ~line 9590 onward). The icon IS already programmatically centered — but within a **fixed-width reserved zone** (`iconSize + 24` = 234px) at the right edge of the header block, regardless of how much of that space the actual archetype name text uses. For short names this likely reads as "off to the edge" with a lot of dead space between the visible text and the icon; the icon's own glow ring is drawn with radius up to `iconSize*1.1` (231px) from its center, which could bleed into the block's clip boundary and read as "cut off" for names that push close to the reserved zone.

I did not change this. The correct fix (centering relative to the actual rendered text's trailing edge, per Andre's literal description, with a clamp so the icon and its glow never approach the clip edge) requires visually verifying the result against an actual rendered card, which I could not do without either running the full authenticated assessment flow or standing up a way to render the canvas in isolation — both felt like scope creep for a "full confidence" pass. Flagging with the exact mechanism and line numbers so Fable (or a visual QA pass) can fix and verify it directly rather than inheriting a guess.

### DNA visualization — 2D bars to "more 3D"

Confirmed: `BLOCK 6 — PHILOSOPHICAL DNA` (~line 9920) is a straightforward bidirectional bar chart, flat rectangles above/below a midline, one per axis. This is a design/rendering craft decision (how to fake depth in a 2D canvas context — gradients, a shaded "side face," etc.), not a bug fix, and Andre explicitly left the feasibility call to Fable in the audit plan. Left untouched.

### Mobile sign-in screen — graphics disappearing on tap

The sign-in flow is a modal (`#auth-modal`, `position:fixed; inset:0`), not a dedicated screen route. The background decoration is driven by `::before`/`::after` pseudo-elements with several breakpoint-specific rules (lines ~2432-2464). I can see the structure but can't reproduce a tap-triggered disappearance from static code alone — this needs a live device/browser test to actually diagnose (could be a z-index/stacking issue, a class toggle on touch, or a mobile Safari repaint quirk with `position:fixed` + blur filters). Flagging the suspect region rather than guessing a fix.

### Mobile report-section dropdown scroll bug

Found the dropdown (`#report-nav-dropdown`, CSS ~line 1011) — it's a plain `position: static` element inside the report nav, not `position: sticky` or `fixed`, so the "shifts and overlaps text on scroll up" bug likely isn't in this element's own CSS but in a parent container's scroll/transform behavior. Needs the same live-reproduction treatment as the sign-in bug above — didn't want to guess at a fix for a bug I can't see happen.

---

## VALIDATION

```
node --check <extracted inline <script> block>   ->  OK  (run after fixes 1-5, and again after the dash cleanup in fix 6)
```

No other JS files (`api/*.js`) were touched.
