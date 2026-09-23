#!/usr/bin/env bash
# Hook: PostToolUse (matcher: Edit|Write)
# Lints the edited TypeScript file with ESLint. On findings, exits with code 2 so Claude Code
# feeds the ESLint output back to Claude, which then fixes the file.
# Prettier is intentionally not run here: the existing tree is not yet Prettier-formatted and
# reformatting whole files on every edit would bury the real change in a noise diff.

set -u

INPUT=$(cat)
# node is always available in this project; jq is not guaranteed on every machine
FILE_PATH=$(printf '%s' "$INPUT" | node -e '
  let raw = "";
  process.stdin.on("data", (chunk) => (raw += chunk));
  process.stdin.on("end", () => {
    const payload = JSON.parse(raw);
    process.stdout.write(payload.tool_input?.file_path ?? "");
  });
')

[[ "$FILE_PATH" =~ \.(ts|tsx)$ ]] || exit 0
[[ -f "$FILE_PATH" ]] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

if ! LINT_OUTPUT=$(npx --no-install eslint --no-warn-ignored "$FILE_PATH" 2>&1); then
  echo "ESLint findings in $FILE_PATH — fix them before continuing:" >&2
  echo "$LINT_OUTPUT" >&2
  exit 2
fi

exit 0
