import { useEffect, useRef, useState } from "react";
import type {
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from "react";
import { MIN_ZOOM, MAX_ZOOM } from "./useDbNodes";
import type { NodePos } from "./useDbPositions";

export function useDbCanvas(): {
  pan: NodePos;
  setPan: Dispatch<SetStateAction<NodePos>>;
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  canvasRef: RefObject<HTMLDivElement | null>;
  panRef: MutableRefObject<NodePos>;
  zoomRef: MutableRefObject<number>;
} {
  const [pan, setPan] = useState<NodePos>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);

  const panRef = useRef(pan);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) {
      return;
    }
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, zoomRef.current * factor),
        );
        const cx = (e.clientX - panRef.current.x) / zoomRef.current;
        const cy = (e.clientY - panRef.current.y) / zoomRef.current;
        setPan({ x: e.clientX - cx * newZoom, y: e.clientY - cy * newZoom });
        setZoom(newZoom);
      } else {
        setPan((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return { pan, setPan, zoom, setZoom, canvasRef, panRef, zoomRef };
}
