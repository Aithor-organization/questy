/**
 * Membership Actions
 * 멤버십 관련 액션
 */

import type { MembershipData, SetState, GetState } from './types';
import { log } from './utils';

/**
 * 멤버십 정보 로드
 */
export async function loadMembership(
  get: GetState,
  set: SetState
): Promise<MembershipData | null> {
  const session = get().session;
  if (!session?.access_token) {
    return null;
  }

  try {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const response = await fetch(`${API_URL}/api/admin/membership/status`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = await response.json();

    if (data.success) {
      const membership: MembershipData = data.data;
      set({ membershipData: membership });
      log.log(' Membership loaded:', membership.type);
      return membership;
    }
    return null;
  } catch (err) {
    console.error('[Auth] Load membership error:', err);
    return null;
  }
}
