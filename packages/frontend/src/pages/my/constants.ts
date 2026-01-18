/**
 * MyPage 상수 정의
 */

// 탐구 과목 옵션
export const SOCIAL_SUBJECTS = [
  '생활과윤리', '윤리와사상', '한국지리', '세계지리',
  '동아시아사', '세계사', '경제', '정치와법', '사회문화'
];

export const SCIENCE_SUBJECTS = [
  '물리학Ⅰ', '물리학Ⅱ', '화학Ⅰ', '화학Ⅱ',
  '생명과학Ⅰ', '생명과학Ⅱ', '지구과학Ⅰ', '지구과학Ⅱ'
];

// N수생 라벨
export const EXAM_YEAR_LABELS: Record<number, string> = {
  0: '현역 (고3)',
  1: '재수생',
  2: '삼수생',
  3: '그 이상',
};

// 인강 사이트 라벨
export const PLATFORM_LABELS: Record<string, string> = {
  megastudy: '메가스터디',
  etoos: '이투스',
  daesung: '대성마이맥',
  ebsi: 'EBSi',
  skyedu: '스카이에듀',
  jinhak: '진학사',
  other: '기타',
};

// 고정 과목
export const FIXED_SUBJECTS = ['국어', '수학', '영어', '한국사'];

// 등급 옵션
export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
