/**
 * EmptyState
 * 플랜이 없을 때 표시되는 빈 상태 컴포넌트
 */

import { Link } from 'react-router-dom';
import { NotebookLayout, NotebookPage } from '../../../components/notebook';
import type { DailyCoachData } from '../types';

interface EmptyStateProps {
  coachData: DailyCoachData | null;
  isNewUser: boolean;
}

export function EmptyState({ coachData, isNewUser }: EmptyStateProps) {
  return (
    <NotebookLayout>
      {coachData && (
        <div className="notebook-page-lined p-4 bg-[var(--highlight-green)] mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
              🤖
            </div>
            <div className="flex-1">
              <p className="text-[var(--ink-black)] font-medium">{coachData.dailyMessage}</p>
              <p className="text-sm text-[var(--pencil-gray)] mt-1">{coachData.coachTip}</p>
            </div>
            {coachData.streak > 0 && (
              <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-full text-sm">
                🔥 {coachData.streak}일
              </div>
            )}
          </div>
        </div>
      )}

      <NotebookPage decoration="holes" className="text-center">
        <div className="py-12">
          <div className="text-6xl mb-4">📓</div>
          <h1 className="handwrite handwrite-xl text-[var(--ink-black)] mb-2">QuestyBook</h1>
          <p className="text-[var(--pencil-gray)] mb-6">
            {isNewUser ? (
              <>처음 오셨네요! 👋<br />AI 코치와 함께 학습 여정을 시작해볼까요?</>
            ) : (
              <>아직 학습 플랜이 없어요!<br />새로운 퀘스트를 만들어볼까요?</>
            )}
          </p>
          <div className="flex flex-col gap-3">
            <Link to="/chat" className="inline-flex items-center gap-2 sticker sticker-mint text-base px-6 py-3">
              💬 코치와 대화하기
            </Link>
            <Link to="/generate" className="inline-flex items-center gap-2 sticker sticker-gold text-base px-6 py-3">
              ✨ 퀘스트 생성하기
            </Link>
          </div>
        </div>
      </NotebookPage>

      <div className="postit mt-6 mx-auto max-w-sm">
        <p className="handwrite text-lg mb-3">💡 QuestyBook 사용 꿀팁</p>
        <ul className="text-sm space-y-2 text-[var(--pencil-gray)]">
          <li className="flex items-start gap-2">
            <span>📸</span><span>교재 목차 사진을 찍어 보내면 AI가 학습 플랜을 만들어줘요</span>
          </li>
          <li className="flex items-start gap-2">
            <span>💬</span><span>코치에게 "오늘 뭐 공부해?" 라고 물어보세요</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✅</span><span>퀘스트 완료 시 체크하면 연속 학습일이 쌓여요</span>
          </li>
          <li className="flex items-start gap-2">
            <span>🔥</span><span>7일 연속 달성하면 특별 배지를 받을 수 있어요!</span>
          </li>
        </ul>
      </div>
    </NotebookLayout>
  );
}
