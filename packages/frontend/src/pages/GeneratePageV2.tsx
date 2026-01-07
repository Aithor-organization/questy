/**
 * GeneratePageV2
 * 퀘스트 생성 페이지 - 노트북 스타일 + YES24 검색
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotebookLayout, NotebookPage, ImageUploadZone } from '../components/notebook';
import { BookSearch } from '../components/BookSearch';
import { useQuestGeneration } from '../hooks/useQuestGeneration';
import type { GeneratedPlan } from '../hooks/useQuestGeneration';
import { useQuestStore } from '../stores/questStore';
import { API_BASE_URL } from '../config';

interface ImageData {
  base64: string;
  type: 'jpg' | 'png';
  preview: string;
}

interface BookMetadata {
  subject?: string;
  targetGrade?: string;
  bookType?: string;
  category?: string;
  description?: string;
}

interface Yes24Book {
  productId: string;
  title: string;
  author: string;
  publisher: string;
  previewUrl: string;
  thumbnailUrl: string;
  metadata?: BookMetadata;
}

interface PreviewImage {
  pageNumber: number;
  imageUrl: string;
}

type InputMode = 'upload' | 'search';

export function GeneratePageV2() {
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
  const [step, setStep] = useState<'upload' | 'result'>('upload');

  // YES24 검색 관련 상태
  const [selectedBook, setSelectedBook] = useState<Yes24Book | null>(null);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<PreviewImage | null>(null);
  const [analyzingBook, setAnalyzingBook] = useState(false);

  // 책 선택 시 미리보기 로드
  const handleBookSelect = async (book: Yes24Book) => {
    setSelectedBook(book);
    setMaterialName(book.title);
    setSelectedPages([]);

    setLoadingPreview(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/books/${book.productId}/preview`,
        {
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        }
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
            {
              headers: {
                'ngrok-skip-browser-warning': 'true',
              },
            }
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

  return (
    <NotebookLayout>
      {step === 'upload' ? (
        <>
          {/* 업로드 폼 */}
          <NotebookPage title="✨ 새 퀘스트 만들기" decoration="holes">
            {/* 입력 모드 탭 */}
            <div className="flex gap-2 p-1 bg-[var(--paper-lines)] rounded-xl mb-6">
              <button
                type="button"
                onClick={() => setInputMode('upload')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${inputMode === 'upload'
                  ? 'bg-white text-[var(--ink-blue)] shadow-sm'
                  : 'text-[var(--pencil-gray)] hover:text-[var(--ink-black)]'
                  }`}
              >
                📷 사진 업로드
              </button>
              <button
                type="button"
                onClick={() => setInputMode('search')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${inputMode === 'search'
                  ? 'bg-white text-[var(--ink-blue)] shadow-sm'
                  : 'text-[var(--pencil-gray)] hover:text-[var(--ink-black)]'
                  }`}
              >
                🔍 교재 검색
              </button>
            </div>

            {inputMode === 'upload' ? (
              <>
                {/* 교재 이름 */}
                <div className="mb-6">
                  <label className="block text-sm text-[var(--pencil-gray)] mb-2">
                    교재 이름
                  </label>
                  <input
                    type="text"
                    value={materialName}
                    onChange={(e) => setMaterialName(e.target.value)}
                    placeholder="예: 수학의 정석, 영어 독해 기본"
                    className="w-full px-4 py-3 bg-[var(--paper-cream)] border-b-2 border-[var(--paper-lines)] focus:border-[var(--ink-blue)] outline-none transition-colors handwrite text-lg"
                  />
                </div>

                {/* 이미지 업로드 */}
                <div className="mb-6">
                  <label className="block text-sm text-[var(--pencil-gray)] mb-2">
                    📷 목차 사진
                  </label>
                  <ImageUploadZone
                    images={images}
                    onImagesChange={setImages}
                    maxImages={4}
                  />
                </div>
              </>
            ) : (
              <>
                {/* YES24 교재 검색 */}
                <div className="mb-6">
                  <label className="block text-sm text-[var(--pencil-gray)] mb-2">
                    Yes24에서 교재 검색
                  </label>
                  <BookSearch onSelectBook={handleBookSelect} />
                </div>

                {/* 선택된 교재 정보 */}
                {selectedBook && (
                  <div className="p-4 bg-[var(--highlight-blue)] rounded-xl mb-6">
                    <div className="flex items-center gap-3">
                      <img
                        src={selectedBook.thumbnailUrl}
                        alt={selectedBook.title}
                        className="w-12 h-16 object-cover rounded shadow"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-[var(--ink-black)] truncate">
                          {selectedBook.title}
                        </h4>
                        {selectedBook.metadata?.subject && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-white rounded text-xs text-[var(--ink-blue)]">
                            {selectedBook.metadata.subject}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 미리보기 로딩 */}
                {loadingPreview && (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin text-2xl">🔄</div>
                    <p className="text-sm text-[var(--pencil-gray)] mt-2">
                      미리보기 로드 중...
                    </p>
                  </div>
                )}

                {/* 미리보기 이미지 선택 */}
                {previewImages.length > 0 && !loadingPreview && (
                  <div className="mb-6">
                    <label className="block text-sm text-[var(--pencil-gray)] mb-2">
                      📄 목차 페이지 선택
                      <span className="ml-2 px-2 py-0.5 bg-[var(--highlight-yellow)] rounded text-xs">
                        {selectedPages.length}/5
                      </span>
                    </label>
                    <p className="text-xs text-[var(--pencil-gray)] mb-3">
                      클릭하면 크게 볼 수 있어요 (최대 5장)
                    </p>
                    <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto p-1">
                      {previewImages.map((img) => (
                        <button
                          key={img.pageNumber}
                          type="button"
                          onClick={() => setZoomedImage(img)}
                          className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all ${selectedPages.includes(img.pageNumber)
                            ? 'border-[var(--ink-blue)] ring-2 ring-[var(--highlight-blue)]'
                            : 'border-[var(--paper-lines)] hover:border-[var(--pencil-gray)]'
                            }`}
                        >
                          <img
                            src={img.imageUrl}
                            alt={`${img.pageNumber}페이지`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-0.5 text-center">
                            {img.pageNumber}
                          </span>
                          {selectedPages.includes(img.pageNumber) && (
                            <div className="absolute top-1 right-1 w-5 h-5 bg-[var(--ink-blue)] rounded-full flex items-center justify-center">
                              <span className="text-white text-xs">✓</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 이미지 확대 모달 */}
                {zoomedImage && (
                  <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                    onClick={() => setZoomedImage(null)}
                  >
                    <div
                      className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between p-4 border-b">
                        <span className="font-medium text-[var(--ink-black)]">
                          {zoomedImage.pageNumber}페이지
                        </span>
                        <button
                          type="button"
                          onClick={() => setZoomedImage(null)}
                          className="text-[var(--pencil-gray)] hover:text-[var(--ink-black)]"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="p-4 overflow-auto max-h-[60vh]">
                        <img
                          src={zoomedImage.imageUrl}
                          alt={`${zoomedImage.pageNumber}페이지`}
                          className="w-full h-auto"
                        />
                      </div>

                      <div className="p-4 border-t flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            togglePageSelection(zoomedImage.pageNumber);
                            const currentIndex = previewImages.findIndex(
                              (img) => img.pageNumber === zoomedImage.pageNumber
                            );
                            if (currentIndex < previewImages.length - 1) {
                              setZoomedImage(previewImages[currentIndex + 1]);
                            }
                          }}
                          className={`flex-1 py-3 rounded-xl font-medium transition-colors ${selectedPages.includes(zoomedImage.pageNumber)
                            ? 'bg-[var(--highlight-pink)] text-[var(--ink-red)]'
                            : 'bg-[var(--ink-blue)] text-white'
                            }`}
                        >
                          {selectedPages.includes(zoomedImage.pageNumber)
                            ? '선택 해제'
                            : '📌 목차로 선택'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setZoomedImage(null)}
                          className="px-6 py-3 border border-[var(--paper-lines)] rounded-xl text-[var(--pencil-gray)] hover:bg-[var(--paper-cream)]"
                        >
                          닫기
                        </button>
                      </div>

                      <div className="px-4 pb-4 flex justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            const currentIndex = previewImages.findIndex(
                              (img) => img.pageNumber === zoomedImage.pageNumber
                            );
                            if (currentIndex > 0) {
                              setZoomedImage(previewImages[currentIndex - 1]);
                            }
                          }}
                          disabled={zoomedImage.pageNumber === previewImages[0]?.pageNumber}
                          className="text-sm text-[var(--ink-blue)] hover:underline disabled:text-[var(--paper-lines)]"
                        >
                          ← 이전
                        </button>
                        <span className="text-sm text-[var(--pencil-gray)]">
                          {zoomedImage.pageNumber} / {previewImages.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const currentIndex = previewImages.findIndex(
                              (img) => img.pageNumber === zoomedImage.pageNumber
                            );
                            if (currentIndex < previewImages.length - 1) {
                              setZoomedImage(previewImages[currentIndex + 1]);
                            }
                          }}
                          disabled={
                            zoomedImage.pageNumber ===
                            previewImages[previewImages.length - 1]?.pageNumber
                          }
                          className="text-sm text-[var(--ink-blue)] hover:underline disabled:text-[var(--paper-lines)]"
                        >
                          다음 →
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 목표 일수 */}
            <div className="mb-6">
              <label className="block text-sm text-[var(--pencil-gray)] mb-2">
                목표 일수
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="7"
                  max="90"
                  value={totalDays}
                  onChange={(e) => setTotalDays(Number(e.target.value))}
                  className="flex-1 h-2 bg-[var(--paper-lines)] rounded-lg appearance-none cursor-pointer"
                />
                <div className="sticker sticker-gold">
                  {totalDays}일
                </div>
              </div>
              <div className="flex justify-between text-xs text-[var(--pencil-gray)] mt-1">
                <span>빠르게 (7일)</span>
                <span>여유롭게 (90일)</span>
              </div>

              {/* 주말 미포함 체크박스 */}
              <div className="mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeWeekends}
                    onChange={(e) => setExcludeWeekends(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--paper-lines)] text-[var(--ink-blue)] focus:ring-[var(--ink-blue)]"
                  />
                  <span className="text-sm text-[var(--ink-black)]">
                    📅 주말 미포함
                  </span>
                </label>

                {/* 주말 미포함 경고 문구 */}
                {excludeWeekends && (
                  <div className="mt-2 p-3 bg-[var(--highlight-yellow)] rounded-lg">
                    <p className="text-xs text-[var(--ink-black)]">
                      ⚠️ <strong>주의:</strong> 스케줄을 못 끝내고 하루가 지나갈 경우에 주말에도 퀘스트가 생성될 수 있습니다.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 에러 */}
            {error && (
              <div className="postit text-sm text-[var(--ink-red)] mb-4">
                ⚠️ {error}
              </div>
            )}

            {/* 생성 버튼 */}
            {inputMode === 'upload' ? (
              <button
                onClick={handleGenerate}
                disabled={images.length === 0 || isLoading}
                className={`w-full py-4 rounded-lg handwrite text-xl transition-all ${images.length === 0
                  ? 'bg-[var(--paper-lines)] text-[var(--pencil-gray)] cursor-not-allowed'
                  : 'bg-[var(--ink-blue)] text-white hover:shadow-lg'
                  }`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">🔄</span>
                    AI가 분석 중...
                  </span>
                ) : (
                  '🚀 퀘스트 생성하기'
                )}
              </button>
            ) : (
              <button
                onClick={handleAnalyzeBook}
                disabled={!selectedBook || selectedPages.length === 0 || isLoading || analyzingBook}
                className={`w-full py-4 rounded-lg handwrite text-xl transition-all ${!selectedBook || selectedPages.length === 0
                  ? 'bg-[var(--paper-lines)] text-[var(--pencil-gray)] cursor-not-allowed'
                  : 'bg-[var(--ink-blue)] text-white hover:shadow-lg'
                  }`}
              >
                {isLoading || analyzingBook ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">🔄</span>
                    AI가 분석 중...
                  </span>
                ) : (
                  '🚀 퀘스트 생성하기'
                )}
              </button>
            )}
          </NotebookPage>

          {/* 안내 포스트잇 */}
          <div className="postit mt-6 mx-auto max-w-xs">
            <p className="handwrite text-lg mb-2">💡 Tip</p>
            {inputMode === 'upload' ? (
              <ul className="text-sm space-y-1 text-[var(--pencil-gray)]">
                <li>• 목차 전체가 보이게 촬영해요</li>
                <li>• 여러 페이지면 모두 올려도 OK!</li>
                <li>• AI가 자동으로 분석해요</li>
              </ul>
            ) : (
              <ul className="text-sm space-y-1 text-[var(--pencil-gray)]">
                <li>• Yes24에서 교재를 검색해요</li>
                <li>• 미리보기에서 목차를 선택해요</li>
                <li>• 최대 5페이지까지 선택 가능!</li>
              </ul>
            )}
          </div>
        </>
      ) : (
        <>
          {/* 결과 화면 */}
          {result && (
            <NotebookPage title="🎉 퀘스트 완성!" decoration="tape">
              {/* AI 메시지 */}
              {result.aiMessage && (
                <div className="postit mb-6">
                  <p className="text-sm">💬 {result.aiMessage}</p>
                </div>
              )}

              {/* 생성된 플랜들 */}
              <div className="space-y-4">
                {result.plans.map((plan, index) => (
                  <div
                    key={index}
                    className="notebook-page p-4 cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => handleSavePlan(plan)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="handwrite text-xl text-[var(--ink-black)]">
                        {plan.planName}
                      </h3>
                      <span className="sticker sticker-mint">
                        {plan.totalDays}일
                      </span>
                    </div>
                    <p className="text-sm text-[var(--pencil-gray)] mb-3">
                      {plan.description}
                    </p>
                    <div className="flex items-center justify-between text-xs text-[var(--pencil-gray)]">
                      <span>📚 {plan.dailyQuests.length}개 퀘스트</span>
                      <span>⏱ 약 {plan.totalEstimatedHours}시간</span>
                    </div>

                    {/* 미리보기 */}
                    <div className="mt-4 p-3 bg-[var(--paper-cream)] rounded-lg">
                      <p className="text-xs text-[var(--pencil-gray)] mb-2">미리보기</p>
                      {plan.dailyQuests.slice(0, 3).map((quest, qIndex) => (
                        <div key={qIndex} className="flex items-center gap-2 text-sm">
                          <span className="w-5 h-5 rounded border border-[var(--paper-lines)] flex-shrink-0" />
                          <span className="truncate">
                            Day {quest.day}: {quest.unitTitle}
                          </span>
                        </div>
                      ))}
                      {plan.dailyQuests.length > 3 && (
                        <p className="text-xs text-[var(--pencil-gray)] mt-1">
                          +{plan.dailyQuests.length - 3}개 더...
                        </p>
                      )}
                    </div>

                    <button className="w-full mt-4 py-2 bg-[var(--ink-blue)] text-white rounded-lg text-sm hover:bg-opacity-90 transition-colors">
                      이 플랜 선택하기
                    </button>
                  </div>
                ))}
              </div>

              {/* 다시 만들기 */}
              <button
                onClick={handleReset}
                className="w-full mt-4 py-3 text-[var(--ink-blue)] hover:underline text-sm"
              >
                ← 다시 만들기
              </button>
            </NotebookPage>
          )}
        </>
      )}
    </NotebookLayout>
  );
}
