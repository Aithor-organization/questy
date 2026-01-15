-- QuestyBook 전체 테이블 마이그레이션
-- Supabase SQL Editor에서 실행
-- 실행 순서: 003 -> 004 -> 005 -> 006

-- =====================================================
-- 1. 학습 계획 (Plans) 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  material_name TEXT,
  subject TEXT,
  total_days INTEGER NOT NULL,
  total_units INTEGER,
  estimated_hours DECIMAL(5,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  start_date DATE,
  end_date DATE,
  summary JSONB DEFAULT '{}',
  recommendations JSONB DEFAULT '[]',
  ai_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own plans"
  ON public.plans FOR ALL
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_plans_student_id ON public.plans(student_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON public.plans(status);

-- =====================================================
-- 2. 퀘스트 (Quests) 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS public.quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.plans(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  date DATE,
  unit_number INTEGER,
  unit_title TEXT NOT NULL,
  range TEXT,
  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  tip TEXT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  -- 상세 정보
  topics JSONB DEFAULT '[]',
  pages TEXT,
  objectives JSONB DEFAULT '[]',
  -- AI 학습 팁
  study_tips JSONB DEFAULT '{}',
  -- 문제풀이 메모
  practice_note TEXT,
  is_practice BOOLEAN DEFAULT FALSE,
  -- 타이머 기록
  timer_record JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own quests"
  ON public.quests FOR ALL
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_quests_plan_id ON public.quests(plan_id);
CREATE INDEX IF NOT EXISTS idx_quests_student_id ON public.quests(student_id);
CREATE INDEX IF NOT EXISTS idx_quests_date ON public.quests(date);
CREATE INDEX IF NOT EXISTS idx_quests_completed ON public.quests(completed);

-- =====================================================
-- 3. 태스크 (Tasks) 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID REFERENCES public.quests(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('study', 'review', 'exercise', 'test')),
  estimated_minutes INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage tasks via quests"
  ON public.tasks FOR ALL
  USING (quest_id IN (
    SELECT id FROM public.quests
    WHERE student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  ));

CREATE INDEX IF NOT EXISTS idx_tasks_quest_id ON public.tasks(quest_id);

-- =====================================================
-- 4. 학습 진도 (Progress) 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS public.progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  study_minutes INTEGER DEFAULT 0,
  quests_completed INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);

ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own progress"
  ON public.progress FOR ALL
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_progress_student_id ON public.progress(student_id);
CREATE INDEX IF NOT EXISTS idx_progress_date ON public.progress(date);

-- =====================================================
-- 5. 채팅방 (Chat Rooms) 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '💬',
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chat rooms"
  ON public.chat_rooms FOR ALL
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_chat_rooms_student_id ON public.chat_rooms(student_id);

-- =====================================================
-- 6. 채팅 메시지 (Chat Messages) 테이블
-- =====================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  agent_role TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  -- 일정 재조정 옵션
  reschedule_options JSONB DEFAULT '[]',
  -- 액션 버튼
  actions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage messages via rooms"
  ON public.chat_messages FOR ALL
  USING (room_id IN (
    SELECT id FROM public.chat_rooms
    WHERE student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
  ));

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON public.chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);

-- =====================================================
-- 7. 대화 기록 (Conversations) - 코치용
-- =====================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  agent_role TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conversations"
  ON public.conversations FOR ALL
  USING (student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_conversations_student_id ON public.conversations(student_id);

-- =====================================================
-- 8. 에이전트 학습 패턴 (Agent Patterns) 테이블
-- ChromaDB 대체용 - Self-Evolving Agent System
-- 사용자별 개인화된 학습 패턴 저장
-- =====================================================
CREATE TABLE IF NOT EXISTS public.agent_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_id TEXT NOT NULL,  -- LP-001, LP-002 형식 (사용자별 고유)
  context TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS_PATTERN', 'FAILURE_PATTERN', 'WARNING', 'DISCOVERY')),
  content TEXT NOT NULL,
  model_used TEXT,
  confidence DECIMAL(3,2) DEFAULT 0.80,
  tags JSONB DEFAULT '[]',
  related_files JSONB DEFAULT '[]',
  learned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, pattern_id)  -- 사용자별 패턴 ID 고유
);

ALTER TABLE public.agent_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own patterns"
  ON public.agent_patterns FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_agent_patterns_user_id ON public.agent_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_patterns_status ON public.agent_patterns(status);
CREATE INDEX IF NOT EXISTS idx_agent_patterns_tags ON public.agent_patterns USING GIN(tags);

-- =====================================================
-- 9. 에이전트 세션 (Agent Sessions) 테이블
-- 사용자별 에이전트 작업 세션 기록
-- =====================================================
CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL,  -- evolve, research, build, review
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  context JSONB DEFAULT '{}',
  result JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions"
  ON public.agent_sessions FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON public.agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_type ON public.agent_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON public.agent_sessions(status);

-- =====================================================
-- 10. 벡터 임베딩 (Vector Embeddings) - pgvector
-- ChromaDB 대체용 - 사용자별 개인화
-- =====================================================

-- pgvector 확장 활성화 (Supabase 대시보드에서 먼저 활성화 필요)
-- CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_type TEXT NOT NULL,  -- pattern, conversation, document
  source_id TEXT,  -- 원본 ID (LP-001 등)
  metadata JSONB DEFAULT '{}',
  -- embedding VECTOR(1536),  -- OpenAI ada-002 차원
  -- Supabase에서 vector 확장 활성화 후 위 라인 주석 해제
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own embeddings"
  ON public.embeddings FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_embeddings_user_id ON public.embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_content_type ON public.embeddings(content_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_source_id ON public.embeddings(source_id);

-- =====================================================
-- 업데이트 트리거 함수
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 트리거 적용
CREATE TRIGGER trigger_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_chat_rooms_updated_at
  BEFORE UPDATE ON public.chat_rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_agent_patterns_updated_at
  BEFORE UPDATE ON public.agent_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 유틸리티 함수들
-- =====================================================

-- 오늘의 퀘스트 조회
CREATE OR REPLACE FUNCTION get_today_quests(p_student_id UUID)
RETURNS TABLE (
  id UUID,
  plan_id UUID,
  plan_name TEXT,
  day INTEGER,
  date DATE,
  unit_title TEXT,
  estimated_minutes INTEGER,
  completed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.plan_id,
    p.name as plan_name,
    q.day,
    q.date,
    q.unit_title,
    q.estimated_minutes,
    q.completed
  FROM public.quests q
  JOIN public.plans p ON q.plan_id = p.id
  WHERE q.student_id = p_student_id
    AND q.date = CURRENT_DATE
  ORDER BY q.day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 학습 진도 통계
CREATE OR REPLACE FUNCTION get_study_stats(p_student_id UUID, p_days INTEGER DEFAULT 7)
RETURNS TABLE (
  total_minutes INTEGER,
  total_quests INTEGER,
  current_streak INTEGER,
  avg_daily_minutes DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(study_minutes), 0)::INTEGER as total_minutes,
    COALESCE(SUM(quests_completed), 0)::INTEGER as total_quests,
    COALESCE(MAX(streak), 0)::INTEGER as current_streak,
    COALESCE(AVG(study_minutes), 0)::DECIMAL as avg_daily_minutes
  FROM public.progress
  WHERE student_id = p_student_id
    AND date >= CURRENT_DATE - p_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 패턴 검색 함수 (사용자별)
CREATE OR REPLACE FUNCTION search_patterns(
  p_query TEXT,
  p_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  pattern_id TEXT,
  context TEXT,
  status TEXT,
  content TEXT,
  confidence DECIMAL,
  tags JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ap.id,
    ap.pattern_id,
    ap.context,
    ap.status,
    ap.content,
    ap.confidence,
    ap.tags
  FROM public.agent_patterns ap
  WHERE ap.user_id = auth.uid()
    AND (p_status IS NULL OR ap.status = p_status)
    AND (ap.context ILIKE '%' || p_query || '%'
         OR ap.content ILIKE '%' || p_query || '%')
  ORDER BY ap.confidence DESC, ap.learned_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 다음 패턴 ID 생성 함수
CREATE OR REPLACE FUNCTION get_next_pattern_id()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(pattern_id FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.agent_patterns
  WHERE user_id = auth.uid()
    AND pattern_id ~ '^LP-[0-9]+$';

  RETURN 'LP-' || LPAD(next_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
