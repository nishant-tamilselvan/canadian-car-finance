# Copilot Commit Instructions

Apply these rules whenever the user asks to commit, release, or publish.

## Before Commit
- Confirm the repository is cleanly scoped: `git status --short --branch`.
- Stage only files related to the requested change.
- Never include unrelated files in the commit.
- Do not amend existing commits unless explicitly requested.

## Required Validation (Library Repo)
Run all checks before committing:
- `npm test`
- `npm run lint`
- `npm run build`

If any check fails:
- Stop and fix issues related to the requested change.
- Re-run failed checks until green.

## Versioning and npm Publish
Only when user explicitly asks to publish:
- Bump version with `npm version patch|minor|major` as requested.
- Publish with `npm publish`.
- Push commit and tags: `git push origin main --follow-tags`.

## Commit Standards
- Use clear, action-oriented commit messages.
- Keep commit focused and atomic.
- After commit, report:
  - Commit hash
  - Commit message
  - Branch status vs remote

## Safety Rules
- Never run destructive git commands (`git reset --hard`, `git checkout --`) unless explicitly requested.
- Never commit secrets, tokens, or credentials.
- If repository state changes unexpectedly, pause and ask user how to proceed.
