/**
 * TodayPage 모달 컴포넌트들
 */

import type { RescheduleModalState, EveningReviewData } from '../types';

// 미학습 알림 모달
interface MissedStudyModalProps {
  show: boolean;
  missedDays: number;
  onConfirm: () => void;
  onClose: () => void;
}

export function MissedStudyModal({ show, missedDays, onConfirm, onClose }: MissedStudyModalProps) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
        <div className="text-center">
          <div className="text-5xl mb-3">😢</div>
          <h3 className="font-bold text-lg text-[var(--ink-black)] mb-2">좀 쉬었네요...</h3>
          <p className="text-[var(--pencil-gray)] mb-4">
            {missedDays}일 동안 학습을 쉬었어요.<br />다시 시작해볼까요?
          </p>
          <div className="space-y-2">
            <button onClick={onConfirm} className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg">
              💪 다시 시작하기
            </button>
            <button onClick={onClose} className="w-full py-3 bg-gray-100 text-gray-600 rounded-lg">
              나중에
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 위기 개입 모달
interface CrisisModalProps {
  show: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function CrisisModal({ show, onConfirm, onClose }: CrisisModalProps) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
        <div className="text-center">
          <div className="text-5xl mb-3">💙</div>
          <h3 className="font-bold text-lg text-[var(--ink-black)] mb-2">많이 힘드셨죠?</h3>
          <p className="text-[var(--pencil-gray)] mb-4">
            최근 학습이 어려워 보여요.<br />코치가 도움을 드릴게요.
          </p>
          <div className="space-y-2">
            <button onClick={onConfirm} className="w-full py-3 bg-[var(--sticker-mint)] text-white rounded-lg">
              💬 코치와 대화하기
            </button>
            <button onClick={onClose} className="w-full py-3 bg-gray-100 text-gray-600 rounded-lg">
              괜찮아요
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 재조정 모달
interface RescheduleModalProps {
  modal: RescheduleModalState;
  targetDate: string;
  todayStr: string;
  isRescheduling: boolean;
  onTargetDateChange: (date: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export function RescheduleModal({
  modal, targetDate, todayStr, isRescheduling,
  onTargetDateChange, onConfirm, onClose,
}: RescheduleModalProps) {
  if (!modal.isOpen || !modal.quest) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
        <div className="text-center">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="font-bold text-lg text-[var(--ink-black)] mb-2">
            {modal.mode === 'single' ? '퀘스트 일정 변경' : '전체 일정 재조정'}
          </h3>
          <p className="text-[var(--pencil-gray)] mb-4 text-sm">
            {modal.mode === 'single'
              ? `"${modal.quest.unitTitle}" 퀘스트를 언제로 옮길까요?`
              : `"${modal.quest.planName}" 플랜의 미완료 퀘스트를 스마트하게 재배치합니다.`}
          </p>
          <div className="mb-4">
            <label className="block text-sm text-[var(--pencil-gray)] mb-1">
              {modal.mode === 'single' ? '새 날짜' : '시작 날짜'}
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => onTargetDateChange(e.target.value)}
              min={todayStr}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-center"
            />
          </div>
          {modal.mode === 'bulk' && (
            <div className="bg-[var(--highlight-blue)] rounded-lg p-3 mb-4 text-left">
              <p className="text-xs text-[var(--ink-blue)]">
                🧠 <strong>스마트 재조정</strong>이란?<br />
                • 다른 플랜과의 시간 충돌 방지<br />
                • 하루 학습량 80% 버퍼 규칙 적용<br />
                • 균등한 일정 분배
              </p>
            </div>
          )}
          <div className="space-y-2">
            <button
              onClick={onConfirm}
              disabled={isRescheduling || !targetDate}
              className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg disabled:opacity-50"
            >
              {isRescheduling ? '재조정 중...' : modal.mode === 'single' ? '날짜 변경' : '🧠 스마트 재조정'}
            </button>
            <button onClick={onClose} className="w-full py-3 bg-gray-100 text-gray-600 rounded-lg">
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 저녁 리뷰 모달
interface EveningReviewModalProps {
  show: boolean;
  review: EveningReviewData | null;
  onClose: () => void;
}

export function EveningReviewModal({ show, review, onClose }: EveningReviewModalProps) {
  if (!show || !review) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
        <div className="text-center">
          <div className="text-5xl mb-3">🌙</div>
          <h3 className="font-bold text-lg text-[var(--ink-black)] mb-2">오늘의 학습 리뷰</h3>
          <div className="my-4 flex justify-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--ink-blue)]">{review.completedCount}</div>
              <div className="text-xs text-[var(--pencil-gray)]">완료</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-300">{review.totalCount - review.completedCount}</div>
              <div className="text-xs text-[var(--pencil-gray)]">남음</div>
            </div>
          </div>
          <p className="text-[var(--pencil-gray)] text-sm whitespace-pre-wrap mb-4">{review.summary}</p>
          <button onClick={onClose} className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg">
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
