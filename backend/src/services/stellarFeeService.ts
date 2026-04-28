import { Horizon } from "@stellar/stellar-sdk";
import { config } from "../config";
import { createLogger } from "../logger";
import { ExternalServiceError } from "../errors";

const logger = createLogger({ component: "stellarFeeService" });

export interface NetworkFeeInfo {
  baseFee: number; // in stroops
  baseFeeInXLM: number;
  lastUpdated: string;
  source: "cached" | "live";
}

export interface FeeEstimate {
  networkFee: number; // in XLM
  platformFee: number; // in XLM
  totalFee: number; // in XLM
  estimatedAt: string;
}

export class StellarFeeService {
  private cachedBaseFee: number | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_TTL_MS = 60000; // 1 minute cache
  private readonly DEFAULT_BASE_FEE = 100; // 100 stroops = 0.00001 XLM

  /**
   * Get current network base fee
   */
  async getNetworkFee(): Promise<NetworkFeeInfo> {
    const now = Date.now();

    // Return cached fee if still valid
    if (
      this.cachedBaseFee !== null &&
      now - this.lastFetchTime < this.CACHE_TTL_MS
    ) {
      return {
        baseFee: this.cachedBaseFee,
        baseFeeInXLM: this.cachedBaseFee / 10_000_000,
        lastUpdated: new Date(this.lastFetchTime).toISOString(),
        source: "cached",
      };
    }

    // Fetch fresh fee from Horizon
    try {
      const server = new Horizon.Server(config.stellar.horizonUrl);
      const baseFee = await server.fetchBaseFee();

      this.cachedBaseFee = baseFee;
      this.lastFetchTime = now;

      logger.info(
        { baseFee, baseFeeInXLM: baseFee / 10_000_000 },
        "Fetched network base fee",
      );

      return {
        baseFee,
        baseFeeInXLM: baseFee / 10_000_000,
        lastUpdated: new Date(now).toISOString(),
        source: "live",
      };
    } catch (error) {
      logger.warn({ error }, "Failed to fetch network fee, using default");

      // Use default fee if fetch fails
      const defaultFee = this.cachedBaseFee || this.DEFAULT_BASE_FEE;
      return {
        baseFee: defaultFee,
        baseFeeInXLM: defaultFee / 10_000_000,
        lastUpdated: new Date(this.lastFetchTime || now).toISOString(),
        source: "cached",
      };
    }
  }

  /**
   * Estimate total fees for a transfer
   */
  async estimateFees(amount: number, currency: string): Promise<FeeEstimate> {
    const networkFeeInfo = await this.getNetworkFee();
    const networkFee = networkFeeInfo.baseFeeInXLM;

    // Platform fee calculation (simplified - 0.5% of amount, min 0.01 XLM)
    const platformFeePercent = 0.005;
    const platformFee = Math.max(amount * platformFeePercent, 0.01);

    const totalFee = networkFee + platformFee;

    return {
      networkFee,
      platformFee,
      totalFee,
      estimatedAt: new Date().toISOString(),
    };
  }

  /**
   * Check if network fees are elevated
   */
  async isNetworkCongested(): Promise<boolean> {
    const feeInfo = await this.getNetworkFee();
    // Consider network congested if base fee is more than 10x the default
    return feeInfo.baseFee > this.DEFAULT_BASE_FEE * 10;
  }

  /**
   * Clear cached fee (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cachedBaseFee = null;
    this.lastFetchTime = 0;
    logger.info("Cleared network fee cache");
  }
}
