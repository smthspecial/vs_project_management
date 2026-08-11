import type { SpecItem } from "./models";

// ---------------------------------------------------------------------------
// Type labels for display
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  fr: "Functional Requirements",
  nfr: "Non-Functional Requirements",
  epic: "Epics",
  story: "User Stories",
  task: "Tasks",
  bug: "Bugs",
  sprint: "Sprints",
  release: "Releases",
  adr: "Architecture Decision Records",
  arch: "Architecture Docs",
  "service": "Services",
  "data-proc": "Data Processes",
  "db-table": "Database Tables",
  member: "Team Members",
};

const TYPE_ORDER = [
  "fr",
  "nfr",
  "epic",
  "story",
  "task",
  "bug",
  "sprint",
  "release",
  "adr",
  "arch",
  "service",
  "data-proc",
  "db-table",
  "member",
];

// ---------------------------------------------------------------------------
// Build a Markdown summary of a set of spec items, grouped and labeled by
// type. Used both to render the full spec and to render a filtered subset.
// ---------------------------------------------------------------------------

export function buildSpecContent(items: SpecItem[]): string {
  if (items.length === 0) {
    return (
      "No project specification found.\n\n" +
      "Open the Project Spec sidebar and use the + buttons to create items.\n" +
      "Files are stored in `.spec/` at the workspace root."
    );
  }

  const groups = new Map<string, SpecItem[]>();
  for (const item of items) {
    const g = groups.get(item.data.type) ?? [];
    g.push(item);
    groups.set(item.data.type, g);
  }

  const lines: string[] = ["# Project Specification\n"];

  for (const type of TYPE_ORDER) {
    const group = groups.get(type);
    if (!group?.length) {
      continue;
    }

    lines.push(`\n## ${TYPE_LABELS[type] ?? type}\n`);

    for (const item of group) {
      const d = item.data;
      lines.push(`### [${d.id}] ${d.title}`);
      lines.push(`- **Status**: ${d.status}`);
      if (d.priority) {
        lines.push(`- **Priority**: ${d.priority}`);
      }
      if (d.epicId) {
        lines.push(`- **Epic**: ${d.epicId}`);
      }
      if (d.storyId) {
        lines.push(`- **Story**: ${d.storyId}`);
      }
      if (d.sprintId) {
        lines.push(`- **Sprint**: ${d.sprintId}`);
      }
      if (d.releaseId) {
        lines.push(`- **Release**: ${d.releaseId}`);
      }
      if (d.dependsOn) {
        lines.push(`- **Depends on**: ${d.dependsOn}`);
      }
      if (d.startDate) {
        lines.push(`- **Start**: ${d.startDate}`);
      }
      if (d.dueDate) {
        lines.push(`- **Due**: ${d.dueDate}`);
      }
      if (d.releaseDate) {
        lines.push(`- **Release date**: ${d.releaseDate}`);
      }
      if (d.assigneeId) {
        lines.push(`- **Assigned to**: ${d.assigneeId}`);
      }
      if (d.role) {
        lines.push(`- **Role**: ${d.role}`);
      }
      if (d.processType) {
        lines.push(`- **Process type**: ${d.processType}`);
      }
      if (item.body.trim()) {
        lines.push(`\n${item.body.trim()}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Query — filter items by type and/or status, then render the same way
// ---------------------------------------------------------------------------

export interface SpecQueryFilter {
  type?: string;
  status?: string;
}

export function buildQueryContent(
  items: SpecItem[],
  filter: SpecQueryFilter,
): string {
  let filtered = items;
  if (filter.type) {
    const types = filter.type.split(",").map((t) => t.trim());
    filtered = filtered.filter((i) => types.includes(i.data.type));
  }
  if (filter.status) {
    const statuses = filter.status.split(",").map((s) => s.trim());
    filtered = filtered.filter((i) => statuses.includes(i.data.status));
  }
  if (filtered.length === 0) {
    return "No items match the given filters.";
  }
  return buildSpecContent(filtered);
}
