/**
 * Storage Module Exports
 * 벡터 저장소 및 임베딩 생성
 *
 * ## 저장소 백엔드
 * - **Supabase (pgvector)**: 기본 저장소 - 프로덕션 권장
 * - **ChromaDB**: 레거시/개발용 - 로컬 개발 시에만 사용
 *
 * ## 환경 변수
 * - SUPABASE_URL: Supabase 프로젝트 URL
 * - SUPABASE_SERVICE_KEY: Supabase 서비스 키 (또는 SUPABASE_ANON_KEY)
 *
 * ## 마이그레이션
 * - 008_create_learning_memories.sql 마이그레이션 적용 필수
 */

// ============== Primary: Supabase (Recommended) ==============
export { SupabaseMemoryStorage } from './supabase-client.js';
export type { SupabaseStorageConfig } from './supabase-client.js';

// ============== Legacy: ChromaDB (Development Only) ==============
/**
 * @deprecated ChromaDB는 더 이상 권장되지 않습니다.
 * Supabase (pgvector) 사용을 권장합니다.
 * 로컬 개발 환경에서 Supabase 없이 테스트할 때만 사용하세요.
 */
export { ChromaMemoryStorage } from './chroma-client.js';
export type { ChromaStorageConfig } from './chroma-client.js';

// ============== Embeddings ==============
export { EmbeddingGenerator } from './embeddings.js';
export type { EmbeddingConfig } from './embeddings.js';
