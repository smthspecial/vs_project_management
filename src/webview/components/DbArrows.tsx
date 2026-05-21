import React from "react";
import {
  DbEdge,
  HEADER_H,
  COL_ROW_H,
  TABLE_W,
  nodeHeight,
} from "../hooks/useDbNodes";
import { NodePos } from "../hooks/useDbPositions";

// ---------------------------------------------------------------------------
// Arrow path builder
// ---------------------------------------------------------------------------

interface ArrowData {
  path: string;
  srcX: number;
  srcY: number;
  dstX: number;
  dstY: number;
  srcSide: "right" | "left";
  dstSide: "left" | "right";
}

function buildArrowData(
  fromId: string,
  toId: string,
  colIdx: number,
  pkIdx: number,
  fromCols: number,
  toCols: number,
  positions: Record<string, NodePos>,
): ArrowData | null {
  const fromPos = positions[fromId];
  const toPos = positions[toId];
  if (!fromPos || !toPos) return null;

  const srcY =
    fromPos.y +
    (colIdx >= 0
      ? HEADER_H + colIdx * COL_ROW_H + COL_ROW_H / 2
      : nodeHeight(fromCols) / 2);
  const dstY =
    toPos.y +
    (pkIdx >= 0
      ? HEADER_H + pkIdx * COL_ROW_H + COL_ROW_H / 2
      : nodeHeight(toCols) / 2);

  const isSelf = fromId === toId;
  let srcX: number, dstX: number, path: string;
  let srcSide: "right" | "left";
  let dstSide: "left" | "right";

  if (isSelf) {
    srcX = fromPos.x + TABLE_W;
    dstX = fromPos.x;
    srcSide = "right";
    dstSide = "left";
    const tableH = nodeHeight(fromCols);
    const loopRight = fromPos.x + TABLE_W + 50;
    const loopLeft = fromPos.x - 50;
    const loopBottom = fromPos.y + tableH + 30;
    path = `M ${srcX} ${srcY} H ${loopRight} V ${loopBottom} H ${loopLeft} V ${dstY} H ${dstX}`;
  } else if (toPos.x + TABLE_W / 2 >= fromPos.x + TABLE_W / 2) {
    srcX = fromPos.x + TABLE_W;
    dstX = toPos.x;
    srcSide = "right";
    dstSide = "left";
    const midX = (srcX + dstX) / 2;
    path = `M ${srcX} ${srcY} H ${midX} V ${dstY} H ${dstX}`;
  } else {
    srcX = fromPos.x;
    dstX = toPos.x + TABLE_W;
    srcSide = "left";
    dstSide = "right";
    const midX = (srcX + dstX) / 2;
    path = `M ${srcX} ${srcY} H ${midX} V ${dstY} H ${dstX}`;
  }

  return { path, srcX, srcY, dstX, dstY, srcSide, dstSide };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DbArrowsProps {
  edges: DbEdge[];
  positions: Record<string, NodePos>;
  selectedId: string | null;
  pan: NodePos;
  zoom: number;
}

export function DbArrows({
  edges,
  positions,
  selectedId,
  pan,
  zoom,
}: DbArrowsProps): React.ReactElement {
  return (
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
        <marker
          id="fk-arrow-hi"
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="#60a5fa" />
        </marker>
      </defs>
      <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
        {edges.map((edge, i) => {
          const arrow = buildArrowData(
            edge.fromId,
            edge.toId,
            edge.colIdx,
            edge.pkIdx,
            edge.fromCols,
            edge.toCols,
            positions,
          );
          if (!arrow) return null;
          const isRelated =
            selectedId !== null &&
            (selectedId === edge.fromId || selectedId === edge.toId);
          const isDimmed = selectedId !== null && !isRelated;
          const edgeOpacity = isDimmed ? 0.1 : isRelated ? 1.0 : 0.7;
          const edgeStroke = isRelated ? "#60a5fa" : "#3b82f6";
          const edgeWidth = isRelated ? "2.5" : "1.5";
          const marker = isRelated ? "url(#fk-arrow-hi)" : "url(#fk-arrow)";
          const nX =
            arrow.srcSide === "right" ? arrow.srcX + 6 : arrow.srcX - 6;
          const nAnchor =
            arrow.srcSide === "right" ? "start" : ("end" as const);
          const oneX =
            arrow.dstSide === "left" ? arrow.dstX + 6 : arrow.dstX - 6;
          const oneAnchor =
            arrow.dstSide === "left" ? "start" : ("end" as const);
          return (
            <g key={i} opacity={edgeOpacity}>
              <path
                d={arrow.path}
                fill="none"
                stroke={edgeStroke}
                strokeWidth={edgeWidth}
                markerEnd={marker}
              />
              <text
                x={nX}
                y={arrow.srcY - 4}
                fontSize={9}
                fill={edgeStroke}
                textAnchor={nAnchor}
                style={{ userSelect: "none", pointerEvents: "none" }}
              >
                N
              </text>
              <text
                x={oneX}
                y={arrow.dstY - 4}
                fontSize={9}
                fill={edgeStroke}
                textAnchor={oneAnchor}
                style={{ userSelect: "none", pointerEvents: "none" }}
              >
                1
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
