import { useState, useCallback } from 'react';

interface ImageData {
  base64: string;
  type: 'jpg' | 'png';
}

interface FormData {
  materialName: string;
  images: ImageData[];
  totalDays: number;
}

export interface DailyQuest {
  day: number;
  date: string;
  unitNumber: number;
  unitTitle: string;
  range: string;
  estimatedMinutes: number;
  tip?: string;
  // 상세 정보 (학습계획표에서 추출)
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

// 개별 플랜
export interface GeneratedPlan {
  planType: 'original' | 'custom';
  planName: string;
  description: string;
  dailyQuests: DailyQuest[];
  totalDays: number;
  totalEstimatedHours: number;
}

// 감지된 학습계획표 정보
interface DetectedStudyPlan {
  source: string;
  totalDays: number;
}

// API 응답 결과
export interface GenerateResult {
  materialName: string;
  hasOriginalPlan: boolean;
  detectedStudyPlan: DetectedStudyPlan | null;
  plans: GeneratedPlan[];
  recommendations?: Recommendation[];
  aiMessage?: string;
}

interface UseQuestGenerationReturn {
  generate: (data: FormData) => Promise<void>;
  result: GenerateResult | null;
  isLoading: boolean;
  error: string | null;
  reset: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useQuestGeneration(): UseQuestGenerationReturn {
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (data: FormData) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

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
        }),
      });

      const json = await response.json();

      if (!json.success) {
        throw new Error(json.error?.message || '퀘스트 생성에 실패했습니다');
      }

      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { generate, result, isLoading, error, reset };
}
