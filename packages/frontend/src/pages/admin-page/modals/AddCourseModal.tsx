/**
 * Admin Page - Add Course Modal
 * 강좌 추가 모달 (단일/다중 URL 지원)
 */

import { useState } from 'react';
import { X, Loader2, Plus, Trash2, CheckCircle, XCircle } from 'lucide-react';
import type { Teacher, Course } from '../types';

interface BatchProgress {
  total: number;
  completed: number;
  success: number;
  failed: number;
  current?: { url: string; success: boolean; name?: string; error?: string };
}

interface AddCourseModalProps {
  onClose: () => void;
  onAdd: (url: string, teacher?: string, subject?: string) => Promise<Course | null>;
  onAddBatch?: (
    urls: string[],
    onProgress?: (progress: BatchProgress) => void
  ) => Promise<{ success: number; failed: number; results: any[] }>;
  teachers: Teacher[];
  loading: boolean;
}

export function AddCourseModal({
  onClose,
  onAdd,
  onAddBatch,
  teachers,
  loading,
}: AddCourseModalProps) {
  const [urls, setUrls] = useState<string[]>(['']);
  const [teacher, setTeacher] = useState('');
  const [subject, setSubject] = useState('');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

  // URL 입력창 추가
  const addUrlInput = () => {
    setUrls([...urls, '']);
    if (urls.length === 1) {
      setIsBatchMode(true);
    }
  };

  // URL 입력창 제거
  const removeUrlInput = (index: number) => {
    const newUrls = urls.filter((_, i) => i !== index);
    setUrls(newUrls.length === 0 ? [''] : newUrls);
    if (newUrls.length <= 1) {
      setIsBatchMode(false);
    }
  };

  // URL 값 변경
  const updateUrl = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  // 유효한 URL 개수
  const validUrlCount = urls.filter(url => url.trim()).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validUrls = urls.filter(url => url.trim());
    if (validUrls.length === 0) return;

    // 단일 URL인 경우 기존 방식 사용
    if (validUrls.length === 1 && !isBatchMode) {
      const result = await onAdd(validUrls[0].trim(), teacher || undefined, subject || undefined);
      if (result) onClose();
      return;
    }

    // 다중 URL인 경우 배치 처리
    if (onAddBatch) {
      setIsProcessing(true);
      setProgress({ total: validUrls.length, completed: 0, success: 0, failed: 0 });

      const result = await onAddBatch(validUrls, (p) => {
        setProgress(p);
      });

      setIsProcessing(false);

      // 모든 작업 완료 후 결과 표시
      if (result.success > 0) {
        // 성공한 항목이 있으면 약간의 딜레이 후 닫기
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    }
  };

  const isLoading = loading || isProcessing;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            강좌 추가 {validUrlCount > 1 && `(${validUrlCount}개)`}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg"
            disabled={isProcessing}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* URL 입력 영역 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              강좌 URL *
            </label>

            <div className="space-y-2">
              {urls.map((url, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => updateUrl(index, e.target.value)}
                    placeholder="https://www.megastudy.net/teacher/..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isProcessing}
                  />
                  {urls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeUrlInput(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      disabled={isProcessing}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* URL 추가 버튼 */}
            <button
              type="button"
              onClick={addUrlInput}
              className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              disabled={isProcessing}
            >
              <Plus size={16} />
              URL 추가
            </button>

            <p className="text-xs text-gray-500 mt-1">
              메가스터디/대성마이맥 강좌 페이지 URL을 입력하세요
            </p>
          </div>

          {/* 단일 URL일 때만 강사/과목 선택 표시 */}
          {!isBatchMode && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  강사 (선택)
                </label>
                <select
                  value={teacher}
                  onChange={(e) => handleTeacherChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isProcessing}
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
                  disabled={isProcessing}
                />
              </div>
            </>
          )}

          {/* 다중 URL일 때 안내 메시지 */}
          {isBatchMode && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                여러 강좌를 추가할 때는 강사/과목이 자동으로 감지됩니다.
              </p>
            </div>
          )}

          {/* 진행 상황 표시 */}
          {progress && (
            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">진행 상황</span>
                <span className="font-medium">
                  {progress.completed} / {progress.total}
                </span>
              </div>

              {/* 프로그레스 바 */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                />
              </div>

              {/* 성공/실패 카운트 */}
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle size={14} />
                  성공: {progress.success}
                </span>
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle size={14} />
                  실패: {progress.failed}
                </span>
              </div>

              {/* 현재 처리 중인 항목 */}
              {progress.current && (
                <div className={`text-xs p-2 rounded ${
                  progress.current.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {progress.current.success ? (
                    <span>✓ {progress.current.name || progress.current.url}</span>
                  ) : (
                    <span>✗ {progress.current.error || '실패'}</span>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || validUrlCount === 0}
            className="w-full py-2.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 size={18} className="animate-spin" />}
            {isProcessing
              ? `처리 중... (${progress?.completed || 0}/${progress?.total || validUrlCount})`
              : validUrlCount > 1
                ? `${validUrlCount}개 강좌 가져오기`
                : '강좌 가져오기'
            }
          </button>
        </form>
      </div>
    </div>
  );
}
