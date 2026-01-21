/**
 * 캐시 유틸리티
 * P3: staleTime 기반 캐시 재검증 로직
 *
 * zustand persist의 수동 캐싱 문제를 보완하여
 * stale data 감지 및 자동 재검증을 지원
 */

// 기본 staleTime (5분)
const DEFAULT_STALE_TIME = 5 * 60 * 1000;

// 캐시 키 접두사
const CACHE_PREFIX = 'questybook_cache_';

/**
 * 캐시 항목 타입
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * 캐시가 stale 상태인지 확인
 * @param key 캐시 키
 * @param staleTime stale 시간 (밀리초, 기본 5분)
 */
export function isCacheStale(key: string, staleTime: number = DEFAULT_STALE_TIME): boolean {
  const cacheKey = `${CACHE_PREFIX}${key}`;
  const cached = localStorage.getItem(cacheKey);

  if (!cached) return true;

  try {
    const entry = JSON.parse(cached) as CacheEntry<unknown>;
    return Date.now() - entry.timestamp > staleTime;
  } catch (e) {
    console.warn('[Cache] 캐시 stale 체크 파싱 실패:', e);
    return true;
  }
}

/**
 * 캐시에서 데이터 가져오기
 * @param key 캐시 키
 */
export function getFromCache<T>(key: string): T | null {
  const cacheKey = `${CACHE_PREFIX}${key}`;
  const cached = localStorage.getItem(cacheKey);

  if (!cached) return null;

  try {
    const entry = JSON.parse(cached) as CacheEntry<T>;
    return entry.data;
  } catch (e) {
    console.warn('[Cache] 캐시 데이터 파싱 실패:', e);
    return null;
  }
}

/**
 * 캐시에 데이터 저장
 * @param key 캐시 키
 * @param data 저장할 데이터
 */
export function setToCache<T>(key: string, data: T): void {
  const cacheKey = `${CACHE_PREFIX}${key}`;
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch (e) {
    console.warn('[Cache] 캐시 저장 실패:', e);
  }
}

/**
 * 캐시에서 데이터 제거
 * @param key 캐시 키
 */
export function removeFromCache(key: string): void {
  const cacheKey = `${CACHE_PREFIX}${key}`;
  localStorage.removeItem(cacheKey);
}

/**
 * 특정 접두사로 시작하는 모든 캐시 제거
 * @param prefix 캐시 키 접두사
 */
export function invalidateCacheByPrefix(prefix: string): void {
  const fullPrefix = `${CACHE_PREFIX}${prefix}`;
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(fullPrefix)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
  console.log(`[Cache] ${keysToRemove.length}개 캐시 무효화 (prefix: ${prefix})`);
}

/**
 * 모든 questybook 캐시 제거
 */
export function clearAllCache(): void {
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
  console.log(`[Cache] 전체 캐시 초기화 (${keysToRemove.length}개)`);
}

/**
 * 캐시 정보 조회 (디버깅용)
 */
export function getCacheInfo(): Array<{ key: string; timestamp: number; age: string }> {
  const info: Array<{ key: string; timestamp: number; age: string }> = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const entry = JSON.parse(cached) as CacheEntry<unknown>;
          const ageMs = Date.now() - entry.timestamp;
          const ageMin = Math.floor(ageMs / 60000);
          info.push({
            key: key.replace(CACHE_PREFIX, ''),
            timestamp: entry.timestamp,
            age: ageMin < 1 ? `${Math.floor(ageMs / 1000)}초` : `${ageMin}분`,
          });
        }
      } catch (e) {
        console.warn('[Cache] 캐시 정보 파싱 실패:', e);
      }
    }
  }

  return info;
}

/**
 * 캐시된 데이터 가져오기 또는 새로 fetch
 * staleTime이 지났으면 새로 fetch하고 캐시 갱신
 *
 * @param key 캐시 키
 * @param fetchFn 데이터를 가져오는 함수
 * @param options 옵션 (staleTime, forceRefresh)
 */
export async function fetchWithCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: {
    staleTime?: number;
    forceRefresh?: boolean;
  } = {}
): Promise<T> {
  const { staleTime = DEFAULT_STALE_TIME, forceRefresh = false } = options;

  // 강제 새로고침이 아니고 캐시가 fresh하면 캐시 반환
  if (!forceRefresh && !isCacheStale(key, staleTime)) {
    const cached = getFromCache<T>(key);
    if (cached !== null) {
      console.log(`[Cache] 캐시 히트: ${key}`);
      return cached;
    }
  }

  // 새로 fetch
  console.log(`[Cache] 데이터 fetch: ${key}`);
  const data = await fetchFn();

  // 캐시에 저장
  setToCache(key, data);

  return data;
}

/**
 * Stale-While-Revalidate 패턴
 * 캐시된 데이터를 즉시 반환하고, 백그라운드에서 새 데이터를 fetch
 *
 * @param key 캐시 키
 * @param fetchFn 데이터를 가져오는 함수
 * @param onUpdate 새 데이터가 도착했을 때 호출될 콜백
 * @param options 옵션
 */
export function staleWhileRevalidate<T>(
  key: string,
  fetchFn: () => Promise<T>,
  onUpdate: (data: T) => void,
  options: {
    staleTime?: number;
  } = {}
): T | null {
  const { staleTime = DEFAULT_STALE_TIME } = options;
  const cached = getFromCache<T>(key);

  // 캐시가 stale하면 백그라운드에서 revalidate
  if (isCacheStale(key, staleTime)) {
    fetchFn()
      .then((data) => {
        setToCache(key, data);
        onUpdate(data);
        console.log(`[Cache] SWR 재검증 완료: ${key}`);
      })
      .catch((e) => {
        console.warn(`[Cache] SWR 재검증 실패: ${key}`, e);
      });
  }

  // 캐시된 데이터 즉시 반환 (null일 수 있음)
  return cached;
}
