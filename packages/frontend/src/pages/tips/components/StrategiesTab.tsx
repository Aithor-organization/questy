/**
 * StrategiesTab
 * 학습 전략 탭 컴포넌트
 */

import { ChevronDown, ChevronUp, BookOpen, Brain, GraduationCap, Home, Sparkles, Lightbulb } from 'lucide-react';
import { tipCategories, type StudyTip } from '../../../data/studyTips';
import type { CategoryType } from '../types';

interface StrategiesTabProps {
  selectedCategory: CategoryType;
  tips: StudyTip[];
  expandedId: string | null;
  onCategoryChange: (category: CategoryType) => void;
  onToggle: (id: string) => void;
}

export function StrategiesTab({
  selectedCategory, tips, expandedId,
  onCategoryChange, onToggle,
}: StrategiesTabProps) {
  return (
    <div className="space-y-6">
      {/* 카테고리 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => onCategoryChange('all')}
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
            onClick={() => onCategoryChange(key as CategoryType)}
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
        {tips.map(tip => (
          <TipCard
            key={tip.id}
            tip={tip}
            isExpanded={expandedId === tip.id}
            onToggle={() => onToggle(tip.id)}
          />
        ))}
      </div>
    </div>
  );
}

// 전략 카드 서브 컴포넌트
function TipCard({
  tip, isExpanded, onToggle,
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
          <p className="text-sm text-gray-600 mt-3 mb-3">{tip.description}</p>
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
