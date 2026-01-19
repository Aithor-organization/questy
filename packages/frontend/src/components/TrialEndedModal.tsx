/**
 * TrialEndedModal
 * 체험판 종료 안내 모달
 * - 베타테스터 기간(7일) 만료 후 표시
 * - AI 기능 사용 시도 시 표시
 */

import { X } from 'lucide-react';

interface TrialEndedModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string; // 시도한 기능 이름 (선택)
}

export function TrialEndedModal({
  isOpen,
  onClose,
  featureName,
}: TrialEndedModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm bg-white rounded-2xl shadow-xl z-50 overflow-hidden">
        {/* 헤더 */}
        <div className="relative bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-8 text-center">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
          <div className="text-5xl mb-3">⏰</div>
          <h2 className="text-xl font-bold text-white">
            체험판이 종료되었습니다
          </h2>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5">
          <p className="text-[var(--pencil-gray)] text-sm text-center mb-4">
            {featureName ? (
              <>
                <span className="font-semibold text-[var(--ink-black)]">{featureName}</span>
                {' '}기능은 베타테스터 전용 기능입니다.
              </>
            ) : (
              '이 기능은 베타테스터 전용 기능입니다.'
            )}
          </p>

          {/* 제한된 기능 목록 */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="text-xs font-medium text-[var(--pencil-gray)] mb-2">
              베타테스터 전용 기능
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-[var(--ink-black)]">
                <span className="text-lg">💬</span>
                <span>AI 코치 채팅</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-[var(--ink-black)]">
                <span className="text-lg">📚</span>
                <span>AI 커리큘럼 생성</span>
              </li>
              <li className="flex items-center gap-2 text-sm text-[var(--ink-black)]">
                <span className="text-lg">🎯</span>
                <span>AI 퀘스트 생성</span>
              </li>
            </ul>
          </div>

          {/* 안내 메시지 */}
          <div className="bg-blue-50 rounded-xl p-4 mb-4">
            <p className="text-sm text-[var(--ink-blue)]">
              💡 베타테스터로 다시 참여하고 싶으시다면 관리자에게 문의해주세요!
            </p>
          </div>

          {/* 버튼 */}
          <button
            onClick={onClose}
            className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            확인
          </button>
        </div>
      </div>
    </>
  );
}

export default TrialEndedModal;
