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
import { toast } from '../stores/toastStore';

// 스토리지 테이블 이름
const STORAGE_TABLE = 'user_storage';

// 마지막 사용자 ID를 추적하는 키
const LAST_USER_KEY = 'questybook_last_user_id';

// 사용자 ID 가져오기
async function getUserId(): Promise<string | null> {
  if (!supabase) return null;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (e) {
    console.warn('[SupabaseStorage] 사용자 조회 실패:', e);
    return null;
  }
}

// localStorage 폴백
function getLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('[SupabaseStorage] localStorage 조회 실패:', e);
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
  } catch (e) {
    console.warn('[SupabaseStorage] JSON 파싱 실패:', e);
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
      // 1. 먼저 localStorage에서 데이터 확인 (즉시 반환으로 깜빡임 방지)
      const localData = getLocalStorage(key);
      const lastUserId = getLocalStorage(LAST_USER_KEY);

      // 2. Supabase가 없으면 localStorage만 사용
      if (!supabase) {
        return parseStorageValue<T>(localData);
      }

      // 3. 사용자 ID 확인
      const userId = await getUserId();

      // 4. 비로그인 상태면 localStorage 반환
      if (!userId) {
        return parseStorageValue<T>(localData);
      }

      // 5. 사용자 변경 감지 - 변경되었으면 캐시 무효화
      if (lastUserId && lastUserId !== userId) {
        console.log('[SupabaseStorage] 사용자 변경 감지, 캐시 무효화:', lastUserId, '→', userId);
        removeLocalStorage(key);
        setLocalStorage(LAST_USER_KEY, userId);
        // 사용자 변경 시에는 Supabase에서 새로 가져와야 함
      } else {
        // 6. 사용자 동일 + localStorage에 데이터 있으면 즉시 반환 (캐시 히트)
        //    Supabase 동기화는 App.tsx에서 syncFromSupabase로 별도 처리
        if (localData) {
          if (!lastUserId) {
            setLocalStorage(LAST_USER_KEY, userId);
          }
          return parseStorageValue<T>(localData);
        }
      }

      // 7. localStorage에 없으면 Supabase에서 가져오기
      if (!lastUserId) {
        setLocalStorage(LAST_USER_KEY, userId);
      }

      try {
        const { data, error } = await supabase
          .from(STORAGE_TABLE)
          .select('value, updated_at')
          .eq('user_id', userId)
          .eq('store_name', storeName)
          .eq('key', key)
          .maybeSingle();

        if (error) {
          console.warn('[SupabaseStorage] 조회 실패:', error.message);
          return null;
        }

        if (data?.value) {
          // Supabase 데이터가 있으면 localStorage도 업데이트
          setLocalStorage(key, data.value);
          return parseStorageValue<T>(data.value);
        }

        return null;
      } catch (error) {
        console.error('[SupabaseStorage] getItem 에러:', error);
        return null;
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
        console.log(`[SupabaseStorage] setItem 스킵 - userId: ${userId}, supabase: ${!!supabase}, store: ${storeName}`);
        return;
      }

      console.log(`[SupabaseStorage] setItem 시도 - store: ${storeName}, key: ${key}, userId: ${userId}`);


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
          console.error('[SupabaseStorage] setItem 실패:', error.message, error);
          // 사용자에게 저장 실패 알림
          toast.warning('데이터 동기화에 실패했습니다. 인터넷 연결을 확인해주세요.');
        } else {
          console.log(`[SupabaseStorage] setItem 성공 - store: ${storeName}, key: ${key}`);
        }
      } catch (error) {
        console.error('[SupabaseStorage] setItem 에러:', error);
        toast.warning('데이터 동기화에 실패했습니다. 잠시 후 다시 시도해주세요.');
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
      .maybeSingle();

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
 * @returns 동기화된 항목 수 (0이면 데이터 없음)
 */
export async function syncFromSupabase(storeName: string): Promise<number> {
  const userId = await getUserId();
  if (!userId || !supabase) {
    return 0;
  }

  try {
    const { data, error } = await supabase
      .from(STORAGE_TABLE)
      .select('key, value')
      .eq('user_id', userId)
      .eq('store_name', storeName);

    if (error) {
      console.error('[SupabaseStorage] 동기화 조회 실패:', error.message);
      return 0;
    }

    if (data && data.length > 0) {
      // 청크 처리로 UI 프리징 방지 (대량 데이터 시)
      const CHUNK_SIZE = 10;
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        chunk.forEach(item => setLocalStorage(item.key, item.value));

        // 다음 청크 전 이벤트 루프에 양보 (UI 응답성 유지)
        if (i + CHUNK_SIZE < data.length) {
          await new Promise(r => setTimeout(r, 0));
        }
      }
      console.log(`[SupabaseStorage] 동기화 완료: ${storeName} (${data.length}개 항목)`);
      return data.length;
    }

    console.log(`[SupabaseStorage] 동기화: ${storeName}에 서버 데이터 없음`);
    return 0;
  } catch (error) {
    console.error('[SupabaseStorage] 동기화 에러:', error);
    return 0;
  }
}
