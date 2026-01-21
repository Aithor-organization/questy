-- Migration: 017_cleanup_duplicate_chat_rooms.sql
-- 중복 채팅방 정리 및 재발 방지
-- Created: 2026-01-21

-- ============================================
-- 1. 현재 상태 확인 (실행 전 검토용)
-- ============================================

-- 모든 사용자별 채팅방 개수 확인
-- SELECT
--   s.user_id,
--   u.email,
--   COUNT(cr.id) as total_rooms,
--   COUNT(CASE WHEN cr.is_default = true THEN 1 END) as default_rooms,
--   COUNT(CASE WHEN cr.is_default = false THEN 1 END) as custom_rooms
-- FROM students s
-- LEFT JOIN chat_rooms cr ON s.id = cr.student_id
-- LEFT JOIN auth.users u ON s.user_id = u.id
-- GROUP BY s.user_id, u.email
-- ORDER BY total_rooms DESC;

-- 기본 채팅방이 2개 이상인 사용자만 표시
-- SELECT
--   s.user_id,
--   u.email,
--   COUNT(cr.id) as default_room_count
-- FROM students s
-- JOIN chat_rooms cr ON s.id = cr.student_id
-- LEFT JOIN auth.users u ON s.user_id = u.id
-- WHERE cr.is_default = true
-- GROUP BY s.user_id, u.email
-- HAVING COUNT(cr.id) > 1
-- ORDER BY default_room_count DESC;

-- ============================================
-- 2. 중복 채팅방 삭제
-- ============================================

-- 각 학생별로 가장 오래된 채팅방 1개만 유지하고 나머지 삭제
-- (메시지가 있는 채팅방도 함께 삭제됨 - CASCADE)
DELETE FROM chat_rooms
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY student_id
        ORDER BY
          CASE WHEN is_default = true THEN 0 ELSE 1 END,  -- 기본 채팅방 우선
          created_at ASC  -- 가장 오래된 것 유지
      ) as rn
    FROM chat_rooms
  ) ranked
  WHERE rn > 1  -- 첫 번째(가장 오래된 기본 채팅방) 제외하고 모두 삭제
);

-- ============================================
-- 3. 재발 방지: UNIQUE 제약 조건 추가
-- ============================================

-- 기본 채팅방 중복 방지 (partial unique index)
-- 각 학생당 is_default=true인 채팅방은 1개만 허용
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_default_chat_room
ON chat_rooms (student_id)
WHERE is_default = true;

-- ============================================
-- 4. 정리 결과 확인 (실행 후 검토용)
-- ============================================

-- 정리 후 각 사용자별 채팅방 개수 확인
-- SELECT
--   s.user_id,
--   u.email,
--   COUNT(cr.id) as total_rooms
-- FROM students s
-- LEFT JOIN chat_rooms cr ON s.id = cr.student_id
-- LEFT JOIN auth.users u ON s.user_id = u.id
-- GROUP BY s.user_id, u.email
-- ORDER BY total_rooms DESC;
