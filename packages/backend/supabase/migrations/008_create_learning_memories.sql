-- Learning Memories Table
-- 에이전트 학습 시스템의 메모리 저장 (ChromaDB 대체)
-- 벡터 검색은 pgvector 확장 사용

-- pgvector 확장 활성화 (Supabase에서 기본 제공)
CREATE EXTENSION IF NOT EXISTS vector;

-- 기존 테이블 삭제 (개발 환경용 - 프로덕션에서는 제거)
DROP TABLE IF EXISTS learning_memories CASCADE;
DROP TABLE IF EXISTS review_patterns CASCADE;

-- 학습 메모리 테이블
CREATE TABLE learning_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL,
  memory_type TEXT NOT NULL DEFAULT 'LEARNING',
  subject TEXT NOT NULL DEFAULT 'GENERAL',
  topic TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  confidence FLOAT DEFAULT 0.8,
  difficulty INTEGER DEFAULT 3,
  mastery_score INTEGER DEFAULT 5,
  times_observed INTEGER DEFAULT 1,
  recall_count INTEGER DEFAULT 0,
  positive_feedback INTEGER DEFAULT 0,
  negative_feedback INTEGER DEFAULT 0,
  emotion_at_creation TEXT DEFAULT 'NEUTRAL',
  embedding vector(768),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_recalled TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기본 인덱스 생성
CREATE INDEX idx_learning_memories_student_id ON learning_memories(student_id);
CREATE INDEX idx_learning_memories_subject ON learning_memories(subject);
CREATE INDEX idx_learning_memories_type ON learning_memories(memory_type);
CREATE INDEX idx_learning_memories_topic ON learning_memories(topic);
CREATE INDEX idx_learning_memories_confidence ON learning_memories(confidence);

-- 벡터 검색용 인덱스 (HNSW - 빈 테이블에서도 생성 가능)
CREATE INDEX idx_learning_memories_embedding
  ON learning_memories USING hnsw (embedding vector_cosine_ops);

-- RLS 활성화
ALTER TABLE learning_memories ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 학습 메모리는 공개 접근 (student_id로 필터링)
CREATE POLICY "Public read access for learning memories"
  ON learning_memories FOR SELECT
  USING (true);

CREATE POLICY "Public write access for learning memories"
  ON learning_memories FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update access for learning memories"
  ON learning_memories FOR UPDATE
  USING (true);

CREATE POLICY "Public delete access for learning memories"
  ON learning_memories FOR DELETE
  USING (true);

-- updated_at 자동 갱신 트리거 함수
CREATE OR REPLACE FUNCTION update_learning_memories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_learning_memories_updated_at
  BEFORE UPDATE ON learning_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_learning_memories_updated_at();

-- 리뷰 패턴 테이블 (학습된 패턴 저장)
CREATE TABLE review_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id TEXT NOT NULL UNIQUE,
  pattern_name TEXT NOT NULL,
  description TEXT,
  trigger_conditions JSONB DEFAULT '{}'::jsonb,
  issue_description TEXT,
  suggested_fix TEXT,
  successful_fix_count INTEGER DEFAULT 0,
  failed_fix_count INTEGER DEFAULT 0,
  confidence FLOAT DEFAULT 0.8,
  validation_score FLOAT DEFAULT 0.8,
  usage_count INTEGER DEFAULT 0,
  subject TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 리뷰 패턴 인덱스
CREATE INDEX idx_review_patterns_pattern_id ON review_patterns(pattern_id);
CREATE INDEX idx_review_patterns_confidence ON review_patterns(confidence);
CREATE INDEX idx_review_patterns_subject ON review_patterns(subject);

-- RLS 활성화
ALTER TABLE review_patterns ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 리뷰 패턴은 공개 접근
CREATE POLICY "Public access for review patterns"
  ON review_patterns FOR SELECT
  USING (true);

CREATE POLICY "Public insert for review patterns"
  ON review_patterns FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update for review patterns"
  ON review_patterns FOR UPDATE
  USING (true);

CREATE POLICY "Public delete for review patterns"
  ON review_patterns FOR DELETE
  USING (true);

-- updated_at 자동 갱신 트리거 함수
CREATE OR REPLACE FUNCTION update_review_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_review_patterns_updated_at
  BEFORE UPDATE ON review_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_review_patterns_updated_at();

-- 주석
COMMENT ON TABLE learning_memories IS '에이전트 학습 시스템의 메모리 저장소';
COMMENT ON TABLE review_patterns IS '학습된 리뷰 패턴 저장소';
