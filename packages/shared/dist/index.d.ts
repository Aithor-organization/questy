import { z } from 'zod';

/**
 * 요일 타입 (영문 약어)
 */
type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
/**
 * 모든 요일 배열 (월~일 순서)
 */
declare const ALL_DAYS: DayOfWeek[];
/**
 * 평일만 배열
 */
declare const WEEKDAYS: DayOfWeek[];
/**
 * 요일 한글 라벨
 */
declare const DAY_LABELS: Record<DayOfWeek, string>;
/**
 * 요일을 JavaScript Date.getDay() 값으로 변환 (0=일요일, 6=토요일)
 */
declare const DAY_TO_JS_DAY: Record<DayOfWeek, number>;
declare const BookMetadataSchema: z.ZodObject<{
    subject: z.ZodOptional<z.ZodString>;
    targetGrade: z.ZodOptional<z.ZodString>;
    bookType: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    subject?: string | undefined;
    targetGrade?: string | undefined;
    bookType?: string | undefined;
    category?: string | undefined;
    description?: string | undefined;
}, {
    subject?: string | undefined;
    targetGrade?: string | undefined;
    bookType?: string | undefined;
    category?: string | undefined;
    description?: string | undefined;
}>;
type BookMetadata = z.infer<typeof BookMetadataSchema>;
declare const MaterialSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    type: z.ZodEnum<["book", "lecture", "video", "document"]>;
    totalUnits: z.ZodNumber;
    unitNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    description: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "book" | "lecture" | "video" | "document";
    id: string;
    title: string;
    totalUnits: number;
    createdAt: string;
    description?: string | undefined;
    unitNames?: string[] | undefined;
}, {
    type: "book" | "lecture" | "video" | "document";
    id: string;
    title: string;
    totalUnits: number;
    createdAt: string;
    description?: string | undefined;
    unitNames?: string[] | undefined;
}>;
type Material = z.infer<typeof MaterialSchema>;
declare const StudyTipsSchema: z.ZodObject<{
    importance: z.ZodString;
    keyPoints: z.ZodArray<z.ZodString, "many">;
    commonMistakes: z.ZodOptional<z.ZodString>;
    studyMethod: z.ZodOptional<z.ZodString>;
    relatedUnits: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    importance: string;
    keyPoints: string[];
    commonMistakes?: string | undefined;
    studyMethod?: string | undefined;
    relatedUnits?: string | undefined;
}, {
    importance: string;
    keyPoints: string[];
    commonMistakes?: string | undefined;
    studyMethod?: string | undefined;
    relatedUnits?: string | undefined;
}>;
type StudyTips = z.infer<typeof StudyTipsSchema>;
declare const DailyQuestSchema: z.ZodObject<{
    id: z.ZodString;
    date: z.ZodString;
    dayNumber: z.ZodNumber;
    title: z.ZodString;
    tasks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        materialUnit: z.ZodOptional<z.ZodNumber>;
        estimatedMinutes: z.ZodNumber;
        completed: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        id: string;
        estimatedMinutes: number;
        completed: boolean;
        materialUnit?: number | undefined;
    }, {
        description: string;
        id: string;
        estimatedMinutes: number;
        materialUnit?: number | undefined;
        completed?: boolean | undefined;
    }>, "many">;
    totalEstimatedMinutes: z.ZodNumber;
    completed: z.ZodDefault<z.ZodBoolean>;
    studyTips: z.ZodOptional<z.ZodObject<{
        importance: z.ZodString;
        keyPoints: z.ZodArray<z.ZodString, "many">;
        commonMistakes: z.ZodOptional<z.ZodString>;
        studyMethod: z.ZodOptional<z.ZodString>;
        relatedUnits: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        importance: string;
        keyPoints: string[];
        commonMistakes?: string | undefined;
        studyMethod?: string | undefined;
        relatedUnits?: string | undefined;
    }, {
        importance: string;
        keyPoints: string[];
        commonMistakes?: string | undefined;
        studyMethod?: string | undefined;
        relatedUnits?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    date: string;
    dayNumber: number;
    tasks: {
        description: string;
        id: string;
        estimatedMinutes: number;
        completed: boolean;
        materialUnit?: number | undefined;
    }[];
    completed: boolean;
    totalEstimatedMinutes: number;
    studyTips?: {
        importance: string;
        keyPoints: string[];
        commonMistakes?: string | undefined;
        studyMethod?: string | undefined;
        relatedUnits?: string | undefined;
    } | undefined;
}, {
    id: string;
    title: string;
    date: string;
    dayNumber: number;
    tasks: {
        description: string;
        id: string;
        estimatedMinutes: number;
        materialUnit?: number | undefined;
        completed?: boolean | undefined;
    }[];
    totalEstimatedMinutes: number;
    completed?: boolean | undefined;
    studyTips?: {
        importance: string;
        keyPoints: string[];
        commonMistakes?: string | undefined;
        studyMethod?: string | undefined;
        relatedUnits?: string | undefined;
    } | undefined;
}>;
type DailyQuest = z.infer<typeof DailyQuestSchema>;
declare const StudyPlanSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    material: z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        type: z.ZodEnum<["book", "lecture", "video", "document"]>;
        totalUnits: z.ZodNumber;
        unitNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        description: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "book" | "lecture" | "video" | "document";
        id: string;
        title: string;
        totalUnits: number;
        createdAt: string;
        description?: string | undefined;
        unitNames?: string[] | undefined;
    }, {
        type: "book" | "lecture" | "video" | "document";
        id: string;
        title: string;
        totalUnits: number;
        createdAt: string;
        description?: string | undefined;
        unitNames?: string[] | undefined;
    }>;
    startDate: z.ZodString;
    endDate: z.ZodString;
    totalDays: z.ZodNumber;
    dailyQuests: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        date: z.ZodString;
        dayNumber: z.ZodNumber;
        title: z.ZodString;
        tasks: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            description: z.ZodString;
            materialUnit: z.ZodOptional<z.ZodNumber>;
            estimatedMinutes: z.ZodNumber;
            completed: z.ZodDefault<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            description: string;
            id: string;
            estimatedMinutes: number;
            completed: boolean;
            materialUnit?: number | undefined;
        }, {
            description: string;
            id: string;
            estimatedMinutes: number;
            materialUnit?: number | undefined;
            completed?: boolean | undefined;
        }>, "many">;
        totalEstimatedMinutes: z.ZodNumber;
        completed: z.ZodDefault<z.ZodBoolean>;
        studyTips: z.ZodOptional<z.ZodObject<{
            importance: z.ZodString;
            keyPoints: z.ZodArray<z.ZodString, "many">;
            commonMistakes: z.ZodOptional<z.ZodString>;
            studyMethod: z.ZodOptional<z.ZodString>;
            relatedUnits: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            importance: string;
            keyPoints: string[];
            commonMistakes?: string | undefined;
            studyMethod?: string | undefined;
            relatedUnits?: string | undefined;
        }, {
            importance: string;
            keyPoints: string[];
            commonMistakes?: string | undefined;
            studyMethod?: string | undefined;
            relatedUnits?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        date: string;
        dayNumber: number;
        tasks: {
            description: string;
            id: string;
            estimatedMinutes: number;
            completed: boolean;
            materialUnit?: number | undefined;
        }[];
        completed: boolean;
        totalEstimatedMinutes: number;
        studyTips?: {
            importance: string;
            keyPoints: string[];
            commonMistakes?: string | undefined;
            studyMethod?: string | undefined;
            relatedUnits?: string | undefined;
        } | undefined;
    }, {
        id: string;
        title: string;
        date: string;
        dayNumber: number;
        tasks: {
            description: string;
            id: string;
            estimatedMinutes: number;
            materialUnit?: number | undefined;
            completed?: boolean | undefined;
        }[];
        totalEstimatedMinutes: number;
        completed?: boolean | undefined;
        studyTips?: {
            importance: string;
            keyPoints: string[];
            commonMistakes?: string | undefined;
            studyMethod?: string | undefined;
            relatedUnits?: string | undefined;
        } | undefined;
    }>, "many">;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    createdAt: string;
    material: {
        type: "book" | "lecture" | "video" | "document";
        id: string;
        title: string;
        totalUnits: number;
        createdAt: string;
        description?: string | undefined;
        unitNames?: string[] | undefined;
    };
    startDate: string;
    endDate: string;
    totalDays: number;
    dailyQuests: {
        id: string;
        title: string;
        date: string;
        dayNumber: number;
        tasks: {
            description: string;
            id: string;
            estimatedMinutes: number;
            completed: boolean;
            materialUnit?: number | undefined;
        }[];
        completed: boolean;
        totalEstimatedMinutes: number;
        studyTips?: {
            importance: string;
            keyPoints: string[];
            commonMistakes?: string | undefined;
            studyMethod?: string | undefined;
            relatedUnits?: string | undefined;
        } | undefined;
    }[];
    updatedAt: string;
}, {
    id: string;
    title: string;
    createdAt: string;
    material: {
        type: "book" | "lecture" | "video" | "document";
        id: string;
        title: string;
        totalUnits: number;
        createdAt: string;
        description?: string | undefined;
        unitNames?: string[] | undefined;
    };
    startDate: string;
    endDate: string;
    totalDays: number;
    dailyQuests: {
        id: string;
        title: string;
        date: string;
        dayNumber: number;
        tasks: {
            description: string;
            id: string;
            estimatedMinutes: number;
            materialUnit?: number | undefined;
            completed?: boolean | undefined;
        }[];
        totalEstimatedMinutes: number;
        completed?: boolean | undefined;
        studyTips?: {
            importance: string;
            keyPoints: string[];
            commonMistakes?: string | undefined;
            studyMethod?: string | undefined;
            relatedUnits?: string | undefined;
        } | undefined;
    }[];
    updatedAt: string;
}>;
type StudyPlan = z.infer<typeof StudyPlanSchema>;
declare const CreatePlanRequestSchema: z.ZodObject<{
    title: z.ZodString;
    materialType: z.ZodEnum<["book", "lecture", "video", "document"]>;
    materialTitle: z.ZodString;
    totalUnits: z.ZodNumber;
    unitNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    startDate: z.ZodString;
    endDate: z.ZodString;
    dailyStudyMinutes: z.ZodDefault<z.ZodNumber>;
    preferences: z.ZodOptional<z.ZodObject<{
        includeReview: z.ZodDefault<z.ZodBoolean>;
        restDays: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
        difficulty: z.ZodDefault<z.ZodEnum<["easy", "normal", "hard"]>>;
    }, "strip", z.ZodTypeAny, {
        includeReview: boolean;
        restDays: number[];
        difficulty: "easy" | "normal" | "hard";
    }, {
        includeReview?: boolean | undefined;
        restDays?: number[] | undefined;
        difficulty?: "easy" | "normal" | "hard" | undefined;
    }>>;
    bookMetadata: z.ZodOptional<z.ZodObject<{
        subject: z.ZodOptional<z.ZodString>;
        targetGrade: z.ZodOptional<z.ZodString>;
        bookType: z.ZodOptional<z.ZodString>;
        category: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        subject?: string | undefined;
        targetGrade?: string | undefined;
        bookType?: string | undefined;
        category?: string | undefined;
        description?: string | undefined;
    }, {
        subject?: string | undefined;
        targetGrade?: string | undefined;
        bookType?: string | undefined;
        category?: string | undefined;
        description?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    totalUnits: number;
    startDate: string;
    endDate: string;
    materialType: "book" | "lecture" | "video" | "document";
    materialTitle: string;
    dailyStudyMinutes: number;
    unitNames?: string[] | undefined;
    preferences?: {
        includeReview: boolean;
        restDays: number[];
        difficulty: "easy" | "normal" | "hard";
    } | undefined;
    bookMetadata?: {
        subject?: string | undefined;
        targetGrade?: string | undefined;
        bookType?: string | undefined;
        category?: string | undefined;
        description?: string | undefined;
    } | undefined;
}, {
    title: string;
    totalUnits: number;
    startDate: string;
    endDate: string;
    materialType: "book" | "lecture" | "video" | "document";
    materialTitle: string;
    unitNames?: string[] | undefined;
    dailyStudyMinutes?: number | undefined;
    preferences?: {
        includeReview?: boolean | undefined;
        restDays?: number[] | undefined;
        difficulty?: "easy" | "normal" | "hard" | undefined;
    } | undefined;
    bookMetadata?: {
        subject?: string | undefined;
        targetGrade?: string | undefined;
        bookType?: string | undefined;
        category?: string | undefined;
        description?: string | undefined;
    } | undefined;
}>;
type CreatePlanRequest = z.infer<typeof CreatePlanRequestSchema>;
declare const ApiResponseSchema: <T extends z.ZodTypeAny>(dataSchema: T) => z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodString>;
}>, any> extends infer T_1 ? { [k in keyof T_1]: T_1[k]; } : never, z.baseObjectInputType<{
    success: z.ZodBoolean;
    data: z.ZodOptional<T>;
    error: z.ZodOptional<z.ZodString>;
}> extends infer T_2 ? { [k_1 in keyof T_2]: T_2[k_1]; } : never>;
interface Yes24Book {
    productId: string;
    title: string;
    author: string;
    publisher: string;
    previewUrl: string;
    thumbnailUrl: string;
    metadata?: BookMetadata;
}
interface PreviewImage {
    pageNumber: number;
    imageUrl: string;
}
/**
 * DailyQuestBase - 공통 필드
 * 백엔드 생성과 프론트엔드 표시에 모두 필요한 기본 필드
 */
interface DailyQuestBase {
    day: number;
    date: string;
    unitNumber: number;
    unitTitle: string;
    range: string;
    estimatedMinutes: number;
}
/**
 * DailyQuestAPI - API 응답용
 * 백엔드에서 생성하여 프론트엔드로 전달하는 데이터 구조
 */
interface DailyQuestAPI extends DailyQuestBase {
    id?: string;
    tip?: string;
    topics?: string[];
    pages?: string;
    objectives?: string[];
}
/**
 * DailyQuestClient - 클라이언트 상태용
 * 프론트엔드에서 사용자 인터랙션을 위해 확장한 구조
 */
interface DailyQuestClient extends DailyQuestAPI {
    id: string;
    completed?: boolean;
    completedAt?: string;
    studyTips?: StudyTips;
    practiceNote?: string;
    isPractice?: boolean;
    timerRecord?: {
        startTime: string;
        endTime: string;
        duration: number;
    };
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 변환 (한국 시간 기준)
 * toISOString()은 UTC 기준이므로, 한국 시간대에서는 자정~오전 9시 사이에 전날로 표시됨
 * 따라서 명시적으로 Asia/Seoul 타임존 사용
 */
declare function formatDate(date: Date): string;
declare function parseDate(dateStr: string): Date;
declare function getDaysBetween(start: Date, end: Date): number;
declare function generateId(): string;

export { ALL_DAYS, ApiResponseSchema, type BookMetadata, BookMetadataSchema, type CreatePlanRequest, CreatePlanRequestSchema, DAY_LABELS, DAY_TO_JS_DAY, type DailyQuest, type DailyQuestAPI, type DailyQuestBase, type DailyQuestClient, DailyQuestSchema, type DayOfWeek, type Material, MaterialSchema, type PreviewImage, type StudyPlan, StudyPlanSchema, type StudyTips, StudyTipsSchema, WEEKDAYS, type Yes24Book, formatDate, generateId, getDaysBetween, parseDate };
