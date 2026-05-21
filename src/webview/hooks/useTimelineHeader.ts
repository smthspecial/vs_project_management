import { useMemo } from "react";
import {
  DAY_WIDTH,
  daysBetween,
  startOfWeek,
  addDays,
  isSameDay,
} from "./timelineUtils";

export interface MonthSegment {
  label: string;
  x: number;
  width: number;
}

export interface WeekSegment {
  label: string;
  x: number;
  width: number;
  isToday: boolean;
}

export function useTimelineHeader(
  minDate: Date,
  maxDate: Date,
): {
  monthSegments: MonthSegment[];
  weekSegments: WeekSegment[];
  todayX: number;
} {
  const monthSegments = useMemo((): MonthSegment[] => {
    const segments: MonthSegment[] = [];
    let cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cur <= maxDate) {
      const segStart = cur < minDate ? minDate : cur;
      const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const segEnd = nextMonth > maxDate ? maxDate : nextMonth;
      const x = daysBetween(minDate, segStart) * DAY_WIDTH;
      const width = daysBetween(segStart, segEnd) * DAY_WIDTH;
      segments.push({
        label: cur.toLocaleString("default", {
          month: "long",
          year: "numeric",
        }),
        x,
        width,
      });
      cur = nextMonth;
    }
    return segments;
  }, [minDate, maxDate]);

  const weekSegments = useMemo((): WeekSegment[] => {
    const segments: WeekSegment[] = [];
    let cur = startOfWeek(minDate);
    const today = new Date();
    while (cur <= maxDate) {
      const dayOffset = daysBetween(minDate, cur);
      const x = Math.max(0, dayOffset * DAY_WIDTH);
      const weekEnd = addDays(cur, 6);
      const width = Math.min(
        7 * DAY_WIDTH,
        (daysBetween(minDate, weekEnd < maxDate ? weekEnd : maxDate) + 1) *
          DAY_WIDTH -
          x,
      );
      const isToday =
        isSameDay(cur, today) || (cur <= today && today <= weekEnd);
      segments.push({ label: String(cur.getDate()), x, width, isToday });
      cur = addDays(cur, 7);
    }
    return segments;
  }, [minDate, maxDate]);

  const todayX = daysBetween(minDate, new Date()) * DAY_WIDTH;

  return { monthSegments, weekSegments, todayX };
}
