/**
 * useMembershipCheck Hook
 * AI 기능 사용 가능 여부를 확인하는 훅
 * - 베타테스터/랩멤버만 AI 기능 사용 가능
 * - pending(일반인) 상태면 사용 불가
 */

import { useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

export interface MembershipCheckResult {
  /** AI 기능 사용 가능 여부 */
  canUseAI: boolean;
  /** 멤버십 타입 (pending, beta_tester, lab_member) */
  membershipType: string | null;
  /** 멤버십 상태 (pending, active, expired, revoked) */
  membershipStatus: string | null;
  /** 체험판 종료 모달 표시 여부 */
  showTrialEndedModal: boolean;
  /** 시도한 기능 이름 */
  attemptedFeature: string | null;
  /** AI 기능 사용 시도 - 권한 없으면 모달 표시 */
  checkAndShowModal: (featureName: string) => boolean;
  /** 모달 닫기 */
  closeModal: () => void;
}

/**
 * 멤버십 체크 훅
 * @returns 멤버십 상태 및 AI 기능 접근 제어 함수
 */
export function useMembershipCheck(): MembershipCheckResult {
  const membership = useAuthStore((state) => state.membershipData);

  // 모달 상태
  const [showTrialEndedModal, setShowTrialEndedModal] = useState(false);
  const [attemptedFeature, setAttemptedFeature] = useState<string | null>(null);

  // AI 기능 사용 가능 여부 계산
  // - beta_tester 또는 lab_member이고 active 상태여야 함
  const canUseAI = (() => {
    if (!membership) return false;

    const allowedTypes = ['beta_tester', 'lab_member'];
    const isAllowedType = allowedTypes.includes(membership.type);
    const isActive = membership.status === 'active';
    const isNotExpired = !membership.isExpired;

    return isAllowedType && isActive && isNotExpired;
  })();

  /**
   * AI 기능 사용 시도 시 호출
   * @param featureName 시도하는 기능 이름
   * @returns true면 사용 가능, false면 모달 표시됨
   */
  const checkAndShowModal = useCallback((featureName: string): boolean => {
    if (canUseAI) {
      return true;
    }

    // 권한 없음 - 모달 표시
    setAttemptedFeature(featureName);
    setShowTrialEndedModal(true);
    return false;
  }, [canUseAI]);

  /**
   * 모달 닫기
   */
  const closeModal = useCallback(() => {
    setShowTrialEndedModal(false);
    setAttemptedFeature(null);
  }, []);

  return {
    canUseAI,
    membershipType: membership?.type ?? null,
    membershipStatus: membership?.status ?? null,
    showTrialEndedModal,
    attemptedFeature,
    checkAndShowModal,
    closeModal,
  };
}

export default useMembershipCheck;
