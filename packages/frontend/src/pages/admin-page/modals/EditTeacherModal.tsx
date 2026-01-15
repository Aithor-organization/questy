/**
 * Admin Page - Edit Teacher Modal
 * 강사 수정 모달
 */

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Teacher } from '../types';

interface EditTeacherModalProps {
  onClose: () => void;
  onEdit: (oldName: string, newData: { name?: string; subject?: string; platform?: string }) => Promise<boolean>;
  teacher: Teacher;
  loading: boolean;
}

export function EditTeacherModal({
  onClose,
  onEdit,
  teacher,
  loading,
}: EditTeacherModalProps) {
  const [name, setName] = useState(teacher.name);
  const [platform, setPlatform] = useState(teacher.platform || 'megastudy');
  const [subject, setSubject] = useState(teacher.subjects[0] || '');

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

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            저장
          </button>
        </form>
      </div>
    </div>
  );
}
