/**
 * SearchForm Component
 * YES24 교재 검색 폼
 */

import { BookSearch } from '../../../components/BookSearch';
import type { Yes24Book, PreviewImage } from '@questybook/shared';

interface SearchFormProps {
  selectedBook: Yes24Book | null;
  previewImages: PreviewImage[];
  selectedPages: number[];
  loadingPreview: boolean;
  onBookSelect: (book: Yes24Book) => void;
  onPageClick: (image: PreviewImage) => void;
}

export function SearchForm({
  selectedBook,
  previewImages,
  selectedPages,
  loadingPreview,
  onBookSelect,
  onPageClick,
}: SearchFormProps) {
  return (
    <>
      {/* YES24 교재 검색 */}
      <div className="mb-6">
        <label className="block text-sm text-[var(--pencil-gray)] mb-2">
          Yes24에서 교재 검색
        </label>
        <BookSearch onSelectBook={onBookSelect} />
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
                onClick={() => onPageClick(img)}
                className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all ${
                  selectedPages.includes(img.pageNumber)
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
    </>
  );
}
