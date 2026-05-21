import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ItemData, WebviewMessage } from "./types";
import { vscode } from "./vscodeApi";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABLE_W = 240;
const HEADER_H = 36;
const COL_ROW_H = 22;
const PAD_B = 8;
const GRID_GAP_X = 80;
const GRID_GAP_Y = 60;
const CANVAS_PAD = 40;
const COLS_PER_ROW = 3;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4.0;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Column {
  name: string;
  type: string;
  constraints: string;
}

interface Relation {
  col: string;
  targetId: string;
}

interface NodePos {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  // skip header row (idx 0) and separator row (idx 1)
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

function nodeHeight(numCols: number): number {
  return HEADER_H + Math.max(1, numCols) * COL_ROW_H + PAD_B;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DatabaseViewProps {
  items: ItemData[];
}

export function DatabaseView({ items }: DatabaseViewProps): React.ReactElement {
  const dbItems = useMemo(
    () => items.filter((i) => i.type === "db-table"),
    [items],
  );

  // node positions (in canvas space, without pan)
  const [positions, setPositions] = useState<Record<string, NodePos>>({});
  const [pan, setPan] = useState<NodePos>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);

  // refs for drag handling
  const panRef = useRef(pan);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  const posRef = useRef(positions);
  useEffect(() => {
    posRef.current = positions;
  }, [positions]);

  // compute columns and relations once per items change
  const nodes = useMemo(() => {
    return dbItems.map((item) => ({
      item,
      columns: parseColumns(item.body ?? ""),
      relations: parseRelations(item.relations),
    }));
  }, [dbItems]);

  // initialise positions for new tables
  useEffect(() => {
    setPositions((prev) => {
      const next = { ...prev };
      nodes.forEach(({ item }, idx) => {
        if (!next[item.id]) {
          const col = idx % COLS_PER_ROW;
          const row = Math.floor(idx / COLS_PER_ROW);
          next[item.id] = {
            x: CANVAS_PAD + col * (TABLE_W + GRID_GAP_X),
            y: CANVAS_PAD + row * (200 + GRID_GAP_Y),
          };
        }
      });
      return next;
    });
  }, [nodes]);

  const nodeMap = useMemo(
    () => new Map(nodes.map((n) => [n.item.id, n])),
    [nodes],
  );

  // Build FK edges
  const edges = useMemo(() => {
    return nodes.flatMap(({ item, columns, relations: rels }) =>
      rels.map((rel) => {
        const colIdx = columns.findIndex((c) => c.name === rel.col);
        return {
          fromId: item.id,
          toId: rel.targetId,
          colIdx,
        };
      }),
    );
  }, [nodes]);

  // ---------------------------------------------------------------------------
  // Drag handling
  // ---------------------------------------------------------------------------

  type DragState =
    | { kind: "pan"; startX: number; startY: number; origPan: NodePos }
    | {
        kind: "node";
        id: string;
        startX: number;
        startY: number;
        origPos: NodePos;
      };

  const dragRef = useRef<DragState | null>(null);
  const nodeWasDraggedRef = useRef(false);

  const handleBgMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest(".db-node")) {
        return;
      }
      e.preventDefault();
      const orig = panRef.current;
      dragRef.current = {
        kind: "pan",
        startX: e.clientX,
        startY: e.clientY,
        origPan: orig,
      };

      const onMove = (ev: MouseEvent): void => {
        const d = dragRef.current;
        if (!d || d.kind !== "pan") {
          return;
        }
        setPan({
          x: d.origPan.x + ev.clientX - d.startX,
          y: d.origPan.y + ev.clientY - d.startY,
        });
      };
      const onUp = (): void => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [],
  );

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, id: string) => {
      if (e.button !== 0) {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
      const orig = posRef.current[id] ?? { x: 0, y: 0 };
      nodeWasDraggedRef.current = false;
      dragRef.current = {
        kind: "node",
        id,
        startX: e.clientX,
        startY: e.clientY,
        origPos: orig,
      };

      const onMove = (ev: MouseEvent): void => {
        const d = dragRef.current;
        if (!d || d.kind !== "node") {
          return;
        }
        const dx = ev.clientX - d.startX;
        const dy = ev.clientY - d.startY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          nodeWasDraggedRef.current = true;
        }
        setPositions((prev) => ({
          ...prev,
          [d.id]: {
            x: d.origPos.x + dx,
            y: d.origPos.y + dy,
          },
        }));
      };
      const onUp = (): void => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Zoom handling
  // ---------------------------------------------------------------------------

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, zoomRef.current * factor),
    );
    const cx = (e.clientX - panRef.current.x) / zoomRef.current;
    const cy = (e.clientY - panRef.current.y) / zoomRef.current;
    setPan({ x: e.clientX - cx * newZoom, y: e.clientY - cy * newZoom });
    setZoom(newZoom);
  }, []);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleOpen = useCallback((filePath: string) => {
    vscode.postMessage({ type: "openFile", filePath } as WebviewMessage);
  }, []);

  const handleNewTable = useCallback(() => {
    vscode.postMessage({ type: "createTable" } as WebviewMessage);
  }, []);

  const handleDelete = useCallback((id: string, filePath: string) => {
    vscode.postMessage({ type: "deleteTable", id, filePath } as WebviewMessage);
  }, []);

  // ---------------------------------------------------------------------------
  // Arrow rendering helpers
  // ---------------------------------------------------------------------------

  function arrowPath(
    fromId: string,
    toId: string,
    colIdx: number,
    cols: number,
  ): string | null {
    const fromPos = positions[fromId];
    const toPos = positions[toId];
    if (!fromPos || !toPos) {
      return null;
    }
    const fromH = nodeHeight(cols);
    const toNode = nodeMap.get(toId);
    const toH = nodeHeight(toNode?.columns.length ?? 1);

    const colY =
      colIdx >= 0 ? HEADER_H + colIdx * COL_ROW_H + COL_ROW_H / 2 : fromH / 2;

    const x1 = fromPos.x + TABLE_W;
    const y1 = fromPos.y + colY;
    const x2 = toPos.x;
    const y2 = toPos.y + toH / 2;
    const cx = (x1 + x2) / 2;

    return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (dbItems.length === 0) {
    return (
      <div className="db-empty">
        <div className="db-empty-icon">🗄</div>
        <p>No database tables yet.</p>
        <button className="db-btn" onClick={handleNewTable}>
          + New Table
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="db-root">
      {/* Toolbar */}
      <div className="db-toolbar">
        <span className="db-toolbar-title">Database Schema</span>
        <button className="db-btn" onClick={handleNewTable}>
          + New Table
        </button>
        <button
          className="db-btn"
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.2))}
        >
          +
        </button>
        <button
          className="db-btn"
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.2))}
        >
          −
        </button>
        <button
          className="db-btn"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        >
          Reset
        </button>
      </div>

      {/* Canvas */}
      <div
        className="db-canvas"
        onMouseDown={handleBgMouseDown}
        onWheel={handleWheel}
      >
        {/* SVG arrows overlay */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          <defs>
            <marker
              id="fk-arrow"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#3b82f6" opacity="0.7" />
            </marker>
          </defs>
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {edges.map((edge, i) => {
              const fromNode = nodeMap.get(edge.fromId);
              if (!fromNode) {
                return null;
              }
              const d = arrowPath(
                edge.fromId,
                edge.toId,
                edge.colIdx,
                fromNode.columns.length,
              );
              if (!d) {
                return null;
              }
              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  opacity="0.6"
                  markerEnd="url(#fk-arrow)"
                />
              );
            })}
          </g>
        </svg>

        {/* Table nodes */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {nodes.map(({ item, columns, relations: rels }) => {
            const pos = positions[item.id] ?? { x: 0, y: 0 };
            const h = nodeHeight(columns.length);
            return (
              <div
                key={item.id}
                className="db-node"
                style={{
                  position: "absolute",
                  left: pos.x,
                  top: pos.y,
                  width: TABLE_W,
                  height: h,
                }}
                onMouseDown={(e) => handleNodeMouseDown(e, item.id)}
              >
                <div className="db-node-header">
                  <span
                    className="db-node-name"
                    title="Open file"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!nodeWasDraggedRef.current) {
                        handleOpen(item.filePath);
                      }
                    }}
                  >
                    {item.title}
                  </span>
                  <button
                    className="db-node-del"
                    title="Delete table"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id, item.filePath);
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="db-node-cols">
                  {columns.map((col, ci) => {
                    const isPK = /\bPK\b/.test(col.constraints);
                    const isFK =
                      /\bFK\b/.test(col.constraints) ||
                      rels.some((r) => r.col === col.name);
                    return (
                      <div key={ci} className="db-col-row">
                        <span className="db-col-icon">
                          {isPK ? "🔑" : isFK ? "⟶" : ""}
                        </span>
                        <span className="db-col-name">{col.name}</span>
                        <span className="db-col-type">{col.type}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
