import React, { useCallback, useRef } from "react";
import type { MutableRefObject } from "react";
import type { NodePos } from "./useDbPositions";

type DragState =
  | { kind: "pan"; startX: number; startY: number; origPan: NodePos }
  | {
      kind: "node";
      id: string;
      startX: number;
      startY: number;
      origPos: NodePos;
    };

interface UseDbDragOptions {
  panRef: MutableRefObject<NodePos>;
  zoomRef: MutableRefObject<number>;
  posRef: MutableRefObject<Record<string, NodePos>>;
  setPan: React.Dispatch<React.SetStateAction<NodePos>>;
  setPositions: React.Dispatch<React.SetStateAction<Record<string, NodePos>>>;
}

export function useDbDrag({
  panRef,
  zoomRef,
  posRef,
  setPan,
  setPositions,
}: UseDbDragOptions): {
  handleBgMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleNodeMouseDown: (
    e: React.MouseEvent<HTMLDivElement>,
    id: string,
  ) => void;
  nodeWasDraggedRef: MutableRefObject<boolean>;
} {
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
    [panRef, setPan],
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
        const z = zoomRef.current;
        setPositions((prev) => ({
          ...prev,
          [d.id]: {
            x: d.origPos.x + dx / z,
            y: d.origPos.y + dy / z,
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
    [posRef, zoomRef, setPositions],
  );

  return { handleBgMouseDown, handleNodeMouseDown, nodeWasDraggedRef };
}
