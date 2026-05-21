import React, { useEffect, useMemo, useRef } from "react";
import { ItemData } from "./types";
import { vscode } from "./vscodeApi";
import {
  DAY_WIDTH,
  ROW_HEIGHT,
  HEADER_HEIGHT,
  SPRINT_ROW_HEIGHT,
  ARROW_COLOR,
  addDays,
  daysBetween,
  formatDate,
} from "./hooks/timelineUtils";
import { useTimelineItems } from "./hooks/useTimelineItems";
import { useTimelineHeader } from "./hooks/useTimelineHeader";
import { useTimelineDrag } from "./hooks/useTimelineDrag";
import { useTimelineDrop } from "./hooks/useTimelineDrop";
import { useSprintDrag } from "./hooks/useSprintDrag";
import { TimelineHeader } from "./components/TimelineHeader";
import { TimelineBar } from "./components/TimelineBar";
import { TimelineLabelPanel } from "./components/TimelineLabelPanel";

interface TimelineViewProps {
  items: ItemData[];
}

export function TimelineView({ items }: TimelineViewProps): React.ReactElement {
  const {
    localItems,
    setLocalItems,
    localItemsRef,
    timelineItems,
    unscheduled,
    minDate,
    maxDate,
    totalDays,
    sprintBands,
    sprintBandsRef,
    releaseMarkers,
    releaseMarkersRef,
    minDateRef,
  } = useTimelineItems(items);

  const { monthSegments, weekSegments, todayX } = useTimelineHeader(
    minDate,
    maxDate,
  );

  const { handleBarMouseDown, draggingId } = useTimelineDrag({
    setLocalItems,
    localItemsRef,
    sprintBandsRef,
    releaseMarkersRef,
  });

  const { handleSprintMouseDown } = useSprintDrag(setLocalItems);

  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    handleChartDragOver,
    handleChartDragLeave,
    handleChartDrop,
    handleUnscheduledDragStart,
    dropIndicatorX,
  } = useTimelineDrop({ scrollRef, minDateRef, localItemsRef, setLocalItems });

  const totalWidth = totalDays * DAY_WIDTH;
  const bodyHeight = Math.max((timelineItems.length + 1) * ROW_HEIGHT, 200);

  // Scroll to today once on initial load
  const hasScrolledRef = useRef(false);
  useEffect(() => {
    if (hasScrolledRef.current) return;
    if (!scrollRef.current || timelineItems.length === 0) return;
    hasScrolledRef.current = true;
    const offsetDays = daysBetween(minDate, new Date());
    const targetScroll = offsetDays * DAY_WIDTH - 200;
    scrollRef.current.scrollLeft = Math.max(0, targetScroll);
  }, [minDate, timelineItems.length]);

  // Dependency arrows
  const arrows = useMemo(() => {
    const arrs: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const ti of timelineItems) {
      const deps = ti.item.dependsOn
        ? ti.item.dependsOn
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      for (const depId of deps) {
        const predTi = timelineItems.find((t) => t.item.id === depId);
        if (!predTi) continue;
        const predEndX = daysBetween(minDate, predTi.end) * DAY_WIDTH;
        const predMidY = predTi.row * ROW_HEIGHT + ROW_HEIGHT / 2;
        const succStartX = daysBetween(minDate, ti.start) * DAY_WIDTH;
        const succMidY = ti.row * ROW_HEIGHT + ROW_HEIGHT / 2;
        arrs.push({
          x1: predEndX,
          y1: predMidY,
          x2: succStartX,
          y2: succMidY,
        });
      }
    }
    return arrs;
  }, [timelineItems, minDate]);

  return (
    <div className="timeline-root">
      <TimelineLabelPanel
        timelineItems={timelineItems}
        sprintBands={sprintBands}
        unscheduled={unscheduled}
        onDragStart={handleUnscheduledDragStart}
      />

      <div
        ref={scrollRef}
        className={`timeline-chart${dropIndicatorX !== null ? " drop-target" : ""}`}
        onDragOver={handleChartDragOver}
        onDragLeave={handleChartDragLeave}
        onDrop={handleChartDrop}
      >
        <TimelineHeader
          monthSegments={monthSegments}
          weekSegments={weekSegments}
          totalWidth={totalWidth}
          minDate={minDate}
          sprintBands={sprintBands}
          onSprintMouseDown={handleSprintMouseDown}
        />

        {/* Chart body */}
        <svg
          width={totalWidth}
          height={bodyHeight}
          style={{ display: "block" }}
        >
          <rect
            x={0}
            y={0}
            width={totalWidth}
            height={bodyHeight}
            fill="var(--vscode-editor-background)"
          />

          {/* Sprint background bands (tinted, no labels — labels are in sticky sprint row) */}
          {sprintBands.map((spr, i) => {
            const x1 = Math.max(0, daysBetween(minDate, spr.start) * DAY_WIDTH);
            const x2 = Math.min(
              totalWidth,
              daysBetween(minDate, spr.end) * DAY_WIDTH,
            );
            const w = x2 - x1;
            if (w <= 0) return null;
            const bandColor = ["#2563eb", "#7c3aed", "#0d9488", "#d97706"][
              i % 4
            ]!;
            return (
              <rect
                key={spr.item.id}
                x={x1}
                y={0}
                width={w}
                height={bodyHeight}
                fill={bandColor}
                opacity={0.07}
              />
            );
          })}

          {/* Weekend columns */}
          {Array.from({ length: totalDays }).map((_, dayIdx) => {
            const d = addDays(minDate, dayIdx);
            const dow = d.getDay();
            if (dow !== 0 && dow !== 6) return null;
            return (
              <rect
                key={`wk-${dayIdx}`}
                x={dayIdx * DAY_WIDTH}
                y={0}
                width={DAY_WIDTH}
                height={bodyHeight}
                fill="var(--vscode-panel-border)"
                opacity={0.15}
              />
            );
          })}

          {/* Row backgrounds */}
          {timelineItems.map((ti, idx) => (
            <rect
              key={ti.item.id}
              x={0}
              y={idx * ROW_HEIGHT}
              width={totalWidth}
              height={ROW_HEIGHT}
              fill={
                idx % 2 === 0
                  ? "var(--vscode-list-hoverBackground)"
                  : "var(--vscode-editor-background)"
              }
              opacity={0.3}
            />
          ))}

          {/* Release markers */}
          {releaseMarkers.map((rel) => {
            const x = daysBetween(minDate, rel.date) * DAY_WIDTH;
            if (x < 0 || x > totalWidth) return null;
            return (
              <g key={rel.item.id}>
                <line
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={bodyHeight}
                  stroke="#dc2626"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  opacity={0.7}
                />
                <text
                  x={x + 4}
                  y={28}
                  fontSize={10}
                  fill="#dc2626"
                  opacity={0.85}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {rel.item.title}
                </text>
              </g>
            );
          })}

          {/* Today line */}
          {todayX >= 0 && todayX <= totalWidth && (
            <line
              x1={todayX}
              y1={0}
              x2={todayX}
              y2={bodyHeight}
              stroke="#e11d48"
              strokeWidth={1.5}
              opacity={0.7}
              strokeDasharray="4 3"
            />
          )}

          {/* Dependency arrows */}
          <defs>
            <marker
              id="arrow"
              markerWidth={8}
              markerHeight={6}
              refX={8}
              refY={3}
              orient="auto"
            >
              <polygon
                points="0 0, 8 3, 0 6"
                fill={ARROW_COLOR}
                opacity={0.7}
              />
            </marker>
          </defs>
          {arrows.map((a, i) => {
            const midX = (a.x1 + a.x2) / 2;
            const path = `M ${a.x1} ${a.y1} C ${midX} ${a.y1}, ${midX} ${a.y2}, ${a.x2} ${a.y2}`;
            return (
              <path
                key={i}
                d={path}
                fill="none"
                stroke={ARROW_COLOR}
                strokeWidth={1.5}
                strokeDasharray="4 2"
                markerEnd="url(#arrow)"
                opacity={0.7}
              />
            );
          })}

          {/* Bars */}
          {timelineItems.map((ti) => (
            <TimelineBar
              key={ti.item.id}
              ti={ti}
              minDate={minDate}
              draggingId={draggingId}
              onMouseDown={handleBarMouseDown}
            />
          ))}

          {/* Drop indicator */}
          {dropIndicatorX !== null && (
            <>
              <rect
                x={dropIndicatorX - 1}
                y={0}
                width={2}
                height={bodyHeight}
                fill="var(--vscode-focusBorder)"
                opacity={0.8}
              />
              <text
                x={dropIndicatorX + 4}
                y={16}
                fontSize={10}
                fill="var(--vscode-focusBorder)"
              >
                {formatDate(
                  addDays(minDate, Math.round(dropIndicatorX / DAY_WIDTH)),
                )}
              </text>
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
