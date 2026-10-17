import { xlmToStroops } from "@/lib/stroops";

export const MIN_STREAM_RATE_STROOPS = 1n;
export const MIN_STREAM_RATE_XLM = "0.0000001";
export const RATE_TOO_LOW_MESSAGE =
  "Rate is too low — enter at least 0.0000001 XLM/sec.";

export function streamRatePerSecondStroops(
  amountXlm: string,
  durationSeconds: number,
): bigint | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;

  try {
    return xlmToStroops(amountXlm) / BigInt(Math.floor(durationSeconds));
  } catch {
    return null;
  }
}

export function isStreamRateTooLow(
  amountXlm: string,
  durationSeconds: number,
): boolean {
  const rate = streamRatePerSecondStroops(amountXlm, durationSeconds);
  return rate !== null && rate < MIN_STREAM_RATE_STROOPS;
}
