import React from "react";
import { ItemData } from "../types";
import { BoardCard } from "./BoardCard";

interface BoardColumnProps {
  id: string;
  label: string;
  cards: ItemData[];
  allItems: ItemData[];
  isOver: boolean;
  draggingId: string | null;
  onOpen: (filePath: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
}

export function BoardColumn({
  id: _id,
  label,
  cards,
  allItems,
  isOver,
  draggingId,
  onOpen,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: BoardColumnProps): React.ReactElement {
  return (
    <div
      className={`column${isOver ? " drag-over" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="column-header">
        <span>{label}</span>
        <span className="count">{cards.length}</span>
      </div>
      <div className="cards">
        {cards.length === 0 && !isOver ? (
          <div className="empty">No items</div>
        ) : (
          cards.map((item) => (
            <BoardCard
              key={item.id}
              item={item}
              allItems={allItems}
              onOpen={onOpen}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))
        )}
        {isOver && draggingId && <div className="drop-placeholder" />}
      </div>
    </div>
  );
}
