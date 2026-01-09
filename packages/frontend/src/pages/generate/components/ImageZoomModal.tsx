/**
 * ImageZoomModal Component
 * 이미지 확대 모달 (페이지 선택 기능 포함)
 */

import type { PreviewImage } from '@questybook/shared';

interface ImageZoomModalProps {
  image: PreviewImage;
  allImages: PreviewImage[];
  selectedPages: number[];
  onClose: () => void;
  onToggleSelection: (pageNumber: number) => void;
  onNavigate: (image: PreviewImage) => void;
}

export function ImageZoomModal({
  image,
  allImages,
  selectedPages,
  onClose,
  onToggleSelection,
  onNavigate,
}: ImageZoomModalProps) {
  const currentIndex = allImages.findIndex(img => img.pageNumber === image.pageNumber);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === allImages.length - 1;
  const isSelected = selectedPages.includes(image.pageNumber);

  const handlePrev = () => {
    if (!isFirst) onNavigate(allImages[currentIndex - 1]);
  };

  const handleNext = () => {
    if (!isLast) onNavigate(allImages[currentIndex + 1]);
  };

  const handleToggleAndNext = () => {
    onToggleSelection(image.pageNumber);
    if (!isLast) onNavigate(allImages[currentIndex + 1]);
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b">
          <span className="font-medium text-[var(--ink-black)]">
            {image.pageNumber}페이지
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--pencil-gray)] hover:text-[var(--ink-black)]"
          >
            ✕
          </button>
        </div>

        {/* 이미지 */}
        <div className="p-4 overflow-auto max-h-[60vh]">
          <img
            src={image.imageUrl}
            alt={`${image.pageNumber}페이지`}
            className="w-full h-auto"
          />
        </div>

        {/* 선택 버튼 */}
        <div className="p-4 border-t flex gap-2">
          <button
            type="button"
            onClick={handleToggleAndNext}
            className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
              isSelected
                ? 'bg-[var(--highlight-pink)] text-[var(--ink-red)]'
                : 'bg-[var(--ink-blue)] text-white'
            }`}
          >
            {isSelected ? '선택 해제' : '📌 목차로 선택'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 border border-[var(--paper-lines)] rounded-xl text-[var(--pencil-gray)] hover:bg-[var(--paper-cream)]"
          >
            닫기
          </button>
        </div>

        {/* 네비게이션 */}
        <div className="px-4 pb-4 flex justify-between">
          <button
            type="button"
            onClick={handlePrev}
            disabled={isFirst}
            className="text-sm text-[var(--ink-blue)] hover:underline disabled:text-[var(--paper-lines)]"
          >
            ← 이전
          </button>
          <span className="text-sm text-[var(--pencil-gray)]">
            {image.pageNumber} / {allImages.length}
          </span>
          <button
            type="button"
            onClick={handleNext}
            disabled={isLast}
            className="text-sm text-[var(--ink-blue)] hover:underline disabled:text-[var(--paper-lines)]"
          >
            다음 →
          </button>
        </div>
      </div>
    </div>
  );
}
