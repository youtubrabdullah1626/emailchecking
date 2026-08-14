describe("Customer Feedback & CSAT Logic", () => {
  // Sentiment deduction helper
  function calculateSentiment(rating: number): string {
    if (rating === 5) return "EXCELLENT";
    if (rating === 4) return "GOOD";
    if (rating === 3) return "AVERAGE";
    return "POOR";
  }

  // CSAT percentage helper
  function calculateCsatPercentage(ratings: number[]): number {
    if (ratings.length === 0) return 100;
    const positive = ratings.filter((r) => r >= 4).length;
    return Math.round((positive / ratings.length) * 100);
  }

  // Average rating helper
  function calculateAverageRating(ratings: number[]): number {
    if (ratings.length === 0) return 5.0;
    const sum = ratings.reduce((a, b) => a + b, 0);
    return parseFloat((sum / ratings.length).toFixed(2));
  }

  describe("Rating & Sentiment Deduction", () => {
    it("should correctly classify 5-star rating as EXCELLENT", () => {
      expect(calculateSentiment(5)).toBe("EXCELLENT");
    });

    it("should correctly classify 4-star rating as GOOD", () => {
      expect(calculateSentiment(4)).toBe("GOOD");
    });

    it("should correctly classify 3-star rating as AVERAGE", () => {
      expect(calculateSentiment(3)).toBe("AVERAGE");
    });

    it("should correctly classify 1 and 2-star ratings as POOR", () => {
      expect(calculateSentiment(2)).toBe("POOR");
      expect(calculateSentiment(1)).toBe("POOR");
    });
  });

  describe("CSAT & Average Rating Math", () => {
    it("should compute accurate average rating across mixed submissions", () => {
      const submissions = [5, 5, 4, 5, 3]; // Sum: 22 / 5 = 4.4
      expect(calculateAverageRating(submissions)).toBe(4.4);
    });

    it("should compute accurate positive CSAT percentage (4 & 5 stars)", () => {
      const submissions = [5, 5, 4, 3, 2]; // 3 out of 5 are >= 4 = 60%
      expect(calculateCsatPercentage(submissions)).toBe(60);
    });

    it("should return 100% CSAT when all ratings are 5 stars", () => {
      const submissions = [5, 5, 5, 5];
      expect(calculateCsatPercentage(submissions)).toBe(100);
      expect(calculateAverageRating(submissions)).toBe(5.0);
    });
  });

  describe("Cooldown Calculation", () => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    it("should allow milestone prompt if user has never submitted feedback", () => {
      const lastFeedbackAt = null;
      const canPrompt = !lastFeedbackAt;
      expect(canPrompt).toBe(true);
    });

    it("should block milestone prompt if user submitted feedback 10 days ago", () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const canPrompt = Date.now() - tenDaysAgo.getTime() >= THIRTY_DAYS_MS;
      expect(canPrompt).toBe(false);
    });

    it("should allow milestone prompt if user submitted feedback 35 days ago", () => {
      const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
      const canPrompt = Date.now() - thirtyFiveDaysAgo.getTime() >= THIRTY_DAYS_MS;
      expect(canPrompt).toBe(true);
    });
  });
});
