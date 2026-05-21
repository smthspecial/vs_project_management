import React from "react";
import type { MutableRefObject } from "react";
import { ItemData } from "../types";
import { Column, Relation } from "../hooks/useDbNodes";
import { NodePos } from "../hooks/useDbPositions";

interface DbNodeProps {
  item: ItemData;
  columns: Column[];
  relations: Relation[];
  pos: NodePos;
  width: number;
  height: number;
  isSelected: boolean;
  wasDraggedRef: MutableRefObject<boolean>;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onClick: () => void;
  onOpen: (filePath: string) => void;
  onDelete: (id: string, filePath: string) => void;
}

export function DbNode({
  item,
  columns,
  relations,
  pos,
  width,
  height,
  isSelected,
  wasDraggedRef,
  onMouseDown,
  onClick,
  onOpen,
  onDelete,
}: DbNodeProps): React.ReactElement {
  return (
    <div
      className={`db-node${isSelected ? " db-node--selected" : ""}`}
      style={{ position: "absolute", left: pos.x, top: pos.y, width, height }}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <div className="db-node-header">
        <span
          className="db-node-name"
          title="Open file"
          onClick={(e) => {
            e.stopPropagation();
            if (!wasDraggedRef.current) onOpen(item.filePath);
          }}
        >
          {item.title}
        </span>
        <button
          className="db-node-del"
          title="Delete table"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id, item.filePath);
          }}
        >
          ×
        </button>
      </div>
      <div className="db-node-cols">
        {columns.map((col, ci) => {
          const isPK = /\bPK\b/.test(col.constraints);
          const isFK =
            /\bFK\b/.test(col.constraints) ||
            relations.some((r) => r.col === col.name);
          return (
            <div key={ci} className="db-col-row">
              <span className="db-col-icon">
                {isPK ? "🔑" : isFK ? "⟶" : ""}
              </span>
              <span className="db-col-name">{col.name}</span>
              <span className="db-col-type">{col.type}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
