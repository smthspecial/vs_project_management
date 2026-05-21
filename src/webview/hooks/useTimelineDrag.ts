import React, { useCallback, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { ItemData, WebviewMessage } from "../types";
import { vscode } from "../vscodeApi";
import {
  TimelineItem,
  DragMode,
  formatDate,
  addDays,
  parseDate,
  DAY_WIDTH,
} from "./timelineUtils";
import type { SprintBand, ReleaseMarker } from "./useTimelineItems";

interface DragState {
  id: string;
  mode: DragMode;
  startX: number;
  origStart: Date;
  origEnd: Date;
}

export function useTimelineDrag({
  setLocalItems,
  localItemsRef,
  sprintBandsRef,
  releaseMarkersRef,
}: {
  setLocalItems: Dispatch<SetStateAction<ItemData[]>>;
  localItemsRef: MutableRefObject<ItemData[]>;
  sprintBandsRef: MutableRefObject<SprintBand[]>;
  releaseMarkersRef: MutableRefObject<ReleaseMarker[]>;
}): {
  handleBarMouseDown: (
    e: React.MouseEvent,
    ti: TimelineItem,
    mode: DragMode,
  ) => void;
  draggingId: string | null;
} {
  const dragRef = useRef<DragState | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleBarMouseDown = useCallback(
    (e: React.MouseEvent, ti: TimelineItem, mode: DragMode) => {
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
        if (!drag) {
          return;
        }
        const dx = ev.clientX - drag.startX;
        const dayDelta = Math.round(dx / DAY_WIDTH);
        setLocalItems((prev) =>
          prev.map((item) => {
            if (item.id !== drag.id) {
              return item;
            }
            let newStart = drag.origStart;
            let newEnd = drag.origEnd;
            if (drag.mode === "move") {
              newStart = addDays(drag.origStart, dayDelta);
              newEnd = addDays(drag.origEnd, dayDelta);
            } else if (drag.mode === "resize-start") {
              newStart = addDays(drag.origStart, dayDelta);
              if (newStart >= newEnd) {
                newStart = addDays(newEnd, -1);
              }
            } else {
              newEnd = addDays(drag.origEnd, dayDelta);
              if (newEnd <= newStart) {
                newEnd = addDays(newStart, 1);
              }
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
    [setLocalItems, localItemsRef, sprintBandsRef, releaseMarkersRef],
  );

  return { handleBarMouseDown, draggingId };
}
