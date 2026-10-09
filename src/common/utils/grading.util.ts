import { roundMark } from './grade.util.js';

/**
 * Grading scale + GPA conversion.
 *
 * IMPORTANT: The official SVU grading rules are NOT modelled here because the
 * university does not publish a machine-readable conversion. The table below is
 * a clearly-marked PLACEHOLDER that can be replaced/configured when the correct
 * rules are supplied. Keeping the conversion isolated here means GPA behaviour
 * can be corrected without touching enrollment or controller code.
 */
export interface GradeBand {
  /** Minimum percentage (inclusive) for this band. */
  min: number;
  letter: string;
  /** Grade points for this band. */
  points: number;
}

export const DEFAULT_GRADE_SCALE: GradeBand[] = [
  { min: 90, letter: 'A', points: 4.0 },
  { min: 80, letter: 'B', points: 3.0 },
  { min: 70, letter: 'C', points: 2.0 },
  { min: 60, letter: 'D', points: 1.0 },
  { min: 0, letter: 'F', points: 0.0 },
];

/** Percentage below which a course is considered failed. */
export const DEFAULT_PASS_MARK = 60;

export function percentageToBand(
  percentage: number,
  scale: GradeBand[] = DEFAULT_GRADE_SCALE,
): GradeBand | null {
  if (!Number.isFinite(percentage)) {
    return null;
  }
  const ordered = [...scale].sort((a, b) => b.min - a.min);
  return ordered.find((band) => percentage >= band.min) ?? null;
}

export interface GpaEntry {
  totalMark: number | null;
  creditHours: number;
}

/**
 * Credit-weighted GPA over the provided entries. Entries without a total mark
 * are ignored. Returns `null` when no entry can be graded.
 */
export function calculateGpa(
  entries: GpaEntry[],
  scale: GradeBand[] = DEFAULT_GRADE_SCALE,
): number | null {
  let weighted = 0;
  let credits = 0;
  for (const entry of entries) {
    if (entry.totalMark === null || !Number.isFinite(entry.totalMark)) {
      continue;
    }
    const band = percentageToBand(entry.totalMark, scale);
    if (!band) {
      continue;
    }
    weighted += band.points * entry.creditHours;
    credits += entry.creditHours;
  }
  if (credits === 0) {
    return null;
  }
  return roundMark(weighted / credits);
}
