/**
 * Supabase Storage Adapter for Zustand
 * zustand persist 미들웨어와 Supabase를 연동하는 스토리지 어댑터
 *
 * 특징:
 * - localStorage 폴백 지원
 * - 오프라인 지원 (localStorage 우선, 이후 Supabase 동기화)
 * - 사용자별 데이터 격리
 */

import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { supabase } from './supabase';

// 스토리지 테이블 이름
const STORAGE_TABLE = 'user_storage';

// 사용자 ID 가져오기
async function getUserId(): Promise<string | null> {
  if (!supabase) return null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

// localStorage 폴백
function getLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error('[SupabaseStorage] localStorage 저장 실패:', error);
  }
}

function removeLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('[SupabaseStorage] localStorage 삭제 실패:', error);
  }
}

// JSON 문자열을 StorageValue로 파싱
function parseStorageValue<T>(value: string | null): StorageValue<T> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as StorageValue<T>;
  } catch {
    return null;
  }
}

/**
 * Supabase 스토리지 어댑터 생성
 * @param storeName - 스토리지 이름 (예: 'quest', 'chat')
 * @returns PersistStorage
 */
export function createSupabaseStorage<T>(storeName: string): PersistStorage<T> {
  return {
    getItem: async (key: string): Promise<StorageValue<T> | null> => {
      // 1. 먼저 localStorage에서 빠르게 가져옴 (오프라인 지원)
      const localData = getLocalStorage(key);
      const localParsed = parseStorageValue<T>(localData);

      // 2. Supabase가 설정되지 않았으면 localStorage만 사용
      const userId = await getUserId();
      if (!userId || !supabase) {
        return localParsed;
      }

      try {
        // 3. Supabase에서 최신 데이터 가져오기
        const { data, error } = await supabase
          .from(STORAGE_TABLE)
          .select('value, updated_at')
          .eq('user_id', userId)
          .eq('store_name', storeName)
          .eq('key', key)
          .single();

        if (error) {
          // PGRST116은 "no rows" 에러 - 정상 케이스
          if (error.code !== 'PGRST116') {
            console.warn('[SupabaseStorage] 조회 실패:', error.message);
          }
          return localParsed;
        }

        if (data?.value) {
          // Supabase 데이터가 있으면 localStorage도 업데이트
          setLocalStorage(key, data.value);
          return parseStorageValue<T>(data.value);
        }

        return localParsed;
      } catch (error) {
        console.error('[SupabaseStorage] getItem 에러:', error);
        return localParsed;
      }
    },

    setItem: async (key: string, value: StorageValue<T>): Promise<void> => {
      // JSON 직렬화
      const serialized = JSON.stringify(value);

      // 1. 먼저 localStorage에 즉시 저장 (오프라인 지원, 빠른 응답)
      setLocalStorage(key, serialized);

      // 2. Supabase에 비동기로 저장
      const userId = await getUserId();
      if (!userId || !supabase) {
        return;
      }

      try {
        const { error } = await supabase
          .from(STORAGE_TABLE)
          .upsert(
            {
              user_id: userId,
              store_name: storeName,
              key,
              value: serialized,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'user_id,store_name,key',
            }
          );

        if (error) {
          console.error('[SupabaseStorage] setItem 실패:', error.message);
        }
      } catch (error) {
        console.error('[SupabaseStorage] setItem 에러:', error);
      }
    },

    removeItem: async (key: string): Promise<void> => {
      // 1. localStorage에서 먼저 삭제
      removeLocalStorage(key);

      // 2. Supabase에서 삭제
      const userId = await getUserId();
      if (!userId || !supabase) {
        return;
      }

      try {
        const { error } = await supabase
          .from(STORAGE_TABLE)
          .delete()
          .eq('user_id', userId)
          .eq('store_name', storeName)
          .eq('key', key);

        if (error) {
          console.error('[SupabaseStorage] removeItem 실패:', error.message);
        }
      } catch (error) {
        console.error('[SupabaseStorage] removeItem 에러:', error);
      }
    },
  };
}

/**
 * localStorage를 Supabase로 마이그레이션
 * 기존 localStorage 데이터를 Supabase로 이관
 */
export async function migrateLocalStorageToSupabase(
  storeName: string,
  localStorageKey: string
): Promise<boolean> {
  const userId = await getUserId();
  if (!userId || !supabase) {
    console.log('[SupabaseStorage] 마이그레이션 스킵 - 로그인 필요');
    return false;
  }

  try {
    const localData = getLocalStorage(localStorageKey);
    if (!localData) {
      console.log('[SupabaseStorage] 마이그레이션 스킵 - 로컬 데이터 없음');
      return false;
    }

    // Supabase에 이미 데이터가 있는지 확인
    const { data: existingData } = await supabase
      .from(STORAGE_TABLE)
      .select('id')
      .eq('user_id', userId)
      .eq('store_name', storeName)
      .eq('key', localStorageKey)
      .single();

    if (existingData) {
      console.log('[SupabaseStorage] 마이그레이션 스킵 - 이미 Supabase에 데이터 존재');
      return false;
    }

    // Supabase에 저장
    const { error } = await supabase
      .from(STORAGE_TABLE)
      .insert({
        user_id: userId,
        store_name: storeName,
        key: localStorageKey,
        value: localData,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[SupabaseStorage] 마이그레이션 실패:', error.message);
      return false;
    }

    console.log(`[SupabaseStorage] 마이그레이션 성공: ${storeName}/${localStorageKey}`);
    return true;
  } catch (error) {
    console.error('[SupabaseStorage] 마이그레이션 에러:', error);
    return false;
  }
}

/**
 * 모든 스토어 데이터를 Supabase에서 localStorage로 동기화
 * 로그인 후 호출하여 서버 데이터를 로컬에 반영
 */
export async function syncFromSupabase(storeName: string): Promise<void> {
  const userId = await getUserId();
  if (!userId || !supabase) {
    return;
  }

  try {
    const { data, error } = await supabase
      .from(STORAGE_TABLE)
      .select('key, value')
      .eq('user_id', userId)
      .eq('store_name', storeName);

    if (error) {
      console.error('[SupabaseStorage] 동기화 조회 실패:', error.message);
      return;
    }

    if (data) {
      for (const item of data) {
        setLocalStorage(item.key, item.value);
      }
      console.log(`[SupabaseStorage] 동기화 완료: ${storeName} (${data.length}개 항목)`);
    }
  } catch (error) {
    console.error('[SupabaseStorage] 동기화 에러:', error);
  }
}
