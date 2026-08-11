// Single source of truth for the "17 document types" table and the key
// authoring rules, reused by every AI-facing surface: the `get_schema`
// language model tool, the generated Copilot/Claude/Codex instruction files,
// and CLAUDE.md's own copy (kept in sync by hand since Claude Code reads
// CLAUDE.md directly, not through this module).
//
// This describes the schema for AI consumption only. The behavioral source
// of truth — the actual directory each type is read from and written to —
// is `getTypeDir()` in ../specParser.ts. If you change one, change the other.

export const TYPE_REGISTRY_TABLE = `\
| \`type\` | \`id\` prefix | Directory under \`.spec/\` | File name | Valid \`status\` values |
|--------|-------------|--------------------------|-----------|----------------------|
| \`epic\` | \`EPIC-NNN\` | \`backlog/epics/\` | \`epic-NNN.md\` | \`draft\` · \`active\` · \`done\` |
| \`story\` | \`US-NNN\` | \`backlog/stories/\` | \`us-NNN.md\` | \`draft\` · \`active\` · \`done\` |
| \`task\` | \`TASK-NNN\` | \`backlog/tasks/\` | \`task-NNN.md\` | \`todo\` · \`in-progress\` · \`testing\` · \`blocked\` · \`done\` |
| \`bug\` | \`BUG-NNN\` | \`backlog/tasks/\` | \`bug-NNN.md\` | \`todo\` · \`in-progress\` · \`testing\` · \`blocked\` · \`done\` |
| \`fr\` | \`FR-NNN\` | \`requirements/fr/\` | \`fr-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`nfr\` | \`NFR-NNN\` | \`requirements/nfr/\` | \`nfr-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`sprint\` | \`SPR-NNN\` | \`planning/sprints/\` | \`spr-NNN.md\` | \`planned\` · \`active\` · \`done\` |
| \`release\` | \`REL-NNN\` | \`planning/releases/\` | \`rel-NNN.md\` | \`draft\` · \`active\` · \`released\` |
| \`adr\` | \`ADR-NNN\` | \`technical/adr/\` | \`adr-NNN.md\` | \`proposed\` · \`accepted\` · \`deprecated\` · \`superseded\` |
| \`arch\` | \`ARCH-NNN\` | \`technical/arch/\` | \`arch-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`service\` | \`SRV-NNN\` | \`technical/services/\` | \`srv-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`data-proc\` | \`DP-NNN\` | \`technical/data-processes/\` | \`dp-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`db-table\` | \`TBL-NNN\` | \`technical/database/\` | \`tbl-NNN.md\` | \`draft\` · \`active\` · \`done\` |
| \`cicd\` | \`CICD-NNN\` | \`technical/cicd/\` | \`cicd-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`auth-spec\` | \`AUTH-NNN\` | \`technical/auth/\` | \`auth-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |
| \`member\` | \`MBR-NNN\` | \`team/members/\` | \`mbr-NNN.md\` | \`active\` · \`draft\` |
| \`concept\` | \`CON-NNN\` | \`concept/{section}/\` | \`con-NNN.md\` | \`draft\` · \`active\` · \`deprecated\` |

\`NNN\` = zero-padded 3-digit number (001, 002, …). For \`concept\`, \`{section}\` ∈ \`history\` · \`goals\` · \`principles\` · \`risks\` · \`sysdesign\` · \`sysimpl\`.`;

export const KEY_RULES = `\
- \`type\` is strictly enforced — only the 17 exact strings above are valid. Never invent types (\`spec\`, \`technical-spec\`, \`service-spec\`, \`auth\`, \`tech-spec\` are all invalid).
- Never change an existing \`id\` — IDs are immutable.
- \`title\` must always be in double quotes in the front matter.
- \`epicId\` is required on every story; \`storyId\` is required on every task and bug.
- \`role\` is required on every member; \`processType\` (\`sync\` | \`async\` | \`cron\`) is required on every \`data-proc\`.
- Comma-separated fields (\`linkedIds\`, \`dependsOn\`, \`relations\`) must have no spaces around commas.
- Dates must be \`YYYY-MM-DD\` only.`;
