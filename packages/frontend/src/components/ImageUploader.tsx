import { useState, useCallback } from 'react';

interface ImageData {
  base64: string;
  type: 'jpg' | 'png';
  preview: string;
}

interface ImageUploaderProps {
  onImagesChange: (images: ImageData[]) => void;
  maxImages?: number;
}

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function ImageUploader({ onImagesChange, maxImages = 4 }: ImageUploaderProps) {
  const [images, setImages] = useState<ImageData[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback((file: File) => {
    if (!file.type.match(/^image\/(jpeg|png)$/)) {
      setError('JPG 또는 PNG 파일만 가능합니다');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('파일 크기는 10MB 이하여야 합니다');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const base64 = result.split(',')[1];
      const type = file.type === 'image/png' ? 'png' : 'jpg';

      setImages(prev => {
        if (prev.length >= maxImages) {
          setError(`최대 ${maxImages}장까지 업로드 가능합니다`);
          return prev;
        }
        const newImages = [...prev, { base64, type, preview: result }];
        onImagesChange(newImages);
        return newImages;
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  }, [maxImages, onImagesChange]);

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
    setImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      onImagesChange(newImages);
      return newImages;
    });
    setError(null);
  };

  return (
    <div className="space-y-3">
      {/* 이미지 미리보기 그리드 */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {images.map((img, index) => (
            <div key={index} className="relative aspect-[4/3] rounded-lg overflow-hidden border border-gray-200">
              <img
                src={img.preview}
                alt={`목차 ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removeImage(index)}
                type="button"
                className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-sm transition-colors"
              >
                ✕
              </button>
              <span className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                {index + 1}/{maxImages}
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
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }`}
        >
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleChange}
            className="hidden"
            id="image-upload"
            multiple
          />
          <label htmlFor="image-upload" className="cursor-pointer block">
            <div className="text-4xl mb-2">📷</div>
            <p className="text-gray-700 font-medium">
              {images.length === 0 ? '목차 이미지 업로드' : '이미지 추가'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              클릭 또는 드래그 (최대 {maxImages}장)
            </p>
          </label>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
