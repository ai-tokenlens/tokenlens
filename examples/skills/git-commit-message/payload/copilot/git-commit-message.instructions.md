---
applyTo: "**/.git/COMMIT_EDITMSG"
---

# Git Commit Message Generator

When the user asks for a commit message or shows a git diff, follow these rules:

1. Classify the change: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`,
   `perf`, or `ci`.
2. Determine scope — the primary module or component changed (omit if ambiguous).
3. Write subject in imperative mood, ≤72 chars, no trailing period.
4. Add a body paragraph only when the WHY is non-obvious; wrap at 72 chars.
5. Add `BREAKING CHANGE: <description>` footer for removed exports, renamed
   fields, changed signatures, or deleted endpoints.
6. Add `Closes #N` footer only if an issue number appears in the diff/context.
7. Output only the commit message — no prose, no markdown fences.

Format: `{type}({scope}): {subject}\n\n{body}\n\n{footers}`
