import { useMemo } from "react";
import { ItemData } from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TABLE_W = 240;
export const HEADER_H = 36;
export const COL_ROW_H = 22;
export const PAD_B = 8;
export const GRID_GAP_X = 80;
export const GRID_GAP_Y = 60;
export const CANVAS_PAD = 40;
export const COLS_PER_ROW = 3;
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 4.0;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Column {
  name: string;
  type: string;
  constraints: string;
}

export interface Relation {
  col: string;
  targetId: string;
}

export interface DbNode {
  item: ItemData;
  columns: Column[];
  relations: Relation[];
}

export interface DbEdge {
  fromId: string;
  toId: string;
  colIdx: number;
  pkIdx: number;
  fromCols: number;
  toCols: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function nodeHeight(numCols: number): number {
  return HEADER_H + Math.max(1, numCols) * COL_ROW_H + PAD_B;
}

function parseColumns(body: string): Column[] {
  if (!body) {
    return [];
  }
  const lines = body.split("\n");
  let inCols = false;
  const tableLines: string[] = [];
  for (const line of lines) {
    if (/^##\s+Columns/i.test(line)) {
      inCols = true;
      continue;
    }
    if (inCols && /^##/.test(line)) {
      inCols = false;
    }
    if (inCols && line.trim().startsWith("|") && line.trim().endsWith("|")) {
      tableLines.push(line);
    }
  }
  return tableLines
    .slice(2)
    .map((line) => {
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      return {
        name: cells[0] ?? "",
        type: cells[1] ?? "",
        constraints: cells[2] ?? "",
      };
    })
    .filter((c) => c.name);
}

function parseRelations(relStr?: string): Relation[] {
  if (!relStr) {
    return [];
  }
  return relStr
    .split(",")
    .map((s) => {
      const [col, targetId] = s.trim().split(":");
      return { col: col?.trim() ?? "", targetId: targetId?.trim() ?? "" };
    })
    .filter((r) => r.col && r.targetId);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDbNodes(items: ItemData[]): {
  dbItems: ItemData[];
  nodes: DbNode[];
  edges: DbEdge[];
  nodeMap: Map<string, DbNode>;
} {
  const dbItems = useMemo(
    () => items.filter((i) => i.type === "db-table"),
    [items],
  );

  const nodes = useMemo(
    () =>
      dbItems.map((item) => ({
        item,
        columns: parseColumns(item.body ?? ""),
        relations: parseRelations(item.relations),
      })),
    [dbItems],
  );

  const nodeMap = useMemo(
    () => new Map(nodes.map((n) => [n.item.id, n])),
    [nodes],
  );

  const edges = useMemo(
    () =>
      nodes.flatMap(({ item, columns, relations: rels }) =>
        rels.map((rel) => {
          const colIdx = columns.findIndex((c) => c.name === rel.col);
          const toNode = nodeMap.get(rel.targetId);
          const pkIdx = toNode
            ? toNode.columns.findIndex((c) => /\bPK\b/.test(c.constraints))
            : -1;
          return {
            fromId: item.id,
            toId: rel.targetId,
            colIdx,
            pkIdx,
            fromCols: columns.length,
            toCols: toNode?.columns.length ?? 1,
          };
        }),
      ),
    [nodes, nodeMap],
  );

  return { dbItems, nodes, edges, nodeMap };
}
