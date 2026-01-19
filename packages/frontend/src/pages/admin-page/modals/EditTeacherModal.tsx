/**
 * Admin Page - Edit Teacher Modal
 * 강사 수정 모달
 */

import { useState } from 'react';
import { X, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import type { Teacher } from '../types';

interface EditTeacherModalProps {
  onClose: () => void;
  onEdit: (oldName: string, newData: { name?: string; subject?: string; platform?: string }) => Promise<boolean>;
  onDelete?: (teacherName: string) => Promise<boolean>;
  teacher: Teacher;
  loading: boolean;
}

export function EditTeacherModal({
  onClose,
  onEdit,
  onDelete,
  teacher,
  loading,
}: EditTeacherModalProps) {
  const [name, setName] = useState(teacher.name);
  const [platform, setPlatform] = useState(teacher.platform || 'megastudy');
  const [subject, setSubject] = useState(teacher.subjects[0] || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const success = await onEdit(teacher.name, {
      name: name.trim(),
      platform,
      subject: subject || undefined,
    });
    if (success) onClose();
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    const success = await onDelete(teacher.name);
    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">강사 정보 수정</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              강사명 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 현우진"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              플랫폼
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="megastudy">메가스터디</option>
              <option value="mimac">대성마이맥</option>
              <option value="etoos">이투스</option>
              <option value="ebsi">EBSi</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              과목
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="예: 수학"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              수정하면 이 강사의 모든 강좌 과목이 변경됩니다
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              저장
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
                className="px-4 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                title="강사 삭제"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </form>

        {/* 삭제 확인 다이얼로그 */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4 text-red-600">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-bold">강사 삭제 확인</h3>
              </div>
              <p className="text-gray-700 mb-2">
                <strong>{teacher.name}</strong> 강사를 삭제하시겠습니까?
              </p>
              <p className="text-sm text-red-600 mb-4 bg-red-50 p-2 rounded-lg">
                ⚠️ 이 강사의 모든 강좌 <strong>({teacher.courseCount}개)</strong>도 함께 삭제됩니다.
                이 작업은 되돌릴 수 없습니다.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={18} className="animate-spin" />}
                  삭제
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
