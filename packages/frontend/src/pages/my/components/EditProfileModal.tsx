/**
 * EditProfileModal
 * 기본 정보 수정 모달
 */

interface EditProfileModalProps {
  show: boolean;
  editName: string;
  editPassword: string;
  editPasswordConfirm: string;
  isUpdating: boolean;
  updateError: string | null;
  updateSuccess: boolean;
  onNameChange: (name: string) => void;
  onPasswordChange: (password: string) => void;
  onPasswordConfirmChange: (confirm: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function EditProfileModal({
  show, editName, editPassword, editPasswordConfirm, isUpdating,
  updateError, updateSuccess, onNameChange, onPasswordChange,
  onPasswordConfirmChange, onSave, onClose,
}: EditProfileModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full">
        <div className="text-center mb-4">
          <span className="text-4xl">✏️</span>
          <h3 className="handwrite handwrite-lg text-[var(--ink-black)] mt-2">
            내 정보 수정
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--pencil-gray)] mb-1">이름</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400 handwrite"
              placeholder="이름을 입력하세요"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--pencil-gray)] mb-1">새 비밀번호 (선택)</label>
            <input
              type="password"
              value={editPassword}
              onChange={(e) => onPasswordChange(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400 handwrite"
              placeholder="변경할 비밀번호 (6자 이상)"
            />
          </div>

          {editPassword && (
            <div>
              <label className="block text-sm text-[var(--pencil-gray)] mb-1">비밀번호 확인</label>
              <input
                type="password"
                value={editPasswordConfirm}
                onChange={(e) => onPasswordConfirmChange(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400 handwrite"
                placeholder="비밀번호를 다시 입력하세요"
              />
            </div>
          )}

          {updateError && <p className="text-sm text-red-500 text-center">{updateError}</p>}
          {updateSuccess && <p className="text-sm text-green-500 text-center">✅ 정보가 수정되었어요!</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isUpdating}
            className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors handwrite disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onSave}
            disabled={isUpdating}
            className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors handwrite disabled:opacity-50"
          >
            {isUpdating ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
