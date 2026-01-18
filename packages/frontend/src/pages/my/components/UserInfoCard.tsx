/**
 * UserInfoCard
 * 사용자 기본 정보 카드
 */

import { User, ClipboardList, Mail, Hash, Pencil } from 'lucide-react';

interface UserInfoCardProps {
  userName: string | undefined;
  userEmail: string | undefined;
  studentId: string | null | undefined;
  onEdit: () => void;
}

export function UserInfoCard({ userName, userEmail, studentId, onEdit }: UserInfoCardProps) {
  return (
    <div className="bg-white/10 rounded-lg p-6 mb-6 border border-[var(--paper-lines)]">
      <h2 className="handwrite handwrite-lg text-[var(--ink-black)] mb-4 flex items-center gap-2">
        <ClipboardList className="w-5 h-5" /> 내 정보
      </h2>

      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-dashed border-[var(--paper-lines)]">
          <User className="w-6 h-6 text-[var(--pencil-gray)]" />
          <div>
            <div className="text-xs text-[var(--pencil-gray)]">이름</div>
            <div className="handwrite text-[var(--ink-black)]">
              {userName || '이름 없음'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pb-3 border-b border-dashed border-[var(--paper-lines)]">
          <Mail className="w-6 h-6 text-[var(--pencil-gray)]" />
          <div>
            <div className="text-xs text-[var(--pencil-gray)]">이메일</div>
            <div className="handwrite text-[var(--ink-black)]">
              {userEmail || '이메일 없음'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Hash className="w-6 h-6 text-[var(--pencil-gray)]" />
          <div>
            <div className="text-xs text-[var(--pencil-gray)]">학생 ID</div>
            <div className="handwrite text-[var(--ink-black)] text-sm">
              {studentId || '미등록'}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onEdit}
        className="w-full mt-4 py-2 px-4 bg-[var(--highlight-blue)] hover:opacity-80 text-[var(--ink-blue)] rounded-lg border border-[var(--ink-blue)]/30 transition-colors flex items-center justify-center gap-2"
      >
        <Pencil className="w-4 h-4" />
        내 정보 수정
      </button>
    </div>
  );
}
