export type ItemStatus =
  | "draft"
  | "active"
  | "in-progress"
  | "done"
  | "closed"
  | "todo"
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
  | "tech-spec"
  | "sprint"
  | "release";

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
  priority?: ItemPriority;
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
  "done",
  "closed",
];
export const FR_NFR_STATUSES: ItemStatus[] = ["draft", "active", "done"];
export const ADR_STATUSES: ItemStatus[] = [
  "proposed",
  "accepted",
  "deprecated",
  "superseded",
];
export const TECH_STATUSES: ItemStatus[] = ["draft", "active", "done"];
export const SPRINT_STATUSES: ItemStatus[] = ["planned", "active", "done"];
export const RELEASE_STATUSES: ItemStatus[] = ["draft", "active", "released"];
