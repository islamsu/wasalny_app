export function summarizeRatings(values: number[]) {
  const validRatings = values.filter((value) => Number.isInteger(value) && value >= 1 && value <= 5);
  return {
    averageRating: validRatings.length ? Math.round((validRatings.reduce((sum, value) => sum + value, 0) / validRatings.length) * 10) / 10 : null,
    totalRatings: validRatings.length,
  };
}
