/**
 * useGeneratePage Hook
 * 퀘스트 생성 페이지 상태 관리 및 비즈니스 로직
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuestGeneration } from '../../hooks/useQuestGeneration';
import type { GeneratedPlan } from '../../hooks/useQuestGeneration';
import { useQuestStore } from '../../stores/questStore';
import { API_BASE_URL } from '../../config';
import type { Yes24Book, PreviewImage } from '@questybook/shared';
import type { ImageData, InputMode, GenerateStep } from './types';

export function useGeneratePage() {
  const navigate = useNavigate();
  const { generate, result, isLoading, error, reset } = useQuestGeneration();
  const { addPlan } = useQuestStore();

  // 입력 모드
  const [inputMode, setInputMode] = useState<InputMode>('upload');

  // 폼 상태
  const [images, setImages] = useState<ImageData[]>([]);
  const [materialName, setMaterialName] = useState('');
  const [totalDays, setTotalDays] = useState(30);
  const [excludeWeekends, setExcludeWeekends] = useState(false);
  const [step, setStep] = useState<GenerateStep>('upload');

  // YES24 검색 관련 상태
  const [selectedBook, setSelectedBook] = useState<Yes24Book | null>(null);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<PreviewImage | null>(null);
  const [analyzingBook, setAnalyzingBook] = useState(false);

  // 플랜 상세 보기 상태
  const [viewingPlan, setViewingPlan] = useState<GeneratedPlan | null>(null);

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
          totalDays,
          bookProductId: selectedBook.productId,
          bookMetadata: selectedBook.metadata,
          excludeWeekends,
          startDate: excludeWeekends ? new Date().toISOString().split('T')[0] : undefined,
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
      totalDays,
      excludeWeekends,
      startDate: excludeWeekends ? new Date().toISOString().split('T')[0] : undefined,
    });

    setStep('result');
  };

  // 플랜 저장
  const handleSavePlan = (plan: GeneratedPlan) => {
    if (!result) return;

    const totalMinutes = plan.dailyQuests.reduce((sum, q) => sum + q.estimatedMinutes, 0);
    const questUnits = new Set(plan.dailyQuests.map(q => q.unitNumber));

    addPlan({
      materialName: result.materialName,
      dailyQuests: plan.dailyQuests,
      summary: {
        totalDays: plan.totalDays,
        totalUnits: questUnits.size,
        averageMinutesPerDay: Math.round(totalMinutes / plan.totalDays),
        totalEstimatedHours: plan.totalEstimatedHours,
      },
      recommendations: result.recommendations,
      aiMessage: result.aiMessage,
    });

    navigate('/');
  };

  // 리셋
  const handleReset = () => {
    setImages([]);
    setMaterialName('');
    setTotalDays(30);
    setExcludeWeekends(false);
    setStep('upload');
    setSelectedBook(null);
    setPreviewImages([]);
    setSelectedPages([]);
    reset();
  };

  return {
    // 상태
    inputMode,
    images,
    materialName,
    totalDays,
    excludeWeekends,
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
    // 액션
    setInputMode,
    setImages,
    setMaterialName,
    setTotalDays,
    setExcludeWeekends,
    setZoomedImage,
    setViewingPlan,
    handleBookSelect,
    togglePageSelection,
    handleAnalyzeBook,
    handleGenerate,
    handleSavePlan,
    handleReset,
  };
}
