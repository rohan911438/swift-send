import { calculateFees, FeeCalculation } from '../feeCalculation';

describe('Fee Calculation', () => {
  describe('calculateFees', () => {
    it('should calculate correct fees for standard amounts', () => {
      const result = calculateFees(100);
      
      expect(result.networkFee).toBe(0.00001); // Fixed Stellar network fee
      expect(result.serviceFee).toBe(0.5); // 0.5% of 100
      expect(result.totalFee).toBe(0.50001);
      expect(result.recipientGets).toBe(99.49999);
    });

    it('should handle minimum amounts', () => {
      const result = calculateFees(1);
      
      expect(result.networkFee).toBe(0.00001);
      expect(result.serviceFee).toBe(0.01); // Minimum fee applied
      expect(result.totalFee).toBe(0.01001);
      expect(result.recipientGets).toBe(0.98999);
    });

    it('should handle large amounts', () => {
      const result = calculateFees(10000);
      
      expect(result.networkFee).toBe(0.00001);
      expect(result.serviceFee).toBe(25); // Capped at maximum
      expect(result.totalFee).toBe(25.00001);
      expect(result.recipientGets).toBe(9974.99999);
    });

    it('should apply minimum service fee', () => {
      const result = calculateFees(0.1); // Very small amount
      
      expect(result.serviceFee).toBe(0.01); // Minimum fee
      expect(result.totalFee).toBe(0.01001);
      expect(result.recipientGets).toBe(0.08999);
    });

    it('should apply maximum service fee cap', () => {
      const result = calculateFees(100000); // Large amount
      
      expect(result.serviceFee).toBe(25); // Maximum fee cap
      expect(result.totalFee).toBe(25.00001);
      expect(result.recipientGets).toBe(99974.99999);
    });

    it('should handle zero amount', () => {
      const result = calculateFees(0);
      
      expect(result.networkFee).toBe(0.00001);
      expect(result.serviceFee).toBe(0.01); // Minimum fee
      expect(result.totalFee).toBe(0.01001);
      expect(result.recipientGets).toBe(-0.01001);
    });

    it('should handle decimal amounts correctly', () => {
      const result = calculateFees(123.45);
      
      expect(result.networkFee).toBe(0.00001);
      expect(result.serviceFee).toBeCloseTo(0.61725, 4); // 0.5% of 123.45
      expect(result.totalFee).toBeCloseTo(0.61726, 4);
      expect(result.recipientGets).toBeCloseTo(122.83274, 4);
    });

    it('should maintain precision for financial calculations', () => {
      const result = calculateFees(999.99);
      
      // Check that calculations maintain proper precision
      expect(result.serviceFee).toBeCloseTo(4.99995, 3);
      expect(result.totalFee).toBeCloseTo(4.99996, 3);
      expect(result.recipientGets).toBeCloseTo(994.99004, 3);
    });
  });

  describe('Fee calculation edge cases', () => {
    it('should handle negative amounts gracefully', () => {
      const result = calculateFees(-100);
      
      expect(result.networkFee).toBe(0.00001);
      expect(result.serviceFee).toBe(0.01); // Minimum fee applied
      expect(result.totalFee).toBe(0.01001);
      expect(result.recipientGets).toBe(-100.01001);
    });

    it('should handle very large numbers', () => {
      const result = calculateFees(1000000);
      
      expect(result.networkFee).toBe(0.00001);
      expect(result.serviceFee).toBe(25); // Capped at maximum
      expect(result.totalFee).toBe(25.00001);
      expect(result.recipientGets).toBe(999974.99999);
    });
  });
});