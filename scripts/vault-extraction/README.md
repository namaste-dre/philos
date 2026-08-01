# Vault extraction scripts

These scripts parse Andre's Obsidian vault content docs and generate the
inert `lib/*-registry.js` modules under `lib/`, per the DI-005 discipline:
the vault doc is the review surface and source of truth; the registry
module is a machine-readable encoding. Content strings are never hand-typed
into a `.js` file directly - always re-run the matching script here so the
two cannot drift.

## Why Python in a Node repo

These are one-off, dev-time generation tools, never imported by the app or
its test suites at runtime - only their *output* (`lib/*-registry.js`)
is. Python was the tool already in hand for vault-side work in the session
that built each registry (the same session also runs `vault_contract.py`
against the vault directly), so it stayed the path of least resistance
rather than porting to Node for no functional benefit. If that stops being
true - if these need to run somewhere Python isn't available - porting to
Node is a mechanical, low-risk follow-up, not a rewrite of the extraction
logic itself.

## Why these are committed at all

Flagged by Lyra as a process note during the B-5 review (2026-08-01): the
extraction script for `lib/belief-map-registry.js` was never committed,
which is fine for a single instance but becomes a real gap once the
pattern recurs - a script that exists only in a chat session's scratch
files cannot be re-run by anyone else, or even by a future session,
without reconstructing it from scratch and hoping the reconstruction
matches. By the time B-1/B-2/B-3 were extracted (2026-08-02), the pattern
had repeated five times; these three scripts are committed here so future
regeneration is a real, repeatable command, not a re-derivation.

**Known gap, not addressed here:** `lib/belief-map-registry.js`'s and
`lib/alignment-library-registry.js`'s own original extraction scripts
predate this directory and are not included - reconstructing them now
carries a real risk of silently drifting from whatever the original
scripts actually did, even if the reconstruction's output currently
passes parity tests. Committing a *plausible* script that is not
provably the *actual* one used is worse than documenting the gap
honestly. If those two ever need re-extraction, treat it as writing a
new script against the current parity tests as the specification, not as
"restoring" a lost one.

## Scripts

- `extract_how_you_operate.py` -> `lib/how-you-operate-registry.js` (B-3)
- `extract_culture_map.py` -> `lib/culture-map-registry.js` (B-2)
- `extract_famous_minds.py` -> `lib/famous-minds-registry.js` (B-1)

## Running

Each script reads its vault doc from the standard path in Andre's vault
(`C:\Andre's 2nd brain\750 - Other Ventures\757 - Phil OS\Build Log and
Decisions\...`) and writes directly to the matching file under `lib/`.
Run from anywhere - paths are resolved relative to the script's own
location and the vault's known standard location, not the working
directory:

```
python scripts/vault-extraction/extract_how_you_operate.py
python scripts/vault-extraction/extract_culture_map.py
python scripts/vault-extraction/extract_famous_minds.py
```

After regenerating, always run the matching test suite
(`node lib/how-you-operate-registry.test.js`, etc.) - the vault-doc parity
section will fail loudly if the regenerated content and the vault doc have
drifted from what the test expects, and the other sections re-validate
shape, coverage, and hygiene from scratch every time.
