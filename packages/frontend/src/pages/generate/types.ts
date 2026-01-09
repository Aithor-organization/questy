/**
 * Generate Page Types
 * 퀘스트 생성 페이지 타입 정의
 */

export interface ImageData {
  base64: string;
  type: 'jpg' | 'png';
  preview: string;
}

export type InputMode = 'upload' | 'search';

export type GenerateStep = 'upload' | 'result';
