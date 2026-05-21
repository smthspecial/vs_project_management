import { useCallback, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ItemData } from "../types";
import { vscode } from "../vscodeApi";

export function useBoardDrag(
  localItems: ItemData[],
  setLocalItems: Dispatch<SetStateAction<ItemData[]>>,
): {
  draggingId: string | null;
  dragOverCol: string | null;
  setDragOverCol: Dispatch<SetStateAction<string | null>>;
  handleDragStart: (id: string) => void;
  handleDragEnd: () => void;
  handleDrop: (columnId: string) => void;
  handleStatusChange: (item: ItemData, newStatus: string) => void;
} {
  const dragIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const handleStatusChange = useCallback(
    (item: ItemData, newStatus: string) => {
      setLocalItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i)),
      );
      vscode.postMessage({
        type: "updateStatus",
        id: item.id,
        status: newStatus,
        filePath: item.filePath,
      });
    },
    [setLocalItems],
  );

  const handleDragStart = useCallback((id: string) => {
    dragIdRef.current = id;
    setDraggingId(id);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragIdRef.current = null;
    setDraggingId(null);
    setDragOverCol(null);
  }, []);

  const handleDrop = useCallback(
    (columnId: string) => {
      const id = dragIdRef.current;
      if (!id) {
        return;
      }
      const item = localItems.find((i) => i.id === id);
      if (item && item.status !== columnId) {
        handleStatusChange(item, columnId);
      }
      setDragOverCol(null);
    },
    [localItems, handleStatusChange],
  );

  return {
    draggingId,
    dragOverCol,
    setDragOverCol,
    handleDragStart,
    handleDragEnd,
    handleDrop,
    handleStatusChange,
  };
}
