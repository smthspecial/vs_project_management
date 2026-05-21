import React from "react";
import { MAX_ZOOM, MIN_ZOOM } from "../hooks/useDbNodes";

interface DbToolbarProps {
  zoom: number;
  onNewTable: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function DbToolbar({
  zoom,
  onNewTable,
  onZoomIn,
  onZoomOut,
  onReset,
}: DbToolbarProps): React.ReactElement {
  return (
    <div className="db-toolbar">
      <span className="db-toolbar-title">Database Schema</span>
      <button className="db-btn" onClick={onNewTable}>
        + New Table
      </button>
      <button className="db-btn" onClick={onZoomIn} disabled={zoom >= MAX_ZOOM}>
        +
      </button>
      <button
        className="db-btn"
        onClick={onZoomOut}
        disabled={zoom <= MIN_ZOOM}
      >
        −
      </button>
      <button className="db-btn" onClick={onReset}>
        Reset
      </button>
    </div>
  );
}
