export type ItemStatus =
  | "draft"
  | "active"
  | "in-progress"
  | "done"
  | "blocked"
  | "todo"
  | "testing"
  | "proposed"
  | "accepted"
  | "deprecated"
  | "superseded"
  | "planned"
  | "released";

export type ItemPriority = "low" | "medium" | "high";
export type ItemType =
  | "epic"
  | "story"
  | "task"
  | "bug"
  | "fr"
  | "nfr"
  | "adr"
  | "arch"
  | "service"
  | "sprint"
  | "release"
  | "db-table"
  | "member"
  | "cicd"
  | "auth-spec"
  | "concept"
  | "data-proc"
  | "test-plan";

export interface SpecFrontMatter {
  id: string;
  type: ItemType;
  title: string;
  status: ItemStatus;
  created: string;
  /** Reference to parent Epic id — used by stories */
  epicId?: string;
  /** Reference to parent User Story id — used by tasks and bugs */
  storyId?: string;
  /** Comma-separated linked item IDs — used by FR/NFR to reference stories or tasks */
  linkedIds?: string;
  /** Comma-separated item IDs this item depends on (must be completed first) */
  dependsOn?: string;
  /** Sprint this item belongs to */
  sprintId?: string;
  /** Release this item belongs to */
  releaseId?: string;
  /** Planned start date — ISO YYYY-MM-DD */
  startDate?: string;
  /** Planned due date — ISO YYYY-MM-DD */
  dueDate?: string;
  /** Release date (for releases) — ISO YYYY-MM-DD */
  releaseDate?: string;
  /** FK relations for db-table — comma-separated colName:tableId pairs */
  relations?: string;
  priority?: ItemPriority;
  /** Member this task/bug is assigned to */
  assigneeId?: string;
  /** Role of a member */
  role?: string;
  /** Process type for data-proc — sync | async | cron */
  processType?: "sync" | "async" | "cron";
  /** Test scope for test-plan — integration | e2e */
  testScope?: "integration" | "e2e";
}

export interface SpecItem {
  filePath: string;
  data: SpecFrontMatter;
  body: string;
}

export const EPIC_STATUSES: ItemStatus[] = ["draft", "active", "done"];
export const STORY_STATUSES: ItemStatus[] = ["draft", "active", "done"];
export const TASK_STATUSES: ItemStatus[] = [
  "todo",
  "in-progress",
  "testing",
  "blocked",
  "done",
];
export const FR_NFR_STATUSES: ItemStatus[] = ["draft", "active", "deprecated"];
export const ADR_STATUSES: ItemStatus[] = [
  "proposed",
  "accepted",
  "deprecated",
  "superseded",
];
export const TECH_STATUSES: ItemStatus[] = ["draft", "active", "deprecated"];
export const SPRINT_STATUSES: ItemStatus[] = ["planned", "active", "done"];
export const RELEASE_STATUSES: ItemStatus[] = ["draft", "active", "released"];
export const MEMBER_STATUSES: ItemStatus[] = ["active", "draft"];
export const CICD_STATUSES: ItemStatus[] = ["draft", "active", "deprecated"];
export const AUTH_SPEC_STATUSES: ItemStatus[] = [
  "draft",
  "active",
  "deprecated",
];
export const CONCEPT_STATUSES: ItemStatus[] = ["draft", "active", "deprecated"];
export const DB_TABLE_STATUSES: ItemStatus[] = ["draft", "active", "done"];

// ---------------------------------------------------------------------------
// Type registry — the canonical, exhaustive list of item types plus the
// per-type facts derived from it (ID prefix, valid statuses). Anything that
// needs to enumerate or validate against "all types" should use these
// instead of re-declaring its own copy.
// ---------------------------------------------------------------------------

export const ALL_TYPES: ItemType[] = [
  "epic",
  "story",
  "task",
  "bug",
  "fr",
  "nfr",
  "adr",
  "arch",
  "service",
  "data-proc",
  "db-table",
  "cicd",
  "auth-spec",
  "sprint",
  "release",
  "member",
  "concept",
  "test-plan",
];

export const ID_PREFIXES: Record<ItemType, string> = {
  epic: "EPIC",
  story: "US",
  task: "TASK",
  bug: "BUG",
  fr: "FR",
  nfr: "NFR",
  adr: "ADR",
  arch: "ARCH",
  service: "SRV",
  "data-proc": "DP",
  "db-table": "TBL",
  sprint: "SPR",
  release: "REL",
  cicd: "CICD",
  "auth-spec": "AUTH",
  member: "MBR",
  concept: "CON",
  "test-plan": "TP",
};

export const VALID_STATUSES: Record<ItemType, ItemStatus[]> = {
  epic: EPIC_STATUSES,
  story: STORY_STATUSES,
  task: TASK_STATUSES,
  bug: TASK_STATUSES,
  fr: FR_NFR_STATUSES,
  nfr: FR_NFR_STATUSES,
  adr: ADR_STATUSES,
  arch: TECH_STATUSES,
  service: TECH_STATUSES,
  "data-proc": TECH_STATUSES,
  "db-table": DB_TABLE_STATUSES,
  cicd: CICD_STATUSES,
  "auth-spec": AUTH_SPEC_STATUSES,
  sprint: SPRINT_STATUSES,
  release: RELEASE_STATUSES,
  member: MEMBER_STATUSES,
  concept: CONCEPT_STATUSES,
  "test-plan": TECH_STATUSES,
};
