import { useState, useCallback } from 'react';
import type { BookMetadata } from '@questybook/shared';

interface ImageData {
  base64: string;
  type: 'jpg' | 'png';
}

interface FormData {
  materialName: string;
  images: ImageData[];
  totalDays: number;
  bookMetadata?: BookMetadata;
  bookProductId?: string;
  excludeWeekends?: boolean;
  startDate?: string; // ISO date string (YYYY-MM-DD)
}

export interface DailyQuest {
  day: number;
  date: string;
  unitNumber: number;
  unitTitle: string;
  range: string;
  estimatedMinutes: number;
  tip?: string;
  topics?: string[];
  pages?: string;
  objectives?: string[];
}

export interface Recommendation {
  suggestedDays: number;
  reason: string;
  intensity: 'relaxed' | 'normal' | 'intensive';
  dailyStudyMinutes: number;
}

export interface GeneratedPlan {
  planType: 'original' | 'custom';
  planName: string;
  description: string;
  dailyQuests: DailyQuest[];
  totalDays: number;
  totalEstimatedHours: number;
}

interface DetectedStudyPlan {
  source: string;
  totalDays: number;
}

// 분석된 단원 정보 (재생성에 필요)
export interface AnalyzedUnit {
  unitNumber: number;
  unitTitle: string;
  subSections: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

// 플랜 리뷰 결과
export interface PlanReview {
  overallScore: number;
  overallComment: string;
  strengths: string[];
  improvements: string[];
  balanceAnalysis: {
    timeBalance: string;
    difficultyProgression: string;
    restDaysAdvice: string;
  };
  motivationalTips: string[];
  expertAdvice: string;
}

export interface GenerateResult {
  materialName: string;
  hasOriginalPlan: boolean;
  detectedStudyPlan: DetectedStudyPlan | null;
  plans: GeneratedPlan[];
  recommendations?: Recommendation[];
  aiMessage?: string;
  analyzedUnits?: AnalyzedUnit[];
}

interface UseQuestGenerationReturn {
  generate: (data: FormData) => Promise<void>;
  regenerate: (targetDays: number) => Promise<void>;
  reviewPlan: (plan: GeneratedPlan) => Promise<PlanReview | null>;
  result: GenerateResult | null;
  isLoading: boolean;
  isRegenerating: boolean;
  isReviewing: boolean;
  review: PlanReview | null;
  error: string | null;
  reset: () => void;
}

import { API_BASE_URL } from '../config';

const API_URL = API_BASE_URL;

export function useQuestGeneration(): UseQuestGenerationReturn {
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [review, setReview] = useState<PlanReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (data: FormData) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setReview(null);

    // 🧪 MVP 모드: 백엔드 없이 목업 데이터 반환
    const isMvpMode = false; // MVP 모드 비활성화 - 진짜 AI 사용

    if (isMvpMode) {
      setTimeout(() => {
        const mockPlan: GeneratedPlan = {
          planType: 'original',
          planName: '30일 수능 완성 플랜',
          description: 'AI가 분석한 최적의 학습 로드맵입니다.',
          totalDays: data.totalDays,
          totalEstimatedHours: 45,
          dailyQuests: Array.from({ length: data.totalDays }, (_, i) => ({
            day: i + 1,
            date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
            unitNumber: (i % 5) + 1,
            unitTitle: `단원 ${Math.floor(i / 5) + 1}: 핵심 개념 정리`,
            range: `${i * 10 + 1}p ~ ${i * 10 + 10}p`,
            estimatedMinutes: 90,
            tip: '오늘은 개념 이해에 집중하세요!',
            objectives: ['기본 공식 암기', '예제 문제 풀이'],
          })),
        };

        const mockResult: GenerateResult = {
          materialName: data.materialName,
          hasOriginalPlan: true,
          detectedStudyPlan: { source: 'index_analysis', totalDays: 30 },
          plans: [mockPlan],
          aiMessage: '교재 분석이 완료되었습니다! 완벽한 플랜을 준비했어요. 🎉',
          analyzedUnits: [],
        };

        setResult(mockResult);
        setIsLoading(false);
      }, 2000); // 2초 딜레이
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialName: data.materialName,
          images: data.images.map(img => ({
            base64: img.base64,
            type: img.type,
          })),
          totalDays: data.totalDays,
          bookMetadata: data.bookMetadata,
          excludeWeekends: data.excludeWeekends,
          startDate: data.startDate,
        }),
      });

      const json = await response.json();

      if (!json.success) {
        throw new Error(json.error?.message || '퀘스트 생성에 실패했습니다');
      }

      const resultData = json.data as GenerateResult;
      setResult(resultData);
      setIsLoading(false);

      // 플랜 생성 완료 후 자동으로 첫 번째 플랜 리뷰 시작
      if (resultData.plans.length > 0) {
        setIsReviewing(true);
        try {
          const reviewResponse = await fetch(`${API_URL}/api/generate/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              materialName: resultData.materialName,
              planName: resultData.plans[0].planName,
              dailyQuests: resultData.plans[0].dailyQuests,
              totalDays: resultData.plans[0].totalDays,
              totalEstimatedHours: resultData.plans[0].totalEstimatedHours,
            }),
          });

          const reviewJson = await reviewResponse.json();
          if (reviewJson.success) {
            setReview(reviewJson.data);
          }
        } catch {
          // 리뷰 실패는 무시 (사용자가 수동으로 다시 시도 가능)
        } finally {
          setIsReviewing(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
      setIsLoading(false);
    }
  }, []);

  // 새 일수로 플랜 재생성 (이미지 분석 없이 빠르게)
  const regenerate = useCallback(async (targetDays: number) => {
    if (!result?.analyzedUnits || !result.materialName) return;

    setIsRegenerating(true);
    setError(null);
    setReview(null);

    try {
      const response = await fetch(`${API_URL}/api/generate/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialName: result.materialName,
          analyzedUnits: result.analyzedUnits,
          targetDays,
        }),
      });

      const json = await response.json();

      if (!json.success) {
        throw new Error(json.error?.message || '플랜 재생성에 실패했습니다');
      }

      const newPlan = json.data.plan as GeneratedPlan;

      // 새 플랜을 plans 배열에 추가/교체
      setResult(prev => prev ? {
        ...prev,
        plans: [newPlan],
        recommendations: json.data.recommendations,
        aiMessage: json.data.aiMessage,
      } : null);
      setIsRegenerating(false);

      // 재생성 완료 후 자동으로 리뷰 시작
      setIsReviewing(true);
      try {
        const reviewResponse = await fetch(`${API_URL}/api/generate/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            materialName: result.materialName,
            planName: newPlan.planName,
            dailyQuests: newPlan.dailyQuests,
            totalDays: newPlan.totalDays,
            totalEstimatedHours: newPlan.totalEstimatedHours,
          }),
        });

        const reviewJson = await reviewResponse.json();
        if (reviewJson.success) {
          setReview(reviewJson.data);
        }
      } catch {
        // 리뷰 실패는 무시 (사용자가 수동으로 다시 시도 가능)
      } finally {
        setIsReviewing(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
      setIsRegenerating(false);
    }
  }, [result]);

  // AI 전문가 플랜 리뷰
  const reviewPlan = useCallback(async (plan: GeneratedPlan): Promise<PlanReview | null> => {
    if (!result?.materialName) return null;

    setIsReviewing(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/generate/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialName: result.materialName,
          planName: plan.planName,
          dailyQuests: plan.dailyQuests,
          totalDays: plan.totalDays,
          totalEstimatedHours: plan.totalEstimatedHours,
        }),
      });

      const json = await response.json();

      if (!json.success) {
        throw new Error(json.error?.message || '플랜 리뷰에 실패했습니다');
      }

      setReview(json.data);
      return json.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
      return null;
    } finally {
      setIsReviewing(false);
    }
  }, [result]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setReview(null);
    setIsLoading(false);
    setIsRegenerating(false);
    setIsReviewing(false);
  }, []);

  return {
    generate,
    regenerate,
    reviewPlan,
    result,
    isLoading,
    isRegenerating,
    isReviewing,
    review,
    error,
    reset,
  };
}
