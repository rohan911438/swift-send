/**
 * Unit tests for fee calculator
 * Tests all fee calculation scenarios including edge cases
 */

import {
  calculateTransferFees,
  calculateTransferFeesDetailed,
  calculateTransferFeesWithExchange,
  calculateSenderAmountFromRecipientAmount,
  isValidAmount,
  isValidExchangeRate,
  roundToTwoDecimals,
  formatFeeAsCurrency,
  getFeeTier,
  calculateSavingsVsTraditional,
  getFeeStatistics,
  createFeeConfig,
  DEFAULT_FEE_CONFIG,
} from "./feeCalculator";

describe("Fee Calculator", () => {
  describe("calculateTransferFees", () => {
    it("should calculate fees for standard transfer", () => {
      const result = calculateTransferFees(100);

      expect(result.amount).toBe(100);
      expect(result.networkFee).toBe(0.001);
      expect(result.serviceFee).toBe(0.2); // 0.2% of 100
      expect(result.totalFee).toBe(0.201);
      expect(result.recipientGets).toBe(99.799);
      expect(result.feePercentage).toBeCloseTo(0.201, 2);
    });

    it("should calculate fees for small transfer", () => {
      const result = calculateTransferFees(5);

      expect(result.amount).toBe(5);
      expect(result.networkFee).toBe(0.001);
      // Service fee should be minimum ($0.01)
      expect(result.serviceFee).toBe(0.01);
      expect(result.totalFee).toBe(0.011);
      expect(result.recipientGets).toBe(4.989);
    });

    it("should calculate fees for large transfer", () => {
      const result = calculateTransferFees(10000);

      expect(result.amount).toBe(10000);
      expect(result.networkFee).toBe(0.001);
      // Service fee should be capped at $50
      expect(result.serviceFee).toBe(50);
      expect(result.totalFee).toBe(50.001);
      expect(result.recipientGets).toBe(9949.999);
    });

    it("should calculate fees for very small transfer", () => {
      const result = calculateTransferFees(0.5);

      expect(result.amount).toBe(0.5);
      expect(result.networkFee).toBe(0.001);
      // Service fee should be minimum ($0.01)
      expect(result.serviceFee).toBe(0.01);
      expect(result.totalFee).toBe(0.011);
      expect(result.recipientGets).toBe(0.489);
    });

    it("should calculate fees for $1 transfer", () => {
      const result = calculateTransferFees(1);

      expect(result.amount).toBe(1);
      expect(result.networkFee).toBe(0.001);
      // Service fee should be minimum ($0.01)
      expect(result.serviceFee).toBe(0.01);
      expect(result.totalFee).toBe(0.011);
      expect(result.recipientGets).toBe(0.989);
    });

    it("should handle custom fee configuration", () => {
      const customConfig = createFeeConfig({
        serviceFeePercentage: 0.01, // 1%
        minServiceFee: 0.05,
        maxServiceFee: 100,
      });

      const result = calculateTransferFees(100, customConfig);

      expect(result.serviceFee).toBe(1); // 1% of 100
      expect(result.totalFee).toBe(1.001);
    });

    it("should round to two decimal places", () => {
      const result = calculateTransferFees(33.33);

      expect(result.amount).toBe(33.33);
      expect(result.serviceFee).toBe(0.07); // 0.2% of 33.33 = 0.0666, rounded to 0.07
      expect(result.totalFee).toBe(0.071);
      expect(result.recipientGets).toBe(33.259);
    });
  });

  describe("calculateTransferFeesDetailed", () => {
    it("should provide detailed fee breakdown", () => {
      const result = calculateTransferFeesDetailed(100);

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.networkFee).toBeDefined();
      expect(result.breakdown.networkFee.amount).toBe(0.001);
      expect(result.breakdown.networkFee.description).toBe(
        "Stellar network fee",
      );

      expect(result.breakdown.serviceFee).toBeDefined();
      expect(result.breakdown.serviceFee.amount).toBe(0.2);
      expect(result.breakdown.serviceFee.percentage).toBeCloseTo(0.2, 1);
      expect(result.breakdown.serviceFee.description).toBe(
        "SwiftSend service fee",
      );
    });
  });

  describe("calculateTransferFeesWithExchange", () => {
    it("should calculate fees with exchange rate", () => {
      // 100 MXN at 17.25 MXN/USD = ~5.80 USD
      const result = calculateTransferFeesWithExchange(100, 17.25);

      expect(result.amount).toBeCloseTo(5.8, 1);
      expect(result.networkFee).toBe(0.001);
      expect(result.serviceFee).toBeGreaterThan(0);
      expect(result.totalFee).toBeGreaterThan(0);
      expect(result.recipientGets).toBeGreaterThan(0);
    });

    it("should handle 1:1 exchange rate", () => {
      const result = calculateTransferFeesWithExchange(100, 1);

      expect(result.amount).toBe(100);
      expect(result.networkFee).toBe(0.001);
      expect(result.serviceFee).toBe(0.2);
    });

    it("should handle high exchange rates", () => {
      // 1000 PHP at 56.50 PHP/USD = ~17.70 USD
      const result = calculateTransferFeesWithExchange(1000, 56.5);

      expect(result.amount).toBeCloseTo(17.7, 1);
      expect(result.recipientGets).toBeGreaterThan(0);
    });

    it("should handle low exchange rates", () => {
      // 0.5 BTC at 50000 USD/BTC = 25000 USD
      const result = calculateTransferFeesWithExchange(0.5, 0.00002);

      expect(result.amount).toBeCloseTo(25000, 0);
      expect(result.serviceFee).toBe(50); // Capped at max
    });
  });

  describe("calculateSenderAmountFromRecipientAmount", () => {
    it("should calculate sender amount from recipient amount", () => {
      const result = calculateSenderAmountFromRecipientAmount(100);

      expect(result.recipientGets).toBeCloseTo(100, 1);
      expect(result.amount).toBeGreaterThan(100);
    });

    it("should handle small recipient amounts", () => {
      const result = calculateSenderAmountFromRecipientAmount(1);

      expect(result.recipientGets).toBeCloseTo(1, 1);
      expect(result.amount).toBeGreaterThan(1);
    });

    it("should handle large recipient amounts", () => {
      const result = calculateSenderAmountFromRecipientAmount(10000);

      expect(result.recipientGets).toBeCloseTo(10000, 0);
      expect(result.amount).toBeGreaterThan(10000);
    });
  });

  describe("isValidAmount", () => {
    it("should validate positive amounts", () => {
      expect(isValidAmount(0.01)).toBe(true);
      expect(isValidAmount(1)).toBe(true);
      expect(isValidAmount(100)).toBe(true);
      expect(isValidAmount(999999)).toBe(true);
    });

    it("should reject invalid amounts", () => {
      expect(isValidAmount(0)).toBe(false);
      expect(isValidAmount(-1)).toBe(false);
      expect(isValidAmount(NaN)).toBe(false);
      expect(isValidAmount(Infinity)).toBe(false);
      expect(isValidAmount("100")).toBe(false);
      expect(isValidAmount(null)).toBe(false);
      expect(isValidAmount(undefined)).toBe(false);
    });

    it("should reject amounts exceeding maximum", () => {
      expect(isValidAmount(1000001)).toBe(false);
    });
  });

  describe("isValidExchangeRate", () => {
    it("should validate positive exchange rates", () => {
      expect(isValidExchangeRate(0.5)).toBe(true);
      expect(isValidExchangeRate(1)).toBe(true);
      expect(isValidExchangeRate(17.25)).toBe(true);
      expect(isValidExchangeRate(56.5)).toBe(true);
    });

    it("should reject invalid exchange rates", () => {
      expect(isValidExchangeRate(0)).toBe(false);
      expect(isValidExchangeRate(-1)).toBe(false);
      expect(isValidExchangeRate(NaN)).toBe(false);
      expect(isValidExchangeRate(Infinity)).toBe(false);
      expect(isValidExchangeRate("1.5")).toBe(false);
      expect(isValidExchangeRate(null)).toBe(false);
      expect(isValidExchangeRate(undefined)).toBe(false);
    });

    it("should reject extreme exchange rates", () => {
      expect(isValidExchangeRate(0.0000001)).toBe(false);
      expect(isValidExchangeRate(10000001)).toBe(false);
    });
  });

  describe("roundToTwoDecimals", () => {
    it("should round to two decimal places", () => {
      expect(roundToTwoDecimals(1.234)).toBe(1.23);
      expect(roundToTwoDecimals(1.235)).toBe(1.24);
      expect(roundToTwoDecimals(1.999)).toBe(2);
      expect(roundToTwoDecimals(0.001)).toBe(0);
      expect(roundToTwoDecimals(0.005)).toBe(0.01);
    });

    it("should handle edge cases", () => {
      expect(roundToTwoDecimals(0)).toBe(0);
      expect(roundToTwoDecimals(0.1)).toBe(0.1);
      expect(roundToTwoDecimals(100)).toBe(100);
    });
  });

  describe("formatFeeAsCurrency", () => {
    it("should format as USD currency", () => {
      const formatted = formatFeeAsCurrency(100);
      expect(formatted).toContain("$");
      expect(formatted).toContain("100");
    });

    it("should format with different currencies", () => {
      const formatted = formatFeeAsCurrency(100, "EUR");
      expect(formatted).toContain("100");
    });

    it("should handle small amounts", () => {
      const formatted = formatFeeAsCurrency(0.01);
      expect(formatted).toContain("$");
    });
  });

  describe("getFeeTier", () => {
    it("should categorize amounts into fee tiers", () => {
      expect(getFeeTier(5)).toBe("micro");
      expect(getFeeTier(50)).toBe("small");
      expect(getFeeTier(500)).toBe("medium");
      expect(getFeeTier(5000)).toBe("large");
      expect(getFeeTier(50000)).toBe("enterprise");
    });

    it("should handle boundary values", () => {
      expect(getFeeTier(10)).toBe("small");
      expect(getFeeTier(100)).toBe("medium");
      expect(getFeeTier(1000)).toBe("large");
      expect(getFeeTier(10000)).toBe("enterprise");
    });
  });

  describe("calculateSavingsVsTraditional", () => {
    it("should calculate savings vs traditional wire", () => {
      const savings = calculateSavingsVsTraditional(100);

      // Traditional 2% fee = $2
      // SwiftSend fee = $0.201
      // Savings = $1.799
      expect(savings).toBeCloseTo(1.799, 2);
    });

    it("should handle custom traditional fee percentage", () => {
      const savings = calculateSavingsVsTraditional(100, 0.05); // 5% traditional fee

      // Traditional 5% fee = $5
      // SwiftSend fee = $0.201
      // Savings = $4.799
      expect(savings).toBeCloseTo(4.799, 2);
    });

    it("should show significant savings for large transfers", () => {
      const savings = calculateSavingsVsTraditional(10000);

      // Traditional 2% fee = $200
      // SwiftSend fee = $50.001
      // Savings = $149.999
      expect(savings).toBeGreaterThan(100);
    });
  });

  describe("getFeeStatistics", () => {
    it("should calculate statistics for multiple amounts", () => {
      const amounts = [10, 50, 100, 500, 1000];
      const stats = getFeeStatistics(amounts);

      expect(stats.averageFeePercentage).toBeGreaterThan(0);
      expect(stats.minFeePercentage).toBeGreaterThan(0);
      expect(stats.maxFeePercentage).toBeGreaterThan(stats.minFeePercentage);
      expect(stats.totalFees).toBeGreaterThan(0);
      expect(stats.averageFee).toBeGreaterThan(0);
    });

    it("should handle empty array", () => {
      const stats = getFeeStatistics([]);

      expect(stats.averageFeePercentage).toBe(0);
      expect(stats.minFeePercentage).toBe(0);
      expect(stats.maxFeePercentage).toBe(0);
      expect(stats.totalFees).toBe(0);
      expect(stats.averageFee).toBe(0);
    });

    it("should handle single amount", () => {
      const stats = getFeeStatistics([100]);

      expect(stats.averageFeePercentage).toBeCloseTo(0.201, 2);
      expect(stats.minFeePercentage).toBeCloseTo(0.201, 2);
      expect(stats.maxFeePercentage).toBeCloseTo(0.201, 2);
    });
  });

  describe("createFeeConfig", () => {
    it("should create config with defaults", () => {
      const config = createFeeConfig();

      expect(config.networkFeeFixed).toBe(DEFAULT_FEE_CONFIG.networkFeeFixed);
      expect(config.serviceFeePercentage).toBe(
        DEFAULT_FEE_CONFIG.serviceFeePercentage,
      );
    });

    it("should override defaults", () => {
      const config = createFeeConfig({
        serviceFeePercentage: 0.01,
        maxServiceFee: 100,
      });

      expect(config.serviceFeePercentage).toBe(0.01);
      expect(config.maxServiceFee).toBe(100);
      expect(config.networkFeeFixed).toBe(DEFAULT_FEE_CONFIG.networkFeeFixed);
    });
  });

  describe("Edge cases", () => {
    it("should handle very small amounts", () => {
      const result = calculateTransferFees(0.01);

      expect(result.amount).toBe(0.01);
      expect(result.recipientGets).toBeGreaterThan(0);
      expect(result.totalFee).toBeGreaterThan(0);
    });

    it("should handle amounts with many decimal places", () => {
      const result = calculateTransferFees(123.456789);

      expect(result.amount).toBe(123.46); // Rounded
      expect(result.recipientGets).toBeGreaterThan(0);
    });

    it("should maintain precision across calculations", () => {
      const amount = 99.99;
      const result = calculateTransferFees(amount);

      // Verify that amount + fees = original amount
      const reconstructed = result.recipientGets + result.totalFee;
      expect(reconstructed).toBeCloseTo(amount, 2);
    });

    it("should handle fee tier boundaries", () => {
      const tiers = [9.99, 10, 10.01, 99.99, 100, 100.01];
      const results = tiers.map((amount) => ({
        amount,
        tier: getFeeTier(amount),
      }));

      expect(results[0].tier).toBe("micro");
      expect(results[1].tier).toBe("small");
      expect(results[2].tier).toBe("small");
    });
  });

  describe("Consistency checks", () => {
    it("should maintain consistency across multiple calls", () => {
      const amount = 100;
      const result1 = calculateTransferFees(amount);
      const result2 = calculateTransferFees(amount);

      expect(result1).toEqual(result2);
    });

    it("should maintain consistency with detailed breakdown", () => {
      const amount = 100;
      const result = calculateTransferFees(amount);
      const detailed = calculateTransferFeesDetailed(amount);

      expect(result.amount).toBe(detailed.amount);
      expect(result.networkFee).toBe(detailed.networkFee);
      expect(result.serviceFee).toBe(detailed.serviceFee);
      expect(result.totalFee).toBe(detailed.totalFee);
      expect(result.recipientGets).toBe(detailed.recipientGets);
    });

    it("should maintain consistency with reverse calculation", () => {
      const amount = 100;
      const result = calculateTransferFees(amount);
      const reverse = calculateSenderAmountFromRecipientAmount(
        result.recipientGets,
      );

      expect(reverse.amount).toBeCloseTo(amount, 1);
      expect(reverse.recipientGets).toBeCloseTo(result.recipientGets, 1);
    });
  });
});
