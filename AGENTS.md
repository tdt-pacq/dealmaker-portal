# Dealmaker Portal

Internal tool for Peterson Acquisitions / The Deal Team. See `CLAUDE.md` for architecture, commands, and environment variables.

## UI spacing

Follow `.cursor/rules/ui-spacing.mdc` on every UI change.

- Use the spacing tokens in `client/src/styles.css` (`--space-*`, `--pad-card`, `--pad-field-*`, `--gap-label`, `--gap-field`, `--pad-row-x`).
- Text, icons, and values must not touch card, panel, field, or table edges.
- Minimum inset is 16px on containers (20–24px on desktop), 10–12px inside fields, ~6px from label to field, and ~16px between fields.
- Numbers use tabular figures and must not clip (`min-width: 0`, wrap or shrink).
- Do not put an unlayered `margin`/`padding` reset on `*`. That override cancels Tailwind spacing utilities.
- Before opening a PR, visually check every changed screen at 1440px and 1024px.
