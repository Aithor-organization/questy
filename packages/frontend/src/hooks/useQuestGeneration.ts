import { useState, useCallback } from 'react';

interface ImageData {
  base64: string;
  type: 'jpg' | 'png';
}

// 교재 메타데이터 (수능 학습용)
interface BookMetadata {
  subject?: string;
  targetGrade?: string;
  bookType?: string;
  category?: string;
  description?: string;
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
