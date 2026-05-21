import { useEffect, useRef, useState } from "react";
import type { MutableRefObject, Dispatch, SetStateAction } from "react";
import { vscode } from "../vscodeApi";
import {
  CANVAS_PAD,
  COLS_PER_ROW,
  TABLE_W,
  GRID_GAP_X,
  GRID_GAP_Y,
  type DbNode,
} from "./useDbNodes";

export interface NodePos {
  x: number;
  y: number;
}

export function useDbPositions(nodes: DbNode[]): {
  positions: Record<string, NodePos>;
  setPositions: Dispatch<SetStateAction<Record<string, NodePos>>>;
  posRef: MutableRefObject<Record<string, NodePos>>;
} {
  const [positions, setPositions] = useState<Record<string, NodePos>>(() => {
    const saved = vscode.getState<{ dbPositions?: Record<string, NodePos> }>();
    return saved?.dbPositions ?? {};
  });

  const posRef = useRef(positions);
  useEffect(() => {
    posRef.current = positions;
  }, [positions]);

  // Initialise positions for new tables
  useEffect(() => {
    setPositions((prev) => {
      const next = { ...prev };
      nodes.forEach(({ item }, idx) => {
        if (!next[item.id]) {
          const col = idx % COLS_PER_ROW;
          const row = Math.floor(idx / COLS_PER_ROW);
          next[item.id] = {
            x: CANVAS_PAD + col * (TABLE_W + GRID_GAP_X),
            y: CANVAS_PAD + row * (200 + GRID_GAP_Y),
          };
        }
      });
      return next;
    });
  }, [nodes]);

  // Persist layout to webview state
  useEffect(() => {
    vscode.setState({
      ...(vscode.getState<Record<string, unknown>>() ?? {}),
      dbPositions: positions,
    });
  }, [positions]);

  return { positions, setPositions, posRef };
}
