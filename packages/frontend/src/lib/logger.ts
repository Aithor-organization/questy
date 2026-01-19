/**
 * Logger 유틸리티
 *
 * 개발 모드에서만 로그 출력, 프로덕션에서는 자동 비활성화
 * - 보안: 프로덕션에서 민감한 정보 노출 방지
 * - 성능: 불필요한 console.log 호출 제거
 */

const isDev = import.meta.env.DEV;

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface LoggerOptions {
  prefix?: string;
  enabled?: boolean;
}

/**
 * 조건부 로깅 함수
 * 개발 모드에서만 로그 출력
 */
function createLogFn(level: LogLevel) {
  return (...args: unknown[]) => {
    if (isDev) {
      console[level](...args);
    }
  };
}

/**
 * 기본 Logger
 * 개발 모드에서만 동작
 */
export const logger = {
  log: createLogFn('log'),
  info: createLogFn('info'),
  warn: createLogFn('warn'),
  error: createLogFn('error'),
  debug: createLogFn('debug'),
};

/**
 * 네임스페이스가 있는 Logger 생성
 *
 * @example
 * const log = createLogger('[ChatStore]');
 * log.info('메시지 전송됨'); // [ChatStore] 메시지 전송됨
 */
export function createLogger(prefix: string, options: LoggerOptions = {}) {
  const { enabled = true } = options;

  const formatArgs = (args: unknown[]) => {
    if (prefix) {
      return [prefix, ...args];
    }
    return args;
  };

  return {
    log: (...args: unknown[]) => {
      if (isDev && enabled) {
        console.log(...formatArgs(args));
      }
    },
    info: (...args: unknown[]) => {
      if (isDev && enabled) {
        console.info(...formatArgs(args));
      }
    },
    warn: (...args: unknown[]) => {
      if (isDev && enabled) {
        console.warn(...formatArgs(args));
      }
    },
    error: (...args: unknown[]) => {
      // 에러는 프로덕션에서도 출력 (모니터링 필요)
      if (enabled) {
        console.error(...formatArgs(args));
      }
    },
    debug: (...args: unknown[]) => {
      if (isDev && enabled) {
        console.debug(...formatArgs(args));
      }
    },
  };
}

/**
 * 조건부 로그 (특정 조건에서만 출력)
 *
 * @example
 * logIf(user.isAdmin, 'Admin user logged in:', user.email);
 */
export function logIf(condition: boolean, ...args: unknown[]) {
  if (isDev && condition) {
    console.log(...args);
  }
}

/**
 * 그룹 로그 (관련 로그를 그룹화)
 *
 * @example
 * logGroup('API Response', () => {
 *   logger.log('Status:', 200);
 *   logger.log('Data:', data);
 * });
 */
export function logGroup(label: string, fn: () => void) {
  if (isDev) {
    console.group(label);
    fn();
    console.groupEnd();
  }
}

/**
 * 성능 측정 로그
 *
 * @example
 * const end = logTime('Fetch users');
 * await fetchUsers();
 * end(); // Fetch users: 123.45ms
 */
export function logTime(label: string) {
  if (!isDev) {
    return () => {}; // no-op
  }

  const start = performance.now();
  return () => {
    const duration = performance.now() - start;
    console.log(`${label}: ${duration.toFixed(2)}ms`);
  };
}

export default logger;
