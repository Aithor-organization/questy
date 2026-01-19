/**
 * RescheduleModal
 * 밀린 퀘스트 재조정 모달
 * - 밀린 퀘스트 목록 표시
 * - 스마트 재조정 (개발중)
 * - 개별 퀘스트 일정 조정 (확인 후 진행)
 */

import { useState } from 'react';
import { X, Calendar, Clock, AlertCircle } from 'lucide-react';
import type { DailyQuest } from '../stores/questStore';
import { getTodayDateString } from '../stores/questStore';

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  overdueQuests: DailyQuest[];
  planName: string;
  onReschedule: (questId: string, newDate: string) => void;
}

export function RescheduleModal({
  isOpen,
  onClose,
  overdueQuests,
  planName,
  onReschedule,
}: RescheduleModalProps) {
  const todayStr = getTodayDateString();

  // 개별 퀘스트 날짜 선택 상태
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // 확인 모달 상태
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmingQuest, setConfirmingQuest] = useState<DailyQuest | null>(null);
  const [confirmingDate, setConfirmingDate] = useState('');

  // 개발중 메시지 표시 상태
  const [showDevMessage, setShowDevMessage] = useState(false);

  if (!isOpen) return null;

  // 날짜를 한국어로 포맷
  const formatDateKorean = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
    return `${month}/${day}(${dayOfWeek})`;
  };

  // 날짜 변경 버튼 클릭
  const handleDateChangeClick = (quest: DailyQuest) => {
    if (selectedQuestId === quest.id) {
      // 이미 선택된 퀘스트면 닫기
      setSelectedQuestId(null);
    } else {
      setSelectedQuestId(quest.id);
      setSelectedDate(todayStr);
    }
  };

  // 날짜 확정 전 확인
  const handleConfirmClick = (quest: DailyQuest, newDate: string) => {
    setConfirmingQuest(quest);
    setConfirmingDate(newDate);
    setShowConfirmation(true);
  };

  // 최종 확인 후 재조정
  const handleFinalConfirm = () => {
    if (confirmingQuest && confirmingDate) {
      onReschedule(confirmingQuest.id, confirmingDate);
      setShowConfirmation(false);
      setConfirmingQuest(null);
      setSelectedQuestId(null);
    }
  };

  // 확인 취소
  const handleCancelConfirm = () => {
    setShowConfirmation(false);
    setConfirmingQuest(null);
    setConfirmingDate('');
  };

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* 메인 모달 */}
      <div className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md max-h-[90vh] bg-white rounded-2xl shadow-xl z-50 flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-amber-50">
          <div className="flex items-center gap-2">
            <AlertCircle size={20} className="text-amber-600" />
            <span className="font-semibold text-[var(--ink-black)]">
              밀린 퀘스트 {overdueQuests.length}개
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-amber-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 플랜 정보 */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
          <p className="text-sm text-[var(--pencil-gray)]">
            📚 {planName}
          </p>
        </div>

        {/* 스마트 재조정 버튼 */}
        <div className="px-4 py-3 border-b border-gray-100">
          <button
            onClick={() => setShowDevMessage(true)}
            className="w-full py-3 bg-gradient-to-r from-[var(--ink-blue)] to-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <span>🧠</span>
            <span>스마트 재조정</span>
          </button>
          <p className="text-xs text-center text-[var(--pencil-gray)] mt-2">
            AI가 자동으로 최적의 일정을 찾아드려요
          </p>
        </div>

        {/* 퀘스트 목록 */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 bg-gray-50 sticky top-0">
            <p className="text-xs text-[var(--pencil-gray)] font-medium">
              또는 개별 퀘스트를 직접 조정하세요
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {overdueQuests.map((quest) => (
              <div key={quest.id} className="px-4 py-3">
                {/* 퀘스트 정보 */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-amber-600 text-xs font-bold">{quest.unitNumber}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--ink-black)] line-clamp-2">
                      {quest.unitTitle}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-red-500 flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDateKorean(quest.date)} 예정
                      </span>
                      {quest.estimatedMinutes > 0 && (
                        <span className="text-xs text-[var(--pencil-gray)] flex items-center gap-1">
                          <Clock size={12} />
                          {quest.estimatedMinutes}분
                        </span>
                      )}
                    </div>
                    {/* 밀린 퀘스트 안내 메모 */}
                    <p className="text-xs text-amber-600 mt-1 bg-amber-50 px-2 py-1 rounded inline-block">
                      💡 아래 버튼을 눌러 일정을 조정하세요
                    </p>
                  </div>
                </div>

                {/* 날짜 변경 버튼 / 날짜 선택기 */}
                {selectedQuestId === quest.id ? (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <label className="text-xs text-[var(--ink-blue)] font-medium mb-2 block">
                      새 날짜 선택
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={selectedDate}
                        min={todayStr}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-blue-200 rounded-lg focus:outline-none focus:border-[var(--ink-blue)]"
                      />
                      <button
                        onClick={() => handleConfirmClick(quest, selectedDate)}
                        disabled={!selectedDate}
                        className="px-4 py-2 bg-[var(--ink-blue)] text-white text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
                      >
                        확인
                      </button>
                      <button
                        onClick={() => setSelectedQuestId(null)}
                        className="px-4 py-2 bg-gray-200 text-gray-600 text-sm rounded-lg hover:opacity-90"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleDateChangeClick(quest)}
                    className="mt-3 w-full py-2 text-sm text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Calendar size={14} />
                    <span>일정 조정하기</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 하단 안내 */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-center text-[var(--pencil-gray)]">
            일정을 조정하면 학습 계획이 자동으로 업데이트됩니다
          </p>
        </div>
      </div>

      {/* 확인 모달 */}
      {showConfirmation && confirmingQuest && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[60]" onClick={handleCancelConfirm} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm bg-white rounded-2xl shadow-2xl z-[60] p-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar size={24} className="text-amber-600" />
              </div>
              <h3 className="font-bold text-lg text-[var(--ink-black)] mb-2">
                일정을 변경할까요?
              </h3>
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-left">
                <p className="text-sm text-[var(--ink-black)] font-medium mb-1">
                  {confirmingQuest.unitNumber}. {confirmingQuest.unitTitle}
                </p>
                <p className="text-xs text-[var(--pencil-gray)]">
                  {formatDateKorean(confirmingQuest.date)} → {formatDateKorean(confirmingDate)}
                </p>
              </div>
              <p className="text-sm text-[var(--pencil-gray)] mb-4">
                변경된 일정은 즉시 적용됩니다.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCancelConfirm}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-lg font-medium"
                >
                  취소
                </button>
                <button
                  onClick={handleFinalConfirm}
                  className="flex-1 py-3 bg-[var(--ink-blue)] text-white rounded-lg font-medium"
                >
                  변경하기
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 개발중 메시지 모달 */}
      {showDevMessage && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[60]" onClick={() => setShowDevMessage(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm bg-white rounded-2xl shadow-2xl z-[60] p-6 text-center">
            <div className="text-5xl mb-4">🔧</div>
            <h3 className="font-bold text-lg text-[var(--ink-black)] mb-2">
              기능 개발 중
            </h3>
            <p className="text-[var(--pencil-gray)] mb-4 text-sm">
              스마트 재조정 기능은 현재 개발중입니다.<br />
              조금만 기다려주세요!
            </p>
            <p className="text-xs text-[var(--pencil-gray)] mb-4">
              개별 퀘스트는 아래 목록에서 직접 조정하실 수 있어요.
            </p>
            <button
              onClick={() => setShowDevMessage(false)}
              className="w-full py-3 bg-[var(--ink-blue)] text-white rounded-lg"
            >
              확인
            </button>
          </div>
        </>
      )}
    </>
  );
}

export default RescheduleModal;
