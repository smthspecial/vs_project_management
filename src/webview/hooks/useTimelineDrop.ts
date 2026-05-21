import React, { useCallback, useState } from "react";
import type {
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from "react";
import { ItemData } from "../types";
import { vscode } from "../vscodeApi";
import { formatDate, addDays, DAY_WIDTH } from "./timelineUtils";

export function useTimelineDrop({
  scrollRef,
  minDateRef,
  localItemsRef,
  setLocalItems,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  minDateRef: MutableRefObject<Date>;
  localItemsRef: MutableRefObject<ItemData[]>;
  setLocalItems: Dispatch<SetStateAction<ItemData[]>>;
}): {
  handleChartDragOver: (e: React.DragEvent) => void;
  handleChartDragLeave: (e: React.DragEvent) => void;
  handleChartDrop: (e: React.DragEvent) => void;
  handleUnscheduledDragStart: (e: React.DragEvent, item: ItemData) => void;
  dropIndicatorX: number | null;
} {
  const [dropIndicatorX, setDropIndicatorX] = useState<number | null>(null);

  const svgXFromDrag = useCallback(
    (e: React.DragEvent): number => {
      if (!scrollRef.current) {
        return 0;
      }
      const rect = scrollRef.current.getBoundingClientRect();
      return e.clientX - rect.left + scrollRef.current.scrollLeft;
    },
    [scrollRef],
  );

  const handleUnscheduledDragStart = useCallback(
    (e: React.DragEvent, item: ItemData) => {
      e.dataTransfer.setData("text/plain", item.id);
      e.dataTransfer.effectAllowed = "copy";
    },
    [],
  );

  const handleChartDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("text/plain")) {
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDropIndicatorX(svgXFromDrag(e));
    },
    [svgXFromDrag],
  );

  const handleChartDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (!scrollRef.current?.contains(e.relatedTarget as Node)) {
        setDropIndicatorX(null);
      }
    },
    [scrollRef],
  );

  const handleChartDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDropIndicatorX(null);
      const id = e.dataTransfer.getData("text/plain");
      if (!id) {
        return;
      }
      const x = svgXFromDrag(e);
      const dayOffset = Math.max(0, Math.round(x / DAY_WIDTH));
      const startDate = formatDate(addDays(minDateRef.current, dayOffset));
      const dueDate = formatDate(addDays(minDateRef.current, dayOffset + 14));
      const item = localItemsRef.current.find((i) => i.id === id);
      if (!item) {
        return;
      }
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
    [svgXFromDrag, minDateRef, localItemsRef, setLocalItems],
  );

  return {
    handleChartDragOver,
    handleChartDragLeave,
    handleChartDrop,
    handleUnscheduledDragStart,
    dropIndicatorX,
  };
}
