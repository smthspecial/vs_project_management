import React, { useMemo, useCallback } from "react";
import { ItemData } from "./types";
import { vscode } from "./vscodeApi";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const NODE_W = 180;
const NODE_H = 54;
const COL_GAP = 110;
const ROW_GAP = 18;
const PAD = 40;

const TYPE_COLOR: Record<string, string> = {
  epic: "#7c3aed",
  story: "#2563eb",
  task: "#16a34a",
  bug: "#dc2626",
  fr: "#ea580c",
  nfr: "#ca8a04",
  adr: "#0891b2",
  arch: "#0f766e",
  "service": "#4f46e5",
  "data-proc": "#0891b2",
};

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface GraphNode {
  item: ItemData;
  level: number;
  rowInLevel: number;
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Build DAG layout (topological levels)
// ---------------------------------------------------------------------------

function buildGraph(items: ItemData[]): {
  nodes: GraphNode[];
  edges: { from: GraphNode; to: GraphNode }[];
  svgWidth: number;
  svgHeight: number;
} {
  // Parse dependency map: item.id -> list of IDs it depends on
  const depMap = new Map<string, string[]>();
  for (const item of items) {
    const deps = item.dependsOn
      ? item.dependsOn
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    depMap.set(item.id, deps);
  }

  // Only include items that participate in at least one dependency edge
  const involved = new Set<string>();
  for (const item of items) {
    const deps = depMap.get(item.id) ?? [];
    if (deps.length > 0) {
      involved.add(item.id);
      deps.forEach((id) => involved.add(id));
    }
  }

  const visibleItems = items.filter((i) => involved.has(i.id));

  if (visibleItems.length === 0) {
    return { nodes: [], edges: [], svgWidth: 0, svgHeight: 0 };
  }

  // Assign topological levels (cycle-safe with visited set)
  const levelCache = new Map<string, number>();

  function getLevel(id: string, ancestors: Set<string>): number {
    if (levelCache.has(id)) return levelCache.get(id)!;
    if (ancestors.has(id)) {
      // Cycle: pin to 0
      levelCache.set(id, 0);
      return 0;
    }
    const deps = depMap.get(id) ?? [];
    let max = -1;
    const next = new Set(ancestors);
    next.add(id);
    for (const depId of deps) {
      max = Math.max(max, getLevel(depId, next));
    }
    const l = max + 1;
    levelCache.set(id, l);
    return l;
  }

  for (const item of visibleItems) {
    getLevel(item.id, new Set());
  }

  // Group by level
  const byLevel = new Map<number, ItemData[]>();
  for (const item of visibleItems) {
    const l = levelCache.get(item.id) ?? 0;
    if (!byLevel.has(l)) byLevel.set(l, []);
    byLevel.get(l)!.push(item);
  }

  // Build node positions
  const nodeMap = new Map<string, GraphNode>();
  for (const [l, levelItems] of byLevel) {
    const x = PAD + l * (NODE_W + COL_GAP);
    levelItems.forEach((item, rowInLevel) => {
      const y = PAD + rowInLevel * (NODE_H + ROW_GAP);
      nodeMap.set(item.id, { item, level: l, rowInLevel, x, y });
    });
  }

  const nodes = Array.from(nodeMap.values());

  // Build edges (predecessor → successor)
  const edges: { from: GraphNode; to: GraphNode }[] = [];
  for (const node of nodes) {
    const deps = depMap.get(node.item.id) ?? [];
    for (const depId of deps) {
      const pred = nodeMap.get(depId);
      if (pred) edges.push({ from: pred, to: node });
    }
  }

  const svgWidth = Math.max(...nodes.map((n) => n.x)) + NODE_W + PAD;
  const svgHeight = Math.max(...nodes.map((n) => n.y)) + NODE_H + PAD;

  return { nodes, edges, svgWidth, svgHeight };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DependenciesViewProps {
  items: ItemData[];
}

export function DependenciesView({
  items,
}: DependenciesViewProps): React.ReactElement {
  const { nodes, edges, svgWidth, svgHeight } = useMemo(
    () => buildGraph(items),
    [items],
  );

  const handleOpen = useCallback((filePath: string) => {
    vscode.postMessage({ type: "openFile", filePath });
  }, []);

  if (nodes.length === 0) {
    return (
      <div className="dep-empty">
        <div className="dep-empty-icon">⛓</div>
        <p>No dependencies defined.</p>
        <p>
          Add <code>dependsOn: ITEM-001, ITEM-002</code> to an item's front
          matter to visualise relationships here.
        </p>
      </div>
    );
  }

  return (
    <div className="dep-root">
      <svg
        width={svgWidth}
        height={svgHeight}
        style={{ display: "block", minWidth: "100%", minHeight: "100%" }}
      >
        {/* Arrow marker */}
        <defs>
          <marker
            id="dep-arrow"
            markerWidth={8}
            markerHeight={6}
            refX={7}
            refY={3}
            orient="auto"
          >
            <polygon
              points="0 0, 8 3, 0 6"
              fill="var(--vscode-editorInfo-foreground)"
              opacity={0.75}
            />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((e, i) => {
          const x1 = e.from.x + NODE_W;
          const y1 = e.from.y + NODE_H / 2;
          const x2 = e.to.x;
          const y2 = e.to.y + NODE_H / 2;
          const cx = (x1 + x2) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="var(--vscode-editorInfo-foreground)"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              markerEnd="url(#dep-arrow)"
              opacity={0.65}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const color = TYPE_COLOR[node.item.type] ?? "#888";
          return (
            <g
              key={node.item.id}
              style={{ cursor: "pointer" }}
              onClick={() => handleOpen(node.item.filePath)}
            >
              {/* Node background */}
              <rect
                x={node.x}
                y={node.y}
                width={NODE_W}
                height={NODE_H}
                rx={7}
                fill={color}
                opacity={0.13}
                stroke={color}
                strokeWidth={1.5}
              />
              {/* Left accent bar */}
              <rect
                x={node.x}
                y={node.y}
                width={4}
                height={NODE_H}
                rx={3}
                fill={color}
                opacity={0.8}
              />
              {/* Type + status badge */}
              <text
                x={node.x + 12}
                y={node.y + 17}
                fontSize={9}
                fill={color}
                fontWeight={700}
                style={{ textTransform: "uppercase", letterSpacing: 0.5 }}
              >
                {node.item.type}
              </text>
              <text
                x={node.x + 12 + node.item.type.length * 6.5 + 6}
                y={node.y + 17}
                fontSize={9}
                fill="var(--vscode-descriptionForeground)"
                opacity={0.7}
              >
                · {node.item.status}
              </text>
              {/* Title */}
              <text
                x={node.x + 12}
                y={node.y + 33}
                fontSize={11.5}
                fill="var(--vscode-foreground)"
                fontWeight={500}
              >
                {node.item.title.length > 20
                  ? node.item.title.slice(0, 20) + "…"
                  : node.item.title}
              </text>
              {/* ID */}
              <text
                x={node.x + 12}
                y={node.y + 47}
                fontSize={9}
                fill="var(--vscode-descriptionForeground)"
                opacity={0.55}
              >
                {node.item.id}
              </text>
              {/* Invisible hover target */}
              <rect
                x={node.x}
                y={node.y}
                width={NODE_W}
                height={NODE_H}
                fill="transparent"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
