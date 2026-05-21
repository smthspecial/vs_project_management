import React from "react";
import {
  HEADER_HEIGHT,
  MONTH_HEIGHT,
  WEEK_HEIGHT,
  SPRINT_ROW_HEIGHT,
  DAY_WIDTH,
  DragMode,
  addDays,
  daysBetween,
  formatDate,
} from "../hooks/timelineUtils";
import { MonthSegment, WeekSegment } from "../hooks/useTimelineHeader";
import type { SprintBand } from "../hooks/useTimelineItems";

interface TimelineHeaderProps {
  monthSegments: MonthSegment[];
  weekSegments: WeekSegment[];
  totalWidth: number;
  minDate: Date;
  sprintBands: SprintBand[];
  onSprintMouseDown?: (
    e: React.MouseEvent,
    spr: SprintBand,
    mode: DragMode,
  ) => void;
}

const SPRINT_COLORS = ["#2563eb", "#7c3aed", "#0d9488", "#d97706"];
const DAY_LETTERS = "SMTWTFS";

export function TimelineHeader({
  monthSegments,
  weekSegments,
  totalWidth,
  minDate,
  sprintBands,
  onSprintMouseDown,
}: TimelineHeaderProps): React.ReactElement {
  const totalDays = Math.round(totalWidth / DAY_WIDTH);
  const totalHeight = HEADER_HEIGHT + SPRINT_ROW_HEIGHT;

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "var(--vscode-editor-background)",
        borderBottom: "1px solid var(--vscode-panel-border)",
      }}
    >
      <svg width={totalWidth} height={totalHeight} style={{ display: "block" }}>
        <rect
          x={0}
          y={0}
          width={totalWidth}
          height={totalHeight}
          fill="var(--vscode-editor-background)"
        />

        {monthSegments.map((seg, i) => (
          <g key={i}>
            <rect
              x={seg.x}
              y={0}
              width={seg.width}
              height={MONTH_HEIGHT}
              fill={
                i % 2 === 0
                  ? "var(--vscode-list-hoverBackground)"
                  : "var(--vscode-editor-background)"
              }
            />
            <text
              x={seg.x + 6}
              y={16}
              fontSize={11}
              fill="var(--vscode-foreground)"
              opacity={0.7}
            >
              {seg.label}
            </text>
            <line
              x1={seg.x}
              y1={0}
              x2={seg.x}
              y2={HEADER_HEIGHT}
              stroke="var(--vscode-panel-border)"
              strokeWidth={1}
            />
          </g>
        ))}

        {weekSegments.map((seg, i) => (
          <g key={i}>
            <rect
              x={seg.x}
              y={MONTH_HEIGHT}
              width={seg.width}
              height={WEEK_HEIGHT}
              fill={
                seg.isToday
                  ? "var(--vscode-list-activeSelectionBackground)"
                  : "transparent"
              }
              opacity={0.3}
            />
            <text
              x={seg.x + 4}
              y={MONTH_HEIGHT + 14}
              fontSize={10}
              fill="var(--vscode-foreground)"
              opacity={0.6}
            >
              {seg.label}
            </text>
            <line
              x1={seg.x}
              y1={MONTH_HEIGHT}
              x2={seg.x}
              y2={HEADER_HEIGHT}
              stroke="var(--vscode-panel-border)"
              strokeWidth={0.5}
              opacity={0.4}
            />
          </g>
        ))}

        {/* Day letters — one per day column */}
        {Array.from({ length: totalDays }).map((_, dayIdx) => {
          const d = addDays(minDate, dayIdx);
          const letter = DAY_LETTERS.charAt(d.getDay());
          const x = dayIdx * DAY_WIDTH + DAY_WIDTH / 2;
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <text
              key={dayIdx}
              x={x}
              y={HEADER_HEIGHT - 4}
              textAnchor="middle"
              fontSize={8}
              fill="var(--vscode-foreground)"
              opacity={isWeekend ? 0.3 : 0.5}
              style={{ userSelect: "none" }}
            >
              {letter}
            </text>
          );
        })}

        {/* Divider between date header and sprint row */}
        <line
          x1={0}
          y1={HEADER_HEIGHT}
          x2={totalWidth}
          y2={HEADER_HEIGHT}
          stroke="var(--vscode-panel-border)"
          strokeWidth={1}
        />

        {/* Sprint bands row — rendered inside this sticky SVG so it scrolls correctly */}
        {sprintBands.map((spr, i) => {
          const x1 = Math.max(0, daysBetween(minDate, spr.start) * DAY_WIDTH);
          const x2 = Math.min(
            totalWidth,
            daysBetween(minDate, spr.end) * DAY_WIDTH,
          );
          const w = x2 - x1;
          if (w <= 0) return null;
          const color = SPRINT_COLORS[i % SPRINT_COLORS.length]!;
          const HANDLE_W = 6;
          const y = HEADER_HEIGHT + 2;
          const h = SPRINT_ROW_HEIGHT - 4;
          const innerW = Math.max(0, w - HANDLE_W * 2);
          const tooltip = `${spr.item.title}  ${formatDate(spr.start)} → ${formatDate(spr.end)}`;

          return (
            <g key={spr.item.id}>
              <title>{tooltip}</title>

              {/* Left resize handle */}
              <rect
                x={x1}
                y={y}
                width={HANDLE_W}
                height={h}
                fill={color}
                opacity={0.45}
                rx={3}
                style={{ cursor: "ew-resize" }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onSprintMouseDown?.(e, spr, "resize-start");
                }}
              />

              {/* Main drag body — click opens file, drag moves sprint */}
              <rect
                x={x1 + HANDLE_W}
                y={y}
                width={innerW}
                height={h}
                fill={color}
                opacity={0.18}
                rx={2}
                style={{ cursor: "grab" }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onSprintMouseDown?.(e, spr, "move");
                }}
              />

              {/* Right resize handle */}
              <rect
                x={x2 - HANDLE_W}
                y={y}
                width={HANDLE_W}
                height={h}
                fill={color}
                opacity={0.45}
                rx={3}
                style={{ cursor: "ew-resize" }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onSprintMouseDown?.(e, spr, "resize-end");
                }}
              />

              {/* Sprint label */}
              <text
                x={x1 + 10}
                y={HEADER_HEIGHT + SPRINT_ROW_HEIGHT / 2 + 4}
                fontSize={10}
                fill={color}
                opacity={0.9}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {spr.item.title}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
