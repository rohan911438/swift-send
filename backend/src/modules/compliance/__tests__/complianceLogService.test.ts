import { ComplianceLogService } from "../complianceLogService";
import { EventBus } from "../../../core/eventBus";

describe("ComplianceLogService", () => {
  let service: ComplianceLogService;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    service = new ComplianceLogService(eventBus);
  });

  describe("performAMLCheck", () => {
    it("should pass for low-risk transactions", async () => {
      const result = await service.performAMLCheck({
        userId: "user_123",
        amount: 100,
        destinationCountry: "US",
      });

      expect(result.passed).toBe(true);
      expect(result.riskScore).toBeLessThan(40);
      expect(result.requiresManualReview).toBe(false);
    });

    it("should flag high-risk countries", async () => {
      const result = await service.performAMLCheck({
        userId: "user_123",
        amount: 100,
        destinationCountry: "IR",
      });

      expect(result.flags).toContain("high_risk_country");
      expect(result.riskScore).toBeGreaterThanOrEqual(30);
    });

    it("should flag large amounts", async () => {
      const result = await service.performAMLCheck({
        userId: "user_123",
        amount: 15000,
        destinationCountry: "US",
      });

      expect(result.flags).toContain("very_large_amount");
      expect(result.riskScore).toBeGreaterThan(0);
    });

    it("should block very high-risk transactions", async () => {
      const result = await service.performAMLCheck({
        userId: "user_123",
        amount: 15000,
        destinationCountry: "KP",
      });

      expect(result.passed).toBe(false);
      expect(result.riskScore).toBeGreaterThanOrEqual(70);
      expect(result.requiresManualReview).toBe(true);
    });
  });

  describe("createLog", () => {
    it("should create a compliance log", () => {
      const log = service.createLog({
        userId: "user_123",
        checkType: "aml",
        status: "passed",
        riskScore: 10,
        flags: [],
        metadata: { amount: 100 },
        checkedBy: "system",
      });

      expect(log.id).toBeDefined();
      expect(log.userId).toBe("user_123");
      expect(log.checkType).toBe("aml");
      expect(log.status).toBe("passed");
    });
  });

  describe("getLogsByUserId", () => {
    it("should return logs for a specific user", () => {
      service.createLog({
        userId: "user_123",
        checkType: "aml",
        status: "passed",
        riskScore: 10,
        flags: [],
        metadata: {},
        checkedBy: "system",
      });

      service.createLog({
        userId: "user_456",
        checkType: "aml",
        status: "flagged",
        riskScore: 50,
        flags: ["high_risk_country"],
        metadata: {},
        checkedBy: "system",
      });

      const logs = service.getLogsByUserId("user_123");
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe("user_123");
    });
  });

  describe("getFlaggedTransactions", () => {
    it("should return only flagged or blocked transactions", () => {
      service.createLog({
        userId: "user_123",
        checkType: "aml",
        status: "passed",
        riskScore: 10,
        flags: [],
        metadata: {},
        checkedBy: "system",
      });

      service.createLog({
        userId: "user_456",
        checkType: "aml",
        status: "flagged",
        riskScore: 50,
        flags: ["high_risk_country"],
        metadata: {},
        checkedBy: "system",
      });

      const flagged = service.getFlaggedTransactions();
      expect(flagged).toHaveLength(1);
      expect(flagged[0].status).toBe("flagged");
    });
  });
});
