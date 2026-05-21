import { useCallback, useRef } from "react";
import type React from "react";
import type { Dispatch, SetStateAction } from "react";
import { vscode } from "../vscodeApi";
import type { SprintBand } from "./useTimelineItems";
import {
  DAY_WIDTH,
  DragMode,
  addDays,
  daysBetween,
  formatDate,
} from "./timelineUtils";
import type { ItemData } from "../types";

interface SprintDragState {
  sprintId: string;
  filePath: string;
  mode: DragMode;
  startX: number;
  originalStart: Date;
  originalEnd: Date;
}

export function useSprintDrag(
  setLocalItems: Dispatch<SetStateAction<ItemData[]>>,
): {
  handleSprintMouseDown: (
    e: React.MouseEvent,
    spr: SprintBand,
    mode: DragMode,
  ) => void;
} {
  const dragStateRef = useRef<SprintDragState | null>(null);

  const handleSprintMouseDown = useCallback(
    (e: React.MouseEvent, spr: SprintBand, mode: DragMode) => {
      e.preventDefault();
      e.stopPropagation();

      dragStateRef.current = {
        sprintId: spr.item.id,
        filePath: spr.item.filePath,
        mode,
        startX: e.clientX,
        originalStart: new Date(spr.start),
        originalEnd: new Date(spr.end),
      };

      const calcDates = (clientX: number): { newStart: Date; newEnd: Date } => {
        const ds = dragStateRef.current!;
        const deltaX = clientX - ds.startX;
        const deltaDays = Math.round(deltaX / DAY_WIDTH);
        let newStart = new Date(ds.originalStart);
        let newEnd = new Date(ds.originalEnd);
        const spanDays = daysBetween(ds.originalStart, ds.originalEnd);

        if (ds.mode === "move") {
          newStart = addDays(ds.originalStart, deltaDays);
          newEnd = addDays(ds.originalEnd, deltaDays);
        } else if (ds.mode === "resize-start") {
          // Clamp so start doesn't pass end (keep at least 1 day span)
          const clamped = Math.min(deltaDays, spanDays - 1);
          newStart = addDays(ds.originalStart, clamped);
        } else if (ds.mode === "resize-end") {
          // Clamp so end doesn't pass start
          const clamped = Math.max(deltaDays, -(spanDays - 1));
          newEnd = addDays(ds.originalEnd, clamped);
        }
        return { newStart, newEnd };
      };

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragStateRef.current) {
          return;
        }
        const { newStart, newEnd } = calcDates(ev.clientX);
        setLocalItems((prev) =>
          prev.map((item) => {
            if (item.id !== dragStateRef.current!.sprintId) {
              return item;
            }
            return {
              ...item,
              startDate: formatDate(newStart),
              dueDate: formatDate(newEnd),
            };
          }),
        );
      };

      const onMouseUp = (ev: MouseEvent) => {
        const ds = dragStateRef.current;
        if (!ds) {
          return;
        }

        const deltaX = ev.clientX - ds.startX;
        const deltaDays = Math.round(deltaX / DAY_WIDTH);

        if (deltaDays === 0 && ds.mode === "move") {
          // No movement — treat as a click and open the sprint file
          vscode.postMessage({ type: "openFile", filePath: ds.filePath });
        } else {
          const { newStart, newEnd } = calcDates(ev.clientX);
          vscode.postMessage({
            type: "updateDates",
            id: ds.sprintId,
            filePath: ds.filePath,
            startDate: formatDate(newStart),
            dueDate: formatDate(newEnd),
          });
        }

        dragStateRef.current = null;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [setLocalItems],
  );

  return { handleSprintMouseDown };
}
