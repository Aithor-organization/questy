/**
 * useGeneratePage Hook
 * 퀘스트 생성 페이지 상태 관리 및 비즈니스 로직
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuestGeneration } from '../../hooks/useQuestGeneration';
import type { GeneratedPlan, GenerateResult } from '../../hooks/useQuestGeneration';
import { useQuestStore } from '../../stores/questStore';
import { API_BASE_URL } from '../../config';
import { DAY_TO_JS_DAY, type Yes24Book, type PreviewImage, type DayOfWeek } from '@questybook/shared';
import type { ImageData, InputMode, GenerateStep } from './types';
import type { ManualUnit } from './components';
import {
  savePendingPlan,
  getPendingPlan,
  clearPendingPlan,
  getPendingPlanTimeRemaining,
  formatTimeRemaining,
} from '../../lib/plan-generation-storage';

export function useGeneratePage() {
  const navigate = useNavigate();
  const { generate, result, isLoading, error, reset, remainingGenerations } = useQuestGeneration();
  const { addPlan } = useQuestStore();

  // 입력 모드
  const [inputMode, setInputMode] = useState<InputMode>('upload');

  // 미적용 플랜 상태
  const [pendingPlanData, setPendingPlanData] = useState<{
    result: GenerateResult;
    totalDays: number;
    selectedDays: DayOfWeek[];
    timeRemaining: string;
  } | null>(null);

  // 폼 상태
  const [images, setImages] = useState<ImageData[]>([]);
  const [materialName, setMaterialName] = useState('');
  const [totalDays, setTotalDays] = useState(30);
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([]); // 기본값: 선택 없음 (사용자가 직접 선택)
  const [scheduleMode, setScheduleMode] = useState<'manual' | 'ai'>('ai');
  const [step, setStep] = useState<GenerateStep>('upload');

  // YES24 검색 관련 상태
  const [selectedBook, setSelectedBook] = useState<Yes24Book | null>(null);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<PreviewImage | null>(null);
  const [analyzingBook, setAnalyzingBook] = useState(false);

  // 직접 만들기 관련 상태
  const [manualUnits, setManualUnits] = useState<ManualUnit[]>([]);
  const [isRepeatMode, setIsRepeatMode] = useState(false);
  const [repeatTargetDate, setRepeatTargetDate] = useState('');

  // 플랜 상세 보기 상태
  const [viewingPlan, setViewingPlan] = useState<GeneratedPlan | null>(null);

  // 미적용 플랜 로드 (컴포넌트 마운트 시)
  useEffect(() => {
    const loadPendingPlan = () => {
      const pending = getPendingPlan();
      if (pending) {
        const timeRemaining = formatTimeRemaining(getPendingPlanTimeRemaining());
        setPendingPlanData({
          result: pending.result,
          totalDays: pending.totalDays,
          selectedDays: pending.selectedDays || [],
          timeRemaining,
        });
      }
    };

    loadPendingPlan();

    // 1분마다 남은 시간 업데이트
    const interval = setInterval(() => {
      const pending = getPendingPlan();
      if (pending) {
        const timeRemaining = formatTimeRemaining(getPendingPlanTimeRemaining());
        setPendingPlanData(prev => prev ? { ...prev, timeRemaining } : null);
      } else {
        setPendingPlanData(null);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // 플랜 생성 완료 시 localStorage에 저장
  useEffect(() => {
    if (result && result.plans.length > 0) {
      savePendingPlan(result, totalDays, selectedDays);
      // 새 결과가 생기면 pending 상태 업데이트
      setPendingPlanData({
        result,
        totalDays,
        selectedDays,
        timeRemaining: formatTimeRemaining(getPendingPlanTimeRemaining()),
      });
    }
  }, [result, totalDays, selectedDays]);

  // 미적용 플랜 적용하기 (결과 화면으로 이동)
  const handleApplyPendingPlan = useCallback(() => {
    if (pendingPlanData) {
      // 저장된 selectedDays 복원 (중요: 날짜 계산에 사용됨)
      if (pendingPlanData.selectedDays && pendingPlanData.selectedDays.length > 0) {
        setSelectedDays(pendingPlanData.selectedDays);
      }
      // 플랜 상세 모달 열기
      if (pendingPlanData.result.plans.length > 0) {
        setViewingPlan(pendingPlanData.result.plans[0]);
      }
    }
  }, [pendingPlanData]);

  // 미적용 플랜 삭제
  const handleDismissPendingPlan = useCallback(() => {
    clearPendingPlan();
    setPendingPlanData(null);
  }, []);

  // 책 선택 시 미리보기 로드
  const handleBookSelect = async (book: Yes24Book) => {
    setSelectedBook(book);
    setMaterialName(book.title);
    setSelectedPages([]);

    setLoadingPreview(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/books/${book.productId}/preview`,
        { headers: { 'ngrok-skip-browser-warning': 'true' } }
      );
      const data = await res.json();
      if (data.success && data.data.images.length > 0) {
        setPreviewImages(data.data.images);
      } else {
        setPreviewImages([]);
      }
    } catch {
      setPreviewImages([]);
    } finally {
      setLoadingPreview(false);
    }
  };

  // 페이지 선택 토글
  const togglePageSelection = (pageNumber: number) => {
    setSelectedPages(prev => {
      if (prev.includes(pageNumber)) {
        return prev.filter(p => p !== pageNumber);
      }
      if (prev.length >= 5) {
        return prev;
      }
      return [...prev, pageNumber].sort((a, b) => a - b);
    });
  };

  // YES24 책 분석 및 퀘스트 생성
  const handleAnalyzeBook = async () => {
    if (!selectedBook || selectedPages.length === 0) return;

    setAnalyzingBook(true);
    try {
      const selectedImages = previewImages.filter(img =>
        selectedPages.includes(img.pageNumber)
      );

      const imagePromises = selectedImages.map(async (img) => {
        try {
          const proxyRes = await fetch(
            `${API_BASE_URL}/api/books/proxy-image?url=${encodeURIComponent(img.imageUrl)}`,
            { headers: { 'ngrok-skip-browser-warning': 'true' } }
          );
          const proxyData = await proxyRes.json();

          if (proxyData.success) {
            return {
              base64: proxyData.data.base64,
              type: 'jpg' as const,
              preview: img.imageUrl,
            };
          }
          return null;
        } catch {
          return null;
        }
      });

      const loadedImages = (await Promise.all(imagePromises)).filter(Boolean) as ImageData[];

      if (loadedImages.length > 0) {
        setImages(loadedImages);
        await generate({
          materialName: selectedBook.title,
          images: loadedImages.map(img => ({ base64: img.base64, type: img.type })),
          totalDays: scheduleMode === 'ai' ? 0 : totalDays, // AI 모드면 0 전송 (백엔드에서 추천)
          bookProductId: selectedBook.productId,
          bookMetadata: selectedBook.metadata,
          selectedDays,
          scheduleMode,
          startDate: new Date().toISOString().split('T')[0],
        });
        setStep('result');
      }
    } catch (err) {
      console.error('책 분석 오류:', err);
    } finally {
      setAnalyzingBook(false);
    }
  };

  // 이미지 업로드 모드에서 생성
  const handleGenerate = async () => {
    if (images.length === 0) return;

    await generate({
      materialName: materialName || '학습 교재',
      images: images.map(img => ({ base64: img.base64, type: img.type })),
      totalDays: scheduleMode === 'ai' ? 0 : totalDays, // AI 모드면 0 전송 (백엔드에서 추천)
      selectedDays,
      scheduleMode,
      startDate: new Date().toISOString().split('T')[0],
    });

    setStep('result');
  };

  // 직접 만들기 모드에서 플랜 생성 (To-do 스타일)
  const handleManualGenerate = () => {
    if (manualUnits.length === 0 || !materialName.trim()) return;

    // 선택된 요일을 JS Day 값으로 변환 (0=일, 1=월, ..., 6=토)
    const allowedJsDays = selectedDays.map(d => DAY_TO_JS_DAY[d]).sort((a, b) => a - b);

    // 요일이 선택되지 않으면 매일로 처리
    const effectiveDays = allowedJsDays.length > 0 ? allowedJsDays : [0, 1, 2, 3, 4, 5, 6];

    // 다음 유효한 날짜 찾기
    const getNextValidDate = (fromDate: Date, skipFirst: boolean = false): Date => {
      const result = new Date(fromDate);
      if (skipFirst) {
        result.setDate(result.getDate() + 1);
      }
      // 선택된 요일이 나올 때까지 날짜 증가
      while (!effectiveDays.includes(result.getDay())) {
        result.setDate(result.getDate() + 1);
      }
      return result;
    };

    let dailyQuests: any[] = [];

    if (isRepeatMode && repeatTargetDate) {
      // 반복 모드: 목표 날짜까지 퀘스트를 매일 반복
      const targetDate = new Date(repeatTargetDate);
      targetDate.setHours(23, 59, 59, 999);

      let currentDate = getNextValidDate(new Date(), false);
      let dayCount = 0;

      while (currentDate <= targetDate) {
        // 각 날짜에 모든 퀘스트를 배치
        manualUnits.forEach((unit, unitIndex) => {
          dailyQuests.push({
            id: crypto.randomUUID(),
            day: dayCount + 1,
            date: currentDate.toISOString().split('T')[0],
            unitNumber: unitIndex + 1,
            unitTitle: unit.title,
            range: unit.description || unit.title,
            estimatedMinutes: 30,
            completed: false,
            topics: [unit.title],
            objectives: [`${unit.title} 완료`],
            studyTips: {
              importance: '일반',
              keyPoints: [unit.title],
              studyMethod: '반복 할 일',
            },
          });
        });

        dayCount++;
        currentDate = getNextValidDate(currentDate, true);
      }
    } else {
      // 일반 모드: 퀘스트를 순차적으로 배치
      let currentDate = getNextValidDate(new Date(), false);
      dailyQuests = manualUnits.map((unit, index) => {
        const questDate = index === 0 ? currentDate : getNextValidDate(currentDate, true);
        currentDate = questDate;

        return {
          id: unit.id,
          day: index + 1,
          date: questDate.toISOString().split('T')[0],
          unitNumber: index + 1,
          unitTitle: unit.title,
          range: unit.description || unit.title,
          estimatedMinutes: 30,
          completed: false,
          topics: [unit.title],
          objectives: [`${unit.title} 완료`],
          studyTips: {
            importance: '일반',
            keyPoints: [unit.title],
            studyMethod: '할 일',
          },
        };
      });
    }

    const actualDays = new Set(dailyQuests.map(q => q.date)).size;
    const totalQuests = dailyQuests.length;

    // questStore에 직접 추가
    addPlan({
      materialName: materialName.trim(),
      dailyQuests,
      summary: {
        totalDays: actualDays,
        totalUnits: totalQuests,
        averageMinutesPerDay: Math.round((totalQuests * 30) / actualDays),
        totalEstimatedHours: Math.round((totalQuests * 30) / 60),
      },
      aiMessage: isRepeatMode
        ? `${manualUnits.length}개의 퀘스트가 ${actualDays}일간 반복 생성되었습니다. (총 ${totalQuests}개)`
        : `${totalQuests}개의 퀘스트가 생성되었습니다.`,
    });

    // 플래너 페이지로 이동
    navigate('/planner');
  };

  // 플랜 저장
  const handleSavePlan = (plan: GeneratedPlan) => {
    // result가 없어도 pendingPlanData에서 가져올 수 있음
    const sourceResult = result || pendingPlanData?.result;
    if (!sourceResult) return;

    const totalMinutes = plan.dailyQuests.reduce((sum, q) => sum + q.estimatedMinutes, 0);
    const questUnits = new Set(plan.dailyQuests.map(q => q.unitNumber));

    // 각 퀘스트에 고유 ID 부여 (백엔드에서 ID를 제공하지 않을 경우)
    const questsWithIds = plan.dailyQuests.map(quest => ({
      ...quest,
      id: quest.id || crypto.randomUUID(),
    }));

    addPlan({
      materialName: sourceResult.materialName,
      dailyQuests: questsWithIds,
      summary: {
        totalDays: plan.totalDays,
        totalUnits: questUnits.size,
        averageMinutesPerDay: Math.round(totalMinutes / plan.totalDays),
        totalEstimatedHours: plan.totalEstimatedHours,
      },
      recommendations: sourceResult.recommendations,
      aiMessage: sourceResult.aiMessage,
    });

    // 저장 시 미적용 플랜 삭제
    clearPendingPlan();
    setPendingPlanData(null);

    navigate('/');
  };

  // 리셋
  const handleReset = () => {
    setImages([]);
    setMaterialName('');
    setTotalDays(30);
    setSelectedDays([]);
    setScheduleMode('ai');
    setStep('upload');
    setSelectedBook(null);
    setPreviewImages([]);
    setSelectedPages([]);
    setManualUnits([]);
    setIsRepeatMode(false);
    setRepeatTargetDate('');
    reset();
  };

  return {
    // 상태
    inputMode,
    images,
    materialName,
    totalDays,
    selectedDays,
    scheduleMode,
    step,
    selectedBook,
    previewImages,
    selectedPages,
    loadingPreview,
    zoomedImage,
    analyzingBook,
    viewingPlan,
    result,
    isLoading,
    error,
    // 직접 만들기
    manualUnits,
    isRepeatMode,
    repeatTargetDate,
    // 생성 제한 및 미적용 플랜
    remainingGenerations,
    pendingPlanData,
    // 액션
    setInputMode,
    setImages,
    setMaterialName,
    setTotalDays,
    setSelectedDays,
    setScheduleMode,
    setZoomedImage,
    setViewingPlan,
    setManualUnits,
    setIsRepeatMode,
    setRepeatTargetDate,
    handleBookSelect,
    togglePageSelection,
    handleAnalyzeBook,
    handleGenerate,
    handleManualGenerate,
    handleSavePlan,
    handleReset,
    handleApplyPendingPlan,
    handleDismissPendingPlan,
  };
}
