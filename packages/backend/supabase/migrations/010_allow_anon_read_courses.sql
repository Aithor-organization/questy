-- 강좌 테이블 공개 읽기 허용
-- 프론트엔드에서 직접 Supabase로 강좌 검색 가능하도록 변경
-- Railway 백엔드 부하 감소 + 응답 속도 향상

-- 기존 정책 유지하면서 anon 읽기 정책 추가
CREATE POLICY "Anyone can read courses"
  ON public.courses
  FOR SELECT
  TO anon
  USING (true);

-- teachers 테이블도 공개 읽기 허용 (강좌와 함께 표시될 수 있음)
CREATE POLICY "Anyone can read teachers"
  ON public.teachers
  FOR SELECT
  TO anon
  USING (true);

COMMENT ON POLICY "Anyone can read courses" ON public.courses IS '프론트엔드 직접 조회용 - 강좌 정보는 공개 데이터';
COMMENT ON POLICY "Anyone can read teachers" ON public.teachers IS '프론트엔드 직접 조회용 - 강사 정보는 공개 데이터';
