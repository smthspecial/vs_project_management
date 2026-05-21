import React from "react";
import { ItemData } from "../types";
import { vscode } from "../vscodeApi";
import {
  TimelineItem,
  TYPE_COLORS,
  ROW_HEIGHT,
  HEADER_HEIGHT,
  SPRINT_ROW_HEIGHT,
} from "../hooks/timelineUtils";
import type { SprintBand } from "../hooks/useTimelineItems";

interface TimelineLabelPanelProps {
  timelineItems: TimelineItem[];
  sprintBands: SprintBand[];
  unscheduled: ItemData[];
  onDragStart: (e: React.DragEvent, item: ItemData) => void;
}

export function TimelineLabelPanel({
  timelineItems,
  sprintBands,
  unscheduled,
  onDragStart,
}: TimelineLabelPanelProps): React.ReactElement {
  return (
    <div className="timeline-labels">
      <div className="timeline-label-header" style={{ height: HEADER_HEIGHT }}>
        Items
      </div>

      {/* Sticky sprint label row — matches chart sprint row height */}
      <div
        className="timeline-sprint-label-row"
        style={{
          height: SPRINT_ROW_HEIGHT,
          position: "sticky",
          top: HEADER_HEIGHT,
          zIndex: 9,
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          gap: 4,
          background: "var(--vscode-editor-background)",
          borderBottom: "1px solid var(--vscode-panel-border)",
          fontSize: 9,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          opacity: 0.6,
          overflow: "hidden",
        }}
      >
        {sprintBands.length > 0 ? (
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Sprints ({sprintBands.length})
          </span>
        ) : (
          <span>Sprints</span>
        )}
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
              onDragStart={(e) => onDragStart(e, item)}
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
  );
}
