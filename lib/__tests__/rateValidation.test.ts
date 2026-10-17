import { describe, expect, it } from "vitest";
import {
  isStreamRateTooLow,
  streamRatePerSecondStroops,
} from "@/lib/rateValidation";

describe("stream rate validation", () => {
  it("accepts a rate of exactly one stroop per second", () => {
    expect(streamRatePerSecondStroops("0.0000001", 1)).toBe(1n);
    expect(isStreamRateTooLow("0.0000001", 1)).toBe(false);
  });

  it("rejects rates that round to zero stroops per second", () => {
    expect(streamRatePerSecondStroops("0.0000001", 2)).toBe(0n);
    expect(isStreamRateTooLow("0.0000001", 2)).toBe(true);
  });

  it("rejects values below one stroop per second", () => {
    expect(isStreamRateTooLow("0.0000001", 86400)).toBe(true);
  });

  it("ignores missing or invalid durations", () => {
    expect(isStreamRateTooLow("0.0000001", 0)).toBe(false);
    expect(isStreamRateTooLow("0.0000001", Number.NaN)).toBe(false);
  });
});
