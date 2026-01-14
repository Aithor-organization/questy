/**
 * Coach Agent Routes
 * QuestyCoachAgent 실제 통합 API
 *
 * - Supervisor: Multi-Agent Orchestration
 * - StudentRegistry: 학생 관리
 * - MemoryLane: 학습 기억 시스템
 * - QuestGenerator/Tracker: 일일 퀘스트
 */

import { Hono } from 'hono';
import { z } from 'zod';
import {
  Supervisor,
  StudentRegistry,
  AutoRescheduler,
  type AgentRequest,
  type StudentProfile,
  type Subject,
  type IncompleteQuest,
  type PlanSettings,
  type StudentPattern,
} from '@questy/coach-agent';
import * as db from '../db/index.js';

// Supervisor 싱글톤 인스턴스
let supervisorInstance: Supervisor | null = null;

// AutoRescheduler 싱글톤 인스턴스
let autoReschedulerInstance: AutoRescheduler | null = null;

function getSupervisor(): Supervisor {
  if (!supervisorInstance) {
    supervisorInstance = new Supervisor({
      enableMemoryExtraction: true,
      enableBurnoutCheck: false,  // 번아웃 체크 비활성화
      enableQuestSystem: true,
    });
    console.log('[Coach] Supervisor 인스턴스 생성됨');
  }
  return supervisorInstance;
}

function getAutoRescheduler(): AutoRescheduler {
  if (!autoReschedulerInstance) {
    autoReschedulerInstance = new AutoRescheduler();
    console.log('[Coach] AutoRescheduler 인스턴스 생성됨');
  }
  return autoReschedulerInstance;
}

export const coachRoutes = new Hono();

// ===================== 학생 관리 =====================

const CreateStudentSchema = z.object({
  name: z.string().min(1).max(50),
  grade: z.string().min(1).max(10),
  subjects: z.array(z.enum(['MATH', 'KOREAN', 'ENGLISH', 'SCIENCE', 'SOCIAL', 'GENERAL'])).optional(),
  goals: z.array(z.string()).optional(),
});

// 학생 생성/등록 (입학)
coachRoutes.post('/students', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = CreateStudentSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { name, grade, subjects, goals } = parsed.data;

    // Supervisor의 StudentRegistry 사용
    const supervisor = getSupervisor();
    const registry = supervisor.getStudentRegistry();

    const student = registry.createStudent({
      name,
      grade,
      enrolledSubjects: (subjects ?? ['GENERAL']) as Subject[],
      goals: goals ?? [],
    });

    // DB에도 저장
    db.createStudent({
      id: student.id,
      name: student.name,
      grade: student.grade,
      subjects: JSON.stringify(subjects ?? ['GENERAL']),
      goals: JSON.stringify(goals ?? []),
    });

    console.log(`[Coach] 학생 등록: ${student.name} (${student.id})`);

    return c.json({
      success: true,
      data: {
        student,
        welcomeMessage: `🎉 ${name}님, QuestyBook에 오신 것을 환영해요!\n\n저는 당신의 학습을 도와줄 AI 코치예요. 함께 목표를 향해 달려가요! 💪`,
      },
    });
  } catch (error) {
    console.error('[Coach/Students] Error:', error);
    return c.json({
      success: false,
      error: { message: '학생 등록에 실패했습니다' },
    }, 500);
  }
});

// 학생 정보 조회
coachRoutes.get('/students/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  return c.json({ success: true, data: student });
});

// 학생 프로필 업데이트
coachRoutes.patch('/students/:studentId', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  const body = await c.req.json();

  // 프로필 업데이트 (StudentRegistry의 updateStudent 사용)
  const updated = registry.updateStudent(studentId, {
    ...body,
    lastActiveAt: new Date(),
  });

  return c.json({ success: true, data: updated });
});

// ===================== 채팅 (코치 대화) =====================

const ChatSchema = z.object({
  studentId: z.string().optional(),  // 선택적 (없으면 자동 생성)
  message: z.string().min(1).max(2000),
  conversationId: z.string().optional(),
  userName: z.string().optional(),  // 게스트 이름
  metadata: z.object({
    currentSubject: z.enum(['MATH', 'KOREAN', 'ENGLISH', 'SCIENCE', 'SOCIAL', 'GENERAL']).optional(),
  }).optional(),
  questContext: z.object({
    // 오늘의 퀘스트
    todayQuests: z.array(z.object({
      unitTitle: z.string(),
      range: z.string(),
      completed: z.boolean().optional(),
      estimatedMinutes: z.number().optional(),
      planName: z.string().optional(),
      planId: z.string().optional(),
      day: z.number().optional(),
    })).optional(),
    // 활성 플랜 목록 (전체 일정)
    activePlans: z.array(z.object({
      id: z.string(),
      title: z.string(),
      textbookTitle: z.string().optional(),
      subject: z.string().optional(),
      totalDays: z.number(),
      completedDays: z.number(),
      startDate: z.string(),
      targetEndDate: z.string(),
      status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED']),
      dailyQuests: z.array(z.object({
        day: z.number(),
        date: z.string(),
        unitTitle: z.string(),
        range: z.string(),
        completed: z.boolean(),
        estimatedMinutes: z.number().optional(),
      })).optional(),
    })).optional(),
    // 향후 N일간의 퀘스트 (캘린더)
    upcomingQuests: z.array(z.object({
      date: z.string(),
      quests: z.array(z.object({
        planId: z.string(),
        planTitle: z.string(),
        day: z.number(),
        unitTitle: z.string(),
        range: z.string(),
        estimatedMinutes: z.number().optional(),
      })),
    })).optional(),
    // 주간 통계
    weeklyStats: z.object({
      totalQuests: z.number(),
      completedQuests: z.number(),
      completionRate: z.number(),
      streakDays: z.number(),
      averageMinutesPerDay: z.number(),
    }).optional(),
    plansCount: z.number().optional(),
    completedToday: z.number().optional(),
    totalToday: z.number().optional(),
  }).optional(),
});

// 코치와 대화 - Supervisor.process() 사용
coachRoutes.post('/chat', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = ChatSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { studentId, message, conversationId, userName, metadata } = parsed.data;

    // Supervisor 사용
    const supervisor = getSupervisor();
    const registry = supervisor.getStudentRegistry();

    // studentId가 없으면 자동 생성
    const finalStudentId = studentId || `guest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // DB에서 학생 확인 또는 자동 생성
    let dbStudent = db.getStudent(finalStudentId);
    if (!dbStudent) {
      // DB에 게스트 학생 생성
      dbStudent = db.createStudent({
        id: finalStudentId,
        name: userName || '학생',
      });
      console.log(`[Coach/Chat] Created guest student in DB: ${finalStudentId}`);
    }

    // 메모리 StudentRegistry에도 동기화
    let student = registry.getStudent(finalStudentId);
    if (!student) {
      student = registry.createStudent({
        id: finalStudentId,
        name: dbStudent.name,
      });
    }

    // 대화 ID 생성 (없으면 새로 생성)
    const convId = conversationId || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    console.log(`[Coach/Chat] conversationId received: ${conversationId}, using: ${convId}`);

    // 사용자 메시지 DB에 저장
    db.addConversation({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      studentId: finalStudentId,
      role: 'user',
      content: message,
    });

    // AgentRequest 생성 - questContext 포함 (전체 일정 정보 포함)
    const { questContext } = parsed.data;
    const request: AgentRequest = {
      studentId: finalStudentId,
      message,
      conversationId: convId,
      metadata: {
        currentSubject: metadata?.currentSubject as Subject | undefined,
        // 프론트엔드에서 받은 퀘스트 정보를 메타데이터에 추가
        questContext: questContext ? {
          todayQuests: questContext.todayQuests || [],
          activePlans: questContext.activePlans || [],
          upcomingQuests: questContext.upcomingQuests || [],
          weeklyStats: questContext.weeklyStats,
          plansCount: questContext.plansCount || 0,
          completedToday: questContext.completedToday || 0,
          totalToday: questContext.totalToday || 0,
        } : undefined,
      },
    };

    console.log(`[Coach/Chat] Processing: "${message.slice(0, 50)}..." for ${student.name}`);

    // Supervisor를 통한 처리 (의도 분류 → 에이전트 라우팅 → 응답 생성)
    const response = await supervisor.process(request);

    // AI 응답 DB에 저장
    db.addConversation({
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      studentId: finalStudentId,
      role: 'assistant',
      agentRole: response.agentRole,
      content: response.message,
    });

    console.log(`[Coach/Chat] Response from ${response.agentRole}: "${response.message.slice(0, 50)}..."`);

    return c.json({
      success: true,
      data: {
        studentId: finalStudentId,  // 프론트엔드에서 저장용
        conversationId: convId,
        agentRole: response.agentRole,
        message: response.message,
        suggestedFollowUp: response.suggestedFollowUp || [],
        memoryExtracted: response.memoryExtracted,
        actions: response.actions || [],
        rescheduleOptions: response.rescheduleOptions || [],  // 일정 변경 옵션
        messageActions: response.messageActions || [],  // 메시지 액션 버튼 (프론트엔드 UI용)
      },
    });
  } catch (error) {
    console.error('[Coach/Chat] Error:', error);
    return c.json({
      success: false,
      error: { message: '채팅 처리에 실패했습니다' },
    }, 500);
  }
});

// ===================== 입학 상담 채팅 (AdmissionAgent 전용) =====================

const AdmissionChatSchema = z.object({
  message: z.string().min(1).max(2000),
  stage: z.enum(['name', 'grade', 'subjects', 'goals', 'general']),
  context: z.object({
    currentInfo: z.object({
      name: z.string().optional(),
      grade: z.string().optional(),
      subjects: z.array(z.string()).optional(),
      goals: z.array(z.string()).optional(),
    }).optional(),
  }).optional(),
});

// 입학 상담 채팅 - AdmissionAgent 직접 사용 (LLM 호출)
coachRoutes.post('/admission/chat', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = AdmissionChatSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { message, stage, context } = parsed.data;

    // Supervisor에서 AdmissionAgent 직접 가져오기
    const supervisor = getSupervisor();
    const admissionAgent = supervisor.getAdmissionAgent();

    // 메시지에서 정보 추출 (이름, 학년 등)
    const extractedInfo = extractInfoFromMessage(message, stage);

    console.log(`[Admission/Chat] Stage: ${stage}, Message: "${message.slice(0, 30)}...", Extracted: ${JSON.stringify(extractedInfo)}`);

    // AdmissionAgent 직접 호출하여 응답 생성
    const request: AgentRequest = {
      studentId: 'admission-temp',
      message,
      conversationId: `admission-${Date.now()}`,
      metadata: {
        stage, // 현재 단계 전달
        extractedInfo, // 추출된 정보 전달
        currentInfo: context?.currentInfo, // 기존 수집 정보 전달
      },
    };

    // AdmissionAgent의 process 메서드 직접 호출
    const response = await admissionAgent.process(request);

    return c.json({
      success: true,
      data: {
        message: response.message,
        extractedInfo,
        suggestedFollowUp: response.suggestedFollowUp || [],
      },
    });
  } catch (error) {
    console.error('[Admission/Chat] Error:', error);
    return c.json({
      success: false,
      error: { message: '입학 상담 처리에 실패했습니다' },
    }, 500);
  }
});

// 메시지에서 정보 추출 (이름, 학년 등)
function extractInfoFromMessage(message: string, stage: string): Record<string, string | string[]> {
  const extracted: Record<string, string | string[]> = {};

  if (stage === 'name') {
    // 이름 추출 패턴
    const namePatterns = [
      /나는\s*(.+?)(?:이야|야|예요|에요|입니다|이에요)/,
      /제?\s*이름은?\s*(.+?)(?:이야|야|예요|에요|입니다|이에요)/,
      /(.+?)(?:입니다|이에요|예요|에요)$/,
      /^(.+?)라고\s*(?:해요|합니다|해)/,
    ];

    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        let name = match[1].trim();
        // 인사말 제거
        name = name.replace(/^(안녕|반가워|반갑습니다|안녕하세요)[,\s]*/gi, '').trim();
        if (name.length > 0 && name.length <= 10) {
          extracted.name = name;
          break;
        }
      }
    }

    // 패턴 실패시 마지막 단어 시도
    if (!extracted.name) {
      const words = message.replace(/[^\w\s가-힣]/g, '').split(/\s+/).filter(w => w.length > 0);
      const lastWord = words[words.length - 1];
      if (lastWord && lastWord.length >= 2 && lastWord.length <= 10) {
        extracted.name = lastWord;
      }
    }
  }

  if (stage === 'grade') {
    // 학년 추출
    if (/고3|고등학교\s*3/.test(message)) extracted.grade = '고3';
    else if (/고2|고등학교\s*2/.test(message)) extracted.grade = '고2';
    else if (/고1|고등학교\s*1/.test(message)) extracted.grade = '고1';
    else if (/중3|중학교\s*3/.test(message)) extracted.grade = '중3';
    else if (/중2|중학교\s*2/.test(message)) extracted.grade = '중2';
    else if (/중1|중학교\s*1/.test(message)) extracted.grade = '중1';
    else if (/N수|재수|삼수/.test(message)) extracted.grade = 'N수생';
  }

  return extracted;
}

// ===================== 플랜 관리 =====================

const CreatePlanSchema = z.object({
  studentId: z.string().min(1),
  textbookId: z.string().min(1),
  subject: z.enum(['MATH', 'KOREAN', 'ENGLISH', 'SCIENCE', 'SOCIAL', 'GENERAL']),
  title: z.string().min(1).max(100),
  totalSessions: z.number().int().positive(),
  targetDays: z.number().int().positive(),
  topics: z.array(z.string()).optional(),
});

// 플랜 생성
coachRoutes.post('/plans', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = CreatePlanSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { studentId, textbookId, subject, title, totalSessions, targetDays, topics } = parsed.data;

    // Supervisor의 StudentRegistry 사용
    const supervisor = getSupervisor();
    const registry = supervisor.getStudentRegistry();

    // 학생 확인
    if (!registry.getStudent(studentId)) {
      return c.json({
        success: false,
        error: { message: '학생을 찾을 수 없습니다' },
      }, 404);
    }

    // 목표 종료일 계산
    const targetEndDate = new Date();
    targetEndDate.setDate(targetEndDate.getDate() + targetDays);

    // 플랜 생성 (StudentRegistry 사용)
    const plan = registry.createPlan({
      studentId,
      textbookId,
      subject: subject as Subject,
      title,
      totalSessions,
      targetEndDate,
      topics: topics ?? [],
    });

    if (!plan) {
      return c.json({
        success: false,
        error: { message: '플랜 생성에 실패했습니다' },
      }, 500);
    }

    console.log(`[Coach/Plans] 플랜 생성: ${title} for ${studentId}`);

    return c.json({
      success: true,
      data: {
        plan,
        coachMessage: `📚 "${title}" 학습 플랜이 생성되었어요!\n\n${totalSessions}회 학습을 ${targetDays}일 동안 진행할 예정이에요. 함께 열심히 해봐요! 🔥`,
      },
    });
  } catch (error) {
    console.error('[Coach/Plans] Error:', error);
    return c.json({
      success: false,
      error: { message: '플랜 생성에 실패했습니다' },
    }, 500);
  }
});

// 학생의 플랜 목록 조회
coachRoutes.get('/students/:studentId/plans', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();

  if (!registry.getStudent(studentId)) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  const activePlans = registry.getActivePlans(studentId);
  const allPlans = registry.getStudentPlans(studentId);

  return c.json({
    success: true,
    data: {
      active: activePlans,
      paused: allPlans.filter(p => p.status === 'paused'),
      completed: allPlans.filter(p => p.status === 'completed'),
    },
  });
});

// 플랜 상세 조회
coachRoutes.get('/plans/:planId', async (c) => {
  const planId = c.req.param('planId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();

  const plan = registry.getPlan(planId);

  if (!plan) {
    return c.json({
      success: false,
      error: { message: '플랜을 찾을 수 없습니다' },
    }, 404);
  }

  return c.json({ success: true, data: plan });
});

// 플랜 진행 업데이트
coachRoutes.patch('/plans/:planId/progress', async (c) => {
  const planId = c.req.param('planId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();

  const plan = registry.getPlan(planId);

  if (!plan) {
    return c.json({
      success: false,
      error: { message: '플랜을 찾을 수 없습니다' },
    }, 404);
  }

  const body = await c.req.json();

  // 플랜 업데이트
  const updated = registry.updatePlan(planId, body);

  if (!updated) {
    return c.json({
      success: false,
      error: { message: '플랜 업데이트에 실패했습니다' },
    }, 500);
  }

  const progressPercent = Math.round((updated.completedSessions / updated.totalSessions) * 100);

  return c.json({
    success: true,
    data: {
      plan: updated,
      progressPercent,
      coachMessage: updated.status === 'completed'
        ? `🎊 축하해요! "${updated.title}" 플랜을 완료했어요! 정말 대단해요! 🏆`
        : `👍 잘하고 있어요! ${progressPercent}% 진행 중이에요. 조금만 더 힘내요! 💪`,
    },
  });
});

// ===================== 오늘의 퀘스트 =====================

coachRoutes.get('/students/:studentId/today', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  try {
    // Supervisor의 generateDailyQuests 사용
    const todayQuests = await supervisor.generateDailyQuests(studentId);

    if (!todayQuests) {
      // 퀘스트가 없을 경우 기본 응답
      const today = new Date();
      return c.json({
        success: true,
        data: {
          date: today.toISOString().slice(0, 10),
          dayOfWeek: ['일', '월', '화', '수', '목', '금', '토'][today.getDay()],
          dailyMessage: `안녕 ${student.name}! 오늘도 함께 성장해요! 🌱`,
          coachTip: getRandomCoachTip(),
          mainQuests: [],
          reviewQuests: [],
          bonusQuests: [],
          summary: {
            totalQuests: 0,
            estimatedTotalMinutes: 0,
            totalXpAvailable: 0,
          },
        },
      });
    }

    const today = new Date();

    return c.json({
      success: true,
      data: {
        date: today.toISOString().slice(0, 10),
        dayOfWeek: ['일', '월', '화', '수', '목', '금', '토'][today.getDay()],
        dailyMessage: todayQuests.dailyMessage,
        coachTip: todayQuests.coachTip,
        mainQuests: todayQuests.mainQuests,
        reviewQuests: todayQuests.reviewQuests,
        bonusQuests: todayQuests.bonusQuests,
        summary: todayQuests.summary,
      },
    });
  } catch (error) {
    console.error('[Coach/Today] Error generating quests:', error);

    // 에러 시 기본 응답
    const today = new Date();
    return c.json({
      success: true,
      data: {
        date: today.toISOString().slice(0, 10),
        dayOfWeek: ['일', '월', '화', '수', '목', '금', '토'][today.getDay()],
        dailyMessage: `안녕 ${student.name}! 오늘도 함께 성장해요! 🌱`,
        coachTip: getRandomCoachTip(),
        mainQuests: [],
        reviewQuests: [],
        bonusQuests: [],
        summary: {
          totalQuests: 0,
          estimatedTotalMinutes: 0,
          totalXpAvailable: 0,
        },
      },
    });
  }
});

// ===================== 리포트 =====================

coachRoutes.get('/students/:studentId/report/weekly', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const questTracker = supervisor.getQuestTracker();
  const memoryLane = supervisor.getMemoryLane();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  // 학생 진행 현황 조회
  const progress = registry.getStudentProgress(studentId);
  const streak = questTracker.getStreak(studentId);
  const allPlans = registry.getStudentPlans(studentId);

  // Memory Lane에서 학습 기록 확인
  const memories = memoryLane.getAllMemories(studentId);
  const completedQuestsCount = memories.filter(m => m.type === 'MASTERY').length;

  // 주간 리포트 생성
  return c.json({
    success: true,
    data: {
      period: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10),
      },
      summary: {
        totalStudyDays: Math.min(streak, 7),
        totalStudyMinutes: completedQuestsCount * 30, // 평균 30분/퀘스트
        completedQuests: completedQuestsCount,
        earnedXp: completedQuestsCount * 100,
        currentStreak: streak,
      },
      planProgress: allPlans.map(plan => ({
        planId: plan.id,
        title: plan.title,
        progress: Math.round((plan.completedSessions / plan.totalSessions) * 100),
        sessionsCompleted: plan.completedSessions,
        totalSessions: plan.totalSessions,
      })),
      achievements: getAchievements(streak, completedQuestsCount),
      coachFeedback: generateCoachFeedback(student.name, streak, progress),
    },
  });
});

// ===================== Memory Lane 관련 =====================

coachRoutes.get('/students/:studentId/memories', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const memoryLane = supervisor.getMemoryLane();

  const memories = memoryLane.getAllMemories(studentId);
  const reviewRecommendations = memoryLane.getReviewRecommendations(studentId);

  return c.json({
    success: true,
    data: {
      totalMemories: memories.length,
      memories: memories.slice(0, 20), // 최근 20개만
      reviewRecommendations,
    },
  });
});

// ===================== 번아웃 체크 =====================

coachRoutes.get('/students/:studentId/burnout-check', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const memoryLane = supervisor.getMemoryLane();

  const burnoutCheck = memoryLane.shouldContinueStudying(studentId);

  return c.json({
    success: true,
    data: burnoutCheck,
  });
});

// ===================== 스케줄 밀림 처리 (Schedule Delay Handling) =====================

// 학생의 스케줄 밀림 분석
coachRoutes.get('/students/:studentId/delays', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const delayHandler = supervisor.getScheduleDelayHandler();
  const questTracker = supervisor.getQuestTracker();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  try {
    // 오늘의 퀘스트 가져오기
    const todayQuests = questTracker.getTodayQuests(studentId);

    if (!todayQuests) {
      return c.json({
        success: true,
        data: {
          hasDelays: false,
          analysis: null,
          message: '분석할 퀘스트가 없습니다',
        },
      });
    }

    // 밀림 분석 실행
    const analysis = delayHandler.analyzeDelays(studentId, todayQuests);

    return c.json({
      success: true,
      data: {
        hasDelays: analysis.expiredQuests.length > 0 || analysis.crisisLevel !== 'NONE',
        analysis,
        message: analysis.crisisLevel === 'CRISIS'
          ? `😢 ${student.name}님, ${analysis.consecutiveMissedDays}일 동안 학습을 쉬셨네요. 같이 이야기해볼까요?`
          : analysis.expiredQuests.length > 0
            ? `📋 ${analysis.expiredQuests.length}개의 밀린 퀘스트가 있어요. 조정해드릴까요?`
            : '✅ 모든 퀘스트가 잘 진행되고 있어요!',
      },
    });
  } catch (error) {
    console.error('[Coach/Delays] Error:', error);
    return c.json({
      success: false,
      error: { message: '스케줄 분석에 실패했습니다' },
    }, 500);
  }
});

// 퀘스트 완료 기록 (밀림 추적용)
coachRoutes.post('/students/:studentId/quests/:questId/complete', async (c) => {
  const studentId = c.req.param('studentId');
  const questId = c.req.param('questId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const delayHandler = supervisor.getScheduleDelayHandler();
  const questTracker = supervisor.getQuestTracker();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  try {
    // 완료 기록 (ScheduleDelayHandler에 기록)
    delayHandler.recordCompletion(studentId, questId);

    // QuestTracker에도 완료 기록
    const result = questTracker.completeQuest(studentId, questId);

    if (!result) {
      return c.json({
        success: false,
        error: { message: '퀘스트를 찾을 수 없거나 이미 완료되었습니다' },
      }, 404);
    }

    return c.json({
      success: true,
      data: {
        questId,
        completed: true,
        result,
        message: '🎉 퀘스트를 완료했어요! 잘했어요!',
      },
    });
  } catch (error) {
    console.error('[Coach/QuestComplete] Error:', error);
    return c.json({
      success: false,
      error: { message: '퀘스트 완료 처리에 실패했습니다' },
    }, 500);
  }
});

// 밀림 알림 목록 조회
coachRoutes.get('/students/:studentId/notifications', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const delayHandler = supervisor.getScheduleDelayHandler();
  const questTracker = supervisor.getQuestTracker();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  // 현재 대기 중인 알림 조회
  const pendingNotifications = delayHandler.getPendingNotifications(studentId);

  // 새 알림 생성 여부 확인 (오늘의 퀘스트 기반)
  const todayQuests = questTracker.getTodayQuests(studentId);

  if (todayQuests && pendingNotifications.length === 0) {
    // 분석 후 알림 생성
    const analysis = delayHandler.analyzeDelays(studentId, todayQuests);

    if (analysis.expiredQuests.length > 0 || analysis.crisisLevel !== 'NONE') {
      const notification = delayHandler.generateDelayNotification(studentId, analysis);

      if (notification) {
        return c.json({
          success: true,
          data: {
            hasNotifications: true,
            notifications: [notification],
            crisisLevel: analysis.crisisLevel,
          },
        });
      }
    }
  }

  return c.json({
    success: true,
    data: {
      hasNotifications: pendingNotifications.length > 0,
      notifications: pendingNotifications,
    },
  });
});

// 알림 해제 (사용자가 확인 후)
coachRoutes.post('/students/:studentId/notifications/:notificationId/dismiss', async (c) => {
  const studentId = c.req.param('studentId');
  const notificationId = c.req.param('notificationId');
  const supervisor = getSupervisor();
  const delayHandler = supervisor.getScheduleDelayHandler();

  try {
    const body = await c.req.json().catch(() => ({}));
    const action = (body as { action?: string })?.action || 'dismissed';

    // 알림 해제 처리
    delayHandler.dismissNotification(studentId, notificationId);

    return c.json({
      success: true,
      data: {
        notificationId,
        action,
        message: action === 'reschedule'
          ? '📅 일정을 재조정해드릴게요!'
          : action === 'start_now'
            ? '💪 좋아요! 지금 바로 시작해봐요!'
            : '확인했어요!',
      },
    });
  } catch (error) {
    console.error('[Coach/Notifications] Error:', error);
    return c.json({
      success: false,
      error: { message: '알림 처리에 실패했습니다' },
    }, 500);
  }
});

// 스케줄 재조정 요청
coachRoutes.post('/students/:studentId/delays/reschedule', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const delayHandler = supervisor.getScheduleDelayHandler();
  const questTracker = supervisor.getQuestTracker();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  try {
    const todayQuests = questTracker.getTodayQuests(studentId);

    if (!todayQuests) {
      return c.json({
        success: false,
        error: { message: '재조정할 퀘스트가 없습니다' },
      }, 400);
    }

    // 분석 및 재조정 제안 생성
    const analysis = delayHandler.analyzeDelays(studentId, todayQuests);

    if (!analysis.rescheduleSuggestion) {
      return c.json({
        success: true,
        data: {
          needsReschedule: false,
          message: '현재 재조정이 필요한 일정이 없어요! 👍',
        },
      });
    }

    return c.json({
      success: true,
      data: {
        needsReschedule: true,
        suggestion: analysis.rescheduleSuggestion,
        expiredQuests: analysis.expiredQuests,
        message: `📋 ${analysis.expiredQuests.length}개의 밀린 퀘스트를 ${analysis.rescheduleSuggestion.suggestedQuests.length}개의 새로운 일정으로 재조정할 수 있어요.`,
        coachAdvice: analysis.crisisLevel === 'CRISIS'
          ? '무리하지 말고 천천히 시작해봐요. 작은 것부터 하나씩! 💕'
          : analysis.crisisLevel === 'CONCERN'
            ? '조금 힘들었나요? 오늘은 가볍게 시작해봐요! 😊'
            : '다시 시작하는 것 자체가 대단해요! 💪',
      },
    });
  } catch (error) {
    console.error('[Coach/Reschedule] Error:', error);
    return c.json({
      success: false,
      error: { message: '스케줄 재조정에 실패했습니다' },
    }, 500);
  }
});

// ===================== 저녁 리뷰 (FR-025) =====================

const EveningReviewSchema = z.object({
  studentId: z.string().min(1),
});

coachRoutes.post('/students/:studentId/evening-review', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const questTracker = supervisor.getQuestTracker();
  const coachAgent = supervisor.getCoachAgent();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  try {
    // 오늘 학습 현황 조회
    const todayQuests = questTracker.getTodayQuests(studentId);
    const completedQuests = todayQuests?.mainQuests?.filter(q => q.completed) ?? [];
    const remainingQuests = todayQuests?.mainQuests?.filter(q => !q.completed) ?? [];
    const streak = questTracker.getStreak(studentId);

    // 내일 퀘스트 (간단히 예측)
    const tomorrowQuests = remainingQuests.length > 0
      ? remainingQuests.slice(0, 3).map(q => q.title)
      : ['새로운 퀘스트가 준비될 예정이에요!'];

    // 코치 에이전트를 통한 저녁 리뷰 생성
    const todayStatus = {
      completedQuests: completedQuests.length,
      totalQuests: todayQuests?.mainQuests?.length ?? 0,
      completedMinutes: completedQuests.reduce((acc, q) => acc + (q.estimatedMinutes ?? 30), 0),
      remainingQuests: remainingQuests.map(q => q.title),
      streak,
    };

    const reviewMessage = await coachAgent.generateEveningReview(
      student.name,
      todayStatus,
      tomorrowQuests
    );

    return c.json({
      success: true,
      data: {
        reviewMessage,
        todayStatus,
        tomorrowPreview: tomorrowQuests,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Coach/EveningReview] Error:', error);
    return c.json({
      success: false,
      error: { message: '저녁 리뷰 생성에 실패했습니다' },
    }, 500);
  }
});

// ===================== 미학습 대응 (FR-024) =====================

coachRoutes.get('/students/:studentId/missed-study', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const delayHandler = supervisor.getScheduleDelayHandler();
  const questTracker = supervisor.getQuestTracker();
  const coachAgent = supervisor.getCoachAgent();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  try {
    // 밀림 분석
    const todayQuests = questTracker.getTodayQuests(studentId);
    const analysis = todayQuests
      ? delayHandler.analyzeDelays(studentId, todayQuests)
      : null;

    const missedDays = analysis?.consecutiveMissedDays ?? 0;

    if (missedDays === 0) {
      return c.json({
        success: true,
        data: {
          hasMissedStudy: false,
          message: '잘하고 있어요! 밀린 학습이 없어요 👍',
        },
      });
    }

    // 미학습 컨텍스트 생성
    const missedContext = {
      missedDays,
      lastStudyDate: analysis?.lastCompletedDate ?? null,
      missedQuests: analysis?.expiredQuests.map(q => q.title) ?? [],
      suggestedReschedule: missedDays >= 2,
    };

    // 코치 메시지 생성
    const responseMessage = await coachAgent.generateMissedStudyResponse(
      student.name,
      missedContext
    );

    return c.json({
      success: true,
      data: {
        hasMissedStudy: true,
        missedContext,
        responseMessage,
        suggestedActions: missedDays >= 3
          ? ['일정 재조정', '가벼운 복습부터 시작', '코치와 상담']
          : ['오늘 바로 시작하기', '일정 재조정'],
      },
    });
  } catch (error) {
    console.error('[Coach/MissedStudy] Error:', error);
    return c.json({
      success: false,
      error: { message: '미학습 분석에 실패했습니다' },
    }, 500);
  }
});

// ===================== 학습 시작 리마인더 (FR-021) =====================

const ReminderSchema = z.object({
  questId: z.string().min(1),
  questName: z.string().min(1),
  estimatedMinutes: z.number().int().positive().default(30),
  reminderType: z.enum(['first', '15min', '30min']).default('first'),
});

coachRoutes.post('/students/:studentId/reminder', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const coachAgent = supervisor.getCoachAgent();

  // 학생이 없어도 기본 이름으로 진행 (프론트엔드 localStorage 사용자)
  const student = registry.getStudent(studentId);
  const studentName = student?.name || '학생';

  try {
    const body = await c.req.json();
    const parsed = ReminderSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { questName, estimatedMinutes, reminderType } = parsed.data;

    // 리마인더 메시지 생성
    const reminderMessage = await coachAgent.generateStudyStartReminder(
      studentName,
      reminderType,
      questName,
      estimatedMinutes
    );

    return c.json({
      success: true,
      data: {
        reminderMessage,
        reminderType,
        questName,
        sentAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Coach/Reminder] Error:', error);
    return c.json({
      success: false,
      error: { message: '리마인더 생성에 실패했습니다' },
    }, 500);
  }
});

// ===================== 위기 개입 (FR-026) =====================

coachRoutes.post('/students/:studentId/crisis-intervention', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const delayHandler = supervisor.getScheduleDelayHandler();
  const questTracker = supervisor.getQuestTracker();
  const memoryLane = supervisor.getMemoryLane();
  const coachAgent = supervisor.getCoachAgent();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  try {
    // 밀림 분석
    const todayQuests = questTracker.getTodayQuests(studentId);
    const analysis = todayQuests
      ? delayHandler.analyzeDelays(studentId, todayQuests)
      : null;

    const missedDays = analysis?.consecutiveMissedDays ?? 0;

    // 최근 감정 기록 조회 (Memory Lane에서)
    const memories = memoryLane.getAllMemories(studentId);
    const recentEmotions = memories
      .filter(m => m.type === 'STRUGGLE' || m.type === 'EMOTION')
      .slice(0, 5)
      .map(m => m.content);

    // 위기 개입이 필요한지 확인
    if (missedDays < 3 && recentEmotions.length === 0) {
      return c.json({
        success: true,
        data: {
          needsIntervention: false,
          message: '현재 위기 개입이 필요하지 않아요. 잘하고 있어요! 👍',
        },
      });
    }

    // 위기 개입 메시지 생성 (Gemini 3 Flash 사용)
    const interventionMessage = await coachAgent.generateCrisisIntervention(
      student.name,
      missedDays,
      recentEmotions
    );

    return c.json({
      success: true,
      data: {
        needsIntervention: true,
        crisisLevel: analysis?.crisisLevel ?? 'CONCERN',
        missedDays,
        recentEmotions,
        interventionMessage,
        suggestedActions: [
          '가벼운 복습부터 시작',
          '목표 재설정',
          '학습 시간 조정',
          '1:1 상담 요청',
        ],
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Coach/CrisisIntervention] Error:', error);
    return c.json({
      success: false,
      error: { message: '위기 개입 메시지 생성에 실패했습니다' },
    }, 500);
  }
});

// ===================== 자동 일정 재조정 (Auto Reschedule) =====================

const AutoRescheduleSchema = z.object({
  incompleteQuests: z.array(z.object({
    questId: z.string(),
    planId: z.string(),
    planName: z.string(),
    unitTitle: z.string(),
    range: z.string(),
    day: z.number(),
    originalDate: z.string(),
    estimatedMinutes: z.number(),
    excludeWeekends: z.boolean(),
  })),
  planSettings: z.object({
    planId: z.string(),
    planName: z.string(),
    excludeWeekends: z.boolean(),
    totalDays: z.number(),
    remainingDays: z.number(),
    targetEndDate: z.string(),
  }),
  studentPattern: z.object({
    preferredStudyDays: z.array(z.enum(['weekday', 'weekend'])),
    averageQuestsPerDay: z.number(),
    completionRate: z.number(),
    weekendAvailability: z.boolean(),
    consecutiveMissedDays: z.number(),
  }).optional(),
  existingQuestsOnNextDay: z.number().default(0),
});

// AI 기반 자동 일정 재조정
coachRoutes.post('/students/:studentId/auto-reschedule', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const autoRescheduler = getAutoRescheduler();

  const student = registry.getStudent(studentId);
  const studentName = student?.name || '학생';

  try {
    const body = await c.req.json();
    const parsed = AutoRescheduleSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { incompleteQuests, planSettings, studentPattern, existingQuestsOnNextDay } = parsed.data;

    // 기본 학생 패턴 (제공되지 않은 경우)
    const pattern: StudentPattern = studentPattern || {
      preferredStudyDays: ['weekday'],
      averageQuestsPerDay: 1,
      completionRate: 0.7,
      weekendAvailability: true,  // 기본적으로 주말 가능
      consecutiveMissedDays: 0,
    };

    console.log(`[AutoReschedule] Processing ${incompleteQuests.length} incomplete quests for ${studentName}`);

    // 여러 미완료 퀘스트 일괄 처리
    const results = await autoRescheduler.batchReschedule(
      incompleteQuests as IncompleteQuest[],
      planSettings as PlanSettings,
      pattern
    );

    // 결과 요약
    const summary = {
      totalProcessed: results.length,
      weekendSpillover: results.filter(r => r.strategy === 'WEEKEND_SPILLOVER').length,
      stackedNextDay: results.filter(r => r.strategy === 'STACK_NEXT_DAY').length,
      reducedLoad: results.filter(r => r.strategy === 'REDUCE_LOAD').length,
    };

    console.log(`[AutoReschedule] Results: ${JSON.stringify(summary)}`);

    return c.json({
      success: true,
      data: {
        results,
        summary,
        overallMessage: generateOverallRescheduleMessage(studentName, results),
      },
    });
  } catch (error) {
    console.error('[AutoReschedule] Error:', error);
    return c.json({
      success: false,
      error: { message: '자동 일정 재조정에 실패했습니다' },
    }, 500);
  }
});

// 단일 퀘스트 자동 재조정
coachRoutes.post('/students/:studentId/quests/:questId/auto-reschedule', async (c) => {
  const studentId = c.req.param('studentId');
  const questId = c.req.param('questId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const autoRescheduler = getAutoRescheduler();

  const student = registry.getStudent(studentId);
  const studentName = student?.name || '학생';

  try {
    const body = await c.req.json();

    const incompleteQuest: IncompleteQuest = {
      questId,
      planId: body.planId,
      planName: body.planName,
      unitTitle: body.unitTitle,
      range: body.range || '',
      day: body.day || 0,
      originalDate: body.originalDate || new Date().toISOString().slice(0, 10),
      estimatedMinutes: body.estimatedMinutes || 30,
      excludeWeekends: body.excludeWeekends ?? true,
    };

    const planSettings: PlanSettings = {
      planId: body.planId,
      planName: body.planName,
      excludeWeekends: body.excludeWeekends ?? true,
      totalDays: body.totalDays || 30,
      remainingDays: body.remainingDays || 15,
      targetEndDate: body.targetEndDate || '',
    };

    const studentPattern: StudentPattern = {
      preferredStudyDays: ['weekday'],
      averageQuestsPerDay: 1,
      completionRate: body.completionRate || 0.7,
      weekendAvailability: body.weekendAvailability ?? true,
      consecutiveMissedDays: body.consecutiveMissedDays || 0,
    };

    console.log(`[AutoReschedule] Processing single quest ${questId} for ${studentName}`);

    const result = await autoRescheduler.evaluateAndReschedule(
      incompleteQuest,
      planSettings,
      studentPattern,
      body.existingQuestsOnNextDay || 0
    );

    console.log(`[AutoReschedule] Strategy: ${result.strategy}, NewDate: ${result.newDate}`);

    return c.json({
      success: true,
      data: {
        result,
        coachMessage: result.coachMessage,
        messageActions: result.messageActions,
      },
    });
  } catch (error) {
    console.error('[AutoReschedule] Error:', error);
    return c.json({
      success: false,
      error: { message: '자동 일정 재조정에 실패했습니다' },
    }, 500);
  }
});

// 전체 재조정 메시지 생성
function generateOverallRescheduleMessage(studentName: string, results: any[]): string {
  if (results.length === 0) {
    return `${studentName}님, 재조정할 퀘스트가 없어요! 👍`;
  }

  const weekendCount = results.filter(r => r.strategy === 'WEEKEND_SPILLOVER').length;
  const stackCount = results.filter(r => r.strategy === 'STACK_NEXT_DAY').length;
  const reduceCount = results.filter(r => r.strategy === 'REDUCE_LOAD').length;

  let message = `📅 ${studentName}님, ${results.length}개의 미완료 퀘스트를 재조정했어요!\n\n`;

  if (weekendCount > 0) {
    message += `🗓️ ${weekendCount}개는 주말에 배치했어요.\n`;
  }
  if (stackCount > 0) {
    message += `📚 ${stackCount}개는 내일로 추가했어요.\n`;
  }
  if (reduceCount > 0) {
    message += `😊 ${reduceCount}개는 분량을 줄였어요.\n`;
  }

  message += `\n무리하지 않게 조정했으니 걱정 마세요! 💪`;

  return message;
}

// ===================== 레벨 테스트 (FR-051) =====================

const LevelTestStartSchema = z.object({
  subject: z.enum(['MATH', 'KOREAN', 'ENGLISH', 'SCIENCE', 'SOCIAL', 'GENERAL']),
  questionCount: z.number().int().min(3).max(20).default(5),
});

// 레벨 테스트 시작
coachRoutes.post('/students/:studentId/level-test/start', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const admissionAgent = supervisor.getAdmissionAgent();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  try {
    const body = await c.req.json();
    const parsed = LevelTestStartSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { subject, questionCount } = parsed.data;

    // 레벨 테스트 문제 생성
    const questions = admissionAgent.generateLevelTest(subject as any, questionCount);

    // 정답 정보 제외하고 반환
    const questionsWithoutAnswers = questions.map(q => ({
      id: q.id,
      subject: q.subject,
      difficulty: q.difficulty,
      question: q.question,
      options: q.options,
      topic: q.topic,
    }));

    return c.json({
      success: true,
      data: {
        testId: `test-${Date.now()}`,
        subject,
        questions: questionsWithoutAnswers,
        totalQuestions: questions.length,
        // 서버에서 정답 정보 저장 (실제로는 세션이나 Redis에 저장)
        _internal: { questions }, // 채점 시 사용
      },
    });
  } catch (error) {
    console.error('[Coach/LevelTest] Error:', error);
    return c.json({
      success: false,
      error: { message: '레벨 테스트 생성에 실패했습니다' },
    }, 500);
  }
});

const LevelTestSubmitSchema = z.object({
  subject: z.enum(['MATH', 'KOREAN', 'ENGLISH', 'SCIENCE', 'SOCIAL', 'GENERAL']),
  questions: z.array(z.object({
    id: z.string(),
    subject: z.string(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
    question: z.string(),
    options: z.array(z.string()),
    correctAnswer: z.number(),
    topic: z.string(),
  })),
  answers: z.array(z.number()),
});

// 레벨 테스트 제출 및 채점
coachRoutes.post('/students/:studentId/level-test/submit', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const admissionAgent = supervisor.getAdmissionAgent();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  try {
    const body = await c.req.json();
    const parsed = LevelTestSubmitSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { subject, questions, answers } = parsed.data;

    // 레벨 테스트 채점
    const result = admissionAgent.evaluateLevelTest(
      studentId,
      subject as any,
      questions as any,
      answers
    );

    // 결과 메시지 생성
    const resultMessage = admissionAgent.generateLevelTestResultMessage(result);

    return c.json({
      success: true,
      data: {
        result,
        resultMessage,
        recommendedClass: result.recommendedClass,
      },
    });
  } catch (error) {
    console.error('[Coach/LevelTest] Error:', error);
    return c.json({
      success: false,
      error: { message: '레벨 테스트 채점에 실패했습니다' },
    }, 500);
  }
});

// ===================== 반 배정 (FR-052) =====================

// 반 옵션 조회
coachRoutes.get('/students/:studentId/class-options', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const admissionAgent = supervisor.getAdmissionAgent();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  const subject = (c.req.query('subject') ?? 'GENERAL') as any;
  const classOptions = admissionAgent.getClassOptions(subject);

  return c.json({
    success: true,
    data: {
      classOptions,
      studentName: student.name,
    },
  });
});

const ClassAssignSchema = z.object({
  classId: z.string().min(1),
  levelTestResult: z.object({
    level: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  }).optional(),
});

// 반 배정
coachRoutes.post('/students/:studentId/class-assign', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const admissionAgent = supervisor.getAdmissionAgent();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  try {
    const body = await c.req.json();
    const parsed = ClassAssignSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { classId, levelTestResult } = parsed.data;

    // 반 배정
    const assignment = admissionAgent.assignClass(
      studentId,
      classId,
      levelTestResult as any
    );

    // 반 옵션 조회 (메시지 생성용)
    const classOptions = admissionAgent.getClassOptions('GENERAL');
    const assignmentMessage = admissionAgent.generateClassAssignmentMessage(assignment, classOptions);

    return c.json({
      success: true,
      data: {
        assignment,
        assignmentMessage,
      },
    });
  } catch (error) {
    console.error('[Coach/ClassAssign] Error:', error);
    return c.json({
      success: false,
      error: { message: '반 배정에 실패했습니다' },
    }, 500);
  }
});

// ===================== 오리엔테이션 (FR-053) =====================

// 오리엔테이션 상태 저장 (임시)
const orientationProgressMap = new Map<string, any>();

// 오리엔테이션 시작
coachRoutes.post('/students/:studentId/orientation/start', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const admissionAgent = supervisor.getAdmissionAgent();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  // 오리엔테이션 시작
  const progress = admissionAgent.startOrientation(studentId);

  // 상태 저장
  orientationProgressMap.set(studentId, progress);

  // 첫 단계 메시지
  const stepMessage = admissionAgent.generateOrientationStepMessage(progress);

  return c.json({
    success: true,
    data: {
      progress,
      stepMessage,
    },
  });
});

// 오리엔테이션 현재 상태 조회
coachRoutes.get('/students/:studentId/orientation', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const admissionAgent = supervisor.getAdmissionAgent();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  const progress = orientationProgressMap.get(studentId);

  if (!progress) {
    return c.json({
      success: true,
      data: {
        hasProgress: false,
        message: '오리엔테이션을 시작하지 않았어요. 시작해볼까요?',
      },
    });
  }

  const stepMessage = admissionAgent.generateOrientationStepMessage(progress);

  return c.json({
    success: true,
    data: {
      hasProgress: true,
      progress,
      stepMessage,
      isComplete: progress.completedAt != null,
    },
  });
});

const OrientationStepSchema = z.object({
  stepId: z.string().min(1),
});

// 오리엔테이션 단계 완료
coachRoutes.post('/students/:studentId/orientation/complete-step', async (c) => {
  const studentId = c.req.param('studentId');
  const supervisor = getSupervisor();
  const registry = supervisor.getStudentRegistry();
  const admissionAgent = supervisor.getAdmissionAgent();

  const student = registry.getStudent(studentId);

  if (!student) {
    return c.json({
      success: false,
      error: { message: '학생을 찾을 수 없습니다' },
    }, 404);
  }

  const progress = orientationProgressMap.get(studentId);

  if (!progress) {
    return c.json({
      success: false,
      error: { message: '오리엔테이션을 먼저 시작해주세요' },
    }, 400);
  }

  try {
    const body = await c.req.json();
    const parsed = OrientationStepSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: { message: parsed.error.issues[0]?.message || '잘못된 요청입니다' },
      }, 400);
    }

    const { stepId } = parsed.data;

    // 단계 완료
    const updatedProgress = admissionAgent.completeOrientationStep(progress, stepId);
    orientationProgressMap.set(studentId, updatedProgress);

    // 완료 여부 확인
    const isComplete = updatedProgress.completedAt != null;

    // 메시지 생성
    const stepMessage = isComplete
      ? admissionAgent.generateOrientationCompleteMessage(student.name)
      : admissionAgent.generateOrientationStepMessage(updatedProgress);

    return c.json({
      success: true,
      data: {
        progress: updatedProgress,
        stepMessage,
        isComplete,
      },
    });
  } catch (error) {
    console.error('[Coach/Orientation] Error:', error);
    return c.json({
      success: false,
      error: { message: '오리엔테이션 단계 완료에 실패했습니다' },
    }, 500);
  }
});

// ===================== 유틸리티 함수 =====================

function getRandomCoachTip(): string {
  const tips = [
    '💡 25분 집중 + 5분 휴식의 포모도로 기법을 사용해보세요!',
    '💡 어려운 문제는 쉬운 것부터 풀어보면 자신감이 생겨요!',
    '💡 오늘 배운 내용을 내일 복습하면 기억에 오래 남아요!',
    '💡 목표를 작게 나누면 달성하기 쉬워져요!',
    '💡 충분한 수면은 학습 효과를 2배로 높여줘요!',
    '💡 틀린 문제는 성장의 기회예요! 꼭 다시 풀어보세요!',
    '💡 집중이 안 될 땐 잠깐 산책을 해보세요!',
    '💡 배운 내용을 누군가에게 설명하면 이해가 깊어져요!',
  ];
  return tips[Math.floor(Math.random() * tips.length)]!;
}

function getAchievements(streak: number, completedQuests: number): Array<{
  id: string;
  title: string;
  icon: string;
  earnedAt: string;
}> {
  const achievements = [];

  if (streak >= 3) {
    achievements.push({
      id: 'streak-3',
      title: '3일 연속 학습',
      icon: '🔥',
      earnedAt: new Date().toISOString(),
    });
  }

  if (streak >= 7) {
    achievements.push({
      id: 'streak-7',
      title: '일주일 연속 학습',
      icon: '🏆',
      earnedAt: new Date().toISOString(),
    });
  }

  if (completedQuests >= 10) {
    achievements.push({
      id: 'quests-10',
      title: '퀘스트 10개 완료',
      icon: '⭐',
      earnedAt: new Date().toISOString(),
    });
  }

  if (completedQuests >= 1) {
    achievements.push({
      id: 'first-quest',
      title: '첫 퀘스트 완료',
      icon: '🎯',
      earnedAt: new Date().toISOString(),
    });
  }

  return achievements;
}

function generateCoachFeedback(
  studentName: string,
  streak: number,
  progress: { overallProgress: number; totalPlans: number; activePlans: number }
): string {
  if (streak >= 7) {
    return `${studentName}님, 일주일 연속 학습 대단해요! 🎉\n\n이 페이스를 유지하면 목표 달성은 시간문제예요. 정말 자랑스러워요! 💪`;
  }

  if (streak >= 3) {
    return `${studentName}님, ${streak}일 연속 학습 중이에요! 🔥\n\n꾸준함이 실력이 되는 거예요. 이대로 계속 가봐요!`;
  }

  if (progress.activePlans > 0) {
    return `${studentName}님, ${progress.activePlans}개 플랜을 진행 중이시네요! 📚\n\n조금씩이라도 매일 하는 게 중요해요. 함께라면 할 수 있어요! 💪`;
  }

  return `${studentName}님, 새로운 학습 플랜을 시작해볼까요? ✨\n\n작은 목표부터 차근차근 달성해봐요. 제가 옆에서 도와드릴게요! 😊`;
}
