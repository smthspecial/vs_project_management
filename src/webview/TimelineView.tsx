import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { ItemData, WebviewMessage } from "./types";
import { vscode } from "./vscodeApi";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_WIDTH = 28; // px per day
const ROW_HEIGHT = 40;
const LABEL_WIDTH = 220;
const HEADER_HEIGHT = 56;
const MONTH_HEIGHT = 24;
const WEEK_HEIGHT = 32;
const ARROW_COLOR = "var(--vscode-editorInfo-foreground)";

const TYPE_COLORS: Record<string, string> = {
  sprint: "#0d9488",
  epic: "#7c3aed",
  story: "#2563eb",
  task: "#16a34a",
  bug: "#dc2626",
};

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimelineItem {
  item: ItemData;
  start: Date;
  end: Date;
  row: number;
  color: string;
}

interface DragState {
  id: string;
  mode: "move" | "resize-start" | "resize-end";
  startX: number;
  origStart: Date;
  origEnd: Date;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TimelineViewProps {
  items: ItemData[];
}

export function TimelineView({ items }: TimelineViewProps): React.ReactElement {
  // Only epics and stories with dates are shown; others can be added via inline controls
  const [localItems, setLocalItems] = useState<ItemData[]>(items);
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const timelineItems: TimelineItem[] = useMemo(() => {
    const sprints = localItems.filter(
      (i) => i.type === "sprint" && i.startDate && i.dueDate,
    );
    const stories = localItems.filter(
      (i) => i.type === "story" && i.startDate && i.dueDate,
    );
    return [...sprints, ...stories].map((item, idx) => ({
      item,
      start: parseDate(item.startDate!),
      end: parseDate(item.dueDate!),
      row: idx,
      color: TYPE_COLORS[item.type] ?? "#555",
    }));
  }, [localItems]);

  // Stories without dates shown as an unscheduled list below the chart
  const unscheduled = useMemo(
    () =>
      localItems.filter(
        (i) => i.type === "story" && (!i.startDate || !i.dueDate),
      ),
    [localItems],
  );

  // Calculate visible date range
  const { minDate, maxDate, totalDays } = useMemo(() => {
    const today = new Date();
    if (timelineItems.length === 0) {
      const min = addDays(startOfWeek(today), -7);
      const max = addDays(min, 90);
      return { minDate: min, maxDate: max, totalDays: 90 };
    }
    const allStarts = timelineItems.map((t) => t.start);
    const allEnds = timelineItems.map((t) => t.end);
    const minD = addDays(
      new Date(Math.min(...allStarts.map((d) => d.getTime()))),
      -14,
    );
    const maxD = addDays(
      new Date(Math.max(...allEnds.map((d) => d.getTime()))),
      14,
    );
    return {
      minDate: minD,
      maxDate: maxD,
      totalDays: daysBetween(minD, maxD),
    };
  }, [timelineItems]);

  const totalWidth = totalDays * DAY_WIDTH;
  const scheduledHeight = Math.max(
    (timelineItems.length + 1) * ROW_HEIGHT + HEADER_HEIGHT,
    200,
  );
  const svgHeight = scheduledHeight;

  const dragRef = useRef<DragState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Keep a ref to localItems so window-level drag handlers can read latest state
  const localItemsRef = useRef<ItemData[]>(localItems);
  useEffect(() => {
    localItemsRef.current = localItems;
  }, [localItems]);

  // Keep minDate in a ref so drop handlers always see the current value
  const minDateRef = useRef(minDate);
  useEffect(() => {
    minDateRef.current = minDate;
  }, [minDate]);

  // Sprint bands and release markers derived from all items
  const sprintBands = useMemo(() => {
    return localItems
      .filter((i) => i.type === "sprint" && i.startDate && i.dueDate)
      .map((spr) => ({
        item: spr,
        start: parseDate(spr.startDate!),
        end: parseDate(spr.dueDate!),
      }));
  }, [localItems]);

  const releaseMarkers = useMemo(() => {
    return localItems
      .filter((i) => i.type === "release" && (i.releaseDate ?? i.dueDate))
      .map((rel) => ({
        item: rel,
        date: parseDate((rel.releaseDate ?? rel.dueDate)!),
      }));
  }, [localItems]);

  const sprintBandsRef = useRef(sprintBands);
  useEffect(() => {
    sprintBandsRef.current = sprintBands;
  }, [sprintBands]);
  const releaseMarkersRef = useRef(releaseMarkers);
  useEffect(() => {
    releaseMarkersRef.current = releaseMarkers;
  }, [releaseMarkers]);

  // x coordinate of drag-over indicator (null = not dragging)
  const [dropIndicatorX, setDropIndicatorX] = useState<number | null>(null);

  // Scroll to today once — only on initial items load, never during drag
  const hasScrolledRef = useRef(false);
  useEffect(() => {
    if (hasScrolledRef.current) return;
    if (!scrollRef.current || timelineItems.length === 0) return;
    hasScrolledRef.current = true;
    const today = new Date();
    const offsetDays = daysBetween(minDate, today);
    const targetScroll = offsetDays * DAY_WIDTH - 200;
    scrollRef.current.scrollLeft = Math.max(0, targetScroll);
  }, [minDate, timelineItems.length]);

  // ---------------------------------------------------------------------------
  // Header (months + weeks)
  // ---------------------------------------------------------------------------

  const monthSegments = useMemo(() => {
    const segments: { label: string; x: number; width: number }[] = [];
    let cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cur <= maxDate) {
      const segStart = cur < minDate ? minDate : cur;
      const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const segEnd = nextMonth > maxDate ? maxDate : nextMonth;
      const x = daysBetween(minDate, segStart) * DAY_WIDTH;
      const width = daysBetween(segStart, segEnd) * DAY_WIDTH;
      segments.push({
        label: cur.toLocaleString("default", {
          month: "long",
          year: "numeric",
        }),
        x,
        width,
      });
      cur = nextMonth;
    }
    return segments;
  }, [minDate, maxDate]);

  const weekSegments = useMemo(() => {
    const segments: {
      label: string;
      x: number;
      width: number;
      isToday: boolean;
    }[] = [];
    let cur = startOfWeek(minDate);
    const today = new Date();
    while (cur <= maxDate) {
      const dayOffset = daysBetween(minDate, cur);
      const x = Math.max(0, dayOffset * DAY_WIDTH);
      const weekEnd = addDays(cur, 6);
      const width = Math.min(
        7 * DAY_WIDTH,
        (daysBetween(minDate, weekEnd < maxDate ? weekEnd : maxDate) + 1) *
          DAY_WIDTH -
          x,
      );
      const isToday =
        isSameDay(cur, today) || (cur <= today && today <= weekEnd);
      segments.push({ label: String(cur.getDate()), x, width, isToday });
      cur = addDays(cur, 7);
    }
    return segments;
  }, [minDate, maxDate]);

  // Today indicator
  const todayX = daysBetween(minDate, new Date()) * DAY_WIDTH;

  // ---------------------------------------------------------------------------
  // Dependency arrows (SVG)
  // ---------------------------------------------------------------------------

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
        if (!predTi) {
          continue;
        }
        const predEndX = daysBetween(minDate, predTi.end) * DAY_WIDTH;
        const predMidY =
          HEADER_HEIGHT + predTi.row * ROW_HEIGHT + ROW_HEIGHT / 2;
        const succStartX = daysBetween(minDate, ti.start) * DAY_WIDTH;
        const succMidY = HEADER_HEIGHT + ti.row * ROW_HEIGHT + ROW_HEIGHT / 2;
        arrs.push({ x1: predEndX, y1: predMidY, x2: succStartX, y2: succMidY });
      }
    }
    return arrs;
  }, [timelineItems, minDate]);

  // ---------------------------------------------------------------------------
  // Drag handlers — window-level so mouse can travel anywhere during drag
  // ---------------------------------------------------------------------------

  const handleBarMouseDown = useCallback(
    (e: React.MouseEvent, ti: TimelineItem, mode: DragState["mode"]) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        id: ti.item.id,
        mode,
        startX: e.clientX,
        origStart: new Date(ti.start),
        origEnd: new Date(ti.end),
      };
      setDraggingId(ti.item.id);

      const onMove = (ev: MouseEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = ev.clientX - drag.startX;
        const dayDelta = Math.round(dx / DAY_WIDTH);
        setLocalItems((prev) =>
          prev.map((item) => {
            if (item.id !== drag.id) return item;
            let newStart = drag.origStart;
            let newEnd = drag.origEnd;
            if (drag.mode === "move") {
              newStart = addDays(drag.origStart, dayDelta);
              newEnd = addDays(drag.origEnd, dayDelta);
            } else if (drag.mode === "resize-start") {
              newStart = addDays(drag.origStart, dayDelta);
              if (newStart >= newEnd) newStart = addDays(newEnd, -1);
            } else {
              newEnd = addDays(drag.origEnd, dayDelta);
              if (newEnd <= newStart) newEnd = addDays(newStart, 1);
            }
            return {
              ...item,
              startDate: formatDate(newStart),
              dueDate: formatDate(newEnd),
            };
          }),
        );
      };

      const onUp = () => {
        const drag = dragRef.current;
        if (drag) {
          const item = localItemsRef.current.find((i) => i.id === drag.id);
          if (item?.startDate && item.dueDate) {
            vscode.postMessage({
              type: "updateDates",
              id: item.id,
              startDate: item.startDate,
              dueDate: item.dueDate,
              filePath: item.filePath,
            });

            // Auto-assign sprint: find sprint whose date range overlaps the story
            const storyStart = parseDate(item.startDate);
            const storyEnd = parseDate(item.dueDate);
            const matchedSprint = sprintBandsRef.current.find(
              (spr) => storyStart <= spr.end && storyEnd >= spr.start,
            );
            if (matchedSprint) {
              vscode.postMessage({
                type: "updateSprint",
                id: item.id,
                sprintId: matchedSprint.item.id,
                filePath: item.filePath,
              } as WebviewMessage);
            }

            // Auto-assign release: earliest release whose date is >= story end
            const sortedReleases = [...releaseMarkersRef.current].sort(
              (a, b) => a.date.getTime() - b.date.getTime(),
            );
            const matchedRelease = sortedReleases.find(
              (rel) => rel.date >= storyEnd,
            );
            if (matchedRelease) {
              vscode.postMessage({
                type: "updateRelease",
                id: item.id,
                releaseId: matchedRelease.item.id,
                filePath: item.filePath,
              } as WebviewMessage);
            }
          }
          dragRef.current = null;
        }
        setDraggingId(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Inline date assignment
  // ---------------------------------------------------------------------------

  const assignDates = useCallback((item: ItemData) => {
    const today = new Date();
    const startDate = formatDate(today);
    const dueDate = formatDate(addDays(today, item.type === "epic" ? 30 : 14));
    setLocalItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, startDate, dueDate } : i)),
    );
    vscode.postMessage({
      type: "updateDates",
      id: item.id,
      startDate,
      dueDate,
      filePath: item.filePath,
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Unscheduled → chart drop
  // ---------------------------------------------------------------------------

  const handleUnscheduledDragStart = useCallback(
    (e: React.DragEvent, item: ItemData) => {
      e.dataTransfer.setData("text/plain", item.id);
      e.dataTransfer.effectAllowed = "copy";
    },
    [],
  );

  /** SVG x coordinate from a drag event, accounting for scroll offset */
  const svgXFromDrag = useCallback((e: React.DragEvent): number => {
    if (!scrollRef.current) return 0;
    const rect = scrollRef.current.getBoundingClientRect();
    return e.clientX - rect.left + scrollRef.current.scrollLeft;
  }, []);

  const handleChartDragOver = useCallback(
    (e: React.DragEvent) => {
      // Only respond to unscheduled item drags (not bar mouse-drags)
      if (!e.dataTransfer.types.includes("text/plain")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDropIndicatorX(svgXFromDrag(e));
    },
    [svgXFromDrag],
  );

  const handleChartDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the chart container itself
    if (!scrollRef.current?.contains(e.relatedTarget as Node)) {
      setDropIndicatorX(null);
    }
  }, []);

  const handleChartDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDropIndicatorX(null);
      const id = e.dataTransfer.getData("text/plain");
      if (!id) return;
      const x = svgXFromDrag(e);
      const dayOffset = Math.max(0, Math.round(x / DAY_WIDTH));
      const startDate = formatDate(addDays(minDateRef.current, dayOffset));
      const dueDate = formatDate(addDays(minDateRef.current, dayOffset + 14));
      const item = localItemsRef.current.find((i) => i.id === id);
      if (!item) return;
      setLocalItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, startDate, dueDate } : i)),
      );
      vscode.postMessage({
        type: "updateDates",
        id,
        startDate,
        dueDate,
        filePath: item.filePath,
      });
    },
    [svgXFromDrag],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="timeline-root">
      {/* Left label panel */}
      <div className="timeline-labels">
        <div
          className="timeline-label-header"
          style={{ height: HEADER_HEIGHT }}
        >
          Items
        </div>
        {timelineItems.map((ti) => (
          <div
            key={ti.item.id}
            className="timeline-label-row"
            style={{ height: ROW_HEIGHT, borderLeftColor: ti.color }}
            title={ti.item.title}
            onClick={() =>
              vscode.postMessage({
                type: "openFile",
                filePath: ti.item.filePath,
              })
            }
          >
            <span className="label-type">{ti.item.type}</span>
            <span className="label-title">{ti.item.title}</span>
            {ti.item.dependsOn && (
              <span
                className="label-dep"
                title={`Depends on: ${ti.item.dependsOn}`}
              >
                🔗
              </span>
            )}
          </div>
        ))}
        {/* Unscheduled stories — no dates set yet */}
        {unscheduled.length > 0 && (
          <>
            <div
              className="timeline-label-row unplanned-header"
              style={{ height: 28, cursor: "default" }}
            >
              Unscheduled ({unscheduled.length})
            </div>
            {unscheduled.map((item) => (
              <div
                key={item.id}
                className="timeline-label-row"
                draggable
                onDragStart={(e) => handleUnscheduledDragStart(e, item)}
                style={{
                  height: ROW_HEIGHT,
                  borderLeftColor: TYPE_COLORS[item.type] ?? "#888",
                  cursor: "grab",
                }}
                title={`Drag onto the chart to schedule • ${item.id}: ${item.title}`}
                onClick={() =>
                  vscode.postMessage({
                    type: "openFile",
                    filePath: item.filePath,
                  })
                }
              >
                <span className="label-type">{item.type}</span>
                <span className="label-title">{item.title}</span>
                <span className="label-add" title="Drag to chart to set dates">
                  ↦
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Scrollable chart area */}
      <div
        ref={scrollRef}
        className={`timeline-chart${dropIndicatorX !== null ? " drop-target" : ""}`}
        onDragOver={handleChartDragOver}
        onDragLeave={handleChartDragLeave}
        onDrop={handleChartDrop}
      >
        <svg width={totalWidth} height={svgHeight} style={{ display: "block" }}>
          {/* Background grid */}
          <rect
            x={0}
            y={0}
            width={totalWidth}
            height={svgHeight}
            fill="var(--vscode-editor-background)"
          />

          {/* Month header */}
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

          {/* Week header */}
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
                y={MONTH_HEIGHT + 20}
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

          {/* Sprint bands — rendered behind everything */}
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
            ];
            return (
              <g key={spr.item.id}>
                <rect
                  x={x1}
                  y={HEADER_HEIGHT}
                  width={w}
                  height={svgHeight - HEADER_HEIGHT}
                  fill={bandColor}
                  opacity={0.07}
                />
                <text
                  x={x1 + 4}
                  y={HEADER_HEIGHT + 14}
                  fontSize={10}
                  fill={bandColor}
                  opacity={0.7}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {spr.item.title}
                </text>
              </g>
            );
          })}

          {/* Weekend column backgrounds */}
          {Array.from({ length: totalDays }).map((_, dayIdx) => {
            const d = addDays(minDate, dayIdx);
            const dow = d.getDay();
            if (dow !== 0 && dow !== 6) return null;
            return (
              <rect
                key={`wk-${dayIdx}`}
                x={dayIdx * DAY_WIDTH}
                y={HEADER_HEIGHT}
                width={DAY_WIDTH}
                height={svgHeight - HEADER_HEIGHT}
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
              y={HEADER_HEIGHT + idx * ROW_HEIGHT}
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
                  y1={HEADER_HEIGHT}
                  x2={x}
                  y2={svgHeight}
                  stroke="#dc2626"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  opacity={0.7}
                />
                <text
                  x={x + 4}
                  y={HEADER_HEIGHT + 28}
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
              y2={svgHeight}
              stroke="#e11d48"
              strokeWidth={1.5}
              opacity={0.7}
              strokeDasharray="4 3"
            />
          )}

          {/* Dependency arrows */}
          {arrows.map((a, i) => {
            const midX = (a.x1 + a.x2) / 2;
            const path = `M ${a.x1} ${a.y1} C ${midX} ${a.y1}, ${midX} ${a.y2}, ${a.x2} ${a.y2}`;
            return (
              <g key={i}>
                <path
                  d={path}
                  fill="none"
                  stroke={ARROW_COLOR}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  markerEnd="url(#arrow)"
                  opacity={0.7}
                />
              </g>
            );
          })}

          {/* Arrow marker */}
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

          {/* Bars */}
          {timelineItems.map((ti) => {
            const x = daysBetween(minDate, ti.start) * DAY_WIDTH;
            const width = Math.max(
              DAY_WIDTH,
              daysBetween(ti.start, ti.end) * DAY_WIDTH,
            );
            const y = HEADER_HEIGHT + ti.row * ROW_HEIGHT + 6;
            const barH = ROW_HEIGHT - 12;
            return (
              <g key={ti.item.id}>
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
                  onMouseDown={(e) => handleBarMouseDown(e, ti, "move")}
                />
                {/* Resize handle - left */}
                <rect
                  x={x + 2}
                  y={y + 2}
                  width={8}
                  height={barH - 4}
                  rx={2}
                  fill="white"
                  opacity={0.4}
                  style={{ cursor: "ew-resize" }}
                  onMouseDown={(e) => handleBarMouseDown(e, ti, "resize-start")}
                />
                {/* Resize handle - right */}
                <rect
                  x={x + width - 10}
                  y={y + 2}
                  width={8}
                  height={barH - 4}
                  rx={2}
                  fill="white"
                  opacity={0.4}
                  style={{ cursor: "ew-resize" }}
                  onMouseDown={(e) => handleBarMouseDown(e, ti, "resize-end")}
                />
                {/* Date labels — always visible on the bar */}
                <text
                  x={x + 10}
                  y={y + barH / 2 + 4}
                  fontSize={11}
                  fill="white"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {width > 80
                    ? ti.item.title.slice(0, Math.floor((width - 20) / 7))
                    : ""}
                </text>
                {/* Dates shown when dragging */}
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
                {/* Date tooltip on hover */}
                <title>{`${ti.item.id}: ${ti.item.title}\n${ti.item.startDate} → ${ti.item.dueDate}`}</title>
              </g>
            );
          })}
          {/* Drop indicator */}
          {dropIndicatorX !== null && (
            <>
              <rect
                x={dropIndicatorX - 1}
                y={HEADER_HEIGHT}
                width={2}
                height={svgHeight - HEADER_HEIGHT}
                fill="var(--vscode-focusBorder)"
                opacity={0.8}
              />
              <text
                x={dropIndicatorX + 4}
                y={HEADER_HEIGHT + 16}
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
