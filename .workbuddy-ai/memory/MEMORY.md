# NEXUS — Project Memory

## What this is
NEXUS — a premium, local-first **personal operating system** (not a dashboard). One file,
no build step, no backend. `C:\Users\punit\Desktop\My_Projects\LifeOS\index.html`
— 24,905 lines · 1.15 MB · **84% JS · 14% CSS · 0.5% HTML**. Reference PNGs in `Downloads\`.

## Where the knowledge lives
The skill **`nexus-milestone-loop`** is the source of truth for *how* to work:
`references/architecture.md` = invariants 1–22, the derived-data map, conventions, port table;
`references/testing-pitfalls.md` = traps 1–25; `scripts/` = the three static gates.
**This file is STATE only.** Reasoning → the dated logs; invariants → the skill.

## Rules in brief
- One milestone at a time: BUILD → syntax CHECK → dead-hook CHECK → CDP TEST → POLISH →
  regression VERIFY → RECORD.
- **Derived, never stored.** Store INTENTIONS (a target, a rating), never MEASUREMENTS.
- **No fake interactions.** Every visible control works; cascades connect. *(See open items —
  `task.recurrence` is the one known violation.)*
- Local-first; no secrets in client code; reduced-motion, keyboard nav, focus states, aria.
- **Motion**: six durations + three curves in `:root`; the duration tokens already carry their
  curve (adding one is an invalid shorthand the browser drops silently). Never animate a number
  a surface displays; `transform`/`opacity` only; reduced-motion forces reveal states visible.
- Visual language: deep navy; blue `#3B82F6` · indigo `#6366F1` · violet `#8B5CF6` ·
  cyan `#06B6D4` · magenta `#EC4899`. Dark glass, rounded cards, hairline borders.
  8 themes — midnight/light free, six Pro.

## Verification harness
Headless Chrome + CDP in `C:\Users\punit\AppData\Local\Temp\nexustest\`; `sweep.sh` runs every
suite on its own port with a fresh profile. **30 suites, 2,588 checks, all green.** Newest rows:
`t43 38 · t44 33 (motion) · t45 71 (pricing)`; the full port table lives in the skill.
- **Three static gates run BEFORE any browser work:** `check_js.py` (syntax),
  `check_balance.py` (nesting), `check_dead_hooks.py` (every visible control is wired).
- A suite that reloads must `await State.flush()` first — all of them do (t32 is the deliberate
  exception). Every `send()` carries a 60 s deadline. `sweep.sh` clears 9381–9699;
  **never start a sweep right after running suites by hand.**
- **A test that asserts a computed style must POLL, not sleep** (trap 25) — M44's 260 ms theme
  crossfade does not reliably advance while `Emulation.clearDeviceMetricsOverride` is churning.
- **A suite owns its Chrome profile and deletes it.** ABSOLUTE path under `%TEMP%` — never
  `/tmp/…`, which is drive-relative on Windows and silently landed on `C:\tmp\` (trap 21:
  432 profiles / 19.7 GB, owned by nothing).

## Open items
**Audit 2026-09-17 (extreme-critic pass) found three real gaps — these are the M46 candidates:**
- **P0 — `task.recurrence` is an inert field.** It is *stored* (line 4247), *normalized* (5698)
  and *displayed read-only* in the task detail panel (23777: `Recurrence — daily`), but there is
  **no editor and no rollover logic** (`nextOccur`/`spawn`/`rollover`/`advanceTask` all absent).
  So a task marked "daily" never returns. Real recurrence lives only in **Automation**
  (`_materialise` + `runDueAutomations`, M35) — which is Pro-gated. Net effect: one concept
  represented twice, and the Free-visible copy is a lie. This is the app's **only** violation of
  its own "no fake interactions" rule, and it is a *trust* bug, not a cosmetic one.
- **P0 — no undo, no trash.** 23 confirm dialogs guard deletes, but 4 surfaces say outright
  "cannot be undone" / "There is no undo". `trash` exists only as an icon name. For an app holding
  journals, notes and finances, confirm-then-gone is a data-loss risk. Cheapest fix: soft-delete
  (`deletedAt`) + a Trash view + 30-day prune.
- **P1 — not a PWA.** Zero `serviceWorker`, zero `manifest`. "Offline" currently means only
  "makes no network calls" — not installable, no home-screen icon, no cache. Note the single-file
  `file://` design makes this genuinely awkward (SW needs https or localhost) — a real decision.
- **P1 — one keyboard shortcut in the whole app** (`Ctrl/Cmd+K`). 22 routes, and the only other
  `e.key` handlers are space/comma/Enter/Escape. No `g d`, no `n`, no `/`, no `j/k`, no `?` sheet.

Pre-existing, deliberate:
- **Demo NEXUS Score is 74/100** (Tasks 83 · Focus 100 · Habits 69 · Goals 61 − 3). The reference
  shows 83; the gap is real work the demo has not done, not a weighting choice. **Do not tune the
  weights to close it.**
- **A due date is never in the past on entry** — `parseDueToken` resolves `"12 Sep"` to the nearest
  not-yet-passed occurrence. Keeps the demo from accumulating fake lateness.
- **`Derive.money` rounds at the formatter.** New money figures go through it, never `fmt()`.
- **The dashboard's headline stat tiles are deliberately NOT in the arrangement** (M41) — page
  chrome, and the empty state's copy says so.
- **Light theme `--text-3` (`#8A91AC`) is 3.1:1 on white** — passes 3:1 for muted text, short of
  4.5:1 for the 11.5px `.card-sub` captions. An app-wide token: **the user's call.**
- The palette's default view shows only the first nine actions, so "Search everything" and the
  review commands are invisible until you type. Deliberate for now.
- **Activating Pro on the demo drops the score 74 → 66** (the catch-up makes a task immediately
  overdue). Honest, but an odd first impression — a demo-anchor call, not a bug.
- **Templates are not in the search index** (M37, deliberate) — a template is a *recipe*.
- Journal deliberately does **not** feed the NEXUS Score (its spec is tasks/habits/focus/goals).
- **The pricing page sells a local licence, and says so.** $5/month or $40/year are real numbers in
  `PLANS`, and taking Pro really flips the gate — but there is no processor and no account.
  **Cloud sync is `planned: true` and must stay that way until a server exists** — it renders
  "Planned" on both columns and carries no gate key.
- **Exactly one tier.** `billing` is a *period*, not a second entitlement; `FeatureAccess.allows()`
  ignores its key on purpose. Invariant 21 names it.
- **Only one workspace exists.** The switcher's panel shows the real one plus locked slots. A
  second real workspace needs its own store — the panel says so instead of faking a list.

## Milestone ledger
One line each; the governing invariant is in `architecture.md`, the reasoning in the logs.
- **M1–M32 ✅** design system, shell, responsive, dashboard + widgets; the palette, IndexedDB and
  every core module (Tasks + detail · Projects · Goals · Calendar · Habits · Focus · Notes ·
  Knowledge · Journal · Inbox · Finance · Files · Search · Activity · Analytics · Reviews). Each
  page's `*View()`/`*List()` is its only UI shape; Knowledge's links are parsed, never stored.
  **A record IS its bytes**; **a function of `now` is derived**; `periodFigures()` is the ONE
  place a period becomes figures. DB **v2 · v3**.
- **M33–M35 ✅** Time Machine + the gate (**a view of the past folds every collection at one day
  key**; an entitlement is live state) · Score v2 (**a term with nothing to measure is excluded
  and renormalised, never scored 0**) · Automation (**a fold, not a scheduler**; **provenance
  cannot be derived**; **a gate must stop the engine**). DB **v4**.
- **M36–M38 ✅** Notifications (**an alert is a statement currently true**; only the user's
  *decision* is stored, and it expires with its cause) · Templates (**a template stores a SHAPE,
  never a date**; **a rule is scheduled, a template is invoked**) · Onboarding + the first real
  `settings` page (**asks only what the app cannot derive**; **closing is not a decision**). DB **v5**.
- **M39 ✅** Export / Import — **an export is data; an import is a restore through the same door as
  a load** (`_reconcile`, so every collection needs a normalizer). The envelope stores no derivable
  count and no plan. DB **v5** (no bump).
- **M40 ✅** Demo reset — **a reset is the seed, run again** (`demoWorkspace()` → `Repo.seed()`, the
  pair `init()` uses). Keeps the profile, the plan, the preferences and the user's own alert
  decisions; writes no log entry. DB **v5** (no bump).
- **M41 ✅** Dashboard customisation — **a dashboard is a table, not a layout** (`DASH_CARDS` +
  `Widgets.card(key)`; the arrangement is `{wide, side}`, not a flat list, because the two columns
  are different widths). Journal / Inbox / Activity cards added; the arrangement travels in
  `EXPORT_PREFS`. DB **v5** (no bump).
- **M42 ✅** Notes attachments — **a pointer has two ends, and both must be visible**
  (`FILE_REF_TYPES` is the checklist; `filesFor` is the inverse). The note editor's Attached row,
  the note card's paperclip, and one `revealRecord` for following a pointer. DB **v5**.
- **M43 ✅** Dead-hook gate — the first **static** gate. `check_dead_hooks.py` fails on a `data-*`
  hook nothing reads (app *or* suite) and on a `<button>` with no id and no hook. Found and removed
  5 inert card-wrapper hooks; 409 buttons, **0 unhooked**. Step 2b of the loop.
- **M44 ✅** Motion — **one motion system, six durations and three curves in `:root`.** Staggered
  card entrance + scroll reveal, travelling nav pill, scoped theme crossfade, layered shadows, real
  glass. Two rules: **never animate a number a surface displays** (16 suites read the stat tiles —
  no count-up), and **animate `transform`/`opacity` only**. The focus ring must NOT animate: it is
  driven. DB **v5**.
- **M45 ✅** Pricing & upgrade — **a price is data, but every number beside it is derived.** `PLANS`
  (free / monthly $5 / yearly $40) + `Derive.planSaving/planPerMonth/planRenews/planDaysLeft/
  planCompare/planCards`. `ProPage` rebuilt from a feature list into a real pricing page (hero +
  billing toggle, 3 cards, 12-row comparison table read off `FEATURES`, manage panel, FAQ, honest
  local-licence notice). `State.activatePro(billing)` / `switchBilling()` / `revertToFree()`;
  `entitlement` gained `billing` + `periodStart` (+ `normalizeEntitlement` on load). The workspace
  switcher now opens a real panel; the header gained an Upgrade button. DB **v5** (no bump).
- **M46 ⏭️ — NEXT.** No product feature is outstanding, but the 2026-09-17 audit opened two P0s
  (inert `task.recurrence`, no undo/trash) and two P1s (no PWA, one shortcut). Any of these is a
  legitimate M46.

## Live routes
`dashboard · tasks · projects · goals · calendar · habits · focus · notes · knowledge · journal ·
inbox · finance · files · activity · analytics · templates · settings`, plus four real routes with
**no `NAV` entry** — `search`, `reviews`, `pro`, `settings`, reached from the palette, the header's
Upgrade button (free plan only), the workspace switcher or a chip.
`time`/`automation`/`templates` carry a `PRO` chip. Nothing falls through to `__stub`.
