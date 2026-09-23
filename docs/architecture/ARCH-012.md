# ARCH-012 — Dark / Light Theme

**Status:** approved
**Created:** 2026-09-23
**Traces:** REQ-012
**Verified by:** TEST-012

## Summary

A React Context (`ThemeProvider`/`useTheme`) that initializes from the OS `prefers-color-scheme`
media query, toggles a `dark` class on `document.documentElement` for Tailwind's dark-mode
variants, and is consumed by the Sankey chart ([ARCH-009](ARCH-009.md)) for its theme-dependent
color palette. Purely client-side, no server component.

## Design

**Components**

| Component | File | Responsibility |
|---|---|---|
| `ThemeProvider` / `useTheme` | `client/src/context/ThemeContext.tsx` | Theme state (`"light" \| "dark"`), initial value from `matchMedia`, `toggle()`, side-effect that adds/removes the `dark` class on `<html>` |
| Sidebar footer toggle button | `client/src/components/Layout.tsx` | Renders the Sun/Moon icon + label, calls `toggle()` |
| Tailwind dark-mode variants | throughout `client/src/**` | Consume the `dark` class via Tailwind's `dark:` variant, switching CSS custom-property sets |
| `SankeyChart` theme colors | `client/src/components/SankeyChart.tsx` (ARCH-009) | Reads `useTheme()` to pick the dark/light color constant pairs |

**Initial theme (AC-012-01, AC-012-02)**

`ThemeProvider`'s `useState` initializer runs `window.matchMedia("(prefers-color-scheme: dark)").matches`
once at mount — `true` → `"dark"`, `false` → `"light"`. The `useEffect` immediately syncs
`document.documentElement`'s `dark` class to match, which is what actually flips every Tailwind
`dark:` variant across the app (including the background colors the ACs describe).

**Toggle (AC-012-03, AC-012-04)**

`toggle()` flips `theme` between `"light"`/`"dark"`; the sidebar footer button (`Layout.tsx`)
renders the Sun icon + "Light-Modus" label when the *current* theme is dark (clicking switches to
light) or the Moon icon + "Dark-Modus" label when current is light — icon/label always describe
the *target* state, matching AC-012-03/04's "label changes to..." wording.

**Sankey integration (AC-012-05)**

Already described in ARCH-009 §"Theming" — `SankeyChart` reads `useTheme()` and picks between two
hardcoded color-constant pairs (income/expense flow colors, node label color) per theme; the exact
hex values in AC-012-05 match those constants.

## Key Decisions

- **`matchMedia` read once at mount, not subscribed to live OS changes** — REQ-012 Notes: the
  theme is a deliberate, click-driven user choice once the app has loaded; the ACs never require
  the app to react to the OS theme changing *while already open*, only to reflect it on load.
- **Not persisted to localStorage or the server** (REQ-012 Notes, explicit) — a reload always
  re-reads the OS preference; treated as intentional, matching REQ-008's identical "resets on
  reload, not a bug" pattern for account visibility.
- **Class-toggle on `<html>`, not a CSS-in-JS theme object** — lets every existing Tailwind
  utility class's `dark:` variant "just work" without threading a theme prop through the component
  tree; the single side-effect in `ThemeProvider` is the only place that touches the DOM directly.

## Out of Scope

- Sankey chart rendering itself — [ARCH-009](ARCH-009.md); this document only covers where its
  theme value comes from.

## Open Questions

- **No test exists for the theme system at all.** No component test or E2E spec verifies the
  initial-theme-from-`matchMedia` logic, the toggle button's label/icon swap, or that the `dark`
  class actually lands on `document.documentElement`. `resize_window`-style viewport/color-scheme
  emulation (available to Playwright) would make AC-012-01/02 directly testable. See Test Gap
  Backlog.
