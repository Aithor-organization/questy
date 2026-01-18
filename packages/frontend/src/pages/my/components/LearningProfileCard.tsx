/**
 * LearningProfileCard
 * 학습 프로필 카드
 */

import { BookOpen, GraduationCap, Target, Pencil } from 'lucide-react';
import type { ProfileData } from '../types';
import { EXAM_YEAR_LABELS, PLATFORM_LABELS, FIXED_SUBJECTS } from '../constants';

interface LearningProfileCardProps {
  profile: ProfileData | null;
  isLoading: boolean;
  onEdit: () => void;
}

export function LearningProfileCard({ profile, isLoading, onEdit }: LearningProfileCardProps) {
  const getSelectedSubjects = (p: ProfileData): string[] => {
    const subjects: string[] = [...FIXED_SUBJECTS];
    if (p.selectedTamgu1) subjects.push(p.selectedTamgu1);
    if (p.selectedTamgu2) subjects.push(p.selectedTamgu2);
    return subjects;
  };

  return (
    <div className="bg-white/10 rounded-lg p-6 mb-6 border border-[var(--paper-lines)]">
      <h2 className="handwrite handwrite-lg text-[var(--ink-black)] mb-4 flex items-center gap-2">
        <BookOpen className="w-5 h-5" /> 학습 프로필
      </h2>

      {isLoading ? (
        <div className="text-center py-4 text-[var(--pencil-gray)]">로딩 중...</div>
      ) : profile ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-dashed border-[var(--paper-lines)]">
            <GraduationCap className="w-6 h-6 text-[var(--pencil-gray)]" />
            <div>
              <div className="text-xs text-[var(--pencil-gray)]">나이 / 수험 년차</div>
              <div className="handwrite text-[var(--ink-black)]">
                {profile.age}세 / {EXAM_YEAR_LABELS[profile.examYear] || '현역'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pb-3 border-b border-dashed border-[var(--paper-lines)]">
            <Target className="w-6 h-6 text-[var(--pencil-gray)]" />
            <div>
              <div className="text-xs text-[var(--pencil-gray)]">목표 대학</div>
              <div className="handwrite text-[var(--ink-black)]">
                {profile.targetUniversity || '미설정'}
              </div>
            </div>
          </div>

          <div className="pb-3 border-b border-dashed border-[var(--paper-lines)]">
            <div className="text-xs text-[var(--pencil-gray)] mb-1">선택 탐구 과목</div>
            <div className="flex gap-2 flex-wrap">
              {profile.selectedTamgu1 && (
                <span className="px-2 py-1 bg-[var(--highlight-blue)] text-[var(--ink-blue)] rounded text-sm">
                  {profile.selectedTamgu1}
                </span>
              )}
              {profile.selectedTamgu2 && (
                <span className="px-2 py-1 bg-[var(--highlight-green)] text-[var(--sticker-mint)] rounded text-sm">
                  {profile.selectedTamgu2}
                </span>
              )}
            </div>
          </div>

          <div className="pb-3 border-b border-dashed border-[var(--paper-lines)]">
            <div className="text-xs text-[var(--pencil-gray)] mb-2">등급 현황</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {getSelectedSubjects(profile).slice(0, 4).map(subject => (
                <div key={subject} className="flex justify-between">
                  <span className="text-[var(--pencil-gray)]">{subject}</span>
                  <span className="handwrite">
                    <span className="text-[var(--sticker-coral)]">{profile.currentGrades[subject] || '-'}</span>
                    <span className="text-[var(--pencil-gray)] mx-1">→</span>
                    <span className="text-[var(--sticker-mint)]">{profile.targetGrades[subject] || '-'}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs text-[var(--pencil-gray)] mb-1">학습 환경</div>
            <div className="text-sm text-[var(--ink-black)]">
              <span className="handwrite">하루 {profile.dailyStudyHours}시간</span>
              {profile.subscribedPlatforms.length > 0 && (
                <span className="text-[var(--pencil-gray)]">
                  {' '}· {profile.subscribedPlatforms.map(p => PLATFORM_LABELS[p] || p).join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-[var(--pencil-gray)]">학습 프로필이 없습니다</div>
      )}

      <button
        onClick={onEdit}
        className="w-full mt-4 py-2 px-4 bg-[var(--highlight-green)] hover:opacity-80 text-[var(--sticker-mint)] rounded-lg border border-[var(--sticker-mint)]/30 transition-colors flex items-center justify-center gap-2"
      >
        <Pencil className="w-4 h-4" />
        {profile ? '학습 프로필 수정' : '학습 프로필 설정'}
      </button>
    </div>
  );
}
