/**
 * AIReviewCard
 * AI 에이전트 커리큘럼 검증 결과 표시 카드
 */

import { useState } from 'react';
import type { CurriculumReviewResult } from '../../../types/curriculum';

// 점수 기반 색상 유틸리티
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-50 border-green-200';
  if (score >= 60) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'excellent': return '✅';
    case 'good': return '👍';
    case 'warning': return '⚠️';
    case 'critical': return '❌';
    default: return '•';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'excellent': return 'text-green-600 bg-green-50';
    case 'good': return 'text-blue-600 bg-blue-50';
    case 'warning': return 'text-yellow-600 bg-yellow-50';
    case 'critical': return 'text-red-600 bg-red-50';
    default: return 'text-gray-600 bg-gray-50';
  }
}

function getCategoryLabel(key: string): string {
  switch (key) {
    case 'feasibility': return '📊 실현 가능성';
    case 'balance': return '⚖️ 균형';
    case 'distribution': return '📚 과목 분배';
    default: return '✅ 완성도';
  }
}

function getCategoryShortLabel(key: string): string {
  switch (key) {
    case 'feasibility': return '실현성';
    case 'balance': return '균형';
    case 'distribution': return '분배';
    default: return '완성도';
  }
}

interface AIReviewCardProps {
  review: CurriculumReviewResult;
}

export function AIReviewCard({ review }: AIReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`notebook-card border ${getScoreBg(review.overallScore)} transition-all`}>
      {/* 헤더 (항상 표시) */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${getScoreColor(review.overallScore)} bg-white border-2`}>
              {review.overallScore}
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                🤖 AI 커리큘럼 검증
                {review.isApproved ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">승인</span>
                ) : (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">조정 권장</span>
                )}
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">{review.summary}</p>
            </div>
          </div>
          <button className="text-gray-400 hover:text-gray-600 transition-colors">
            {isExpanded ? '▲' : '▼'}
          </button>
        </div>

        {/* 카테고리 점수 바 (간략 표시) */}
        {!isExpanded && (
          <div className="flex gap-2 mt-3">
            {Object.entries(review.categories).map(([key, cat]) => (
              <div
                key={key}
                className={`flex-1 text-center py-1 px-2 rounded text-xs ${getStatusColor(cat.status)}`}
              >
                {getStatusIcon(cat.status)} {getCategoryShortLabel(key)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 상세 내용 (펼쳤을 때만 표시) */}
      {isExpanded && <AIReviewDetails review={review} />}
    </div>
  );
}

function AIReviewDetails({ review }: { review: CurriculumReviewResult }) {
  return (
    <div className="px-4 pb-4 space-y-4 border-t border-gray-200 pt-4">
      {/* 카테고리별 상세 점수 */}
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(review.categories).map(([key, cat]) => (
          <div key={key} className={`p-3 rounded-lg ${getStatusColor(cat.status)}`}>
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-sm">{getCategoryLabel(key)}</span>
              <span className="font-bold">{cat.score}</span>
            </div>
            <p className="text-xs opacity-80">{cat.message}</p>
          </div>
        ))}
      </div>

      {/* 좋은 점 */}
      {review.highlights.length > 0 && (
        <ReviewSection
          title="✨ 좋은 점"
          items={review.highlights}
          bgColor="bg-green-50"
          textColor="text-green-700"
          titleColor="text-green-800"
        />
      )}

      {/* 우려 사항 */}
      {review.concerns.length > 0 && (
        <ReviewSection
          title="⚠️ 주의 사항"
          items={review.concerns}
          bgColor="bg-amber-50"
          textColor="text-amber-700"
          titleColor="text-amber-800"
        />
      )}

      {/* 개선 제안 */}
      {review.suggestions.length > 0 && (
        <ReviewSection
          title="💡 개선 제안"
          items={review.suggestions}
          bgColor="bg-blue-50"
          textColor="text-blue-700"
          titleColor="text-blue-800"
        />
      )}
    </div>
  );
}

function ReviewSection({
  title,
  items,
  bgColor,
  textColor,
  titleColor,
}: {
  title: string;
  items: string[];
  bgColor: string;
  textColor: string;
  titleColor: string;
}) {
  return (
    <div className={`${bgColor} rounded-lg p-3`}>
      <h4 className={`text-sm font-medium ${titleColor} mb-2`}>{title}</h4>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className={`text-xs ${textColor} flex items-start gap-2`}>
            <span>•</span><span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
