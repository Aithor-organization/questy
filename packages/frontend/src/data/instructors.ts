/**
 * 인강 강사 데이터
 * 수험생 커뮤니티(오르비, 수만휘, 펨코 등) 빅데이터 기반 2026 수능 강사 총정리
 */

export interface Instructor {
  id: string;
  name: string;
  subject: string;
  subSubject?: string;
  platform: '메가스터디' | '대성마이맥' | 'EBSi' | '이투스';
  keywords: string[];
  style: string;
  description: string;
  recommendedFor: string[];
  tier: 'standard' | 'skill' | 'concept';
}

export interface SubjectTips {
  subject: string;
  icon: string;
  description: string;
  tips: string[];
}

// ===== 수학 강사 =====
export const mathInstructors: Instructor[] = [
  {
    id: 'math-hyunwoo',
    name: '현우진',
    subject: '수학',
    platform: '메가스터디',
    keywords: ['숲을 보는 개념', '뉴런', '매직'],
    style: '본질적 이해, 철학적 접근',
    description: '수학의 문제 풀이를 하나의 철학으로 승화시킨 강사. 개념 강의인 \'뉴런\'은 단순 공식 암기가 아닌 수학적 사고방식 자체를 가르치는 것으로 유명.',
    recommendedFor: ['수학의 본질과 원리를 깊이 이해하고 싶은 학생', '개념이 왜 그렇게 되는지 궁금한 학생'],
    tier: 'standard'
  },
  {
    id: 'math-kim',
    name: '김기훈',
    subject: '수학',
    platform: '메가스터디',
    keywords: ['기훈쌤의 개념완성', '정석적'],
    style: '명료한 정리, 체계적',
    description: '수학의 정석을 기반으로 한 명료하고 체계적인 강의. 기본에 충실한 개념 설명으로 탄탄한 기초를 쌓을 수 있음.',
    recommendedFor: ['체계적인 개념 정리가 필요한 학생', '정석적인 학습법을 선호하는 학생'],
    tier: 'standard'
  },
  {
    id: 'math-jeonghoon',
    name: '정승제',
    subject: '수학',
    platform: '메가스터디',
    keywords: ['수학의 바이블', '자이스토리'],
    style: '구원자, 기초부터 차근차근',
    description: '수포자들의 구원자로 불림. 기초가 없는 학생도 따라올 수 있도록 아주 쉽고 친절하게 설명. 모든 과정을 다 보여주는 스타일.',
    recommendedFor: ['수학을 처음 시작하거나 다시 시작하는 학생', '기초가 부족해서 강의를 따라가기 힘든 학생'],
    tier: 'concept'
  },
  {
    id: 'math-kim-minkyu',
    name: '김민규',
    subject: '수학',
    platform: '대성마이맥',
    keywords: ['찐텐', '고효율', '문제풀이'],
    style: '실전 중심, 빠른 풀이',
    description: '최근 가장 핫한 대세 강사. 군더더기 없는 스킬 강의로 문제 풀이 속도를 극대화. 강의 시간이 짧아 효율적인 학습 가능.',
    recommendedFor: ['개념은 아는데 문제 풀이가 느린 학생', '효율적인 학습을 원하는 학생'],
    tier: 'skill'
  },
  {
    id: 'math-jang',
    name: '장영진',
    subject: '수학',
    platform: '대성마이맥',
    keywords: ['장진수학', '스킬', '표정리'],
    style: '스킬 위주, 계산 단축',
    description: '스킬러 스타일의 대표 강사. 복잡한 계산을 최소화하는 노하우를 전수. 고득점을 노리는 상위권에게 효과적.',
    recommendedFor: ['계산이 복잡해서 시간이 부족한 학생', '기계적으로 빠르게 푸는 스킬을 원하는 학생'],
    tier: 'skill'
  }
];

// ===== 국어 강사 =====
// 2026학년도 수능 대비 최신 정보 (유대종 대성 복귀, 김상훈/전형태 메가 이적)
export const koreanInstructors: Instructor[] = [
  // === 대성마이맥 ===
  {
    id: 'korean-kimseungri',
    name: '김승리',
    subject: '국어',
    subSubject: '독서/문학',
    platform: '대성마이맥',
    keywords: ['AllOfKICE', '유기적연결', '올오카'],
    style: '통합 논리, 체계적 매뉴얼',
    description: '지문과 지문, 문장과 문장을 연결하는 \'유기성\'을 강조. 구조독해와 그읽그풀 사이의 밸런스를 잡아주는 강의.',
    recommendedFor: ['구조독해와 그읽그풀 사이 밸런스를 원하는 학생', '체계적인 행동 강령(매뉴얼)을 원하는 학생'],
    tier: 'standard'
  },
  {
    id: 'korean-yudaejong',
    name: '유대종',
    subject: '국어',
    subSubject: '언어와 매체',
    platform: '대성마이맥',
    keywords: ['국어치트키', '언매총론', 'OVS', '대성복귀'],
    style: '실전 태도, 재미있는 강의',
    description: '딱딱한 분석보다 \'실전에서 어디에 힘을 주고 뺄지(Line)\'를 알려줌. 언매 1타로 재밌고 쉬운 설명이 특징.',
    recommendedFor: ['문법(언매)을 재밌고 쉽게 끝내고 싶은 학생', '지루한 수업을 못 견디는 학생'],
    tier: 'skill'
  },
  {
    id: 'korean-kimjemma',
    name: '김젬마',
    subject: '국어',
    subSubject: '문학',
    platform: '대성마이맥',
    keywords: ['스토리텔링', '문학몰입', '배경지식'],
    style: '서사적 설명, 문학 이해',
    description: '작품의 뒷이야기나 배경을 스토리텔링으로 풀어 문학을 \'이해\'시킴. 고전시가도 쉽게 접근 가능.',
    recommendedFor: ['문학이 너무 재미없는 학생', '고전시가가 외계어처럼 들리는 학생'],
    tier: 'concept'
  },
  {
    id: 'korean-jungsukmin',
    name: '정석민',
    subject: '국어',
    subSubject: '독서',
    platform: '대성마이맥',
    keywords: ['비독원', '문장호흡', '미시독해'],
    style: '정밀한 분석, 정확도 향상',
    description: '한 문장 한 문장을 깊이 있게 씹어 먹으며 사고 과정을 교정. 글을 날림으로 읽는 습관을 고쳐줌.',
    recommendedFor: ['글을 날림으로 읽는 습관이 있는 학생', '정확도를 높이고 싶은 상위권'],
    tier: 'skill'
  },
  // === 메가스터디 ===
  {
    id: 'korean-kangminchul',
    name: '강민철',
    subject: '국어',
    subSubject: '독서/문학',
    platform: '메가스터디',
    keywords: ['강기분', '구조독해', '치밀한분석'],
    style: '체계적, 미시/거시적 분석',
    description: '평가원의 출제 코드를 낱낱이 해부하여 완벽한 \'틀\'을 제공. 압도적인 정보 처리 능력을 키워줌.',
    recommendedFor: ['감으로 푸는 게 싫은 학생', '압도적인 정보 처리 능력을 기르고 싶은 학생'],
    tier: 'standard'
  },
  {
    id: 'korean-kimdongwook',
    name: '김동욱',
    subject: '국어',
    subSubject: '독서',
    platform: '메가스터디',
    keywords: ['일취월장', '반응', 'JustReading'],
    style: '본질적 이해, 깊이 있는 독해',
    description: '스킬보다 글 자체에 호기심을 갖고 반응하는 \'본질적 독해력\'을 중시. 복잡한 필기 없이 진득하게 읽는 힘.',
    recommendedFor: ['복잡한 필기가 싫은 학생', '아침 6시에 일어나서 국어 공부하는 습관을 기르고 싶은 학생'],
    tier: 'concept'
  },
  {
    id: 'korean-kimsanghoon',
    name: '김상훈',
    subject: '국어',
    subSubject: '문학',
    platform: '메가스터디',
    keywords: ['문학론', '정서태도', 'O/X판별', '메가이적'],
    style: '논리적 접근, 명확한 기준',
    description: '애매한 문학 선지를 O/X로 가르는 명확한 기준(문학론)을 세워줌. 문학의 논리화 선구자.',
    recommendedFor: ['"문학은 귀에 걸면 귀걸이"라며 답답해하는 학생', '문학 선지가 항상 애매한 학생'],
    tier: 'skill'
  },
  {
    id: 'korean-jeonhyungtae',
    name: '전형태',
    subject: '국어',
    subSubject: '언어와 매체',
    platform: '메가스터디',
    keywords: ['언매올인원', '나기출', '깔끔함', '메가이적'],
    style: '군더더기 없음, 가독성 최고',
    description: '군더더기 없는 설명과 뛰어난 교재 가독성으로 호불호가 없음. 언매를 가장 효율적이고 정석적으로.',
    recommendedFor: ['문법(언매)이나 화작을 가장 효율적이고 정석적으로 끝내고 싶은 학생'],
    tier: 'standard'
  },
  {
    id: 'korean-leewoonjun',
    name: '이원준',
    subject: '국어',
    subSubject: '독서',
    platform: '메가스터디',
    keywords: ['브레인크래커', '스키마', '리트식논리'],
    style: '논리적 도식화, 이항대립',
    description: '3원칙(이항대립 등)을 이용해 정보를 도식화하여 풀이. 과학/철학 지문에 특히 강력.',
    recommendedFor: ['과학/철학 지문에 강해지고 싶은 학생', '논리적 완결성을 추구하는 최상위권'],
    tier: 'skill'
  }
];

// ===== 영어 강사 =====
export const englishInstructors: Instructor[] = [
  {
    id: 'english-leemyunghak',
    name: '이명학',
    subject: '영어',
    platform: '대성마이맥',
    keywords: ['신택스(Syntax)', '알고리즘', '부드러운 카리스마'],
    style: '구문 분석, 논리적 흐름',
    description: '"이명학은 종교다"라는 말이 있을 정도로 팬덤이 두터움. Syntax 강의는 대한민국 수능 영어 구문 강의의 표준.',
    recommendedFor: ['감으로 읽는 습관을 고치고 싶은 학생', '차분하고 정석적인 강의를 선호하는 학생'],
    tier: 'standard'
  },
  {
    id: 'english-joohyeyeon',
    name: '주혜연',
    subject: '영어',
    platform: 'EBSi',
    keywords: ['해석공식', 'EBS의 구세주', '친절함'],
    style: '친절한 설명, 기초부터',
    description: '사설 인강 강사들을 제치고 엄청난 인기를 누리는 EBS 1타. 해석공식 강의는 노베이스 학생들이 구문을 익히기에 가장 친절.',
    recommendedFor: ['영어 기초가 부족한 학생', '사교육비 부담 없이 최고의 효율을 내고 싶은 학생'],
    tier: 'concept'
  },
  {
    id: 'english-jojungsik',
    name: '조정식',
    subject: '영어',
    platform: '메가스터디',
    keywords: ['현실적 독해', '유쾌함', '믿어봐'],
    style: '실전 대처, 재미있는 강의',
    description: '완벽한 해석보다는 "시험장에서 모르는 문장이 나왔을 때 어떻게 대처하느냐"를 알려줌. 강의가 매우 유쾌하고 재밌음.',
    recommendedFor: ['지루한 강의는 딱 질색인 학생', '실전에서 멘탈이 자주 흔들리는 학생'],
    tier: 'skill'
  },
  {
    id: 'english-shawn',
    name: '션T',
    subject: '영어',
    platform: '대성마이맥',
    keywords: ['키스로직(Kiss Logic)', 'AB/PS 구조', '가성비'],
    style: '효율적, 단순화된 논리',
    description: '최근 몇 년간 오르비 등 커뮤니티에서 가장 핫한 강사. 복잡한 지문을 A와 B라는 두 가지 대립항으로 단순화시켜 푸는 AB 논리가 매우 강력.',
    recommendedFor: ['영어가 절대평가인 만큼 최소한의 시간 투자로 1등급을 효율적으로 따고 싶은 학생'],
    tier: 'skill'
  }
];

// ===== 사회탐구 강사 =====
export const socialStudiesInstructors: Instructor[] = [
  {
    id: 'social-imjunghwan',
    name: '임정환',
    subject: '사회탐구',
    subSubject: '생윤/사문/윤사',
    platform: '대성마이맥',
    keywords: ['재미 & 힐링', '예능보다 재밌음'],
    style: '재미있는 설명, 쉬운 이해',
    description: '현재 사탐 전체에서 가장 폼이 좋은 강사 중 한 명. 강의가 예능보다 재밌다는 평이 많아 지루할 틈이 없음.',
    recommendedFor: ['사탐 공부하다가 졸기 싫은 학생', '쉽고 재미있게 개념을 잡고 싶은 학생'],
    tier: 'standard'
  },
  {
    id: 'social-leejiyoung',
    name: '이지영',
    subject: '사회탐구',
    subSubject: '생윤/사문/윤사',
    platform: '이투스',
    keywords: ['필기의 여왕', '동기부여', '쓴소리'],
    style: '예술적 필기, 인생 조언',
    description: '사탐의 아이콘. 칠판 필기가 예술의 경지라 노트 정리가 완벽하게 됨. 수업 중간의 \'쓴소리\'와 인생 조언이 수험 생활의 큰 버팀목.',
    recommendedFor: ['노트 필기를 좋아하고 꼼꼼하게 단권화하는 것을 선호하는 학생'],
    tier: 'concept'
  },
  {
    id: 'social-leegisang',
    name: '이기상',
    subject: '사회탐구',
    subSubject: '한국지리/세계지리',
    platform: '메가스터디',
    keywords: ['지리의 신', '아재 개그', '암기법'],
    style: '유쾌한 강의, 기발한 암기법',
    description: '"지리는 이기상"이라는 말이 공식처럼 통함. 특유의 아재 개그와 기상천외한 암기법으로 뇌에 지식을 박아줌.',
    recommendedFor: ['지리를 선택했다면 고민 없이 1순위'],
    tier: 'standard'
  },
  {
    id: 'social-yoonsunghoon',
    name: '윤성훈',
    subject: '사회탐구',
    subSubject: '사회문화',
    platform: '메가스터디',
    keywords: ['도표의 신', 'M-Skill'],
    style: '도표 문제 전문',
    description: '사회문화의 킬러인 \'도표(통계) 문제\'를 푸는 스킬(M-Skill)이 독보적. 도표 때문에 윤성훈을 듣는다는 말이 있을 정도.',
    recommendedFor: ['사회문화 도표 문제만 보면 머리가 하얘지는 학생'],
    tier: 'skill'
  },
  {
    id: 'social-leedaji',
    name: '이다지',
    subject: '사회탐구',
    subSubject: '동아시아사/세계사',
    platform: '메가스터디',
    keywords: ['스토리텔링', '비주얼', '연표'],
    style: '드라마처럼 설명',
    description: '역사의 흐름을 드라마처럼 이야기로 풀어서 설명해 줌. 교재 퀄리티가 매우 예쁘고 좋기로 유명.',
    recommendedFor: ['역사를 이야기 듣듯이 자연스럽게 흐름을 타고 싶은 학생'],
    tier: 'standard'
  }
];

// ===== 과학탐구 강사 =====
export const scienceInstructors: Instructor[] = [
  // 물리
  {
    id: 'science-baegibeom',
    name: '배기범',
    subject: '과학탐구',
    subSubject: '물리학',
    platform: '메가스터디',
    keywords: ['물리의 스탠다드', '필수본', '3순환'],
    style: '정석적, 본질적 이해',
    description: '명실상부한 물리 1타. 개념부터 심화 문제 풀이까지 커리큘럼이 가장 탄탄함. 물리적 상황을 해석하는 \'본질적인 눈\'을 길러줌.',
    recommendedFor: ['물리 공부를 정석대로 제대로 하고 싶은 학생', '어떤 난이도에도 흔들리지 않는 실력을 원하는 학생'],
    tier: 'standard'
  },
  {
    id: 'science-banginhyeok',
    name: '방인혁',
    subject: '과학탐구',
    subSubject: '물리학',
    platform: '대성마이맥',
    keywords: ['빠른 풀이', '스킬의 정점', '깔끔함'],
    style: '실전용 풀이, 계산 최소화',
    description: '최근 최상위권에서 가장 핫한 강사. 문제 풀이 속도가 압도적으로 빠르며, 군더더기 없는 \'실전용 풀이\'를 전수.',
    recommendedFor: ['개념은 아는데 시간이 부족한 학생', '효율적이고 빠른 문제 풀이를 원하는 상위권'],
    tier: 'skill'
  },
  // 화학
  {
    id: 'science-kimjun',
    name: '김준',
    subject: '과학탐구',
    subSubject: '화학',
    platform: '대성마이맥',
    keywords: ['화학의 신', '미친 풀이법', '준식'],
    style: '혁신적 풀이법',
    description: '현재 화학 상위권 학생들의 \'종교\'와 같음. 기존의 상식을 깨는 획기적인 풀이법(일명 \'준식\')으로 복잡한 계산 문제를 순식간에 풀어버림.',
    recommendedFor: ['화학 1등급~만점을 목표로 하는 학생', '기존 풀이법으로 한계를 느끼는 학생'],
    tier: 'skill'
  },
  {
    id: 'science-goseokryong',
    name: '고석용',
    subject: '과학탐구',
    subSubject: '화학',
    platform: '메가스터디',
    keywords: ['베테랑', '화학의 정석', '논리적 구조'],
    style: '정석적, 호불호 없음',
    description: '오랫동안 사랑받아온 메가스터디 1타. 문제 풀이의 논리적인 구조를 매우 잘 잡아줌. 가장 호불호 없이 들을 수 있는 강의.',
    recommendedFor: ['화학의 기본부터 심화까지 탄탄하게 쌓고 싶은 학생'],
    tier: 'standard'
  },
  // 생명과학
  {
    id: 'science-baekho',
    name: '백호',
    subject: '과학탐구',
    subSubject: '생명과학',
    platform: '메가스터디',
    keywords: ['압도적 점유율', '섬세한 개념', '스킬'],
    style: '쉽고 친절한 설명',
    description: '이과생이라면 모를 수가 없는 생명과학의 대명사. 노베이스도 이해할 수 있을 만큼 설명이 쉽고 친절함. 유전 스킬도 딱 필요한 만큼 정리.',
    recommendedFor: ['생명과학을 처음 시작하거나 가장 안정적인 1등급 커리큘럼을 원하는 학생'],
    tier: 'standard'
  },
  {
    id: 'science-hanjongcheol',
    name: '한종철',
    subject: '과학탐구',
    subSubject: '생명과학',
    platform: '메가스터디',
    keywords: ['논리 철학', '유전 스킬', '자료 분석'],
    style: '논리적 접근, 체계적 훈련',
    description: '유전 문제 풀이의 \'논리(Logic)\'를 강조. 문제를 만났을 때 어떤 순서로 생각해야 하는지 체계적으로 훈련시킴.',
    recommendedFor: ['유전 문제가 막막하고 논리적인 접근법을 배우고 싶은 학생'],
    tier: 'skill'
  },
  // 지구과학
  {
    id: 'science-ojihoon',
    name: '오지훈',
    subject: '과학탐구',
    subSubject: '지구과학',
    platform: '메가스터디',
    keywords: ['OZ교', '지구과학 그 자체', '유쾌함'],
    style: '완벽한 커리큘럼, 재미있는 강의',
    description: '타의 추종을 불허하는 압도적 1타. 방대한 개념을 빠짐없이 설명하며, 강의가 매우 유쾌하고 재미있음. "그냥 오지훈 들으면 된다"가 정설.',
    recommendedFor: ['지구과학 선택자라면 묻지도 따지지도 않고 추천 1순위'],
    tier: 'standard'
  },
  {
    id: 'science-leeheoonsik',
    name: '이훈식',
    subject: '과학탐구',
    subSubject: '지구과학',
    platform: '대성마이맥',
    keywords: ['식스센스', '자료 분석 심화', '실전'],
    style: '심화 자료 해석',
    description: '오지훈이 개념의 왕이라면, 이훈식은 \'심화 자료 해석\'의 왕. 최근 수능 트렌드인 \'어려운 자료 해석\'을 뚫어내는 훈련을 강하게 시킴.',
    recommendedFor: ['개념은 다 뗐고 고난도 자료 해석 연습을 통해 만점을 노리는 상위권'],
    tier: 'skill'
  }
];

// 전체 강사 목록
export const allInstructors: Instructor[] = [
  ...mathInstructors,
  ...koreanInstructors,
  ...englishInstructors,
  ...socialStudiesInstructors,
  ...scienceInstructors
];

// 과목별 팁
export const subjectTips: SubjectTips[] = [
  {
    subject: '수학',
    icon: '📐',
    description: '"피지컬과 3단계 로드맵"',
    tips: [
      '3단계 커리큘럼: 개념(겨울~2월) → 기출(3~6월) → 실전(6월 이후)',
      '피지컬 훈련: 모의고사 연속 4회 풀기로 체력 키우기',
      '오답 분석: 15분 고민 후 해설지 첫 줄만 보고 다시 풀기'
    ]
  },
  {
    subject: '국어',
    icon: '📖',
    description: '"성적대별 접근과 2026 꿀조합"',
    tips: [
      '하위권(5~6등급 이하): 문제 풀이보다 어휘력과 문장 단위 독해 먼저',
      '중상위권: 기출 분석으로 평가원의 코드 읽기',
      '아침 8시 40분 뇌세팅: 기상 후 비문학 지문 3개 읽기',
      '[2026 대성패스] 김승리(올오카) + 유대종(언매총론)',
      '[2026 메가패스] 강민철/김동욱 + 김상훈(문학) + 전형태(언매)',
      '[2026 환상조합] 독서(강민철/김승리) + 문학(김상훈) + 언매(유대종/전형태)'
    ]
  },
  {
    subject: '영어',
    icon: '🔤',
    description: '"자린고비 암기법과 틈새 공략"',
    tips: [
      '자린고비 단어 암기: 단어 1초 - 뜻 1초 빠르게 여러 번 반복',
      '듣기 평가는 소음 속에서 연습 (백색 소음 익숙해지기)',
      '틈새 시간 활용: 이동시간에 단어, 점심 후 듣기'
    ]
  },
  {
    subject: '사회탐구',
    icon: '🌏',
    description: '"코드가 맞아야 한다"',
    tips: [
      '강사 선생님의 개그 코드/목소리가 안 맞으면 1년 내내 괴로움',
      '쌍윤(생윤+윤사), 쌍지(한지+세지) 조합 시너지 활용',
      '반드시 맛보기 강의 보고 내 귀에 꽂히는 강사 선택'
    ]
  },
  {
    subject: '과학탐구',
    icon: '🧪',
    description: '"타임 어택 시간 싸움"',
    tips: [
      '개념 아는 것 넘어 기계적으로 빠르게 푸는 연습 필수',
      '컨텐츠(모의고사) 퀄리티 좋은 강사 선택이 핵심',
      '화학/생명은 시간 단축 스킬 강사가 상위권에서 인기'
    ]
  }
];
