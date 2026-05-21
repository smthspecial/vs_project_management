import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { ItemData } from "../types";
import {
  TimelineItem,
  TYPE_COLORS,
  parseDate,
  addDays,
  startOfWeek,
  daysBetween,
} from "./timelineUtils";

export interface SprintBand {
  item: ItemData;
  start: Date;
  end: Date;
}

export interface ReleaseMarker {
  item: ItemData;
  date: Date;
}

export function useTimelineItems(items: ItemData[]): {
  localItems: ItemData[];
  setLocalItems: Dispatch<SetStateAction<ItemData[]>>;
  localItemsRef: MutableRefObject<ItemData[]>;
  timelineItems: TimelineItem[];
  unscheduled: ItemData[];
  minDate: Date;
  maxDate: Date;
  totalDays: number;
  sprintBands: SprintBand[];
  sprintBandsRef: MutableRefObject<SprintBand[]>;
  releaseMarkers: ReleaseMarker[];
  releaseMarkersRef: MutableRefObject<ReleaseMarker[]>;
  minDateRef: MutableRefObject<Date>;
} {
  const [localItems, setLocalItems] = useState<ItemData[]>(items);
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const localItemsRef = useRef<ItemData[]>(localItems);
  useEffect(() => {
    localItemsRef.current = localItems;
  }, [localItems]);

  const timelineItems = useMemo((): TimelineItem[] => {
    const stories = localItems.filter(
      (i) => i.type === "story" && i.startDate && i.dueDate,
    );
    return stories.map((item, idx) => ({
      item,
      start: parseDate(item.startDate!),
      end: parseDate(item.dueDate!),
      row: idx,
      color: TYPE_COLORS[item.type] ?? "#555",
    }));
  }, [localItems]);

  const unscheduled = useMemo(
    () =>
      localItems.filter(
        (i) => i.type === "story" && (!i.startDate || !i.dueDate),
      ),
    [localItems],
  );

  const { minDate, maxDate, totalDays } = useMemo(() => {
    const today = new Date();
    const allDates = [
      ...timelineItems.map((t) => t.start),
      ...timelineItems.map((t) => t.end),
      ...localItems
        .filter((i) => i.type === "sprint" && i.startDate)
        .map((i) => parseDate(i.startDate!)),
      ...localItems
        .filter((i) => i.type === "sprint" && i.dueDate)
        .map((i) => parseDate(i.dueDate!)),
    ];
    if (allDates.length === 0) {
      const min = addDays(startOfWeek(today), -7);
      const max = addDays(min, 90);
      return { minDate: min, maxDate: max, totalDays: 90 };
    }
    const minD = addDays(
      new Date(Math.min(...allDates.map((d) => d.getTime()))),
      -14,
    );
    const maxD = addDays(
      new Date(Math.max(...allDates.map((d) => d.getTime()))),
      14,
    );
    return { minDate: minD, maxDate: maxD, totalDays: daysBetween(minD, maxD) };
  }, [timelineItems, localItems]);

  const minDateRef = useRef(minDate);
  useEffect(() => {
    minDateRef.current = minDate;
  }, [minDate]);

  const sprintBands = useMemo(
    () =>
      localItems
        .filter((i) => i.type === "sprint" && i.startDate && i.dueDate)
        .map((spr) => ({
          item: spr,
          start: parseDate(spr.startDate!),
          end: parseDate(spr.dueDate!),
        })),
    [localItems],
  );
  const sprintBandsRef = useRef(sprintBands);
  useEffect(() => {
    sprintBandsRef.current = sprintBands;
  }, [sprintBands]);

  const releaseMarkers = useMemo(
    () =>
      localItems
        .filter((i) => i.type === "release" && (i.releaseDate ?? i.dueDate))
        .map((rel) => ({
          item: rel,
          date: parseDate((rel.releaseDate ?? rel.dueDate)!),
        })),
    [localItems],
  );
  const releaseMarkersRef = useRef(releaseMarkers);
  useEffect(() => {
    releaseMarkersRef.current = releaseMarkers;
  }, [releaseMarkers]);

  return {
    localItems,
    setLocalItems,
    localItemsRef,
    timelineItems,
    unscheduled,
    minDate,
    maxDate,
    totalDays,
    sprintBands,
    sprintBandsRef,
    releaseMarkers,
    releaseMarkersRef,
    minDateRef,
  };
}
