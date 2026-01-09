/**
 * UploadForm Component
 * 이미지 업로드 폼 (교재 이름 + 이미지 업로드)
 */

import { ImageUploadZone } from '../../../components/notebook';
import type { ImageData } from '../types';

interface UploadFormProps {
  materialName: string;
  onMaterialNameChange: (name: string) => void;
  images: ImageData[];
  onImagesChange: (images: ImageData[]) => void;
}

export function UploadForm({
  materialName,
  onMaterialNameChange,
  images,
  onImagesChange,
}: UploadFormProps) {
  return (
    <>
      {/* 교재 이름 */}
      <div className="mb-6">
        <label className="block text-sm text-[var(--pencil-gray)] mb-2">
          교재 이름
        </label>
        <input
          type="text"
          value={materialName}
          onChange={(e) => onMaterialNameChange(e.target.value)}
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
          onImagesChange={onImagesChange}
          maxImages={4}
        />
      </div>
    </>
  );
}
