/**
 * Grade calculation helpers.
 *
 * The total mark is derived from the subject's configured weights so the same
 * formula is used everywhere (enrollment service, GPA service, tests):
 *
 *   total = projectMark * projectWeight / 100 + examMark * examWeight / 100
 *
 * A missing (null/undefined) component contributes 0. When both components are
 * missing the enrollment has no total mark yet and `null` is returned.
 */

export const GRADE_MIN = 0;
export const GRADE_MAX = 100;

export function roundMark(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateTotalMark(
  projectMark: number | null | undefined,
  examMark: number | null | undefined,
  projectWeight: number,
  examWeight: number,
): number | null {
  const hasProject = projectMark !== null && projectMark !== undefined;
  const hasExam = examMark !== null && examMark !== undefined;
  if (!hasProject && !hasExam) {
    return null;
  }
  const project = hasProject ? Number(projectMark) : 0;
  const exam = hasExam ? Number(examMark) : 0;
  const total = (project * projectWeight) / 100 + (exam * examWeight) / 100;
  return roundMark(total);
}

export function isValidMark(value: number | null | undefined): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  return Number.isFinite(value) && value >= GRADE_MIN && value <= GRADE_MAX;
}
