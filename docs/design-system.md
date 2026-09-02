# Design system

Contract reference for tq's web UI design system: a near-monochrome dark
palette with one red accent used only as punctuation, zero border-radius, 1px
borders, and monospace UI chrome — plus GitHub's own brand colors for
PR/issue state, the one deliberate exception to the single-accent rule (see
[GitHub status colors](#github-status-colors)). Modeled on the
[fohte.net](https://fohte.net) design system.

Source of truth for every value in this doc:

- Tokens: `web/src/index.css` (`:root` and `@theme inline` blocks)
- Primitives: `web/src/components/ui/{section-heading,screen-header-bar,tab-strip,chip,keybind-hint,panel,progress-bar,button}.tsx`

If this doc and the source ever disagree, the source wins — but please fix
the doc in the same PR.

## No arbitrary values

`web/`'s ESLint config enforces this doc as a contract, not just documents
it. Two rules combine to close off every place an arbitrary value could
sneak in:

- `tailwindcss/no-arbitrary-value` ([eslint-plugin-tailwindcss](https://github.com/francoismassart/eslint-plugin-tailwindcss)) bans bracket syntax (`w-[600px]`, `text-[11px]`) inside `class`/`className` attributes and classname-building calls (`cn()`, `cva()`, etc.).
- `no-restricted-syntax` bans the same bracket pattern in _any_ string literal in `web/`, so a value can't be stashed in a bare constant (`const X = 'w-[600px]'`) and slip in unlinted. Arbitrary **variants** (`data-[state=open]:hidden`, `[&_svg]:size-4`, `group-[.is-open]:block`) are exempt — only a bracket at the very end of a class token counts as a value.

When a value you need isn't a token yet, add one instead of writing a
bracket. Tailwind v4 gives three ways, all confirmed compiling with this
repo's tailwindcss 4.2.2:

1. **Name it in `@theme`** and reference it by name: `--color-gh-open: #3fb950` → `text-gh-open`.
2. **Reference a `@theme` custom property directly**, using `()` instead of `[]` on any utility: `grid-cols-(--project-list-columns)`, `max-w-(--dialog-inset)` (the value can contain `calc()`/`min()`).
3. **Name it with `@utility`** when Tailwind has no theme namespace for it (`env()`, `vh`, etc.): `@utility pb-safe { padding-bottom: env(safe-area-inset-bottom); }`.

Update this doc in the same PR that adds the token. A true one-off may use
`eslint-disable-next-line` — none exist in `web/` today, so reach for it only
after confirming none of the three options above fit.

## Design tokens

All tokens live directly on `:root` (there is no `.dark` block — the app
always renders with `class="dark"` and has no theme toggle, so a single dark
palette is the only palette).

### Surfaces

| Token              | Value     | Tailwind utility    | Usage                                                                                                                          |
| ------------------ | --------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `--background`     | `#0a0a0a` | `bg-background`     | Page background                                                                                                                |
| `--card`           | `#141414` | `bg-card`           | Raised surface (cards, popovers)                                                                                               |
| `--popover`        | `#141414` | `bg-popover`        | Popover/menu surface (same value as `--card`)                                                                                  |
| `--secondary`      | `#141414` | `bg-secondary`      | Secondary fill (e.g. day-group header row background in `DayView`)                                                             |
| `--muted`          | `#141414` | `bg-muted`          | Muted fill (e.g. button hover background)                                                                                      |
| `--accent`         | `#1f1f1f` | `bg-accent`         | Accent fill (menu item hover, keyboard-highlighted row) — kept distinct from `--popover`/`--card` so it's visible against them |
| `--surface-strong` | `#1f1f1f` | `bg-surface-strong` | Emphasized _enabled_ surface fill — active tab, primary button, progress track background                                      |

### Text

| Token                       | Value     | Tailwind utility               | Usage                                                                                       |
| --------------------------- | --------- | ------------------------------ | ------------------------------------------------------------------------------------------- |
| `--foreground`              | `#fafafa` | `text-foreground`              | Primary text                                                                                |
| `--muted-foreground-strong` | `#a1a1aa` | `text-muted-foreground-strong` | Brighter secondary text — between `--foreground` and `--muted-foreground`                   |
| `--muted-foreground`        | `#71717a` | `text-muted-foreground`        | Standard secondary/muted text                                                               |
| `--muted-foreground-faint`  | `#52525b` | `text-muted-foreground-faint`  | Dim tertiary text — e.g. `SectionLabel`, completed-task `[x]`                               |
| `--muted-foreground-ghost`  | `#3f3f46` | `text-muted-foreground-ghost`  | Dimmest tier — e.g. tree-line glyphs, sidebar keybind hints (`KeybindHint` `plain` variant) |
| `--card-foreground`         | `#fafafa` | `text-card-foreground`         | Text on `--card` surface                                                                    |
| `--popover-foreground`      | `#fafafa` | `text-popover-foreground`      | Text on `--popover` surface                                                                 |
| `--secondary-foreground`    | `#fafafa` | `text-secondary-foreground`    | Text on `--secondary` surface                                                               |
| `--accent-foreground`       | `#fafafa` | `text-accent-foreground`       | Text on `--accent` surface                                                                  |

**Gray-tier ladder, brightest to dimmest:**

```
--foreground → --muted-foreground-strong → --muted-foreground → --muted-foreground-faint → --muted-foreground-ghost
   #fafafa    →      #a1a1aa             →      #71717a        →      #52525b            →      #3f3f46
```

When a screen needs a text color and it's not obvious which tier, pick by
how much attention the text should draw relative to `--foreground` — do not
introduce a new gray value; use the nearest existing tier.

### Borders

| Token             | Value     | Tailwind utility       | Usage                                              |
| ----------------- | --------- | ---------------------- | -------------------------------------------------- |
| `--border`        | `#2a2a2a` | `border-border`        | Standard 1px border (default for everything)       |
| `--border-strong` | `#71717a` | `border-border-strong` | Emphasized 1px border — active tab, primary button |
| `--input`         | `#2a2a2a` | `border-input`         | Form input border (same value as `--border`)       |

### Accent (the one color)

| Token                  | Value     | Tailwind utility                                 | Usage                                                                                                                                                                           |
| ---------------------- | --------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--primary`            | `#ef4444` | `text-primary` / `bg-primary` / `border-primary` | The one red accent. Used broadly across existing components as punctuation: active nav state, links, focus borders. **Not** reused by `Button`'s primary look — see note below. |
| `--primary-foreground` | `#fafafa` | `text-primary-foreground`                        | Text on `bg-primary`                                                                                                                                                            |
| `--destructive`        | `#ef4444` | `text-destructive` / `border-destructive`        | Same red value as `--primary` — this design has one hue for both "accent" and "danger", not two                                                                                 |
| `--ring`               | `#ef4444` | `ring-ring`                                      | Focus ring color                                                                                                                                                                |

> **Why `Button`'s primary variant doesn't use `--primary`:** `--primary` is
> consumed by dozens of existing components (active nav state, links, focus
> borders, status icons, etc.) that assume it's a bright accent color used as
> punctuation — a small amount of red among mostly gray. `Button`'s own
> "primary" look is a full bordered/filled box (`--border-strong` +
> `--surface-strong`, i.e. gray, not red), so it doesn't reuse `--primary`.
> Making the whole button red would break the "red is punctuation, not fill"
> rule. Follow the same reasoning in screen PRs: reach for `--primary` when
> you want a small red accent, and for `--border-strong`/`--surface-strong`
> when you want an emphasized gray surface.

### Sidebar

| Token                          | Value     | Tailwind utility                              |
| ------------------------------ | --------- | --------------------------------------------- |
| `--sidebar`                    | `#0a0a0a` | `bg-sidebar`                                  |
| `--sidebar-foreground`         | `#fafafa` | `text-sidebar-foreground`                     |
| `--sidebar-primary`            | `#ef4444` | `bg-sidebar-primary` / `text-sidebar-primary` |
| `--sidebar-primary-foreground` | `#fafafa` | `text-sidebar-primary-foreground`             |
| `--sidebar-accent`             | `#141414` | `bg-sidebar-accent`                           |
| `--sidebar-accent-foreground`  | `#fafafa` | `text-sidebar-accent-foreground`              |
| `--sidebar-border`             | `#2a2a2a` | `border-sidebar-border`                       |
| `--sidebar-ring`               | `#ef4444` | `ring-sidebar-ring`                           |

### Status-completed accent

| Token                | Value     | Tailwind utility                                | Usage                                        |
| -------------------- | --------- | ----------------------------------------------- | -------------------------------------------- |
| `--status-completed` | `#a371f7` | `bg-status-completed` / `text-status-completed` | `StatusIcon`'s `completed` close-reason fill |

A second, narrowly-scoped accent — see [Status convention](#status-convention)
below for why this doesn't violate the "one accent" rule above. Same hex as
`--github-merged` below, but a separate token: `--github-merged` is reserved
for GitHub state display only, never substitute it here or vice versa.

### GitHub status colors

| Token             | Value     | Tailwind utility     | Usage                               |
| ----------------- | --------- | -------------------- | ----------------------------------- |
| `--github-open`   | `#3fb950` | `text-github-open`   | GitHub PR/issue "open" state icon   |
| `--github-closed` | `#f85149` | `text-github-closed` | GitHub PR/issue "closed" state icon |
| `--github-merged` | `#a371f7` | `text-github-merged` | GitHub PR "merged" state icon       |

These are GitHub's own brand colors for PR/issue state, not app status
colors — kept separate from `--primary` and the gray-tier text ladder above.
Do not substitute an app status token here; the two systems mean different
things even where a value might coincidentally look close.

### Radius

| Token      | Value  |
| ---------- | ------ |
| `--radius` | `0rem` |

See [Radius policy](#radius-policy) below — every `--radius-*` Tailwind scale
value (`radius-sm`, `radius-md`, `radius-lg`, `radius-xl`, `radius-2xl`,
`radius-3xl`, `radius-4xl`) is derived from `--radius` via `calc()`, so they
all resolve to `0rem` too.

## Fonts

Three font roles, each its own CSS custom property in the `@theme inline`
block. **Do not conflate "monospace UI chrome" with "monospace editor
content"** — `--font-mono` and `--font-editor` are deliberately different
stacks (JetBrains-Mono-first vs. IBM-Plex-Mono-first) even though both
eventually fall back to similar faces.

| Role             | CSS variable    | Font stack                                                                          | Tailwind utility                                                                | Use for                                                                                                          |
| ---------------- | --------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Sans (default)   | `--font-sans`   | Helvetica Neue, Arial, Hiragino Kaku Gothic ProN, Hiragino Sans, Meiryo, sans-serif | `font-sans` (applied at `html` level, so this is the default — no class needed) | Reading content: task titles, descriptions, prose                                                                |
| Mono (UI chrome) | `--font-mono`   | JetBrains Mono Variable, IBM Plex Mono, monospace                                   | `font-mono`                                                                     | ALL UI chrome: nav labels, tabs, section headings, badges/chips, buttons, keybind hints, numeric counters        |
| Editor           | `--font-editor` | IBM Plex Mono, monospace                                                            | `font-editor`                                                                   | Plain textareas (`FocusView`, page excerpts) and the markdown editor's `code`/`pre` ONLY — not general UI chrome |

Examples:

- Task title → `font-sans` (default, no class needed)
- Nav label / tab / badge / button / keybind hint → `font-mono` (`Button` applies this by default, no class needed)
- Plain textarea (`FocusView`) → `font-editor`
- Markdown editor prose body → `font-sans`; `code`/`pre` inside it → `font-editor`

## Typography scale

### Font-size

Tailwind's built-in `text-*` scale (`text-xs` 12px, `text-sm` 14px,
`text-base` 16px, `text-xl` 20px, `text-2xl` 24px, etc.) covers almost every
size in the app. There is exactly **one** custom addition, for a tier
Tailwind has no default for:

| Token        | Value                                                   | Tailwind utility | Usage                                                                                                                           |
| ------------ | ------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `--text-2xs` | `0.625rem` (10px), paired line-height `0.875rem` (14px) | `text-2xs`       | Smallest mono UI chrome tier — dim section/field labels (`SectionLabel`, `InlineFieldGroup`), `Chip`, `TabStrip`, `KeybindHint` |

**Do not add another custom `--text-*` tier without updating this table.**
`text-2xs` exists because 8/9/10/11px were the same "small mono chrome" role
expressed with 1px-apart drift, not an intentional scale — collapse any new
occurrence of that role into `text-2xs` instead of picking another nearby
px value.

**Migration table** for the arbitrary `text-[Npx]` values found elsewhere in
the codebase — apply this mechanically wherever one shows up, don't invent a
new mapping:

| Current arbitrary value                               | Resolves to | Why                                                                                                                     |
| ----------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `text-[8px]` `text-[9px]` `text-[10px]` `text-[11px]` | `text-2xs`  | Same role (small mono UI chrome), 1px-apart drift                                                                       |
| `text-[12px]`                                         | `text-xs`   | Exact match                                                                                                             |
| `text-[0.8rem]` (12.8px)                              | `text-xs`   | Nearest neighbor — 0.8px from `text-xs` (12px) vs. 1.2px from `text-sm` (14px), not a tie                               |
| `text-[13px]`                                         | `text-sm`   | Rounds up, not down — keeps the existing size ordering intact (e.g. `SectionHeading` level 3 stays bigger than level 2) |
| `text-[15px]`                                         | `text-sm`   | Equidistant between `text-sm` (14px) and `text-base` (16px) — see note below                                            |
| `text-[19px]`                                         | `text-xl`   | Equidistant between `text-lg` (18px) and `text-xl` (20px) — see note below                                              |
| `text-[22px]` `text-[23px]`                           | `text-2xl`  | Same role ("screen title") 1px apart — round both up together instead of splitting across `text-xl`/`text-2xl`          |

±1px visual drift from this rounding is expected and acceptable. What isn't
acceptable is breaking a size _ordering_ (heading vs. body, label vs. body) —
check that before applying a row mechanically.

`15px`/`19px` sit exactly between two defaults each. This table intentionally
targets only `text-xs`/`sm`/`xl`/`2xl` rather than pulling `text-base`/`lg`
into the mix for a single value each — round both up rather than introduce a
fifth and sixth target size.

### Letter-spacing

| Current arbitrary value                | Resolves to                                   | Why                                                                                                                                                                                                                                                                                        |
| -------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tracking-[0.08em]` `tracking-[0.1em]` | `tracking-widest` (Tailwind default, `0.1em`) | Same role (dim mono chrome label, e.g. `SectionLabel`) expressed as two near-identical values — the default already covers it                                                                                                                                                              |
| `tracking-[0.04em]`                    | `tracking-wider` (Tailwind default, `0.05em`) | Distinct role (`BottomTabBar` tab label — color follows the tab's active state, `text-foreground`/`text-muted-foreground-faint`, unlike the always-dim role above) — `0.05em` is the closer of the two neighboring default steps (`tracking-wide` `0.025em` vs. `tracking-wider` `0.05em`) |

### Line-height

`--text-2xs` carries its own paired line-height (`0.875rem`) as part of the
token — don't add a `leading-*` utility alongside `text-2xs`.

Line-height drift outside the `text-2xs` role (e.g. task/body copy,
headings) is not resolved by this table — decide it alongside that role's
own font-size when that directory's PR touches it.

Two roles resolved so far, scoped to `web/src/components/task/`:

| Role                                                      | Resolves to       | Why                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Markdown/HTML prose body (task description, comment body) | `leading-relaxed` | `leading-[1.7]`/`leading-[1.75]` on these two markdown editors were 1px-apart drift of the same "editable prose" role; `project-detail-main.tsx`'s description editor already used `leading-relaxed` for the identical layout, so this aligns with it. Other `leading-[1.7]`-ish values on non-markdown elements (e.g. a plain `<textarea>`) are a different role and not resolved by this row        |
| Screen/task title (`text-2xl` in `task-main-content.tsx`) | no override       | `leading-[1.4]` was ~1px off Tailwind's own paired line-height for `text-2xl`; `project-detail-main.tsx`'s title also carries no override, so the same "no override" call applies there once its own `text-[22px]` → `text-2xl` migration lands. Other task-title instances outside `web/src/components/task/` (e.g. `focus-view.tsx`) still carry their own override and aren't resolved by this row |

`web/src/components/focus/` resolved its instances of this:

- The focus task title (`FocusCard`'s `h1`) had `leading-[1.4]` at
  `text-[19px]`/mobile and `leading-[1.35]` at `md:text-2xl`/desktop — the
  same role (task title heading) expressed with two near-identical values
  per breakpoint. Collapsed to `leading-snug` (Tailwind default, `1.375`,
  roughly the average of the two) for both breakpoints.
- `FocusNotes`'s notes `Textarea` had `leading-[1.7]` on `text-xs` (20.4px) —
  close enough to `leading-relaxed` (`1.625`, 19.5px, <1px off at this size)
  to apply the same ±1px rounding tolerance used throughout this doc rather
  than add a dedicated `--leading-*` token for one occurrence. Resolved to
  `leading-relaxed`, matching every other prose-like block in the app
  (`task-activity.tsx`, `project-detail-main.tsx`, `task-main-content.tsx`)
  and clearing the last remaining `leading-[…]` arbitrary value in the
  codebase.

## Spacing scale

### Grid

Tailwind v4's `--spacing` unit is `0.25rem` (4px) and `web/src/index.css`
does not override it, so the grid is just Tailwind's default scale — no new
custom token, unlike `--text-2xs` above.

**Half-step utilities (`0.5`/`1.5`/`2.5`/`3.5` → 2/6/10/14px) are part of
this grid, not an exception to it.** Tailwind ships them as named scale
steps, and `web/src/components/ui/` already leans on them heavily —
`chip.tsx`'s `px-1.5 py-0.5`, `panel.tsx`'s `py-1.5`, `badge.tsx`'s
`py-0.5`, `modal-field.tsx`'s `px-2.5 py-1.5`, and more. Banning them would
fight code that's already correct.

What's **not** allowed is inventing a step Tailwind doesn't ship by
default, e.g. `gap-1.75` (7px) or `gap-4.5` (18px). Tailwind v4's dynamic
utilities compile those without brackets, so even a bracket-only
arbitrary-value lint check wouldn't catch them — the value is still
off-grid; only the bracket syntax disappeared. Always resolve to a step
from the table below (or a plain integer beyond `3.5`), never a bespoke
multiplier.

### Migration table

For the arbitrary `[Npx]` values found elsewhere in the codebase, apply
this mechanically to whichever utility prefix carries the value — `gap-`,
`p`/`px`/`py`/`pt`/`pr`/`pb`/`pl`, `m`/`mx`/`my`/`mt`/`mr`/`mb`/`ml`, or
`w`/`h`/`min-w`/`min-h`/`max-w`/`max-h` when the box itself is ≤44px (see
[Sizing](#sizing-grid-rounding-vs-naming-a-dimension) below for anything
bigger). E.g. `gap-[7px]` → `gap-2`, `py-[7px]` → `py-2`.

| Off-grid value | Resolves to   | Why                                                                                                                                                                                                                                                                                                                                                                |
| -------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `3px`          | `1` (4px)     | Equidistant between `0.5` (2px) and `1` (4px) — ties round up                                                                                                                                                                                                                                                                                                      |
| `5px`          | `1.5` (6px)   | Equidistant between `1` (4px) and `1.5` (6px) — ties round up                                                                                                                                                                                                                                                                                                      |
| `-5px`         | `-1.5` (-6px) | Same tie as `5px` above, applied to a negative position offset (`tabs.tsx`'s active-tab underline `bottom-[-5px]` → `-bottom-1.5`) — ties round away from zero, mirroring the positive case                                                                                                                                                                        |
| `7px`          | `2` (8px)     | Equidistant between `1.5` (6px) and `2` (8px) — ties round up                                                                                                                                                                                                                                                                                                      |
| `9px`          | `2.5` (10px)  | Equidistant between `2` (8px) and `2.5` (10px) — ties round up                                                                                                                                                                                                                                                                                                     |
| `11px`         | `3` (12px)    | Equidistant between `2.5` (10px) and `3` (12px) — ties round up                                                                                                                                                                                                                                                                                                    |
| `13px`         | `3.5` (14px)  | Equidistant between `3` (12px) and `3.5` (14px) — ties round up. Exception: `project-list-row.tsx`'s mobile row rounds to `3` instead, unified with its sibling desktop row's `py-[11px]` → `3` — no PR documents an intentional 2px breakpoint difference, and `task-row-shared.tsx`'s `rowWrapperClassName` already uses one `py` value regardless of breakpoint |
| `18px`         | `5` (20px)    | Equidistant between `4` (16px) and `5` (20px) — Tailwind has no half-step above `3.5`, so both neighbors are full steps; ties round up. `focus-view.tsx`'s `mt-4 md:mt-5` (rounded from `md:mt-[18px]`) is the case that motivates rounding up: it must stay ≥ the base `mt-4`, and rounding down would have collapsed the responsive change to a no-op            |
| `22px`         | `6` (24px)    | Equidistant between `5` (20px) and `6` (24px) — ties round up                                                                                                                                                                                                                                                                                                      |
| `41px`         | `10` (40px)   | Nearest step — 40px is 1px away, 44px is 3px away, not a tie. Also used by `layout/sidebar.tsx`'s header row, which sits flush against `ScreenHeaderBar` in the app shell — round every occurrence in the same pass so their `border-b` lines stay aligned instead of drifting by 1px                                                                              |
| `44px`         | `11` (44px)   | Already exactly on-grid (`11 × 4px`, the standard tap-target size) — not a rounding case, just swap the bracket for the equivalent named utility (`min-w-[44px]` → `min-w-11`)                                                                                                                                                                                     |

±1px visual drift from this rounding is expected and acceptable. What isn't
acceptable is breaking a position/ordering relationship (e.g. a responsive
value no longer larger than its base value) — check that before applying a
row mechanically.

### Sizing: grid rounding vs. naming a dimension

Not every `w-[Npx]`/`h-[Npx]` is a grid problem. Once a
`w`/`h`/`max-w`/`max-h`/`min-w`/`min-h` value describes an element's own
footprint rather than the space around it, its size decides which problem
it is:

- **≤44px** — icon boxes, hairline bar thickness, tap targets. These
  behave like spacing: round via the table above (e.g. `status-icon.tsx`'s
  `h-[18px] w-[18px]` → `h-5 w-5`).
- **\>44px** — this is not an off-grid problem. Every large dimension found
  in the arbitrary-value sweep (`w-[600px]`, `w-[236px]`,
  `max-w-[620/640/680/720/760px]`, …) is already a multiple of 4px —
  rounding changes nothing. The defect, where there is one, is a
  duplicated, unnamed constant rather than an off-grid value.

  The four content screens (`focus-view.tsx` `max-w-[620px]`,
  `settings.tsx` `max-w-[680px]`, `task-main-content.tsx` `max-w-[720px]`,
  `project-detail-main.tsx` `max-w-[760px]`) all capped a screen's body at
  a comfortable reading width — the same role expressed with four values
  that tracked when each screen was written, not a deliberate per-screen
  choice. Unified to `max-w-3xl` (768px, Tailwind's default container
  step) — nothing was narrowed, and `task-page-editor.tsx`'s full-page
  markdown editor already used `max-w-3xl` for the same "reading width"
  role, so this aligns with existing usage instead of picking a fifth
  value.

  The PC modal wrapper (`max-w-[600px]` flex column, `rounded-2xl`,
  `shadow-2xl`, `ring-1 ring-foreground/10`) used to be copy-pasted
  verbatim into `create-task-modal.tsx` and `project-form-modal.tsx`, with
  `create-schedule-modal.tsx` copying the same markup but drifted to
  `max-w-[500px]` — a mismatch no grid table would have caught, because
  both numbers were already internally grid-consistent. This is now
  extracted as `ModalPanel` (see [ModalPanel](#modalpanel)), the desktop
  counterpart to `BottomSheetPanel`, with `600px` as the one canonical
  width, expressed as `max-w-150` (Tailwind's spacing-scale dynamic
  utility, `150 × 4px`) since no `--container-*` step lands on 600px.
  `search-modal.tsx`'s `max-w-160`/`max-h-120` (640px/480px, same
  spacing-scale mechanism) were judged a separate command-palette pattern
  — no PC/mobile split, no shared `Dialog` primitive, single-layer portal
  for z-index reasons — and were left as-is rather than folded into
  `ModalPanel`.

The same defect showed up in the app shell's fixed-width panels: the width
lived on each call site's wrapper `<div>` instead of on the panel component,
so it had to be repeated at every call site and could drift. `TaskSidebar`
(`task-detail-sidebar.tsx`) and `ProjectSidebar` (`project-detail-sidebar.tsx`)
are the same role (a screen's PC detail-page sidebar), so both now render
`DetailSidebarPanel` (`web/src/components/ui/detail-sidebar-panel.tsx`),
which owns the one canonical width, `w-60` (240px) — callers render
`<TaskSidebar task={task} />` with no wrapper. `TaskSidebar` had drifted to
`w-[236px]`; there was no reason for a task's sidebar to be 4px narrower
than a project's.

The global nav rail (`layout/sidebar.tsx`, `w-50`/200px) and the mobile
`BottomTabBar` height (`h-13`/52px) are both plain literals on their
components — neither has a second consumer to justify extracting a shared
constant. The sidebar rail's test pins its literal independently (asserting
the full class string) rather than importing it, since a test importing the
exact value it's meant to verify can never catch that value regressing.

The same defect showed up once more in the page/task editors: `MarkdownEditor`,
`HtmlPageEditor`, and `HtmlPageViewer` (`web/src/components/ui/`) had no
height of their own, so every call site invented a wrapper `<div>` with its
own `min-h-[Npx]`/`h-[Npx]` — four near-duplicate values (80/120/160/400px)
that tracked which screen wrote them rather than a deliberate choice. Each
component now takes a `size` prop and owns its default height directly, so
callers no longer wrap it in a sizing `<div>`:

- `MarkdownEditor`'s `size` is `'default'` (`min-h-100`, 400px) or
  `'compact'` (`min-h-30`, 120px). `'default'` is a primary/full editing
  surface (a task page's own editor). `'compact'` is a few-lines inline
  editor (task/project description, a comment, an inline/expanded page
  card, the create-task-modal composer) — this collapsed what used to be
  three separate values (80/120/160px) for the same role.
- `HtmlPageEditor` and `HtmlPageViewer` share a `size` of `'default'`
  (`h-100`, 400px, a fixed height for a standalone editor/viewer) or
  `'fill'` (`min-h-0 flex-1`, stretching to fill a flex-column ancestor that
  already has a defined height — the one case is a task page's own
  full-height editor). `HtmlPageEditor`'s `'fill'` also bakes in `h-full` on
  its own root, so the caller no longer passes that via `className` either.

`create-task-modal.tsx`'s two composers (`max-h-modal-composer` on PC,
`max-h-sheet-composer` on the mobile bottom sheet) keep their `min-h` from
`MarkdownEditor`'s `'compact'` default and only vary by `max-h` — that
difference is a deliberate PC/mobile viewport split, not drift, and follows
`BottomSheetPanel`'s existing `max-h-sheet` precedent of clamping to a
viewport-relative height (see [Overlay viewport
units](#overlay-viewport-units) below).

### Overlay viewport units

A handful of overlays clamp their size or position relative to the viewport
(`vh`), not to the spacing grid — grid rounding doesn't apply here, since
these aren't spacing values. `vh` has no `@theme` namespace of its own, but
each of `max-h`/`padding-top` does resolve against a per-utility theme
namespace (`--max-height-*`, confirmed by compiling with this repo's
tailwindcss 4.2.2), so each value gets a name instead of a bracket:

| Token                                            | Utility                | Value                                               | Role                                                                     |
| ------------------------------------------------ | ---------------------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| `--max-height-sheet`                             | `max-h-sheet`          | `calc(var(--visual-viewport-height, 100vh) * 0.85)` | Mobile bottom sheet's overall height cap (`BottomSheetPanel`)            |
| `--max-height-modal-composer`                    | `max-h-modal-composer` | `max-height: 40vh`                                  | PC create-task modal's description composer height cap                   |
| `--max-height-sheet-composer`                    | `max-h-sheet-composer` | `max-height: 30vh`                                  | Mobile create-task bottom sheet's description composer height cap        |
| n/a (`@utility`, no `--padding-top-*` namespace) | `modal-top-offset`     | `padding-top: 15vh`                                 | Drops the search modal down from the top of the viewport (`SearchModal`) |

These four values don't collapse into one token — each clamps a different
role — but the role each one plays is now named and documented here instead
of scattered as four unnamed `vh` brackets.

`--max-height-sheet` reads `--visual-viewport-height` instead of a plain
`vh` unit: iOS Safari doesn't shrink the layout viewport when the software
keyboard opens, so `85vh` would keep clamping against the pre-keyboard
height. `BottomSheetOverlay` (`bottom-sheet.tsx`) sets
`--visual-viewport-height` from `window.visualViewport`, falling back to
`100vh` where it's unsupported.

## Z-index

Stacking order in the app is ad hoc, not a documented scale: `z-10` marks a
sticky element within its own scroll container (e.g. `BottomSheetHeader`,
`select.tsx`'s scroll buttons), `z-50` marks a portal/overlay layer (modals,
dropdowns, tooltips, the floating action button) — both are Tailwind's own
default numeric steps, not custom tokens, and neither is meant to rank
against the other; there's no third tier and no ordering claim between
different `z-50` overlays.

`--z-index-max` (`z-max`, `z-index: 2147483647`, int32's max value) is a
deliberate exception, not a third tier of that scale: it's used exactly
once, on a notice injected via `document.body.appendChild` outside the
React tree and outside `#root` (`session-aware-fetch.ts`'s session-recovery
notice), where the goal isn't "above the app's other overlays" but "above
any stacking context whatsoever, including ones this app doesn't control."

### Border width

Border-width utilities (`border`, `border-<number>`) are **not** part of the
4px spacing grid and are out of this table's jurisdiction. Unlike
`gap`/`padding`/`margin`, which compile to `calc(var(--spacing) * N)`,
Tailwind's border-width utilities resolve straight to `<N>px` (`border` →
`border-width: 1px`, `border-2` → `2px`, and the same holds for the dynamic
`border-<number>` utility used for values with no named step, e.g.
`border-l-3` → `border-left-width: 3px`) — there is no `--spacing`
multiplication to round onto. `task-activity.tsx`'s `CommentRow` accent
border (`border-l-3`) is a plain literal for that reason, not a rounding
case.

## Grid tracks

Named `grid-template-columns` tracks in `web/src/index.css`'s `@theme
inline` block, referenced via `grid-cols-(--<name>)`. Each backs a fixed
layout shared by multiple call sites so widths can't drift between them —
usually a list's rows and its column header (`--project-list-columns`), but
`--icon-content-columns` instead unifies an icon-column width across
otherwise-unrelated components (`task-activity.tsx`'s rows,
`integration-card.tsx`'s `CARD_INDENT`).

| Token                    | Value                      | Used by                                                                                                                                                                                                                                                                                          |
| ------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--project-list-columns` | `14px 1fr 96px 190px 78px` | Projects list: column header (`routes/projects/index.tsx`), `ProjectListRow` — tracks are status mark, project name, status badge, progress bar, target date                                                                                                                                     |
| `--icon-content-columns` | `20px 1fr`                 | `task-activity.tsx`'s `EventRow`/`CommentRow` marker column, `integration-card.tsx`'s `CARD_INDENT` — same "small icon column + body" role, unified onto the 20px column width that `IntegrationCard`'s actual `size-5` icon needs (was `14px` in `task-activity.tsx`, too narrow for that icon) |

The tasks list (`TreeTaskGridRow`) is a flex-based two-line stack instead of
a fixed grid — see the `min-w-30` comment on its title `<span>` for how it
keeps the title from collapsing to 0 width when the row overflows.

## Radius policy

`--radius` is `0rem` globally — every corner in the app is square by
default, including every Tailwind `rounded-*` utility that derives from the
`--radius-*` scale.

There are exactly **two** sanctioned exceptions, both **hardcoded** (not
derived from the `--radius` token):

| Exception                | Where                                                                                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--keycap-radius` (4px)  | Shared by `Kbd` (`web/src/components/ui/kbd.tsx`) and `KeybindHint`'s `boxed` variant (`web/src/components/ui/keybind-hint.tsx`) — both call `rounded-(--keycap-radius)`, a token defined once in `web/src/index.css` |
| Inline `<code>` elements | `border-radius: 4px` on `.ProseMirror code` in `web/src/components/ui/markdown-editor.css`                                                                                                                            |

**Do not introduce new radius exceptions without updating this doc.**

Note: `Button`'s size variants use `rounded-lg` / `rounded-(--btn-radius-xs)`
/ `rounded-(--btn-radius-sm)` etc. — `--btn-radius-xs`/`--btn-radius-sm`
(defined in `web/src/index.css` as `min(var(--radius-md), 10px)` /
`min(var(--radius-md), 12px)`) are still driven by the `--radius` token chain
(they resolve to `0rem` because `--radius` is `0rem`), so they are **not**
exceptions to this policy.

**shadcn regeneration risk:** `button.tsx`, `dialog.tsx`, `tabs.tsx`,
`tooltip.tsx`, and `kbd.tsx` are shadcn CLI-managed (`web/components.json`
points its `ui` alias at `web/src/components/ui/`). Running
`pnpm dlx shadcn add <component>` on any of these overwrites the file,
including the `rounded-(--btn-radius-*)` / `rounded-(--keycap-radius)` /
`max-w-(--dialog-inset)` / `h-(--tabs-trigger-height)` /
`translate-y-(--tooltip-arrow-offset)` calls documented here — re-apply them
after a regen.

## Status convention

Task status is expressed via `StatusIcon`
(`web/src/components/task/status-icon.tsx`) as a small circular icon — an
outline circle or a filled circle with a glyph inside — not literal bracket
text. For `status === 'completed'`, the icon further branches on
`statusReason` (`completed` if `null`, i.e. the implicit default):

| Status / reason                    | Icon                                   | Color token                                               | Extra styling                                                         |
| ---------------------------------- | -------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| `todo`                             | outline circle                         | `text-muted-foreground`                                   | —                                                                     |
| `completed` (reason `completed`)   | filled circle + `Check` (lucide-react) | `bg-status-completed` fill, `text-background` glyph       | Accompanying title text gets `line-through` + `text-muted-foreground` |
| `completed` (reason `not_planned`) | filled circle + `X` (lucide-react)     | `bg-muted-foreground-faint` fill, `text-background` glyph | Same title styling as above                                           |
| `completed` (reason `duplicate`)   | filled circle + `Equal` (lucide-react) | `bg-muted-foreground-faint` fill, `text-background` glyph | Same title styling as above                                           |

`--status-completed` is a second accent color, spent specifically on "things
actually done" so it stands out when scanning a list. `not_planned` and
`duplicate` keep the same neutral `bg-muted-foreground-faint` gray fill that
`completed` always used, and `--status-completed` is the one new non-neutral
color this change adds, applied narrowly to the default close reason only.

Row-level metadata for `not_planned`/`duplicate` also gets a plain second-line
token (`CloseReasonLabel` in `web/src/components/task/task-row-shared.tsx`),
styled like the row's other metadata tokens (`ParentTaskLabel`,
`TaskContextLabel`, etc.) rather than as a chip — nothing renders for the
default `completed` reason.

Completed task/search-result rows (not just the status icon) are further
dimmed via the `dim-completed` utility (`opacity: 55%`, defined in
`web/src/index.css`) — a `@utility` rather than a `--opacity-*` token, since
opacity has no `@theme` namespace to hang a named scale step off of.

## Primitives

All primitives live in `web/src/components/ui/` and are imported via the
`#components/ui/<file>` path alias.

### `SectionHeading`

`web/src/components/ui/section-heading.tsx`

```ts
function SectionHeading(props: {
  level: 2 | 3
  children: ReactNode
  className?: string
}): JSX.Element
```

Renders a `##`/`###`-prefixed inline heading (the `#`/`##` glyph in
`text-primary`, label in `font-mono`). Use for section labels inside a
screen (e.g. "tasks", "subtasks") — not a page title (see
`ScreenHeaderBar` for that).

```tsx
<SectionHeading level={2}>tasks</SectionHeading>
```

### `ScreenHeaderBar`

`web/src/components/ui/screen-header-bar.tsx`

```ts
function ScreenHeaderBar(props: {
  children: React.ReactNode
  className?: string
}): JSX.Element
```

A fixed-height (`h-10`) bottom-bordered bar for a screen's or panel's
top header row. Compose it with a `SectionHeading` / plain label plus
trailing actions (e.g. `ml-auto` button).

```tsx
<ScreenHeaderBar>
  <span className="font-mono text-xs font-bold">tasks</span>
</ScreenHeaderBar>
```

### `TabStrip`

`web/src/components/ui/tab-strip.tsx`

```ts
function TabStrip<T extends string>(props: {
  value: T
  options: ReadonlyArray<{ value: T; label: React.ReactNode }>
  onChange: (value: T) => void
  className?: string
}): JSX.Element
```

A row of adjoining bordered tab buttons (borders collapse between tabs via
`border-l-0` on all but the first). The active tab gets `border-border-strong`
plus `bg-surface-strong`; inactive tabs get `border-border` plus
`text-muted-foreground`. Use for switching between a small, fixed set of
views (e.g. Day/Week/Month) — this is a plain presentation component, not an
ARIA tablist.

`web/src/components/ui/segmented-control.tsx` has a near-identical generic
shape (`value`/`options`/`onChange`) but takes its active/inactive styling as
`className` props instead of baking in this design's connected-border look.
Use `TabStrip` for the joined-mono-tabs pattern described above; keep using
`SegmentedControl` where a caller needs a different visual (e.g. the rounded
pill look in `project-view-tabs.tsx`). Don't add a third tab-switcher
component — extend one of these two.

```tsx
<TabStrip
  value={value}
  options={[
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
  ]}
  onChange={setValue}
/>
```

### `Chip`

`web/src/components/ui/chip.tsx`

```ts
function Chip(props: {
  as?: 'span' | 'button'
  size?: 'sm' | 'md'
  active?: boolean
  className?: string
  children: ReactNode
}): JSX.Element
```

A small bordered label. `size="sm"` for dense inline context (e.g. a
context tag, a `tq#212` GitHub link chip); `size="md"` for a standalone
badge or interactive filter chip (`as="button"`). `active` swaps to
`border-border-strong` + `text-foreground`.

```tsx
<Chip>work</Chip>
<Chip size="md" active>
  <span className="text-primary font-bold">#</span>dev:tq
</Chip>
<Chip as="button" size="md">filter</Chip>
```

### `KeybindHint`

`web/src/components/ui/keybind-hint.tsx`

```ts
function KeybindHint(props: {
  variant?: 'plain' | 'boxed'
  className?: string
  children: React.ReactNode
}): JSX.Element
```

Renders a keybinding label. `plain` (default) is dim, unboxed text
(`text-muted-foreground-ghost`) — used for e.g. sidebar nav hints; override
the color via `className` for brighter contexts (e.g. the status line's
`⌘K search`) rather than adding a new variant. `boxed` renders a bordered
key-cap look (`rounded-(--keycap-radius)`, one of the two [radius exceptions](#radius-policy)).

```tsx
<KeybindHint>g t</KeybindHint>
<KeybindHint className="text-muted-foreground-strong">⌘K</KeybindHint>
<KeybindHint variant="boxed">⌘K</KeybindHint>
```

### `Panel`

`web/src/components/ui/panel.tsx`

```ts
function Panel(props: { children: ReactNode; className?: string }): JSX.Element
```

A bordered container (`border border-border`) for a grouped list of rows,
each typically bottom-bordered with `last:border-b-0`.

```tsx
<Panel>
  <div className="border-b border-border px-3 py-2 text-sm last:border-b-0">
    Set up CI pipeline
  </div>
</Panel>
```

### `ProgressBar`

`web/src/components/ui/progress-bar.tsx`

```ts
function ProgressBar(props: {
  percent: number
  fillClassName?: string // default: 'bg-foreground'
  className?: string
}): JSX.Element
```

A thin (`h-0.5`) track (`bg-surface-strong`) with a filled bar
(`percent` clamped to 0-100). Default fill is `bg-foreground`; pass
`fillClassName` to use a different fill color (e.g. `bg-muted-foreground`
for a dimmer/secondary progress indicator).

```tsx
<ProgressBar percent={39} />
<ProgressBar percent={39} fillClassName="bg-muted-foreground" />
```

### `Button` (redesigned)

`web/src/components/ui/button.tsx`

```ts
function Button(
  props: ButtonPrimitive.Props & {
    variant?:
      'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link'
    size?:
      | 'default'
      | 'xs'
      | 'sm'
      | 'lg'
      | 'icon'
      | 'icon-xs'
      | 'icon-sm'
      | 'icon-lg'
  },
): JSX.Element
```

Built on `@base-ui/react/button` + `cva`. Variant looks:

| Variant       | Look                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default`     | Emphasized bordered box: `border-border-strong` + `bg-surface-strong` (does **not** use `--primary` — see the [accent token note](#accent-the-one-color)) |
| `outline`     | `border-border` + `bg-background`, `bg-muted` on hover                                                                                                    |
| `secondary`   | `border-border`, transparent, `border-border-strong` on hover                                                                                             |
| `ghost`       | No border, `bg-muted` on hover                                                                                                                            |
| `destructive` | `border-border`, transparent, `border-destructive`/`text-destructive` on hover                                                                            |
| `link`        | `text-primary`, underline on hover                                                                                                                        |

Use `default` for the primary action on a screen, `outline`/`secondary` for
secondary actions, `ghost` for low-emphasis icon-only actions, `destructive`
for delete/remove actions, `link` for inline text-styled actions.

```tsx
<Button>Add Task</Button>
<Button variant="destructive">Delete</Button>
<Button size="icon" aria-label="Tasks"><CheckSquare /></Button>
```

### `ModalPanel`

`web/src/components/ui/modal-panel.tsx`

```ts
function ModalPanel(props: React.ComponentProps<'div'>): JSX.Element
```

The desktop counterpart to `BottomSheetPanel`
(`web/src/components/ui/bottom-sheet.tsx`) — a centered card
(`max-w-150` (600px) flex column, `rounded-2xl`, `shadow-2xl`,
`ring-1 ring-foreground/10`, `bg-card`) for the PC layout of a form modal.
Pair it with `DialogHeaderBar` for the header row. Use for centered
CRUD-style form modals (create/edit task, project, schedule) — not for the
search command palette (`search-modal.tsx`), which is a structurally
distinct pattern (no PC/mobile split, no shared `Dialog` primitive).

```tsx
<div className="fixed inset-0 z-50 hidden items-center justify-center p-8 md:flex">
  <ModalPanel>
    <DialogHeaderBar>...</DialogHeaderBar>
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">...</div>
  </ModalPanel>
</div>
```

### `DetailSidebarPanel`

`web/src/components/ui/detail-sidebar-panel.tsx`

```ts
function DetailSidebarPanel(props: React.ComponentProps<'div'>): JSX.Element
```

The fixed-width (`w-60`, 240px) shell for a screen's PC detail-page
sidebar — border, padding, and scroll all in one place (`shrink-0`,
`overflow-y-auto`, `border-l border-border`, `p-4`). Used by `TaskSidebar`
and `ProjectSidebar`; render it directly with no wrapper `<div>` at the
call site.

```tsx
<DetailSidebarPanel>
  <span>DETAILS</span>
  ...
</DetailSidebarPanel>
```

## Naming boundary with shadcn primitives

`web/src/components/ui/` is expected to eventually also hold shadcn-derived
`badge.tsx`, `kbd.tsx`, `progress.tsx`, `tabs.tsx` — full Base UI primitives
with ARIA semantics, built for form-control use cases. `Chip`, `KeybindHint`,
`ProgressBar`, `TabStrip` are deliberately named to avoid colliding with
those filenames/exports.

They are **not** replacements for the shadcn primitives: they're
lighter-weight, non-form-control, presentation-only components for the same
visual patterns. Both sets are meant to coexist — pick whichever fits a
given usage:

| Need                                         | Reach for                                           |
| -------------------------------------------- | --------------------------------------------------- |
| Static/simple bordered label, no ARIA needed | `Chip` / `KeybindHint` / `ProgressBar` / `TabStrip` |
| Full variant system, ARIA semantics needed   | shadcn `Badge` / `Kbd` / `Progress` / `Tabs`        |

There is no requirement to migrate a screen from one set to the other.

## Non-goals

This doc ships tokens and primitives, not a restyle of every existing
screen. Existing components that haven't been updated yet to use these
tokens/primitives will keep looking visually inconsistent with the rest of
the app until they are — that inconsistency is expected, not a bug.
