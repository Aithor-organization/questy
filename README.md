# QuestyBook 📚

> AI 학습 코칭 시스템 - 나만의 AI 코치와 함께하는 스마트 학습

교재 사진을 찍으면 AI가 분석하여 맞춤형 학습 계획을 생성하고, 매일 AI 코치가 학습을 도와줍니다.

## 🖥️ 지원 플랫폼

| 플랫폼 | 지원 | 비고 |
|--------|------|------|
| **macOS** | ✅ | Bun 권장 |
| **Windows** | ✅ | Node.js 사용 |
| **Linux** | ✅ | Bun 또는 Node.js |

---

## ✨ 주요 기능

### 🤖 AI 코칭
- **실시간 학습 코칭**: 모르는 문제 질문, 개념 설명, 힌트 제공
- **나를 기억하는 AI**: 이전에 틀렸던 문제, 어려워했던 개념을 기억
- **감정 지원**: 의욕 저하, 스트레스 시 동기부여 메시지

### 📚 스마트 학습 계획
- **이미지 분석**: 교재 목차 사진 → AI가 자동으로 커리큘럼 분석
- **맞춤 플랜 생성**: 목표 기간과 학습량에 맞춘 최적의 일정
- **여러 과목 동시 관리**: 수학, 영어, 과학 등 멀티 플랜 지원

### ✅ 일일 퀘스트
- **오늘의 할 일**: 매일 해야 할 학습 목록 자동 생성
- **진행률 추적**: 실시간 완료율 확인
- **학습 타이머**: 공부 시간 측정 및 기록

### 🧠 Memory Lane 시스템
- **학습 기억 저장**: 대화에서 중요한 학습 내용 자동 추출
- **스마트 복습**: SM-2 알고리즘 기반 최적 복습 타이밍
- **번아웃 감지**: 감정 패턴 분석으로 휴식 권유

### 📺 인강 커리큘럼 생성
- **강좌 검색**: 과목별 인강 강좌 검색 및 선택
- **과목 비중 설정**: 수학, 영어, 국어 등 과목별 학습 시간 배분
- **이어듣기 지원**: 이미 들은 강의부터 시작점 지정
- **자동 퀘스트 생성**: 강의, 복습, 문제풀이 퀘스트 자동 배분

### 💡 꿀팁 가이드
- **앱 사용법**: 전체 기능 사용 가이드 제공
- **페이지별 팁**: 각 화면에서 상황에 맞는 도움말 표시
- **인강 강사 추천**: 과목별 추천 강사 정보
- **학습 전략**: 수능 대비 효과적인 공부법

---

## 🚀 빠른 시작

### 요구사항

- **Node.js** 20+ (필수)
- **pnpm** 9+ ([설치 가이드](https://pnpm.io/installation))
- **Bun** 1.0+ (macOS/Linux 권장, Windows는 선택)
- **OpenRouter API Key** ([발급받기](https://openrouter.ai/keys))
- **Supabase 프로젝트** ([생성하기](https://supabase.com))

### 1. 설치

#### macOS / Linux

```bash
# 저장소 클론
git clone https://github.com/Aithor-organization/questy.git
cd questy

# pnpm 설치 (없는 경우)
npm install -g pnpm

# Bun 설치 (macOS/Linux 권장)
curl -fsSL https://bun.sh/install | bash

# 의존성 설치
pnpm install

# questyCoachAgent 빌드
cd questyCoachAgent && pnpm install && pnpm build && cd ..
```

#### Windows

```powershell
# 저장소 클론
git clone https://github.com/Aithor-organization/questy.git
cd questy

# pnpm 설치 (없는 경우)
npm install -g pnpm

# Bun 설치 (선택사항 - PowerShell 관리자 권한)
powershell -c "irm bun.sh/install.ps1 | iex"
# 또는 npm으로 설치
npm install -g bun

# 의존성 설치
pnpm install

# questyCoachAgent 빌드
cd questyCoachAgent
pnpm install
pnpm build
cd ..
```

> ⚠️ **Windows 사용자 참고**: Bun 없이도 `tsx`로 백엔드 실행 가능합니다. 아래 실행 섹션 참조.

### 2. 환경 변수 설정

```bash
# macOS/Linux
cp packages/backend/.env.example packages/backend/.env

# Windows (PowerShell)
copy packages\backend\.env.example packages\backend\.env
```

`packages/backend/.env` 파일 편집:

```env
# 필수 - OpenRouter API
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here

# 필수 - Supabase (인증 및 DB)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# 선택 - Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

프론트엔드 환경 변수 (`packages/frontend/.env`):

```env
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. 실행

#### macOS / Linux (Bun 사용)

```bash
# 터미널 1: 백엔드 서버
pnpm --filter backend dev

# 터미널 2: 프론트엔드
pnpm --filter frontend dev
```

#### Windows (Node.js 사용)

```powershell
# 터미널 1: 백엔드 서버 (tsx 사용)
cd packages/backend
npx tsx --watch src/index.ts

# 터미널 2: 프론트엔드
cd packages/frontend
pnpm dev
```

#### 동시 실행 (모든 플랫폼)

```bash
# 루트 디렉토리에서 백엔드 + 프론트엔드 동시 실행
pnpm dev
```

### 4. 접속

- **프론트엔드**: http://localhost:5173
- **백엔드 API**: http://localhost:3001

> 💡 **팁**: 첫 접속 시 Google 로그인 또는 이메일 회원가입으로 시작하세요!

---

## 📖 사용 방법

### Step 1: 회원가입 & 온보딩

1. 앱 접속 → **회원가입** 클릭
2. 이메일, 비밀번호 입력
3. AI 코치와 대화하며 **학습 프로필** 생성
   - 학년 선택
   - 학습 목표 설정
   - 선호하는 학습 스타일 선택

### Step 2: 학습 계획 만들기

1. **플래너** 탭 → **새 플랜 만들기**
2. 교재 선택 방법:
   - Yes24에서 교재 검색
   - 또는 직접 교재명 입력
3. **목차 사진 업로드** (최대 4장)
   - 교재 목차 페이지를 사진으로 찍어 업로드
   - AI가 자동으로 단원/챕터 분석
4. **학습 기간** 설정 (예: 30일, 60일)
5. **AI 플랜 생성** 클릭
6. 생성된 플랜 확인 후 **저장**

### Step 3: 일일 학습

1. **오늘** 탭에서 오늘의 퀘스트 확인
2. 학습 완료 시 **체크박스** 클릭
3. 모르는 문제가 있으면 **AI 코치** 탭에서 질문
4. 하루 끝나면 AI 코치가 **저녁 리뷰** 제공

### Step 4: AI 코치와 대화

**질문 예시:**
- "이 문제 어떻게 풀어?"
- "이차방정식 개념 설명해줘"
- "오늘 공부하기 싫어..."
- "시험 걱정돼"

**AI 코치가 하는 일:**
- 개념 설명 (바로 답 주지 않고 힌트 제공)
- 비슷한 문제 추천
- 동기부여 메시지
- 휴식 권유 (번아웃 감지 시)

### Step 5: 리포트 확인

1. **리포트** 탭에서 학습 현황 확인
2. 확인 가능한 내용:
   - 일일/주간 학습량
   - 과목별 진행률
   - 연속 학습일 (스트릭)
   - 획득 배지

### Step 6: 인강 커리큘럼 생성 (선택)

1. **커리큘럼** 탭 클릭
2. **목표일 설정** (수능, 모의고사 등 퀵버튼 제공)
3. **과목별 학습 시간** 입력 (입력하지 않은 과목은 자동 제외)
4. **강좌 검색** → 과목 필터 또는 강사명 검색
5. 강좌 선택 후 **이어듣기 설정** (이미 들은 강의가 있다면)
6. **퀘스트 생성** → 강의/복습/문제풀이 자동 배분
7. **플래너에 추가** 클릭

### Step 7: 꿀팁 활용

1. **꿀팁** 탭에서 앱 사용법, 강사 추천, 학습 전략 확인
2. 각 페이지 하단의 **포스트잇 메모**에서 상황별 팁 확인
3. **인강 강사 추천**: 과목별 추천 강사와 특징
4. **학습 전략**: 수능 대비 효과적인 공부법

---

## 🛠 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS 4, Zustand |
| **Backend** | Hono.js, Bun/Node.js, TypeScript |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth, Google OAuth |
| **AI Engine** | questyCoachAgent (Multi-Agent System) |
| **LLM** | Claude, Gemini, GPT (via OpenRouter) |
| **Deployment** | Vercel (Frontend), 자체 서버 (Backend) |

---

## 📁 프로젝트 구조

```
questyBook/
├── questyCoachAgent/          # AI 코칭 에이전트 시스템
│   └── src/
│       ├── core/agents/       # 5개 전문 에이전트
│       ├── memory/            # Memory Lane 시스템
│       └── quest/             # 퀘스트 시스템
│
├── packages/
│   ├── backend/               # Hono.js API 서버
│   │   └── src/routes/        # API 라우트 (7개)
│   │
│   └── frontend/              # React UI
│       └── src/
│           ├── pages/         # 10개 페이지
│           └── components/    # UI 컴포넌트
│
├── specs/                     # 기획 문서
├── FEATURES.md                # 상세 기능 문서
└── README.md
```

---

## 🔌 API 엔드포인트

### 인증
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/login` | 로그인 |

### AI 코칭
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/coach/students` | 학생 생성 (온보딩) |
| POST | `/api/coach/message` | AI 코치와 대화 |
| GET | `/api/coach/student/:id` | 학생 프로필 조회 |

### 학습 계획
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/plan` | 플랜 생성 |
| GET | `/api/plan/:id` | 플랜 상세 조회 |
| GET | `/api/plan/student/:studentId` | 학생별 플랜 목록 |

### 퀘스트
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/quest/today/:studentId` | 오늘의 퀘스트 |
| POST | `/api/quest/:id/complete` | 퀘스트 완료 |

### 생성
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/generate/plan` | AI 학습 계획 생성 |
| POST | `/api/generate/book-analysis` | 교재 AI 분석 |

---

## 📚 추가 문서

- [FEATURES.md](./FEATURES.md) - 상세 기능 현황 (사용자/개발자용)
- [specs/ai-coach-system/](./specs/ai-coach-system/) - AI 코치 시스템 스펙

---

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 라이선스

MIT License - 자유롭게 사용하세요!

---

## ❓ 문제 해결 (Troubleshooting)

### Windows에서 Bun 오류 발생 시

```powershell
# Bun 대신 tsx 사용
cd packages/backend
npx tsx --watch src/index.ts
```

### `rm -rf` 명령어 오류 (Windows)

Windows에서 `pnpm clean` 실행 시 오류가 발생할 수 있습니다:

```powershell
# 수동으로 삭제
Remove-Item -Recurse -Force node_modules, packages/frontend/dist, packages/backend/dist
```

### pnpm 설치 오류

```bash
# npm으로 pnpm 재설치
npm install -g pnpm@latest

# 캐시 삭제 후 재설치
pnpm store prune
pnpm install
```

### 포트 충돌

```bash
# 사용 중인 포트 확인 (macOS/Linux)
lsof -i :3001
lsof -i :5173

# Windows
netstat -ano | findstr :3001
netstat -ano | findstr :5173
```

### Supabase 연결 오류

1. Supabase 대시보드에서 프로젝트 URL과 키 확인
2. `.env` 파일의 환경 변수 재확인
3. Supabase 프로젝트의 API 설정에서 허용된 도메인 확인

---

## 💬 문의

- **Issues**: [GitHub Issues](https://github.com/Aithor-organization/questy/issues)
- **Email**: contact@aithor.org

---

## 📝 최근 업데이트

- **v0.1.0** (2026-01)
  - 인강 커리큘럼 생성 기능 추가
  - 전체 페이지 꿀팁 가이드 추가
  - Google OAuth 로그인 지원
  - 프로필 수정 기능 추가
  - Windows 플랫폼 지원 개선
