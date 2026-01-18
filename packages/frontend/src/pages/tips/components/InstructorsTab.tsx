/**
 * InstructorsTab
 * 인강 강사 가이드 탭 컴포넌트
 */

import { ChevronDown, ChevronUp, Lightbulb, Sparkles } from 'lucide-react';
import { type Instructor, type SubjectTips } from '../../../data/instructors';
import { subjects } from '../constants';

interface InstructorsTabProps {
  selectedSubject: string;
  instructors: Instructor[];
  subjectTips: SubjectTips[];
  expandedId: string | null;
  onSubjectChange: (subject: string) => void;
  onToggle: (id: string) => void;
}

export function InstructorsTab({
  selectedSubject, instructors, subjectTips, expandedId,
  onSubjectChange, onToggle,
}: InstructorsTabProps) {
  return (
    <div className="space-y-6">
      {/* 과목 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {subjects.map(subject => (
          <button
            key={subject}
            onClick={() => onSubjectChange(subject)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              selectedSubject === subject
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {subject === 'all' ? '전체' : subject}
          </button>
        ))}
      </div>

      {/* 과목별 팁 */}
      {selectedSubject !== 'all' && subjectTips.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
          {subjectTips.map(tip => (
            <div key={tip.subject}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{tip.icon}</span>
                <span className="font-bold text-blue-800">{tip.subject}</span>
                <span className="text-blue-600 text-sm">{tip.description}</span>
              </div>
              <ul className="space-y-1">
                {tip.tips.map((t: string, i: number) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <Sparkles size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* 강사 목록 */}
      <div className="space-y-3">
        {instructors.map(instructor => (
          <InstructorCard
            key={instructor.id}
            instructor={instructor}
            isExpanded={expandedId === instructor.id}
            onToggle={() => onToggle(instructor.id)}
          />
        ))}
      </div>

      {/* 선택 팁 */}
      <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb size={20} className="text-amber-600" />
          <span className="font-bold text-amber-800">강사 선택 핵심 팁</span>
        </div>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-amber-500">1.</span>
            <span>맛보기(OT)보다 <b>실제 1강</b>을 들어보세요</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500">2.</span>
            <span>남이 좋다고 해도 <b>내 귀에 안 들리면</b> 소용없어요</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500">3.</span>
            <span>강사의 <b>모의고사 퀄리티</b>도 중요해요 (특히 과탐)</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// 강사 카드 서브 컴포넌트
function InstructorCard({
  instructor, isExpanded, onToggle,
}: {
  instructor: Instructor;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const tierColors = {
    standard: 'bg-blue-100 text-blue-700',
    skill: 'bg-purple-100 text-purple-700',
    concept: 'bg-green-100 text-green-700',
  };

  const tierLabels = {
    standard: '정석/안정성',
    skill: '스킬/문제풀이',
    concept: '개념/꼼꼼함',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
            {instructor.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-800">{instructor.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${tierColors[instructor.tier]}`}>
                {tierLabels[instructor.tier]}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{instructor.platform}</span>
              <span>•</span>
              <span>{instructor.subSubject || instructor.subject}</span>
            </div>
          </div>
        </div>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="flex flex-wrap gap-1 mt-3 mb-3">
            {instructor.keywords.map((kw, i) => (
              <span key={i} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                #{kw}
              </span>
            ))}
          </div>
          <p className="text-sm text-gray-700 mb-3">{instructor.description}</p>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-xs font-medium text-blue-700 mb-1">이런 학생에게 추천</div>
            <ul className="space-y-1">
              {instructor.recommendedFor.map((rec, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-blue-500">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
