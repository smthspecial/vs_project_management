import React from "react";
import {
  TimelineItem,
  DragMode,
  DAY_WIDTH,
  ROW_HEIGHT,
  daysBetween,
} from "../hooks/timelineUtils";

interface TimelineBarProps {
  ti: TimelineItem;
  minDate: Date;
  draggingId: string | null;
  onMouseDown: (e: React.MouseEvent, ti: TimelineItem, mode: DragMode) => void;
}

export function TimelineBar({
  ti,
  minDate,
  draggingId,
  onMouseDown,
}: TimelineBarProps): React.ReactElement {
  const x = daysBetween(minDate, ti.start) * DAY_WIDTH;
  const width = Math.max(DAY_WIDTH, daysBetween(ti.start, ti.end) * DAY_WIDTH);
  const y = ti.row * ROW_HEIGHT + 6;
  const barH = ROW_HEIGHT - 12;

  return (
    <g>
      {/* Main bar */}
      <rect
        x={x + 4}
        y={y}
        width={width - 8}
        height={barH}
        rx={4}
        ry={4}
        fill={ti.color}
        opacity={0.85}
        style={{ cursor: "grab" }}
        onMouseDown={(e) => onMouseDown(e, ti, "move")}
      />
      {/* Resize handle — left */}
      <rect
        x={x + 2}
        y={y + 2}
        width={8}
        height={barH - 4}
        rx={2}
        fill="white"
        opacity={0.4}
        style={{ cursor: "ew-resize" }}
        onMouseDown={(e) => onMouseDown(e, ti, "resize-start")}
      />
      {/* Resize handle — right */}
      <rect
        x={x + width - 10}
        y={y + 2}
        width={8}
        height={barH - 4}
        rx={2}
        fill="white"
        opacity={0.4}
        style={{ cursor: "ew-resize" }}
        onMouseDown={(e) => onMouseDown(e, ti, "resize-end")}
      />
      {/* Label */}
      <text
        x={x + 10}
        y={y + barH / 2 + 4}
        fontSize={11}
        fill="white"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {width > 80 ? ti.item.title.slice(0, Math.floor((width - 20) / 7)) : ""}
      </text>
      {/* Dates shown while dragging */}
      {draggingId === ti.item.id && (
        <>
          <text
            x={x + 4}
            y={y - 4}
            fontSize={9}
            fill={ti.color}
            fontWeight={600}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {ti.item.startDate}
          </text>
          <text
            x={x + width - 4}
            y={y - 4}
            fontSize={9}
            fill={ti.color}
            fontWeight={600}
            textAnchor="end"
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {ti.item.dueDate}
          </text>
        </>
      )}
      <title>{`${ti.item.id}: ${ti.item.title}\n${ti.item.startDate} → ${ti.item.dueDate}`}</title>
    </g>
  );
}
