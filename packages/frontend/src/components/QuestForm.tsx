import { useState } from 'react';
import { ImageUploader } from './ImageUploader';

interface ImageData {
  base64: string;
  type: 'jpg' | 'png';
  preview: string;
}

interface FormData {
  materialName: string;
  images: ImageData[];
  totalDays: number;
}

interface QuestFormProps {
  onSubmit: (data: FormData) => void;
  isLoading: boolean;
}

export function QuestForm({ onSubmit, isLoading }: QuestFormProps) {
  const [materialName, setMaterialName] = useState('');
  const [images, setImages] = useState<ImageData[]>([]);
  const [totalDays, setTotalDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!materialName.trim()) {
      setError('교재 이름을 입력해주세요');
      return;
    }
    if (images.length === 0) {
      setError('목차 이미지를 1장 이상 업로드해주세요');
      return;
    }

    onSubmit({ materialName, images, totalDays });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
        disabled={isLoading}
        className="w-full py-4 bg-blue-600 text-white rounded-xl font-medium text-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? '생성 중...' : '퀘스트 생성'}
      </button>
    </form>
  );
}
