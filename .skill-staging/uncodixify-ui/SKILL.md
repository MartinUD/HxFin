---
name: uncodixify-ui
description: Design and refactor frontend UI to avoid generic AI-generated aesthetics and default dashboard tropes. Use when Codex needs to build, restyle, or review interfaces so they feel restrained, human-designed, product-specific, and structurally normal instead of glossy, decorative, gradient-heavy, or "premium SaaS" by default.
---

# Uncodixify UI

Build interfaces that feel intentional, practical, and product-led.

## Workflow

1. Identify the product type before choosing layout.
2. Keep the structure conventional for that product type.
3. Remove default AI UI patterns before adding visual detail.
4. Apply restrained typography, spacing, borders, and motion.
5. Review the result against the banned-pattern checklist.

## Choose Structure First

Match the layout to the actual product instead of inventing a showcase composition.

- Use a standard landing-page section flow for marketing pages.
- Use a standard application shell only when navigation density justifies it.
- Use tables, forms, lists, and detail panes when the product calls for them.
- Prefer stable grids and straightforward flex layouts over asymmetry for its own sake.
- Keep content hierarchy obvious without decorative helper copy.

## Apply The Visual Rules

- Keep sidebars fixed-width, solid, and attached to the layout.
- Keep headers literal: plain `h1`/`h2`, no eyebrow labels, no gradient text, no marketing subcopy inside product UI.
- Keep cards and panels simple: subtle border, restrained radius, minimal shadow.
- Keep buttons and inputs conventional: solid fills or borders, visible labels, simple focus states.
- Keep spacing on a consistent 4/8/12/16/24/32 scale.
- Keep motion minimal: quick color or opacity transitions, no hover transforms by default.
- Keep color calm and controlled; do not lean on blue-black gradient SaaS palettes unless the product already uses them.
- Keep typography readable and product-like; do not default to `Segoe UI`, `Trebuchet MS`, `Arial`, `Inter`, or `Roboto` unless the existing product already does.

## Remove Default AI UI Moves

Before finalizing any interface, explicitly check for and remove:

- Hero sections inside internal dashboards
- KPI card grids used as filler
- Floating glass panels
- Oversized radii or repeated rounded rectangles everywhere
- Decorative badges, mini-notes, or explanatory copy
- Gradient-heavy charts, glows, donut charts, or fake analytics
- Sidebar brand blocks, nav badges, and detached rails without a product reason
- Uppercase eyebrow labels, `small` headers, and ornamental status dots
- Dramatic shadows, transform-hover animations, and "premium dark mode" treatment

## Review Pass

Ask:

- Would this still look defensible if all gradients, blur, and decorative copy were removed?
- Is each panel present because the product needs it, or because the layout felt empty?
- Does the information architecture justify every rail, badge, chart, and callout?
- Does the UI look like a real software product rather than a generated dashboard sample?

## Reference

Read [references/uncodixify-source.md](references/uncodixify-source.md) when you need the full list of banned patterns, preferred defaults, or palette hints from the original source document.
