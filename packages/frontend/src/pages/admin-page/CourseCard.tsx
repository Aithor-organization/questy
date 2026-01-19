/**
 * Admin Page - Course Card Component
 * 강좌 카드 컴포넌트
 */

import { useState } from 'react';
import { RefreshCw, CheckCircle, Clock, Pencil, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { isOutdated, type Course } from './types';

interface CourseCardProps {
  course: Course;
  onUpdate: () => void;
  onEdit?: () => void;
  onDelete?: () => Promise<boolean>;
  updateResult: number | null;
  loading: boolean;
  showTeacher?: boolean;
}

export function CourseCard({
  course,
  onUpdate,
  onEdit,
  onDelete,
  updateResult,
  loading,
  showTeacher = false,
}: CourseCardProps) {
  const outdated = isOutdated(course.lastCrawledAt);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    const success = await onDelete();
    setDeleting(false);
    if (success) {
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className={`bg-white border rounded-xl p-4 shadow-sm ${outdated && !course.isCompleted ? 'border-orange-300' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800">{course.name}</h3>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
            {showTeacher && course.teacher && (
              <span className="text-blue-600 font-medium">{course.teacher}</span>
            )}
            <span>{course.platform}</span>
            {course.subject && <span>• {course.subject}</span>}
            <span>• {course.lectureCount}강</span>
            {course.isCompleted && (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle size={14} />
                완강
              </span>
            )}
            {outdated && !course.isCompleted && (
              <span className="text-orange-600 flex items-center gap-1">
                <Clock size={14} />
                업데이트 필요
              </span>
            )}
          </div>
          {course.lastCrawledAt && (
            <p className="text-xs text-gray-400 mt-1">
              마지막 업데이트: {new Date(course.lastCrawledAt).toLocaleDateString('ko-KR')}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 업데이트 결과 표시 */}
          {updateResult !== null && (
            <span
              className={`text-sm font-medium ${
                updateResult > 0 ? 'text-green-600' : 'text-gray-500'
              }`}
            >
              {updateResult > 0 ? `+${updateResult}강` : '변동 없음'}
            </span>
          )}

          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
              title="강좌 정보 수정"
            >
              <Pencil size={14} />
              수정
            </button>
          )}

          {onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
              title="강좌 삭제"
            >
              <Trash2 size={14} />
            </button>
          )}

          <button
            onClick={onUpdate}
            disabled={loading || !course.url}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            업데이트
          </button>
        </div>
      </div>

      {/* 강의 목록 (축약) */}
      {course.chapters.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 mb-2">최근 강의</p>
          <div className="space-y-1">
            {course.chapters.slice(-3).map((ch, idx) => (
              <div key={idx} className="text-sm text-gray-600 flex justify-between">
                <span className="truncate flex-1">{ch.title}</span>
                {ch.duration && (
                  <span className="text-gray-400 ml-2">{ch.duration}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold">강좌 삭제 확인</h3>
            </div>
            <p className="text-gray-700 mb-4">
              <strong>{course.name}</strong> 강좌를 삭제하시겠습니까?
              <br />
              <span className="text-sm text-gray-500">이 작업은 되돌릴 수 없습니다.</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 size={18} className="animate-spin" />}
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
