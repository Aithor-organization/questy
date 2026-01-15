/**
 * Admin Page - Add Course Modal
 * 강좌 추가 모달
 */

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Teacher, Course } from '../types';

interface AddCourseModalProps {
  onClose: () => void;
  onAdd: (url: string, teacher?: string, subject?: string) => Promise<Course | null>;
  teachers: Teacher[];
  loading: boolean;
}

export function AddCourseModal({
  onClose,
  onAdd,
  teachers,
  loading,
}: AddCourseModalProps) {
  const [url, setUrl] = useState('');
  const [teacher, setTeacher] = useState('');
  const [subject, setSubject] = useState('');

  // 강사 선택 시 해당 강사의 과목을 자동 설정
  const handleTeacherChange = (selectedTeacher: string) => {
    setTeacher(selectedTeacher);
    if (selectedTeacher) {
      const teacherData = teachers.find(t => t.name === selectedTeacher);
      if (teacherData && teacherData.subjects.length > 0) {
        setSubject(teacherData.subjects[0]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    const result = await onAdd(url.trim(), teacher || undefined, subject || undefined);
    if (result) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">강좌 추가</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              강좌 URL *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.megastudy.net/teacher/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              메가스터디 강좌 페이지 URL을 입력하세요
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              강사 (선택)
            </label>
            <select
              value={teacher}
              onChange={(e) => handleTeacherChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">크롤링으로 자동 감지</option>
              {teachers.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} {t.subjects.length > 0 ? `(${t.subjects[0]})` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              강사를 선택하면 해당 강사의 과목이 자동 설정됩니다
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              과목 {teacher ? '' : '(선택)'}
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="예: 수학"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="w-full py-2.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            강좌 가져오기
          </button>
        </form>
      </div>
    </div>
  );
}
