-- QuestyBook 강사/강좌 테이블
-- Supabase SQL Editor에서 실행

-- =====================================================
-- 1. teachers 테이블 (강사 정보)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'megastudy',
  subjects TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, platform)
);

-- RLS 활성화
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- 정책: 관리자만 CRUD 가능 (admins 테이블 연동)
CREATE POLICY "Admins can manage teachers"
  ON public.teachers
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

-- 정책: 인증된 사용자는 조회 가능
CREATE POLICY "Authenticated users can view teachers"
  ON public.teachers
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_teachers_name ON public.teachers(name);
CREATE INDEX IF NOT EXISTS idx_teachers_platform ON public.teachers(platform);

-- =====================================================
-- 2. courses 테이블 (강좌 정보)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.courses (
  id TEXT PRIMARY KEY,  -- course-1234 형식 또는 플랫폼 고유 ID
  name TEXT NOT NULL,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  teacher_name TEXT NOT NULL,  -- 비정규화: 빠른 조회용
  subject TEXT,
  platform TEXT NOT NULL DEFAULT 'megastudy',
  url TEXT,
  lectures JSONB DEFAULT '[]',  -- [{num, title, duration}, ...]
  lecture_count INTEGER DEFAULT 0,
  total_duration TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  last_crawled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- 정책: 관리자만 CRUD 가능
CREATE POLICY "Admins can manage courses"
  ON public.courses
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid())
  );

-- 정책: 인증된 사용자는 조회 가능
CREATE POLICY "Authenticated users can view courses"
  ON public.courses
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_courses_teacher_name ON public.courses(teacher_name);
CREATE INDEX IF NOT EXISTS idx_courses_teacher_id ON public.courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_courses_platform ON public.courses(platform);
CREATE INDEX IF NOT EXISTS idx_courses_is_completed ON public.courses(is_completed);
CREATE INDEX IF NOT EXISTS idx_courses_last_crawled ON public.courses(last_crawled_at);

-- =====================================================
-- 3. 트리거: 자동 updated_at 갱신
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_teachers_updated_at
  BEFORE UPDATE ON public.teachers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. 헬퍼 함수: 강사 통계 조회
-- =====================================================
CREATE OR REPLACE FUNCTION get_teacher_stats()
RETURNS TABLE (
  teacher_name TEXT,
  platform TEXT,
  subjects TEXT[],
  course_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.teacher_name,
    c.platform,
    ARRAY_AGG(DISTINCT c.subject) FILTER (WHERE c.subject IS NOT NULL) AS subjects,
    COUNT(*)::BIGINT AS course_count
  FROM public.courses c
  GROUP BY c.teacher_name, c.platform
  ORDER BY course_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. 코멘트
-- =====================================================
COMMENT ON TABLE public.teachers IS 'QuestyBook 강사 정보';
COMMENT ON TABLE public.courses IS 'QuestyBook 강좌 정보 (커리큘럼 포함)';
COMMENT ON COLUMN public.courses.lectures IS 'JSON 배열: [{num, title, duration}, ...]';
COMMENT ON COLUMN public.courses.teacher_name IS '비정규화된 강사명 (조회 성능용)';
