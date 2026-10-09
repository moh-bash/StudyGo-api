const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Parses a duration such as `15m`, `7d`, or `3600s` into milliseconds. */
export function parseDurationToMs(value: string, fallbackMs: number): number {
  const match = /^\s*(\d+)\s*(ms|s|m|h|d)\s*$/i.exec(value);
  if (!match) {
    return fallbackMs;
  }
  const amount = Number.parseInt(match[1], 10);
  const multiplier = UNIT_MS[match[2].toLowerCase()] ?? 0;
  return amount * multiplier;
}
