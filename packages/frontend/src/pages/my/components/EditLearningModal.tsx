/**
 * EditLearningModal
 * 학습 프로필 수정 모달
 */

import type { ProfileData } from '../types';
import {
  SOCIAL_SUBJECTS, SCIENCE_SUBJECTS, PLATFORM_LABELS, FIXED_SUBJECTS, GRADES,
} from '../constants';

interface EditLearningModalProps {
  show: boolean;
  editProfile: ProfileData | null;
  isSaving: boolean;
  error: string | null;
  success: boolean;
  onProfileChange: (profile: ProfileData) => void;
  onGradeChange: (type: 'target' | 'current', subject: string, grade: number) => void;
  onTogglePlatform: (platformId: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function EditLearningModal({
  show, editProfile, isSaving, error, success,
  onProfileChange, onGradeChange, onTogglePlatform, onSave, onClose,
}: EditLearningModalProps) {
  if (!show || !editProfile) return null;

  const allSubjects = [
    ...FIXED_SUBJECTS,
    ...(editProfile.selectedTamgu1 ? [editProfile.selectedTamgu1] : []),
    ...(editProfile.selectedTamgu2 ? [editProfile.selectedTamgu2] : []),
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full my-4 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-4">
          <span className="text-4xl">📚</span>
          <h3 className="handwrite handwrite-lg text-[var(--ink-black)] mt-2">
            학습 프로필 수정
          </h3>
        </div>

        <div className="space-y-5">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-[var(--pencil-gray)] mb-1">나이</label>
              <input
                type="number"
                min={15}
                max={30}
                value={editProfile.age || ''}
                onChange={(e) => onProfileChange({ ...editProfile, age: parseInt(e.target.value) || null })}
                className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--pencil-gray)] mb-1">수험 년차</label>
              <select
                value={editProfile.examYear}
                onChange={(e) => onProfileChange({ ...editProfile, examYear: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400"
              >
                <option value={0}>현역 (고3)</option>
                <option value={1}>재수생</option>
                <option value={2}>삼수생</option>
                <option value={3}>그 이상</option>
              </select>
            </div>
          </div>

          {/* 목표 대학 */}
          <div>
            <label className="block text-sm text-[var(--pencil-gray)] mb-1">목표 대학</label>
            <input
              type="text"
              value={editProfile.targetUniversity}
              onChange={(e) => onProfileChange({ ...editProfile, targetUniversity: e.target.value })}
              placeholder="예: 서울대학교 경영학과"
              className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* 탐구 과목 선택 */}
          <div>
            <label className="block text-sm text-[var(--pencil-gray)] mb-2">탐구 과목 선택</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--pencil-gray)] mb-1">탐구 1</label>
                <select
                  value={editProfile.selectedTamgu1}
                  onChange={(e) => onProfileChange({ ...editProfile, selectedTamgu1: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400 text-sm"
                >
                  <option value="">선택하세요</option>
                  <optgroup label="사회탐구">
                    {SOCIAL_SUBJECTS.map(subj => (
                      <option key={subj} value={subj} disabled={subj === editProfile.selectedTamgu2}>{subj}</option>
                    ))}
                  </optgroup>
                  <optgroup label="과학탐구">
                    {SCIENCE_SUBJECTS.map(subj => (
                      <option key={subj} value={subj} disabled={subj === editProfile.selectedTamgu2}>{subj}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--pencil-gray)] mb-1">탐구 2</label>
                <select
                  value={editProfile.selectedTamgu2}
                  onChange={(e) => onProfileChange({ ...editProfile, selectedTamgu2: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--paper-lines)] rounded-lg focus:outline-none focus:border-blue-400 text-sm"
                >
                  <option value="">선택하세요</option>
                  <optgroup label="사회탐구">
                    {SOCIAL_SUBJECTS.map(subj => (
                      <option key={subj} value={subj} disabled={subj === editProfile.selectedTamgu1}>{subj}</option>
                    ))}
                  </optgroup>
                  <optgroup label="과학탐구">
                    {SCIENCE_SUBJECTS.map(subj => (
                      <option key={subj} value={subj} disabled={subj === editProfile.selectedTamgu1}>{subj}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>
          </div>

          {/* 현재 등급 */}
          <GradeSelector
            label="현재 등급"
            subjects={allSubjects}
            grades={editProfile.currentGrades}
            colorClass="bg-[var(--sticker-coral)]"
            onChange={(subject, grade) => onGradeChange('current', subject, grade)}
          />

          {/* 목표 등급 */}
          <GradeSelector
            label="목표 등급"
            subjects={allSubjects}
            grades={editProfile.targetGrades}
            colorClass="bg-[var(--sticker-mint)]"
            onChange={(subject, grade) => onGradeChange('target', subject, grade)}
          />

          {/* 인강 사이트 */}
          <div>
            <label className="block text-sm text-[var(--pencil-gray)] mb-2">구독 중인 인강 사이트</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PLATFORM_LABELS).map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onTogglePlatform(id)}
                  className={`px-2 py-2 border rounded-lg text-xs font-medium transition-all ${
                    editProfile.subscribedPlatforms.includes(id)
                      ? 'bg-[var(--highlight-blue)] border-[var(--ink-blue)] text-[var(--ink-blue)]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* 하루 순공 시간 */}
          <div>
            <label className="block text-sm text-[var(--pencil-gray)] mb-2">
              하루 순공 시간: <span className="font-bold text-[var(--ink-blue)]">{editProfile.dailyStudyHours}시간</span>
            </label>
            <input
              type="range"
              min={1}
              max={16}
              value={editProfile.dailyStudyHours}
              onChange={(e) => onProfileChange({ ...editProfile, dailyStudyHours: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          {success && <p className="text-sm text-green-500 text-center">✅ 저장되었어요!</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex-1 py-2 px-4 bg-[var(--sticker-mint)] hover:opacity-90 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 등급 선택 서브 컴포넌트
function GradeSelector({
  label, subjects, grades, colorClass, onChange,
}: {
  label: string;
  subjects: string[];
  grades: Record<string, number>;
  colorClass: string;
  onChange: (subject: string, grade: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm text-[var(--pencil-gray)] mb-2">{label}</label>
      <div className="space-y-2">
        {subjects.map(subject => (
          <div key={subject} className="flex items-center gap-2">
            <span className="w-20 text-xs text-[var(--pencil-gray)] truncate">{subject}</span>
            <div className="flex gap-1 flex-wrap">
              {GRADES.map(grade => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => onChange(subject, grade)}
                  className={`w-7 h-7 rounded-full text-xs font-medium transition-all ${
                    grades[subject] === grade
                      ? `${colorClass} text-white`
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
