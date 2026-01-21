// src/types.ts
import { z } from "zod";
var ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
var WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"];
var DAY_LABELS = {
  mon: "\uC6D4",
  tue: "\uD654",
  wed: "\uC218",
  thu: "\uBAA9",
  fri: "\uAE08",
  sat: "\uD1A0",
  sun: "\uC77C"
};
var DAY_TO_JS_DAY = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};
var BookMetadataSchema = z.object({
  subject: z.string().optional(),
  // 과목: 수학, 국어, 영어, 과학탐구 등
  targetGrade: z.string().optional(),
  // 대상: 고1, 고2, 고3, N수생, 전학년
  bookType: z.string().optional(),
  // 유형: 개념서, 유형서, 기출문제집, 모의고사
  category: z.string().optional(),
  // Yes24 카테고리
  description: z.string().optional()
  // 간략 설명 (100자 이내)
});
var MaterialSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["book", "lecture", "video", "document"]),
  totalUnits: z.number().positive(),
  // 총 단원/강의 수
  unitNames: z.array(z.string()).optional(),
  // 각 단원명
  description: z.string().optional(),
  createdAt: z.string().datetime()
});
var StudyTipsSchema = z.object({
  importance: z.string(),
  // "중요도 높음", "자주 출제됨" 등
  keyPoints: z.array(z.string()),
  // 핵심 포인트
  commonMistakes: z.string().optional(),
  // 자주 하는 실수
  studyMethod: z.string().optional(),
  // 추천 학습법
  relatedUnits: z.string().optional()
  // 연계 단원
});
var DailyQuestSchema = z.object({
  id: z.string(),
  date: z.string(),
  // YYYY-MM-DD
  dayNumber: z.number().positive(),
  // D-day 기준 몇 번째 날
  title: z.string(),
  tasks: z.array(z.object({
    id: z.string(),
    description: z.string(),
    materialUnit: z.number().optional(),
    // 연결된 단원
    estimatedMinutes: z.number().positive(),
    completed: z.boolean().default(false)
  })),
  totalEstimatedMinutes: z.number(),
  completed: z.boolean().default(false),
  studyTips: StudyTipsSchema.optional()
  // AI 학습 팁 (수능 맞춤)
});
var StudyPlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  material: MaterialSchema,
  startDate: z.string(),
  // YYYY-MM-DD
  endDate: z.string(),
  // YYYY-MM-DD
  totalDays: z.number().positive(),
  dailyQuests: z.array(DailyQuestSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
var CreatePlanRequestSchema = z.object({
  title: z.string().min(1),
  materialType: z.enum(["book", "lecture", "video", "document"]),
  materialTitle: z.string().min(1),
  totalUnits: z.number().positive(),
  unitNames: z.array(z.string()).optional(),
  startDate: z.string(),
  endDate: z.string(),
  dailyStudyMinutes: z.number().positive().default(120),
  // 기본 2시간
  preferences: z.object({
    includeReview: z.boolean().default(true),
    // 복습 포함
    restDays: z.array(z.number()).default([]),
    // 쉬는 요일 (0=일, 6=토)
    difficulty: z.enum(["easy", "normal", "hard"]).default("normal")
  }).optional(),
  // 교재 메타데이터 (수능 학습용) - 선택적
  bookMetadata: BookMetadataSchema.optional()
});
var ApiResponseSchema = (dataSchema) => z.object({
  success: z.boolean(),
  data: dataSchema.optional(),
  error: z.string().optional()
});

// src/index.ts
function formatDate(date) {
  const kstDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const year = kstDate.getFullYear();
  const month = String(kstDate.getMonth() + 1).padStart(2, "0");
  const day = String(kstDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function parseDate(dateStr) {
  return new Date(dateStr);
}
function getDaysBetween(start, end) {
  const msPerDay = 1e3 * 60 * 60 * 24;
  return Math.ceil((end.getTime() - start.getTime()) / msPerDay) + 1;
}
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
export {
  ALL_DAYS,
  ApiResponseSchema,
  BookMetadataSchema,
  CreatePlanRequestSchema,
  DAY_LABELS,
  DAY_TO_JS_DAY,
  DailyQuestSchema,
  MaterialSchema,
  StudyPlanSchema,
  StudyTipsSchema,
  WEEKDAYS,
  formatDate,
  generateId,
  getDaysBetween,
  parseDate
};
