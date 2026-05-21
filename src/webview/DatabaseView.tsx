import React, { useCallback, useState } from "react";
import { ItemData, WebviewMessage } from "./types";
import { vscode } from "./vscodeApi";
import {
  useDbNodes,
  TABLE_W,
  MAX_ZOOM,
  MIN_ZOOM,
  nodeHeight,
} from "./hooks/useDbNodes";
import { useDbPositions } from "./hooks/useDbPositions";
import { useDbCanvas } from "./hooks/useDbCanvas";
import { useDbDrag } from "./hooks/useDbDrag";
import { DbToolbar } from "./components/DbToolbar";
import { DbNode } from "./components/DbNode";
import { DbArrows } from "./components/DbArrows";

interface DatabaseViewProps {
  items: ItemData[];
}

export function DatabaseView({ items }: DatabaseViewProps): React.ReactElement {
  const { dbItems, nodes, edges } = useDbNodes(items);
  const { pan, setPan, zoom, setZoom, canvasRef, panRef, zoomRef } =
    useDbCanvas();
  const { positions, setPositions, posRef } = useDbPositions(nodes);
  const { handleBgMouseDown, handleNodeMouseDown, nodeWasDraggedRef } =
    useDbDrag({ panRef, zoomRef, posRef, setPan, setPositions });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleOpen = useCallback((filePath: string) => {
    vscode.postMessage({ type: "openFile", filePath } as WebviewMessage);
  }, []);

  const handleNewTable = useCallback(() => {
    vscode.postMessage({ type: "createTable" } as WebviewMessage);
  }, []);

  const handleDelete = useCallback((id: string, filePath: string) => {
    vscode.postMessage({ type: "deleteTable", id, filePath } as WebviewMessage);
  }, []);

  if (dbItems.length === 0) {
    return (
      <div className="db-empty">
        <div className="db-empty-icon">🗄</div>
        <p>No database tables yet.</p>
        <button className="db-btn" onClick={handleNewTable}>
          + New Table
        </button>
      </div>
    );
  }

  return (
    <div className="db-root">
      <DbToolbar
        zoom={zoom}
        onNewTable={handleNewTable}
        onZoomIn={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.2))}
        onZoomOut={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.2))}
        onReset={() => {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }}
      />

      <div
        ref={canvasRef}
        className="db-canvas"
        onMouseDown={handleBgMouseDown}
      >
        <DbArrows
          edges={edges}
          positions={positions}
          selectedId={selectedId}
          pan={pan}
          zoom={zoom}
        />

        {/* Table nodes layer */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {nodes.map(({ item, columns, relations: rels }) => (
            <DbNode
              key={item.id}
              item={item}
              columns={columns}
              relations={rels}
              pos={positions[item.id] ?? { x: 0, y: 0 }}
              width={TABLE_W}
              height={nodeHeight(columns.length)}
              isSelected={selectedId === item.id}
              wasDraggedRef={nodeWasDraggedRef}
              onMouseDown={(e) => handleNodeMouseDown(e, item.id)}
              onClick={() => {
                if (!nodeWasDraggedRef.current) {
                  setSelectedId((prev) => (prev === item.id ? null : item.id));
                }
              }}
              onOpen={handleOpen}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
