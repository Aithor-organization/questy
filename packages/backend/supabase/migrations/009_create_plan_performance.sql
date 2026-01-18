-- Plan Performance Table
-- 플랜 성과 기록 (에이전트 진화 학습용)
-- performance-tracker.ts와 연동

-- 기존 테이블 삭제 (개발 환경용 - 프로덕션에서는 제거)
DROP TABLE IF EXISTS plan_performance CASCADE;

-- 플랜 성과 테이블
CREATE TABLE plan_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,

  -- 플랜 특성
  subject TEXT NOT NULL DEFAULT 'GENERAL',
  material_name TEXT NOT NULL DEFAULT '',
  total_days INTEGER NOT NULL DEFAULT 30,
  daily_minutes INTEGER NOT NULL DEFAULT 60,
  total_units INTEGER NOT NULL DEFAULT 0,

  -- 성과 지표
  completion_rate FLOAT DEFAULT 0,
  average_quest_success FLOAT DEFAULT 0,
  average_study_time FLOAT DEFAULT 0,
  drop_off_day INTEGER,
  streak_days INTEGER DEFAULT 0,

  -- 학생 피드백
  student_rating INTEGER,
  student_feedback TEXT,
  difficulty_perception TEXT DEFAULT 'UNKNOWN',

  -- 메타데이터 (JSONB)
  metadata JSONB DEFAULT '{}'::jsonb,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_plan_performance_student_id ON plan_performance(student_id);
CREATE INDEX idx_plan_performance_plan_id ON plan_performance(plan_id);
CREATE INDEX idx_plan_performance_subject ON plan_performance(subject);
CREATE INDEX idx_plan_performance_completion_rate ON plan_performance(completion_rate);
CREATE INDEX idx_plan_performance_created_at ON plan_performance(created_at);

-- 복합 인덱스 (학생별 과목별 조회 최적화)
CREATE INDEX idx_plan_performance_student_subject ON plan_performance(student_id, subject);

-- RLS 활성화
ALTER TABLE plan_performance ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 공개 접근 (student_id로 필터링)
CREATE POLICY "Public read access for plan performance"
  ON plan_performance FOR SELECT
  USING (true);

CREATE POLICY "Public write access for plan performance"
  ON plan_performance FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update access for plan performance"
  ON plan_performance FOR UPDATE
  USING (true);

CREATE POLICY "Public delete access for plan performance"
  ON plan_performance FOR DELETE
  USING (true);

-- updated_at 자동 갱신 트리거 함수
CREATE OR REPLACE FUNCTION update_plan_performance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_plan_performance_updated_at
  BEFORE UPDATE ON plan_performance
  FOR EACH ROW
  EXECUTE FUNCTION update_plan_performance_updated_at();

-- 주석
COMMENT ON TABLE plan_performance IS '플랜 성과 기록 - 에이전트 진화 학습용';
COMMENT ON COLUMN plan_performance.completion_rate IS '완료율 (0-1)';
COMMENT ON COLUMN plan_performance.drop_off_day IS '이탈 시점 (일차), NULL이면 완료';
COMMENT ON COLUMN plan_performance.difficulty_perception IS 'TOO_EASY, JUST_RIGHT, TOO_HARD, UNKNOWN';
COMMENT ON COLUMN plan_performance.metadata IS 'unitCompletionRates, weeklyProgressPattern, peakStudyHour 등';
