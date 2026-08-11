import type { ItemType } from "./models";

// ---------------------------------------------------------------------------
// Canonical "what does a fresh file of this type look like" — the single
// source of truth for the body every "New X" command writes to disk AND for
// the AI-facing schema documentation that describes it. Nothing else should
// hand-roll a body template: change it here and both sides stay correct.
// ---------------------------------------------------------------------------

type BodyTemplate = (title: string) => string;

export const BODY_TEMPLATES: Partial<Record<ItemType, BodyTemplate>> = {
  epic: () =>
    `## Overview\n\nDescribe the goal and scope of this epic.\n\n` +
    `## Goals\n\n- \n\n` +
    `## Out of Scope\n\n- \n`,

  story: (title) =>
    `## Description\n\n${title}\n\n` +
    `## Acceptance Criteria\n\n- [ ] \n\n` +
    `## Notes\n\n`,

  task: (title) =>
    `## Description\n\n${title}\n\n` +
    `## Subtasks\n\n- [ ] \n\n` +
    `## Notes\n\n`,

  bug: (title) =>
    `## Description\n\n${title}\n\n` +
    `## Steps to Reproduce\n\n1. \n2. \n\n` +
    `## Expected Behavior\n\n\n\n` +
    `## Actual Behavior\n\n\n\n` +
    `## Notes\n\n`,

  fr: (title) =>
    `## Description\n\n${title}\n\n` +
    `## Acceptance Criteria\n\n- [ ] \n\n` +
    `## Linked Items\n\n` +
    `<!-- Set \`linkedIds: US-001,TASK-001\` in front matter to link stories/tasks -->\n`,

  nfr: (title) =>
    `## Description\n\n${title}\n\n` +
    `## Metric\n\n- Target: \n- Measurement: \n\n` +
    `## Linked Items\n\n` +
    `<!-- Set \`linkedIds: US-001,TASK-001\` in front matter to link stories/tasks -->\n`,

  adr: () =>
    `## Context\n\nDescribe the context and problem statement.\n\n` +
    `## Decision\n\nDescribe the decision made.\n\n` +
    `## Consequences\n\n### Positive\n\n- \n\n### Negative\n\n- \n\n` +
    `## Alternatives Considered\n\n- \n`,

  arch: () =>
    `## Overview\n\nDescribe this architectural component.\n\n` +
    `## Diagram\n\n\`\`\`\n<!-- Add diagram here -->\n\`\`\`\n\n` +
    `## Components\n\n- \n\n` +
    `## Interfaces\n\n- \n`,

  service: () =>
    `## Overview\n\nDescribe this technical component.\n\n` +
    `## API / Interface\n\n\`\`\`\n<!-- Define the API/interface -->\n\`\`\`\n\n` +
    `## Data Model\n\n- \n\n` +
    `## Dependencies\n\n- \n\n` +
    `## Error Handling\n\n- \n`,

  "data-proc": () =>
    `## Overview\n\nDescribe this data process: purpose, inputs, and outputs.\n\n` +
    `## Data Flow\n\nInput → Transformation → Output\n\n` +
    `## Steps\n\n1. \n\n` +
    `## Error Handling\n\n- \n`,

  sprint: (title) =>
    `## Goal\n\n${title}\n\n` +
    `## Stories\n\n<!-- Stories assigned to this sprint will appear here -->\n`,

  release: (title) =>
    `## Overview\n\n${title}\n\n` +
    `## What's Included\n\n<!-- Stories and tasks in this release -->\n\n` +
    `## Release Notes\n\n- \n`,

  "db-table": (title) =>
    `## Description\n\n${title} table.\n\n` +
    `## Columns\n\n` +
    `| Column | Type | Constraints |\n` +
    `|--------|------|-------------|\n` +
    `| id | uuid | PK |\n`,

  cicd: () =>
    `## Overview\n\nDescribe this pipeline.\n\n` +
    `## Stages\n\n1. \n\n` +
    `## Triggers\n\n- \n\n` +
    `## Notifications\n\n- \n`,

  "auth-spec": () =>
    `## Overview\n\nDescribe the authentication or authorization design.\n\n` +
    `## Roles\n\n| Role | Description |\n|------|-------------|\n| | |\n\n` +
    `## Authorization Matrix\n\n| Resource | Role |\n|----------|------|\n| | |\n\n` +
    `## Enforcement\n\n- \n`,
};

// member's body needs both a title and a role, so it doesn't fit the
// single-string BodyTemplate shape above.
export function memberBodyTemplate(title: string, role: string): string {
  return `## Bio\n\n${title} — ${role} engineer.\n`;
}

// concept has one template per section (history/goals/principles/risks/
// sysdesign/sysimpl) rather than one per type.
export const CONCEPT_SECTION_META: Record<
  string,
  { label: string; subdir: string; body: string }
> = {
  history: {
    label: "History & Problem",
    subdir: "concept/history",
    body: `## Background\n\nDescribe the history and context of the problem.\n\n## Problem Statement\n\n- \n\n## Why It Matters\n\n- \n`,
  },
  goals: {
    label: "Goals",
    subdir: "concept/goals",
    body: `## Goals\n\n- \n\n## Non-Goals\n\n- \n\n## Success Criteria\n\n- \n`,
  },
  principles: {
    label: "Core Principles",
    subdir: "concept/principles",
    body: `## Principles\n\n- \n\n## Rationale\n\n- \n`,
  },
  risks: {
    label: "Risks & Obstacles",
    subdir: "concept/risks",
    body: `## Risks\n\n| Risk | Likelihood | Impact | Mitigation |\n|------|-----------|--------|------------|\n| | | | |\n\n## Obstacles\n\n- \n`,
  },
  sysdesign: {
    label: "System Design",
    subdir: "concept/sysdesign",
    body: `## Overview\n\nDescribe the system design.\n\n## Diagram\n\n\`\`\`\n<!-- Add diagram here -->\n\`\`\`\n\n## Components\n\n- \n\n## Data Flow\n\n- \n`,
  },
  sysimpl: {
    label: "System Implementation",
    subdir: "concept/sysimpl",
    body: `## Overview\n\nDescribe the implementation approach.\n\n## Steps\n\n1. \n\n## Dependencies\n\n- \n\n## Rollout\n\n- \n`,
  },
};
