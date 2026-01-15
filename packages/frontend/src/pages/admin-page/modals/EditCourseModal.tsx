/**
 * Admin Page - Edit Course Modal
 * 강좌 수정 모달
 */

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Teacher, Course } from '../types';

interface EditCourseModalProps {
  onClose: () => void;
  onEdit: (courseId: string, data: {
    name?: string;
    teacher?: string;
    subject?: string;
    platform?: string;
    isCompleted?: boolean;
  }) => Promise<Course | null>;
  course: Course;
  teachers: Teacher[];
  loading: boolean;
}

export function EditCourseModal({
  onClose,
  onEdit,
  course,
  teachers,
  loading,
}: EditCourseModalProps) {
  const [name, setName] = useState(course.name);
  const [teacher, setTeacher] = useState(course.teacher);
  const [subject, setSubject] = useState(course.subject || '');
  const [platform, setPlatform] = useState(course.platform || 'megastudy');
  const [isCompleted, setIsCompleted] = useState(course.isCompleted || false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const result = await onEdit(course.id, {
      name: name.trim(),
      teacher,
      subject: subject || undefined,
      platform,
      isCompleted,
    });
    if (result) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">강좌 정보 수정</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              강좌명 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="강좌명 입력"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              강사
            </label>
            <select
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {teachers.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
              <option value={teacher}>{teacher} (현재)</option>
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

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isCompleted"
              checked={isCompleted}
              onChange={(e) => setIsCompleted(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="isCompleted" className="text-sm text-gray-700">
              완강 처리 (업데이트 알림 제외)
            </label>
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
