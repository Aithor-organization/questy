/**
 * ImageUploadZone
 * 목차 이미지 업로드 - 노트북 스타일
 */

import { useState, useCallback } from 'react';

interface ImageData {
  base64: string;
  type: 'jpg' | 'png';
  preview: string;
}

interface ImageUploadZoneProps {
  images: ImageData[];
  onImagesChange: (images: ImageData[]) => void;
  maxImages?: number;
}

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function ImageUploadZone({
  images,
  onImagesChange,
  maxImages = 4,
}: ImageUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback((file: File) => {
    if (!file.type.match(/^image\/(jpeg|png)$/)) {
      setError('JPG 또는 PNG 파일만 가능해요');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('파일 크기는 10MB 이하여야 해요');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const base64 = result.split(',')[1];
      const type = file.type === 'image/png' ? 'png' : 'jpg';

      if (images.length >= maxImages) {
        setError(`최대 ${maxImages}장까지 업로드 가능해요`);
        return;
      }

      const newImages = [...images, { base64, type: type as 'jpg' | 'png', preview: result }];
      onImagesChange(newImages);
      setError(null);
    };
    reader.readAsDataURL(file);
  }, [images, maxImages, onImagesChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => processFile(file));
  }, [processFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => processFile(file));
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* 이미지 미리보기 */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {images.map((img, index) => (
            <div
              key={index}
              className="relative aspect-[4/3] rounded-lg overflow-hidden border-2 border-[var(--paper-lines)] bg-white"
              style={{ transform: `rotate(${index % 2 === 0 ? -1 : 1}deg)` }}
            >
              <img
                src={img.preview}
                alt={`목차 ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removeImage(index)}
                type="button"
                className="absolute top-2 right-2 w-7 h-7 bg-[var(--ink-red)] text-white rounded-full flex items-center justify-center text-sm hover:scale-110 transition-transform"
              >
                ✕
              </button>
              <span className="absolute bottom-2 left-2 sticker sticker-gold text-xs">
                📄 {index + 1}/{maxImages}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 업로드 영역 */}
      {images.length < maxImages && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          className={`notebook-page transition-all cursor-pointer ${
            isDragging ? 'ring-2 ring-[var(--ink-blue)] bg-[var(--highlight-blue)]' : ''
          }`}
          style={{ borderStyle: 'dashed', borderWidth: '2px' }}
        >
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleChange}
            className="hidden"
            id="toc-upload"
            multiple
          />
          <label htmlFor="toc-upload" className="cursor-pointer block p-8 text-center">
            <div className="text-5xl mb-3">
              {isDragging ? '📥' : '📷'}
            </div>
            <p className="handwrite text-xl text-[var(--ink-black)]">
              {images.length === 0 ? '목차 사진을 올려주세요' : '사진 추가하기'}
            </p>
            <p className="text-sm text-[var(--pencil-gray)] mt-2">
              클릭 또는 드래그 (최대 {maxImages}장)
            </p>
            <div className="flex justify-center gap-2 mt-4">
              <span className="sticker sticker-coral text-xs">JPG</span>
              <span className="sticker sticker-mint text-xs">PNG</span>
            </div>
          </label>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="postit text-sm text-[var(--ink-red)]">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
