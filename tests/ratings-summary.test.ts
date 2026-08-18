import { describe, expect, it } from "vitest";
import { summarizeRatings } from "../shared/ratings";

describe("driver rating summaries", () => {
  it("calculates a rounded average and total count", () => {
    expect(summarizeRatings([5, 4, 4])).toEqual({ averageRating: 4.3, totalRatings: 3 });
  });

  it("returns an empty summary when there are no valid ratings", () => {
    expect(summarizeRatings([])).toEqual({ averageRating: null, totalRatings: 0 });
    expect(summarizeRatings([0, 6, 2.5])).toEqual({ averageRating: null, totalRatings: 0 });
  });
});
