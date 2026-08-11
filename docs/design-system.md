# Design system

Contract reference for tq's web UI design system: a near-monochrome dark
palette with one red accent used only as punctuation, zero border-radius, 1px
borders, and monospace UI chrome. Modeled on the
[fohte.net](https://fohte.net) design system.

Source of truth for every value in this doc:

- Tokens: `web/src/index.css` (`:root` and `@theme inline` blocks)
- Primitives: `web/src/components/ui/{section-heading,screen-header-bar,tab-strip,chip,keybind-hint,panel,progress-bar,button}.tsx`

If this doc and the source ever disagree, the source wins — but please fix
the doc in the same PR.

## Design tokens

All tokens live directly on `:root` (there is no `.dark` block — the app
always renders with `class="dark"` and has no theme toggle, so a single dark
palette is the only palette).

### Surfaces

| Token              | Value     | Tailwind utility    | Usage                                                                                     |
| ------------------ | --------- | ------------------- | ----------------------------------------------------------------------------------------- |
| `--background`     | `#0a0a0a` | `bg-background`     | Page background                                                                           |
| `--card`           | `#141414` | `bg-card`           | Raised surface (cards, popovers)                                                          |
| `--popover`        | `#141414` | `bg-popover`        | Popover/menu surface (same value as `--card`)                                             |
| `--secondary`      | `#141414` | `bg-secondary`      | Secondary fill (e.g. `PanelHeader` background)                                            |
| `--muted`          | `#141414` | `bg-muted`          | Muted fill (e.g. button hover background)                                                 |
| `--accent`         | `#141414` | `bg-accent`         | Accent fill (menu item hover, etc.)                                                       |
| `--surface-strong` | `#1f1f1f` | `bg-surface-strong` | Emphasized _enabled_ surface fill — active tab, primary button, progress track background |

### Text

| Token                       | Value     | Tailwind utility               | Usage                                                                                       |
| --------------------------- | --------- | ------------------------------ | ------------------------------------------------------------------------------------------- |
| `--foreground`              | `#fafafa` | `text-foreground`              | Primary text                                                                                |
| `--muted-foreground-strong` | `#a1a1aa` | `text-muted-foreground-strong` | Brighter secondary text — between `--foreground` and `--muted-foreground`                   |
| `--muted-foreground`        | `#71717a` | `text-muted-foreground`        | Standard secondary/muted text                                                               |
| `--muted-foreground-faint`  | `#52525b` | `text-muted-foreground-faint`  | Dim tertiary text — e.g. `PanelHeader` label, completed-task `[x]`                          |
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

| Token                  | Value     | Tailwind utility                                 | Usage                                                                                                                                                                                                                        |
| ---------------------- | --------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--primary`            | `#ef4444` | `text-primary` / `bg-primary` / `border-primary` | The one red accent. Used broadly across existing components as punctuation: active nav state, links, focus borders, status icons, in-progress `[~]` status text. **Not** reused by `Button`'s primary look — see note below. |
| `--primary-foreground` | `#fafafa` | `text-primary-foreground`                        | Text on `bg-primary`                                                                                                                                                                                                         |
| `--destructive`        | `#ef4444` | `text-destructive` / `border-destructive`        | Same red value as `--primary` — this design has one hue for both "accent" and "danger", not two                                                                                                                              |
| `--ring`               | `#ef4444` | `ring-ring`                                      | Focus ring color                                                                                                                                                                                                             |

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

| Role             | CSS variable    | Font stack                                                                          | Tailwind utility                                                                | Use for                                                                                                   |
| ---------------- | --------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Sans (default)   | `--font-sans`   | Helvetica Neue, Arial, Hiragino Kaku Gothic ProN, Hiragino Sans, Meiryo, sans-serif | `font-sans` (applied at `html` level, so this is the default — no class needed) | Reading content: task titles, descriptions, prose                                                         |
| Mono (UI chrome) | `--font-mono`   | JetBrains Mono Variable, IBM Plex Mono, monospace                                   | `font-mono`                                                                     | ALL UI chrome: nav labels, tabs, section headings, badges/chips, buttons, keybind hints, numeric counters |
| Editor           | `--font-editor` | IBM Plex Mono, monospace                                                            | `font-editor`                                                                   | Markdown/page editor body text and textareas ONLY — not general UI chrome                                 |

Examples:

- Task title → `font-sans` (default, no class needed)
- Nav label / tab / badge / button / keybind hint → `font-mono` (`Button` applies this by default, no class needed)
- Markdown editor textarea → `font-editor`

## Typography scale

### Font-size

Tailwind's built-in `text-*` scale (`text-xs` 12px, `text-sm` 14px,
`text-base` 16px, `text-xl` 20px, `text-2xl` 24px, etc.) covers almost every
size in the app. There is exactly **one** custom addition, for a tier
Tailwind has no default for:

| Token        | Value                                                   | Tailwind utility | Usage                                                                                                                          |
| ------------ | ------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `--text-2xs` | `0.625rem` (10px), paired line-height `0.875rem` (14px) | `text-2xs`       | Smallest mono UI chrome tier — dim section/field labels (`PanelHeader`, `InlineFieldGroup`), `Chip`, `TabStrip`, `KeybindHint` |

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

| Current arbitrary value                | Resolves to                                   | Why                                                                                                                          |
| -------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `tracking-[0.08em]` `tracking-[0.1em]` | `tracking-widest` (Tailwind default, `0.1em`) | Same role (dim mono chrome label, e.g. `PanelHeader`) expressed as two near-identical values — the default already covers it |

This table only covers the dim-label role above. Other arbitrary tracking
values belong to a different role (e.g. `tracking-[0.04em]` on the bottom
tab bar's brighter, non-dim label) and are not resolved here — decide them
alongside that role's own consolidation instead of reusing this row.

### Line-height

`--text-2xs` carries its own paired line-height (`0.875rem`) as part of the
token — don't add a `leading-*` utility alongside `text-2xs`.

Line-height drift outside the `text-2xs` role (e.g. task/body copy,
headings) is not resolved by this table — decide it alongside that role's
own font-size when that directory's PR touches it.

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
utilities compile those without brackets, so `no-arbitrary-value` won't
flag them — but the value is still off-grid; only the bracket syntax
disappeared. Always resolve to a step from the table below (or a plain
integer beyond `3.5`), never a bespoke multiplier.

### Migration table

For the arbitrary `[Npx]` values found elsewhere in the codebase, apply
this mechanically to whichever utility prefix carries the value — `gap-`,
`p`/`px`/`py`/`pt`/`pr`/`pb`/`pl`, `m`/`mx`/`my`/`mt`/`mr`/`mb`/`ml`, or
`w`/`h`/`min-w`/`min-h`/`max-w`/`max-h` when the box itself is ≤44px (see
[Sizing](#sizing-grid-rounding-vs-naming-a-dimension) below for anything
bigger). E.g. `gap-[7px]` → `gap-2`, `py-[7px]` → `py-2`.

| Off-grid value | Resolves to  | Why                                                                                                                                                                                                                                                                                            |
| -------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `3px`          | `1` (4px)    | Equidistant between `0.5` (2px) and `1` (4px) — ties round up                                                                                                                                                                                                                                  |
| `5px`          | `1.5` (6px)  | Equidistant between `1` (4px) and `1.5` (6px) — ties round up                                                                                                                                                                                                                                  |
| `7px`          | `2` (8px)    | Equidistant between `1.5` (6px) and `2` (8px) — ties round up                                                                                                                                                                                                                                  |
| `9px`          | `2.5` (10px) | Equidistant between `2` (8px) and `2.5` (10px) — ties round up                                                                                                                                                                                                                                 |
| `11px`         | `3` (12px)   | Equidistant between `2.5` (10px) and `3` (12px) — ties round up                                                                                                                                                                                                                                |
| `13px`         | `3.5` (14px) | Equidistant between `3` (12px) and `3.5` (14px) — ties round up                                                                                                                                                                                                                                |
| `18px`         | `5` (20px)   | Equidistant between `4` (16px) and `5` (20px) — Tailwind has no half-step above `3.5`, so both neighbors are full steps; ties round up. Confirmed by `focus-view.tsx`'s `mt-4 md:mt-[18px]`, which must stay ≥ the base `mt-4` — rounding down would collapse the responsive change to a no-op |
| `22px`         | `6` (24px)   | Equidistant between `5` (20px) and `6` (24px) — ties round up                                                                                                                                                                                                                                  |
| `41px`         | `10` (40px)  | Nearest step — 40px is 1px away, 44px is 3px away, not a tie. Shared by `screen-header-bar.tsx` and `section-heading.stories.tsx`; round both together                                                                                                                                         |
| `44px`         | `11` (44px)  | Already exactly on-grid (`11 × 4px`, the standard tap-target size) — not a rounding case, just swap the bracket for the equivalent named utility (`min-w-[44px]` → `min-w-11`)                                                                                                                 |

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
  rounding changes nothing. The actual defect is a duplicated, unnamed
  constant: the PC modal wrapper (`max-w-[600px]` flex column,
  `rounded-2xl`, `shadow-2xl`, `ring-1 ring-foreground/10`) is copy-pasted
  verbatim into `create-task-modal.tsx` and `project-form-modal.tsx`, and
  `create-schedule-modal.tsx` copies the same markup but drifted to
  `max-w-[500px]` — a mismatch no grid table catches, because both numbers
  are already internally grid-consistent. Fixing this means extracting a
  shared component (or at least a named constant) with one canonical
  width, not replacing the bracket. Leave these alone in grid-rounding
  work — they're a separate, component-identity problem.

## Radius policy

`--radius` is `0rem` globally — every corner in the app is square by
default, including every Tailwind `rounded-*` utility that derives from the
`--radius-*` scale.

There are exactly **two** sanctioned exceptions, both **hardcoded** (not
derived from the `--radius` token):

| Exception                     | Where                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `KeybindHint` `boxed` variant | `rounded-[4px]` in `web/src/components/ui/keybind-hint.tsx`                                |
| Inline `<code>` elements      | `border-radius: 4px` on `.ProseMirror code` in `web/src/components/ui/markdown-editor.css` |

**Do not introduce new radius exceptions without updating this doc.**

Note: `Button`'s size variants use `rounded-lg` / `rounded-[min(var(--radius-md),10px)]`
etc. — these are still driven by the `--radius` token chain (they resolve to
`0rem` because `--radius` is `0rem`), so they are **not** exceptions to this
policy.

## Status convention

Task status is expressed via `StatusIcon`
(`web/src/components/task/status-icon.tsx`) as a small circular icon — an
outline circle, a partial-pie circle, or a filled circle with a check mark —
not literal bracket text.

| Status        | Icon                                           | Color token                                               | Extra styling                                                                   |
| ------------- | ---------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `todo`        | outline circle                                 | `text-muted-foreground`                                   | —                                                                               |
| `in_progress` | partial-pie circle                             | `text-primary` (the red accent)                           | One of the few places red fill/text is used — marks "the one thing in progress" |
| `completed`   | filled circle + check (lucide-react's `Check`) | `bg-muted-foreground-faint` fill, `text-background` check | Accompanying title text gets `line-through` + `text-muted-foreground`           |

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

A fixed-height (`h-[41px]`) bottom-bordered bar for a screen's or panel's
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
views (e.g. All/Backlog, Day/Week/Month) — this is a plain presentation
component, not an ARIA tablist.

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
    { value: 'all', label: 'All' },
    { value: 'backlog', label: 'Backlog' },
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
key-cap look (`rounded-[4px]`, one of the two [radius exceptions](#radius-policy)).

```tsx
<KeybindHint>g t</KeybindHint>
<KeybindHint className="text-muted-foreground-strong">⌘K</KeybindHint>
<KeybindHint variant="boxed">⌘K</KeybindHint>
```

### `Panel` / `PanelHeader`

`web/src/components/ui/panel.tsx`

```ts
function Panel(props: { children: ReactNode; className?: string }): JSX.Element
function PanelHeader(props: {
  children: ReactNode
  className?: string
}): JSX.Element
```

`Panel` is a bordered container (`border border-border`). `PanelHeader` is
an optional bottom-bordered header row inside it
(`bg-secondary`, `font-mono text-2xs tracking-widest text-muted-foreground-faint`)
for an uppercase-style label + trailing action. Use for grouped list/board
sections (e.g. an "OPEN TASKS" panel with rows below the header).

```tsx
<Panel>
  <PanelHeader>
    OPEN TASKS
    <span className="ml-auto text-2xs tracking-normal">view board →</span>
  </PanelHeader>
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
