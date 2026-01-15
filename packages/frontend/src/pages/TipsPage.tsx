/**
 * TipsPage - 학습 꿀팁 페이지
 * 인강 강사 선택 가이드 + 학습 전략 팁
 */

import { useState } from 'react';
import {
  Lightbulb,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Target,
  BookOpen,
  Brain,
  Home,
  Sparkles,
} from 'lucide-react';
import { NotebookLayout } from '../components/notebook';
import {
  allInstructors,
  subjectTips,
  type Instructor,
} from '../data/instructors';
import {
  studyTips,
  tipCategories,
  type StudyTip,
} from '../data/studyTips';

type TabType = 'instructors' | 'strategies' | 'appguide';
type CategoryType = 'all' | 'planning' | 'method' | 'subject' | 'lifestyle' | 'mental';

// QuestyBook 앱 사용 가이드 데이터
const appGuides = [
  {
    id: 'chat-coach',
    icon: '💬',
    title: 'AI 코치와 대화하기',
    description: '학습 상담부터 일정 관리까지 코치에게 물어보세요',
    tips: [
      '"오늘 뭐 공부해?" - 오늘의 학습 일정 확인',
      '"이번 주 일정 어떻게 돼?" - 주간 계획 조회',
      '"공부하기 싫어" - 동기부여 및 상담',
      '"수학 진도 조정해줘" - 학습 플랜 수정',
    ],
  },
  {
    id: 'create-plan',
    icon: '📸',
    title: '학습 플랜 만들기',
    description: '교재 목차 사진만 찍으면 AI가 맞춤 플랜을 생성해요',
    tips: [
      '교재 목차 페이지를 깔끔하게 촬영하세요',
      '목차가 선명하게 보이도록 밝은 곳에서 촬영',
      '완료 예정일을 알려주면 일정에 맞춰 분배',
      '하루 학습 가능 시간도 말해주면 더 정확해요',
    ],
  },
  {
    id: 'quest-complete',
    icon: '✅',
    title: '퀘스트 완료하기',
    description: '매일 퀘스트를 완료하고 연속 학습일을 쌓아보세요',
    tips: [
      '완료한 퀘스트는 체크박스를 눌러 표시하세요',
      '연속 7일 완료 시 특별 배지 획득!',
      '저녁에 리뷰 버튼으로 하루를 정리해보세요',
      '힘들면 "공부가 힘들어요" 버튼으로 도움 요청',
    ],
  },
  {
    id: 'report-check',
    icon: '📊',
    title: '학습 리포트 활용',
    description: '주간 통계로 나의 학습 패턴을 파악하세요',
    tips: [
      '연속 학습일(🔥)을 7일 이상 유지하면 습관 형성',
      '완료율 70% 이상이면 적절한 학습량이에요',
      '배지를 모으며 성취감을 느껴보세요',
      '코치의 피드백으로 동기부여를 받아요',
    ],
  },
  {
    id: 'tips-usage',
    icon: '💡',
    title: '꿀팁 페이지 활용',
    description: '인강 강사 추천과 검증된 학습 전략을 확인하세요',
    tips: [
      '과목별로 인기 강사 정보를 확인할 수 있어요',
      '상위권 학생들의 검증된 학습법을 배워보세요',
      '계획 수립, 학습 방법, 멘탈 관리 등 다양한 팁',
      '포모도로, 백지 복습 등 실천 가능한 방법론',
    ],
  },
];

export function TipsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('appguide');
  const [expandedInstructor, setExpandedInstructor] = useState<string | null>(null);
  const [expandedTip, setExpandedTip] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');

  // 필터링된 강사 목록
  const filteredInstructors = selectedSubject === 'all'
    ? allInstructors
    : allInstructors.filter(i => i.subject === selectedSubject);

  // 필터링된 전략 목록
  const filteredTips = selectedCategory === 'all'
    ? studyTips
    : studyTips.filter(t => t.category === selectedCategory);

  // 과목 목록
  const subjects = ['all', '수학', '국어', '영어', '사회탐구', '과학탐구'];

  return (
    <NotebookLayout>
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-full mb-3">
            <Lightbulb size={20} />
            <span className="font-medium">수험생 필독 꿀팁</span>
          </div>
          <p className="text-gray-600 text-sm">
            상위권 도약에 성공한 케이스들의 검증된 방법론
          </p>
        </div>

        {/* 탭 선택 */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('appguide')}
            className={`flex-1 py-3 px-3 rounded-xl font-medium transition-all min-w-fit ${
              activeTab === 'appguide'
                ? 'bg-amber-500 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <Sparkles size={18} />
              <span>앱 사용법</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('instructors')}
            className={`flex-1 py-3 px-3 rounded-xl font-medium transition-all min-w-fit ${
              activeTab === 'instructors'
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <GraduationCap size={18} />
              <span>강사 가이드</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('strategies')}
            className={`flex-1 py-3 px-3 rounded-xl font-medium transition-all min-w-fit ${
              activeTab === 'strategies'
                ? 'bg-green-500 text-white shadow-lg'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <Target size={18} />
              <span>학습 전략</span>
            </div>
          </button>
        </div>

        {/* 앱 사용법 탭 */}
        {activeTab === 'appguide' && (
          <div className="space-y-4">
            {/* 앱 소개 */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">📓</span>
                <span className="font-bold text-amber-800">QuestyBook이란?</span>
              </div>
              <p className="text-sm text-gray-700">
                AI 학습 코치와 함께하는 스마트 학습 앱이에요.
                교재 목차만 찍으면 맞춤 학습 플랜을 만들어주고,
                매일 퀘스트 형태로 학습을 관리해줘요!
              </p>
            </div>

            {/* 가이드 카드들 */}
            {appGuides.map((guide) => (
              <div
                key={guide.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-2xl">
                      {guide.icon}
                    </div>
                    <div>
                      <div className="font-bold text-gray-800">{guide.title}</div>
                      <div className="text-sm text-gray-500">{guide.description}</div>
                    </div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3">
                    <ul className="space-y-2">
                      {guide.tips.map((tip, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-amber-500">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}

            {/* 추가 팁 */}
            <div className="postit">
              <p className="handwrite text-lg mb-2">💡 더 알면 좋은 것들</p>
              <ul className="text-sm space-y-1 text-[var(--pencil-gray)]">
                <li>• 구글 계정으로 간편 로그인 가능해요</li>
                <li>• 데이터는 자동으로 저장되니 걱정 마세요</li>
                <li>• 힘들 때는 코치에게 솔직하게 말해도 돼요</li>
                <li>• 꿀팁 탭에서 강사 추천도 확인해보세요!</li>
              </ul>
            </div>
          </div>
        )}

        {/* 인강 강사 가이드 탭 */}
        {activeTab === 'instructors' && (
          <div className="space-y-6">
            {/* 과목 필터 */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {subjects.map(subject => (
                <button
                  key={subject}
                  onClick={() => setSelectedSubject(subject)}
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
            {selectedSubject !== 'all' && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                {subjectTips.filter(s => s.subject === selectedSubject).map(tip => (
                  <div key={tip.subject}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{tip.icon}</span>
                      <span className="font-bold text-blue-800">{tip.subject}</span>
                      <span className="text-blue-600 text-sm">{tip.description}</span>
                    </div>
                    <ul className="space-y-1">
                      {tip.tips.map((t, i) => (
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
              {filteredInstructors.map(instructor => (
                <InstructorCard
                  key={instructor.id}
                  instructor={instructor}
                  isExpanded={expandedInstructor === instructor.id}
                  onToggle={() => setExpandedInstructor(
                    expandedInstructor === instructor.id ? null : instructor.id
                  )}
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
        )}

        {/* 학습 전략 탭 */}
        {activeTab === 'strategies' && (
          <div className="space-y-6">
            {/* 카테고리 필터 */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                전체
              </button>
              {Object.entries(tipCategories).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key as CategoryType)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                    selectedCategory === key
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>{value.icon}</span>
                  <span>{value.label}</span>
                </button>
              ))}
            </div>

            {/* 전략 목록 */}
            <div className="space-y-3">
              {filteredTips.map(tip => (
                <TipCard
                  key={tip.id}
                  tip={tip}
                  isExpanded={expandedTip === tip.id}
                  onToggle={() => setExpandedTip(
                    expandedTip === tip.id ? null : tip.id
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </NotebookLayout>
  );
}

// 강사 카드 컴포넌트
function InstructorCard({
  instructor,
  isExpanded,
  onToggle,
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
          {/* 키워드 */}
          <div className="flex flex-wrap gap-1 mt-3 mb-3">
            {instructor.keywords.map((kw, i) => (
              <span key={i} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                #{kw}
              </span>
            ))}
          </div>

          {/* 설명 */}
          <p className="text-sm text-gray-700 mb-3">{instructor.description}</p>

          {/* 추천 대상 */}
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

// 전략 카드 컴포넌트
function TipCard({
  tip,
  isExpanded,
  onToggle,
}: {
  tip: StudyTip;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const categoryInfo = tipCategories[tip.category];

  const categoryIcons = {
    planning: <BookOpen size={18} />,
    method: <Brain size={18} />,
    subject: <GraduationCap size={18} />,
    lifestyle: <Home size={18} />,
    mental: <Sparkles size={18} />,
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center text-white text-xl">
            {tip.icon}
          </div>
          <div>
            <div className="font-bold text-gray-800">{tip.title}</div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                {categoryIcons[tip.category]}
                {categoryInfo.label}
              </span>
            </div>
          </div>
        </div>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          {/* 설명 */}
          <p className="text-sm text-gray-600 mt-3 mb-3">{tip.description}</p>

          {/* 상세 내용 */}
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <ul className="space-y-2">
              {tip.details.map((detail, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-green-500 font-bold">{i + 1}.</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 참고 사항 */}
          {tip.actionItems && tip.actionItems.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs font-medium text-blue-700 mb-2 flex items-center gap-1">
                <Lightbulb size={14} />
                참고하면 좋은 점
              </div>
              <ul className="space-y-1">
                {tip.actionItems.map((action, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-blue-500">•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TipsPage;
