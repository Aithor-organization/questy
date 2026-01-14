/**
 * 학습 전략 데이터
 * 상위권 도약 성공 케이스(의대생, 서울대 합격생)들의 검증된 방법론
 */

export interface StudyTip {
  id: string;
  title: string;
  icon: string;
  category: 'planning' | 'method' | 'subject' | 'lifestyle' | 'mental';
  description: string;
  details: string[];
  actionItems?: string[];
}

export interface QuickAction {
  id: string;
  title: string;
  description: string;
}

// 학습 전략 데이터
export const studyTips: StudyTip[] = [
  // ===== 계획 수립 =====
  {
    id: 'reverse-planning',
    title: '거꾸로 계획법',
    icon: '🔄',
    category: 'planning',
    description: '목표 대학부터 역산하여 구체적인 단기 목표를 도출하는 방법',
    details: [
      '수능 당일: 목표 대학 및 등급 설정 (예: 연세대 경영학과 11111)',
      '9월 모평: 전 과목 1~2등급 진입 목표',
      '6월 모평: 개념 완강 + 기출 1회독 완료',
      '3월 학평: 겨울방학 공부한 과목 확인',
      '이번 달 목표: 구체적인 문제집/단원 끝내기'
    ],
    actionItems: [
      '수능 → 9월 → 6월 → 3월 목표 점수 정하기',
      '목표를 플래너에 눈에 띄게 적어두기'
    ]
  },
  {
    id: '80-percent-rule',
    title: '80% 법칙',
    icon: '📊',
    category: 'planning',
    description: '계획의 80%만 채워서 버퍼 시간을 확보하는 전략',
    details: [
      '가용 시간의 80%만 계획으로 채우기',
      '나머지 20%는 예상치 못한 변수를 위한 버퍼',
      '어려운 문제, 컨디션 저하 대비',
      '계획이 밀리지 않아 성취감 유지'
    ],
    actionItems: [
      '일주일 시간표에서 순수 자습 가능 시간 색칠하기',
      '그 시간의 80%만 계획으로 채우기'
    ]
  },
  {
    id: 'five-day-system',
    title: '5일 단위 운영법',
    icon: '📅',
    category: 'planning',
    description: '월~금 5일 안에 일주일 분량을 끝내는 시스템',
    details: [
      '월~수: 미친 듯이 진도 빼기 (인강+복습)',
      '목: 월~수 못 지킨 계획 보충 또는 복습',
      '금: 주간 테스트 또는 취약 파트 정리',
      '토/일: 성공시 휴식, 실패시 보충의 날'
    ],
    actionItems: [
      '5일 기준으로 계획표 재설계하기',
      '주말을 보상/버퍼로 활용하기'
    ]
  },

  // ===== 학습 방법 =====
  {
    id: 'lecture-vs-self-study',
    title: '강의는 지팡이, 자습은 발',
    icon: '🚶',
    category: 'method',
    description: '수능 공부는 등산과 같다. 강의가 아닌 자습이 실력을 만든다.',
    details: [
      '강사의 강의(인강/현강)는 등산을 도와주는 지팡이',
      '실제로 산을 오르는 건 내 발(자습)',
      '강의만 듣고 공부했다고 착각하지 않기',
      '하루 최소 4시간 이상 자습 시간 먼저 확보'
    ],
    actionItems: [
      '자습 시간을 먼저 확보한 뒤에 강의 배치하기',
      '강의:자습 비율 최소 1:2 이상 유지하기'
    ]
  },
  {
    id: 'white-paper-review',
    title: '백지 복습',
    icon: '📝',
    category: 'method',
    description: '아무것도 보지 않고 배운 내용을 써보는 메타인지 훈련',
    details: [
      '강의 듣고 바로 문제 풀지 않기 (잔상으로 푸는 건 실력이 아님)',
      'A4 용지에 방금 배운 목차와 핵심 키워드 적기',
      '공식 유도 과정을 아무것도 안 보고 써보기',
      '막히는 부분이 진짜 내 약점'
    ],
    actionItems: [
      '오늘 배운 단원을 백지에 써보기',
      '막힌 부분만 다시 복습하기'
    ]
  },
  {
    id: 'error-note-method',
    title: '오답 노트 재정의',
    icon: '❌',
    category: 'method',
    description: '틀린 문제를 오려 붙이는 노가다가 아닌, 이유를 한 문장으로 적기',
    details: [
      '문제 번호 옆에 내가 틀린 이유를 한 문장으로 적기',
      '"계산 실수" (X) → "로그 진수 조건 확인 안 함" (O)',
      '"단어 몰랐음" (X) → "다의어 Subject의 피실험자 뜻 몰랐음" (O)',
      '같은 실수 반복하지 않도록 패턴화'
    ],
    actionItems: [
      '오늘 틀린 문제 3개의 이유를 한 문장씩 적기',
      '일주일 후 같은 유형 문제로 테스트하기'
    ]
  },

  // ===== 과목별 전략 =====
  {
    id: 'math-physical',
    title: '수학 피지컬 훈련',
    icon: '💪',
    category: 'subject',
    description: '하루 4회 연속 모의고사로 수학 체력 키우기',
    details: [
      '목적: 수능 날 수학 시간(100분)에 뇌가 지치지 않게 하기',
      '방법: 아침 8시부터 저녁 6시까지 수학 모의고사 4회 연속',
      '주말이나 공휴일 하루를 "수학의 날"로 지정',
      '이 경험이 한 번이라도 있으면 수능 날 100분이 짧게 느껴짐'
    ],
    actionItems: [
      '다음 주말에 수학 4연속 모의고사 도전하기',
      '시간 재면서 실전처럼 풀기'
    ]
  },
  {
    id: 'korean-morning-routine',
    title: '국어 아침 8시 40분 뇌세팅',
    icon: '🌅',
    category: 'subject',
    description: '수능 1교시 국어 시작 시간에 맞춘 아침 루틴',
    details: [
      '수능 1교시 국어 시작 시간: 8시 40분',
      '이 시간에 뇌가 최고 효율을 내려면 최소 6시 30분 기상',
      '일어나자마자 스마트폰 보지 말기',
      '비문학(독서) 지문 3개 읽기 (문제 풀기보다 읽고 요약하는 워밍업)'
    ],
    actionItems: [
      '내일 아침 6시 30분 알람 맞추기',
      '일어나자마자 국어 지문 읽기'
    ]
  },
  {
    id: 'english-stingy-vocab',
    title: '영어 자린고비 암기법',
    icon: '💰',
    category: 'subject',
    description: '단어를 빠르게 여러 번 보는 효율적인 암기법',
    details: [
      '단어장 하나를 잡고 영어 단어 1초 - 한글 뜻 1초 보고 바로 넘기기',
      '쓰면서 외우지 않기 (시간 낭비)',
      '눈으로 빠르게 여러 번(N회독) 바르기',
      '1시간 동안 단어 100개를 10번 반복해서 훑어보기'
    ],
    actionItems: [
      '오늘 30분 동안 단어 100개 빠르게 5번 훑기',
      '3일 후 같은 단어 테스트하기'
    ]
  },

  // ===== 생활 관리 =====
  {
    id: 'three-hour-prison',
    title: '3시간 감금 공부법',
    icon: '⏰',
    category: 'lifestyle',
    description: '대치동 현강처럼 3시간 연속 몰입하는 훈련',
    details: [
      '대치동 현강은 중간에 화장실 못 감',
      '타이머를 3시간(180분)에 맞추기',
      '이 시간 동안 물 마시기, 화장실 가기, 핸드폰 보기 금지',
      '오직 인강 듣기와 필기만',
      '엉덩이 힘이 생겨서 순공 시간이 폭발적으로 늘어남'
    ],
    actionItems: [
      '오늘 3시간 타이머 맞추고 몰입 훈련하기',
      '중간에 일어나지 않고 버티기'
    ]
  },
  {
    id: 'zombie-alarm',
    title: '1분 간격 알람 기상법',
    icon: '⏰',
    category: 'lifestyle',
    description: '확실하게 일어나는 극단적인 기상 방법',
    details: [
      '7시에 일어나야 한다면 6시 50분부터 7시까지 1분 간격 알람 10개 맞추기',
      '자기 전에 "나는 내일 7시에 무조건 일어난다"를 10번 소리 내어 외치고 자기',
      '뇌에 자기 암시를 걸면 신기하게 눈이 떠짐'
    ],
    actionItems: [
      '내일 기상 시간 10분 전부터 1분 간격 알람 설정하기',
      '자기 전 기상 시간 10번 외치기'
    ]
  },
  {
    id: 'dday-diet',
    title: 'D-Day 식단 관리',
    icon: '🍚',
    category: 'lifestyle',
    description: '시험 전날/당일 음식 선택 가이드',
    details: [
      '수능 전날이나 모의고사 날 기름진 보양식 금지 (장어, 소고기 등)',
      '긴장된 위장에 부담을 줘서 다음 날 시험을 망침',
      '평소에 먹던 된장국, 계란찜, 흰쌀밥 같은 소화 잘 되는 음식이 최고',
      '익숙함이 최고'
    ],
    actionItems: [
      '시험 전날 메뉴를 미리 정해두기',
      '소화가 잘 되는 단백한 음식 선택하기'
    ]
  },

  // ===== 멘탈 관리 =====
  {
    id: 'daily-log',
    title: '데일리 로그 & 감사 일기',
    icon: '📔',
    category: 'mental',
    description: '잠들기 전 5분, 내일의 나를 위한 멘탈 청소',
    details: [
      '플래너 귀퉁이에 딱 3줄만 쓰기',
      '1. 아쉬운 점: "점심 먹고 졸아서 영어 단어 못 외웠다"',
      '2. 해결책: "내일은 점심 먹자마자 서서 스탠딩 책상에서 외운다"',
      '3. 감사한 점 3가지: 긍정적인 감정으로 하루를 닫아야 숙면'
    ],
    actionItems: [
      '오늘 잠자기 전 아쉬운 점 + 해결책 + 감사 3가지 적기',
      '내일 아침에 해결책 바로 실천하기'
    ]
  },
  {
    id: 'hybrid-planner',
    title: '하이브리드 플래너',
    icon: '📱',
    category: 'mental',
    description: '디지털과 종이 플래너의 장점을 조합한 시스템',
    details: [
      '스케줄 관리 (Digital): 학원/인강 일정 등 변동 잦은 일정은 앱으로',
      '감정 및 피드백 (Paper): 오늘의 공부 피드백과 성취감은 반드시 종이에 손으로',
      '손으로 긋는 행위가 뇌에 "나 오늘 해냈다"는 신호',
      '슬럼프 방지에 효과적'
    ],
    actionItems: [
      '일정 관리는 캘린더 앱으로 이전하기',
      '종이 플래너에는 피드백과 감정만 적기'
    ]
  },
  {
    id: 'lecture-choice',
    title: '인강 선택의 기준',
    icon: '🎯',
    category: 'mental',
    description: '맛보기(OT)보다 실제 1강을 들어라',
    details: [
      'OT는 강사가 가장 준비를 많이 하고 매력적으로 보이는 영상',
      '실제 수업 1강이나 가장 어렵다고 소문난 단원의 강의 들어보기',
      '그때도 이해가 잘 되고 귀에 꽂히면 그 강사가 진짜 "나에게 맞는 강사"',
      '남이 추천해도 내 귀에 안 들리면 소용없음'
    ],
    actionItems: [
      '지금 고민 중인 강사의 1강 또는 어려운 단원 강의 들어보기',
      '10분 이상 들어보고 판단하기'
    ]
  }
];

// 지금 당장 실행할 것 (Quick Actions)
export const quickActions: QuickAction[] = [
  {
    id: 'qa-1',
    title: '플래너 수정',
    description: '내일 계획을 짤 때 가용 시간의 80%만 채우세요'
  },
  {
    id: 'qa-2',
    title: '아침 기상',
    description: '내일 아침 6시 30분 알람을 맞추고, 일어나자마자 국어 지문을 읽으세요'
  },
  {
    id: 'qa-3',
    title: '단권화 준비',
    description: '탐구 과목 개념서 하나를 정해서 모든 기출/연계교재의 내용을 포스트잇으로 모으기 시작하세요'
  },
  {
    id: 'qa-4',
    title: '목표 역산하기',
    description: '수능 → 9월 → 6월 → 3월 목표 점수 정하기'
  },
  {
    id: 'qa-5',
    title: '시간표 색칠하기',
    description: '내가 진짜 공부할 수 있는 시간 확보하기'
  },
  {
    id: 'qa-6',
    title: '약점 과목 올인',
    description: '당분간 약한 과목(주로 수학)에 하루 70% 이상 투자하기'
  }
];

// 카테고리별 분류
export const tipCategories = {
  planning: { label: '계획 수립', icon: '📋', color: 'blue' },
  method: { label: '학습 방법', icon: '📚', color: 'green' },
  subject: { label: '과목별 전략', icon: '📐', color: 'purple' },
  lifestyle: { label: '생활 관리', icon: '🏠', color: 'orange' },
  mental: { label: '멘탈 관리', icon: '🧠', color: 'pink' }
} as const;
