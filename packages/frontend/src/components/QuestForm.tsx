import { useState } from 'react';
import { ImageUploader } from './ImageUploader';
import { BookSearch } from './BookSearch';
import { API_BASE_URL } from '../config';
import type { BookMetadata, Yes24Book, PreviewImage } from '@questybook/shared';

interface ImageData {
  base64: string;
  type: 'jpg' | 'png';
  preview: string;
}

interface FormData {
  materialName: string;
  images: ImageData[];
  totalDays: number;
  bookProductId?: string; // Yes24 상품 ID (선택적)
  bookMetadata?: BookMetadata; // 교재 메타데이터 (수능 학습용)
}

interface QuestFormProps {
  onSubmit: (data: FormData) => void;
  isLoading: boolean;
}

type InputMode = 'upload' | 'search';

export function QuestForm({ onSubmit, isLoading }: QuestFormProps) {
  const [inputMode, setInputMode] = useState<InputMode>('upload');
  const [materialName, setMaterialName] = useState('');
  const [images, setImages] = useState<ImageData[]>([]);
  const [totalDays, setTotalDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<Yes24Book | null>(null);
  const [analyzingBook, setAnalyzingBook] = useState(false);

  // 미리보기 관련 상태
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<PreviewImage | null>(null);

  const handleBookSelect = async (book: Yes24Book) => {
    setSelectedBook(book);
    setMaterialName(book.title);
    setSelectedPages([]);

    // 미리보기 이미지 로드
    setLoadingPreview(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/books/${book.productId}/preview`
      );
      const data = await res.json();
      if (data.success && data.data.images.length > 0) {
        setPreviewImages(data.data.images);
      } else {
        setPreviewImages([]);
        setError('미리보기를 찾을 수 없습니다');
      }
    } catch {
      setPreviewImages([]);
      setError('미리보기 로드 실패');
    } finally {
      setLoadingPreview(false);
    }
  };

  const togglePageSelection = (pageNumber: number) => {
    setSelectedPages(prev => {
      if (prev.includes(pageNumber)) {
        return prev.filter(p => p !== pageNumber);
      }
      if (prev.length >= 5) {
        // 최대 5장까지만 선택 가능
        return prev;
      }
      return [...prev, pageNumber].sort((a, b) => a - b);
    });
  };

  const handleAnalyzeBook = async () => {
    if (!selectedBook || selectedPages.length === 0) {
      setError('목차가 있는 페이지를 선택해주세요');
      return;
    }

    setAnalyzingBook(true);
    setError(null);

    try {
      // 선택된 페이지의 이미지를 백엔드 프록시를 통해 base64로 변환
      const selectedImages = previewImages.filter(img =>
        selectedPages.includes(img.pageNumber)
      );

      const imagePromises = selectedImages.map(
        async (img) => {
          try {
            const proxyRes = await fetch(
              `${API_BASE_URL}/api/books/proxy-image?url=${encodeURIComponent(img.imageUrl)}`
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
        }
      );

      const loadedImages = (await Promise.all(imagePromises)).filter(Boolean) as ImageData[];

      if (loadedImages.length > 0) {
        setImages(loadedImages);
        onSubmit({
          materialName: selectedBook.title,
          images: loadedImages,
          totalDays,
          bookProductId: selectedBook.productId,
          bookMetadata: selectedBook.metadata,
        });
      } else {
        setError('이미지를 가져올 수 없습니다');
      }
    } catch {
      setError('책 분석 중 오류가 발생했습니다');
    } finally {
      setAnalyzingBook(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!materialName.trim()) {
      setError('교재 이름을 입력해주세요');
      return;
    }
    if (inputMode === 'upload' && images.length === 0) {
      setError('목차 이미지를 1장 이상 업로드해주세요');
      return;
    }
    if (inputMode === 'search' && !selectedBook) {
      setError('교재를 선택해주세요');
      return;
    }
    if (inputMode === 'search' && selectedPages.length === 0) {
      setError('목차가 있는 페이지를 선택해주세요');
      return;
    }

    if (inputMode === 'search' && selectedBook) {
      handleAnalyzeBook();
    } else {
      onSubmit({ materialName, images, totalDays });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 입력 방식 선택 탭 */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
        <button
          type="button"
          onClick={() => setInputMode('upload')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${inputMode === 'upload'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
            }`}
        >
          📷 이미지 업로드
        </button>
        <button
          type="button"
          onClick={() => setInputMode('search')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${inputMode === 'search'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
            }`}
        >
          🔍 교재 검색
        </button>
      </div>

      {inputMode === 'upload' ? (
        <>
          {/* 교재 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              교재 이름
            </label>
            <input
              type="text"
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
              placeholder="예: 수학의 정석 기본편"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          {/* 목차 이미지 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              목차 이미지
            </label>
            <ImageUploader onImagesChange={setImages} maxImages={4} />
          </div>
        </>
      ) : (
        <>
          {/* Yes24 교재 검색 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Yes24에서 교재 검색
            </label>
            <BookSearch onSelectBook={handleBookSelect} />
          </div>

          {/* 선택된 교재 정보 */}
          {selectedBook && (
            <div className="p-4 bg-blue-50 rounded-xl">
              <div className="flex items-center gap-3">
                <img
                  src={selectedBook.thumbnailUrl}
                  alt={selectedBook.title}
                  className="w-12 h-16 object-cover rounded"
                />
                <div>
                  <h4 className="font-medium text-gray-900">{selectedBook.title}</h4>
                  <p className="text-sm text-gray-600">{selectedBook.author}</p>
                </div>
              </div>
            </div>
          )}

          {/* 미리보기 로딩 */}
          {loadingPreview && (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
              <p className="text-sm text-gray-500 mt-2">미리보기 로드 중...</p>
            </div>
          )}

          {/* 미리보기 이미지 선택 */}
          {previewImages.length > 0 && !loadingPreview && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                목차 페이지 선택
                <span className="text-gray-500 font-normal ml-1">
                  ({selectedPages.length}/5 선택)
                </span>
              </label>
              <p className="text-xs text-gray-500 mb-3">
                이미지를 클릭하면 크게 볼 수 있습니다 (최대 5장 선택)
              </p>
              <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto p-1">
                {previewImages.map((img) => (
                  <button
                    key={img.pageNumber}
                    type="button"
                    onClick={() => setZoomedImage(img)}
                    className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all ${selectedPages.includes(img.pageNumber)
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                      }`}
                  >
                    <img
                      src={img.imageUrl}
                      alt={`${img.pageNumber}페이지`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* 페이지 번호 */}
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-0.5 text-center">
                      {img.pageNumber}
                    </span>
                    {/* 선택 체크 */}
                    {selectedPages.includes(img.pageNumber) && (
                      <div className="absolute top-1 right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
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
                {/* 모달 헤더 */}
                <div className="flex items-center justify-between p-4 border-b">
                  <span className="font-medium text-gray-900">
                    {zoomedImage.pageNumber}페이지
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomedImage(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                {/* 이미지 */}
                <div className="p-4 overflow-auto max-h-[60vh]">
                  <img
                    src={zoomedImage.imageUrl}
                    alt={`${zoomedImage.pageNumber}페이지`}
                    className="w-full h-auto"
                  />
                </div>

                {/* 선택 버튼 */}
                <div className="p-4 border-t flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      togglePageSelection(zoomedImage.pageNumber);
                      // 다음 페이지로 이동
                      const currentIndex = previewImages.findIndex(
                        (img) => img.pageNumber === zoomedImage.pageNumber
                      );
                      if (currentIndex < previewImages.length - 1) {
                        setZoomedImage(previewImages[currentIndex + 1]);
                      }
                    }}
                    className={`flex-1 py-3 rounded-xl font-medium transition-colors ${selectedPages.includes(zoomedImage.pageNumber)
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                  >
                    {selectedPages.includes(zoomedImage.pageNumber)
                      ? '선택 해제'
                      : '목차로 선택'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomedImage(null)}
                    className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50"
                  >
                    닫기
                  </button>
                </div>

                {/* 페이지 네비게이션 */}
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
                    className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-300"
                  >
                    ← 이전
                  </button>
                  <span className="text-sm text-gray-500">
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
                    className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-300"
                  >
                    다음 →
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 목표 기간 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          목표 기간 (일)
        </label>
        <input
          type="number"
          min={1}
          value={totalDays}
          onChange={(e) => setTotalDays(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
        />
      </div>

      {/* 에러 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* 제출 버튼 */}
      <button
        type="submit"
        disabled={isLoading || analyzingBook}
        className="w-full py-4 bg-blue-600 text-white rounded-xl font-medium text-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading || analyzingBook ? '생성 중...' : '퀘스트 생성'}
      </button>
    </form>
  );
}
