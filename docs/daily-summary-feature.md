# AI 일일 학습 요약 기능 명세서

> 자정에 전날 학습 내용을 AI로 분석하여 개인화된 요약을 생성하는 기능

## 개요

| 항목 | 내용 |
|------|------|
| 기능명 | AI 일일 학습 요약 (Daily Learning Summary) |
| 트리거 | 매일 자정 (KST 00:00) |
| AI 모델 | GPT-5 Nano via OpenRouter API |
| 예상 비용 | ~$0.44/월 (100명 기준) |

---

## 1. 데이터 스키마

### 1.1 Supabase 테이블: `daily_summaries`

```sql
CREATE TABLE daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) NOT NULL,
  date DATE NOT NULL,

  -- AI 생성 콘텐츠
  summary_text TEXT NOT NULL,           -- 메인 요약문
  highlights TEXT[],                     -- 주요 성과 배열
  suggestion TEXT,                       -- 내일을 위한 조언
  mood VARCHAR(20),                      -- 'great' | 'good' | 'okay' | 'struggling'

  -- 통계 데이터
  completed_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  total_minutes INTEGER DEFAULT 0,
  completion_rate DECIMAL(5,2),

  -- 메타데이터
  model_used VARCHAR(50) DEFAULT 'gpt-5-nano',
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(student_id, date)
);

-- 인덱스
CREATE INDEX idx_daily_summaries_student_date ON daily_summaries(student_id, date DESC);
```

### 1.2 분석 입력 데이터 타입

```typescript
interface DailyAnalysisInput {
  studentId: string;
  studentName: string;
  date: string;  // YYYY-MM-DD

  quests: {
    id: string;
    title: string;           // "1강. 수열의 극한"
    planName: string;        // "개념완성 수학1"
    subject: string;         // "수학"
    completed: boolean;
    estimatedMinutes: number;
    actualMinutes?: number;  // 타이머 기록
    practiceNote?: string;   // 사용자 메모
  }[];

  stats: {
    completedCount: number;
    totalCount: number;
    totalStudyMinutes: number;
    currentStreak: number;
  };

  // 최근 7일 히스토리 (트렌드 분석용)
  recentHistory?: {
    date: string;
    completedRate: number;
    totalMinutes: number;
  }[];
}
```

### 1.3 분석 출력 데이터 타입

```typescript
interface DailySummaryOutput {
  summaryText: string;      // AI 생성 요약문 (150자 이내)
  highlights: string[];     // 주요 성과 (최대 3개)
  suggestion: string;       // 내일을 위한 한 줄 조언
  mood: 'great' | 'good' | 'okay' | 'struggling';
}
```

---

## 2. AI 프롬프트 설계

### 2.1 시스템 프롬프트

```
너는 고등학생 학습 코치 '퀘스티'야. 학생의 하루 학습을 분석하고 따뜻하게 피드백해줘.

규칙:
1. 요약은 150자 이내로 짧고 친근하게
2. 이모지를 자연스럽게 사용 (1-3개)
3. 구체적인 성과를 언급해줘 (과목명, 강의명 등)
4. 힘들어 보이면 위로와 격려를 먼저
5. 비교하지 말고 개인의 성장에 집중
6. 내일을 위한 실천 가능한 조언 1개

톤앤매너:
- 반말 사용 (친구처럼)
- 긍정적이고 응원하는 느낌
- 잔소리하지 않기
```

### 2.2 사용자 프롬프트 템플릿

```
학생: {studentName}
날짜: {date}
연속 학습일: {streak}일

📊 오늘의 학습
- 완료: {completedCount}/{totalCount} ({completionRate}%)
- 총 학습시간: {totalMinutes}분

✅ 완료한 퀘스트:
{completedQuests.map(q => `- ${q.title} (${q.planName}) ${q.actualMinutes ? `- ${q.actualMinutes}분` : ''}\n  ${q.practiceNote ? `메모: "${q.practiceNote}"` : ''}`).join('\n')}

❌ 미완료 퀘스트:
{incompleteQuests.map(q => `- ${q.title} (${q.planName})`).join('\n')}

{recentHistory ? `📈 최근 7일 추이: ${recentHistory.map(h => h.completedRate + '%').join(' → ')}` : ''}

위 데이터를 분석하여 JSON 형식으로 응답해줘:
{
  "summaryText": "요약문 (150자 이내)",
  "highlights": ["성과1", "성과2"],
  "suggestion": "내일을 위한 조언",
  "mood": "great|good|okay|struggling"
}
```

### 2.3 분석 관점

| 관점 | 분석 내용 | 예시 |
|------|----------|------|
| **성과** | 완료율, 학습량 | "오늘 4/5 퀘스트 완료!" |
| **패턴** | 집중 과목, 학습 시간 | "수학에 집중한 하루였네" |
| **성장** | 스트릭, 추이 변화 | "3일 연속 학습 중! 🔥" |
| **메모 반영** | 사용자 기록 분석 | "적분 어렵다고 했지? 내일 복습해보자" |
| **격려** | 개인화된 응원 | "80% 완료율이라니, 진짜 잘했어!" |

---

## 3. 백엔드 API

### 3.1 엔드포인트

```
POST /api/summary/generate
- 특정 학생의 특정 날짜 요약 생성 (수동 트리거)

POST /api/summary/generate-batch
- 모든 학생의 전날 요약 일괄 생성 (스케줄러용)

GET /api/summary/:studentId/:date
- 저장된 요약 조회
```

### 3.2 구현 파일 구조

```
packages/backend/src/
├── routes/
│   └── summary.ts              # API 라우트
├── services/
│   └── summary-generator.ts    # 요약 생성 로직
└── lib/
    └── openrouter.ts           # OpenRouter API 클라이언트
```

### 3.3 OpenRouter API 클라이언트

```typescript
// packages/backend/src/lib/openrouter.ts

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface OpenRouterConfig {
  apiKey: string;
  model: string;  // 'openai/gpt-5-nano'
}

export async function generateCompletion(
  config: OpenRouterConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://questybook.app',
      'X-Title': 'QuestyBook Daily Summary',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
```

---

## 4. 스케줄러

### 4.1 GitHub Actions Workflow

```yaml
# .github/workflows/daily-summary.yml

name: Daily Learning Summary

on:
  schedule:
    # 매일 KST 00:05 (UTC 15:05 전날)
    - cron: '5 15 * * *'
  workflow_dispatch:
    inputs:
      date:
        description: '분석할 날짜 (YYYY-MM-DD)'
        required: false

jobs:
  generate-summaries:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --filter @questybook/backend

      - name: Generate Daily Summaries
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
        run: |
          cd packages/backend
          npx tsx scripts/generate-daily-summaries.ts ${{ github.event.inputs.date }}
```

### 4.2 스케줄러 스크립트

```typescript
// packages/backend/scripts/generate-daily-summaries.ts

import { createClient } from '@supabase/supabase-js';
import { generateDailySummary } from '../src/services/summary-generator';

async function main() {
  const targetDate = process.argv[2] || getYesterdayDate();

  console.log(`📊 일일 요약 생성 시작: ${targetDate}`);

  // 1. 해당 날짜에 퀘스트가 있는 학생 조회
  const students = await getStudentsWithQuests(targetDate);
  console.log(`👥 대상 학생 수: ${students.length}명`);

  // 2. 각 학생별 요약 생성
  let successCount = 0;
  let failCount = 0;

  for (const student of students) {
    try {
      await generateDailySummary(student.id, targetDate);
      successCount++;
      console.log(`✅ ${student.name}: 요약 생성 완료`);
    } catch (error) {
      failCount++;
      console.error(`❌ ${student.name}: 요약 생성 실패`, error);
    }

    // Rate limiting (1초 대기)
    await sleep(1000);
  }

  console.log(`\n📋 완료: 성공 ${successCount}, 실패 ${failCount}`);
}

main();
```

---

## 5. 프론트엔드 UI

### 5.1 과거 날짜 요약 표시 컴포넌트

```tsx
// packages/frontend/src/components/notebook/DailySummaryCard.tsx

interface DailySummaryCardProps {
  summary: {
    summaryText: string;
    highlights: string[];
    suggestion: string;
    mood: 'great' | 'good' | 'okay' | 'struggling';
    completedCount: number;
    totalCount: number;
    totalMinutes: number;
  };
}

const MOOD_CONFIG = {
  great: { emoji: '🎉', color: 'bg-green-100', text: '최고의 하루!' },
  good: { emoji: '😊', color: 'bg-blue-100', text: '좋은 하루' },
  okay: { emoji: '👍', color: 'bg-yellow-100', text: '괜찮은 하루' },
  struggling: { emoji: '💪', color: 'bg-purple-100', text: '힘냈어' },
};

export function DailySummaryCard({ summary }: DailySummaryCardProps) {
  const moodConfig = MOOD_CONFIG[summary.mood];

  return (
    <div className={`rounded-xl p-4 ${moodConfig.color} mb-4`}>
      <div className="flex items-start gap-3">
        <span className="text-3xl">{moodConfig.emoji}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-600">
              🤖 AI 코치의 분석
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/50">
              {moodConfig.text}
            </span>
          </div>
          <p className="text-gray-800">{summary.summaryText}</p>

          {/* 주요 성과 */}
          {summary.highlights.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {summary.highlights.map((h, i) => (
                <span key={i} className="text-xs px-2 py-1 rounded bg-white/70">
                  ✨ {h}
                </span>
              ))}
            </div>
          )}

          {/* 조언 */}
          {summary.suggestion && (
            <p className="text-sm text-gray-600 mt-2 italic">
              💡 {summary.suggestion}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 5.2 TodayPage 통합

```tsx
// TodayPage.tsx 수정 사항

// 과거 날짜일 때 요약 데이터 로드
const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);

useEffect(() => {
  if (!isToday && selectedDate < todayStr) {
    fetchDailySummary(studentId, selectedDate);
  }
}, [selectedDate, isToday]);

// 렌더링
{!isToday && dailySummary && (
  <DailySummaryCard summary={dailySummary} />
)}
```

---

## 6. 환경 변수

```env
# .env (백엔드)
OPENROUTER_API_KEY=sk-or-xxx

# GitHub Secrets
OPENROUTER_API_KEY=sk-or-xxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx
```

---

## 7. 구현 체크리스트

### Phase 1: 백엔드 (1-2일)
- [ ] Supabase `daily_summaries` 테이블 생성
- [ ] OpenRouter API 클라이언트 구현
- [ ] 요약 생성 서비스 구현
- [ ] API 엔드포인트 구현

### Phase 2: 스케줄러 (0.5일)
- [ ] GitHub Actions 워크플로우 작성
- [ ] 배치 스크립트 구현
- [ ] GitHub Secrets 설정

### Phase 3: 프론트엔드 (1일)
- [ ] DailySummaryCard 컴포넌트 구현
- [ ] TodayPage에 요약 표시 통합
- [ ] 요약 API 연동

### Phase 4: 테스트 & 배포 (0.5일)
- [ ] 수동 트리거로 테스트
- [ ] 프로덕션 배포
- [ ] 모니터링 설정

---

## 8. 비용 추정

| 항목 | 계산 | 월간 비용 |
|------|------|----------|
| 입력 토큰 | 500 토큰 × 30일 × 100명 = 1.5M | $0.075 |
| 출력 토큰 | 300 토큰 × 30일 × 100명 = 0.9M | $0.36 |
| **합계** | | **~$0.44/월** |

※ GPT-5 Nano 기준: $0.05/1M input, $0.40/1M output

---

## 9. 향후 확장 가능성

1. **주간/월간 요약**: 더 긴 기간의 학습 패턴 분석
2. **목표 달성 예측**: AI가 플랜 완료 예상일 계산
3. **맞춤형 학습 제안**: 취약 과목 집중 추천
4. **학부모 리포트**: 주간 학습 현황 이메일 발송
5. **음성 요약**: TTS로 아침에 전날 요약 들려주기
