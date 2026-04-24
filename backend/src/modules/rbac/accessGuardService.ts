import type { UserRole } from '../../auth/sessionTypes';
import { logger } from '../../logger';

/**
 * Application-level implementation of the Access Guard contract pattern.
 *
 * Mirrors the on-chain contract logic (gate + per-address allowlist) so the
 * backend can enforce the same rules without a live Soroban RPC call on every
 * request.  Admins may sync state from the deployed contract via the admin API.
 *
 * Contract: CDPOR7XAJDYSPCQMLM5AJESL4IOC7L2J34GW5UKSTC6NX7Z4GG53OLEF
 * Logic:    check(addr) = gate_open AND address_allowed
 */
export class AccessGuardService {
  /** Global gate — when false every non-admin action is blocked */
  private gateOpen = true;

  /**
   * Per-user explicit allow/block list.
   * Absent = default open (opt-out model matching contract's unwrap_or(false)
   * with gate defaulting open).
   */
  private readonly allowList = new Map<string, boolean>();

  /** Role registry — absent = 'user' */
  private readonly roles = new Map<string, UserRole>();

  // ── Gate control ────────────────────────────────────────────────────────────

  setGate(open: boolean, adminId: string): void {
    logger.info({ adminId, open }, 'access-guard: gate changed');
    this.gateOpen = open;
  }

  isGateOpen(): boolean {
    return this.gateOpen;
  }

  // ── Per-user allow list ──────────────────────────────────────────────────────

  setAllow(userId: string, allow: boolean, adminId: string): void {
    logger.info({ adminId, userId, allow }, 'access-guard: allow changed');
    this.allowList.set(userId, allow);
  }

  isAllowed(userId: string): boolean {
    const explicit = this.allowList.get(userId);
    return explicit === undefined ? true : explicit;
  }

  /**
   * Combined check: gate_open AND address_allowed.
   * Admins bypass the gate and per-user block.
   */
  check(userId: string): boolean {
    if (this.isAdmin(userId)) return true;
    return this.gateOpen && this.isAllowed(userId);
  }

  // ── Role management ──────────────────────────────────────────────────────────

  setRole(userId: string, role: UserRole, adminId?: string): void {
    logger.info({ adminId, userId, role }, 'access-guard: role changed');
    this.roles.set(userId, role);
  }

  getRole(userId: string): UserRole {
    return this.roles.get(userId) ?? 'user';
  }

  isAdmin(userId: string): boolean {
    return this.getRole(userId) === 'admin';
  }

  // ── Introspection ─────────────────────────────────────────────────────────

  getStatus() {
    return {
      gateOpen: this.gateOpen,
      blockedUsers: Array.from(this.allowList.entries())
        .filter(([, v]) => !v)
        .map(([id]) => id),
      adminUsers: Array.from(this.roles.entries())
        .filter(([, r]) => r === 'admin')
        .map(([id]) => id),
      contractId: 'CDPOR7XAJDYSPCQMLM5AJESL4IOC7L2J34GW5UKSTC6NX7Z4GG53OLEF',
    };
  }
}
