/**
 * StudentRegistry
 * 학생 데이터 관리 및 영속화
 * - 학생 프로필
 * - 학습 계획
 * - 진행 상황
 */

import type {
  StudentProfile,
  StudyPlan,
  StudySession,
  LearningStyle,
} from '../types/agent.js';
import type { Subject } from '../types/memory.js';

export interface StudentRegistryConfig {
  maxPlansPerStudent: number;
  defaultSessionDuration: number;  // 분
}

const DEFAULT_CONFIG: StudentRegistryConfig = {
  maxPlansPerStudent: 10,
  defaultSessionDuration: 30,
};

export class StudentRegistry {
  private config: StudentRegistryConfig;

  // In-memory 저장소 (실제로는 DB 사용)
  private profiles: Map<string, StudentProfile>;
  private plans: Map<string, StudyPlan[]>;  // studentId → plans

  constructor(config: Partial<StudentRegistryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.profiles = new Map();
    this.plans = new Map();
  }

  // ==================== 학생 프로필 ====================

  /**
   * 학생 생성
   */
  createStudent(params: {
    name: string;
    grade?: string;
    targetExam?: string;
    enrolledSubjects?: Subject[];
    goals?: string[];
  }): StudentProfile {
    const id = this.generateId('student');

    const profile: StudentProfile = {
      id,
      name: params.name,
      grade: params.grade ?? '미설정',
      targetExam: params.targetExam,
      enrolledSubjects: params.enrolledSubjects ?? [],
      goals: params.goals ?? [],
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };

    this.profiles.set(id, profile);
    this.plans.set(id, []);

    return profile;
  }

  /**
   * 학생 조회
   */
  getStudent(studentId: string): StudentProfile | null {
    return this.profiles.get(studentId) ?? null;
  }

  /**
   * 학생 업데이트
   */
  updateStudent(studentId: string, updates: Partial<StudentProfile>): StudentProfile | null {
    const profile = this.profiles.get(studentId);
    if (!profile) return null;

    const updated: StudentProfile = {
      ...profile,
      ...updates,
      id: profile.id,  // ID는 변경 불가
      createdAt: profile.createdAt,  // 생성일은 유지
      lastActiveAt: new Date(),
    };

    this.profiles.set(studentId, updated);
    return updated;
  }

  /**
   * 학습 스타일 설정
   */
  setLearningStyle(studentId: string, style: LearningStyle): StudentProfile | null {
    return this.updateStudent(studentId, { learningStyle: style });
  }

  /**
   * 과목 등록
   */
  enrollSubject(studentId: string, subject: Subject): StudentProfile | null {
    const profile = this.profiles.get(studentId);
    if (!profile) return null;

    if (!profile.enrolledSubjects.includes(subject)) {
      profile.enrolledSubjects.push(subject);
      profile.lastActiveAt = new Date();
    }

    return profile;
  }

  /**
   * 마지막 활동 시간 업데이트
   */
  updateLastActive(studentId: string): void {
    const profile = this.profiles.get(studentId);
    if (profile) {
      profile.lastActiveAt = new Date();
    }
  }

  /**
   * 모든 학생 조회
   */
  getAllStudents(): StudentProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * 학생 삭제
   */
  deleteStudent(studentId: string): boolean {
    const deleted = this.profiles.delete(studentId);
    this.plans.delete(studentId);
    return deleted;
  }

  // ==================== 학습 계획 ====================

  /**
   * 학습 계획 생성
   */
  createPlan(params: {
    studentId: string;
    textbookId: string;
    subject: Subject;
    title: string;
    totalSessions: number;
    targetEndDate: Date;
    topics?: string[];
  }): StudyPlan | null {
    const { studentId } = params;

    if (!this.profiles.has(studentId)) {
      return null;
    }

    const studentPlans = this.plans.get(studentId) ?? [];
    if (studentPlans.length >= this.config.maxPlansPerStudent) {
      console.warn(`[StudentRegistry] Max plans reached for student ${studentId}`);
      return null;
    }

    const planId = this.generateId('plan');

    // 세션 생성
    const sessions: StudySession[] = [];
    for (let i = 0; i < params.totalSessions; i++) {
      sessions.push({
        id: this.generateId('session'),
        planId,
        order: i + 1,
        topic: params.topics?.[i] ?? `세션 ${i + 1}`,
        estimatedMinutes: this.config.defaultSessionDuration,
        status: 'PENDING',
      });
    }

    const plan: StudyPlan = {
      id: planId,
      studentId,
      textbookId: params.textbookId,
      subject: params.subject,
      title: params.title,
      totalSessions: params.totalSessions,
      completedSessions: 0,
      startDate: new Date(),
      targetEndDate: params.targetEndDate,
      status: 'ACTIVE',
      sessions,
    };

    studentPlans.push(plan);
    this.plans.set(studentId, studentPlans);

    return plan;
  }

  /**
   * 학습 계획 조회
   */
  getPlan(planId: string): StudyPlan | null {
    for (const plans of this.plans.values()) {
      const plan = plans.find(p => p.id === planId);
      if (plan) return plan;
    }
    return null;
  }

  /**
   * 학생의 모든 계획 조회
   */
  getStudentPlans(studentId: string): StudyPlan[] {
    return this.plans.get(studentId) ?? [];
  }

  /**
   * 활성 계획만 조회
   */
  getActivePlans(studentId: string): StudyPlan[] {
    const plans = this.plans.get(studentId) ?? [];
    return plans.filter(p => p.status === 'ACTIVE');
  }

  /**
   * 계획 상태 업데이트
   */
  updatePlanStatus(planId: string, status: StudyPlan['status']): StudyPlan | null {
    const plan = this.getPlan(planId);
    if (!plan) return null;

    plan.status = status;
    return plan;
  }

  /**
   * 세션 완료 처리
   */
  completeSession(sessionId: string, params?: {
    actualMinutes?: number;
    notes?: string;
  }): StudySession | null {
    for (const plans of this.plans.values()) {
      for (const plan of plans) {
        const session = plan.sessions.find(s => s.id === sessionId);
        if (session) {
          session.status = 'COMPLETED';
          session.completedAt = new Date();

          if (params?.actualMinutes) {
            session.actualMinutes = params.actualMinutes;
          }
          if (params?.notes) {
            session.notes = params.notes;
          }

          // 계획 진행률 업데이트
          plan.completedSessions = plan.sessions.filter(
            s => s.status === 'COMPLETED'
          ).length;

          // 모든 세션 완료 시 계획 완료
          if (plan.completedSessions === plan.totalSessions) {
            plan.status = 'COMPLETED';
          }

          return session;
        }
      }
    }
    return null;
  }

  /**
   * 다음 세션 조회
   */
  getNextSession(planId: string): StudySession | null {
    const plan = this.getPlan(planId);
    if (!plan) return null;

    return plan.sessions.find(s => s.status === 'PENDING') ?? null;
  }

  /**
   * 세션 스킵 처리
   */
  skipSession(sessionId: string, reason?: string): StudySession | null {
    for (const plans of this.plans.values()) {
      for (const plan of plans) {
        const session = plan.sessions.find(s => s.id === sessionId);
        if (session) {
          session.status = 'SKIPPED';
          session.notes = reason ?? '스킵됨';
          return session;
        }
      }
    }
    return null;
  }

  /**
   * 계획 삭제
   */
  deletePlan(planId: string): boolean {
    for (const [studentId, plans] of this.plans) {
      const idx = plans.findIndex(p => p.id === planId);
      if (idx >= 0) {
        plans.splice(idx, 1);
        this.plans.set(studentId, plans);
        return true;
      }
    }
    return false;
  }

  // ==================== 통계 ====================

  /**
   * 학생 진행 현황 요약
   */
  getStudentProgress(studentId: string): {
    totalPlans: number;
    activePlans: number;
    completedPlans: number;
    totalSessions: number;
    completedSessions: number;
    overallProgress: number;
  } {
    const plans = this.plans.get(studentId) ?? [];

    const totalSessions = plans.reduce((sum, p) => sum + p.totalSessions, 0);
    const completedSessions = plans.reduce((sum, p) => sum + p.completedSessions, 0);

    return {
      totalPlans: plans.length,
      activePlans: plans.filter(p => p.status === 'ACTIVE').length,
      completedPlans: plans.filter(p => p.status === 'COMPLETED').length,
      totalSessions,
      completedSessions,
      overallProgress: totalSessions > 0 ? completedSessions / totalSessions : 0,
    };
  }

  /**
   * 과목별 진행률
   */
  getSubjectProgress(studentId: string, subject: Subject): {
    totalSessions: number;
    completedSessions: number;
    progress: number;
  } {
    const plans = (this.plans.get(studentId) ?? []).filter(p => p.subject === subject);

    const totalSessions = plans.reduce((sum, p) => sum + p.totalSessions, 0);
    const completedSessions = plans.reduce((sum, p) => sum + p.completedSessions, 0);

    return {
      totalSessions,
      completedSessions,
      progress: totalSessions > 0 ? completedSessions / totalSessions : 0,
    };
  }

  // ==================== 유틸리티 ====================

  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
  }

  // ==================== 데이터 내보내기/가져오기 ====================

  /**
   * 학생 데이터 내보내기
   */
  exportStudent(studentId: string): {
    profile: StudentProfile | null;
    plans: StudyPlan[];
  } {
    return {
      profile: this.profiles.get(studentId) ?? null,
      plans: this.plans.get(studentId) ?? [],
    };
  }

  /**
   * 학생 데이터 가져오기
   */
  importStudent(data: {
    profile: StudentProfile;
    plans: StudyPlan[];
  }): void {
    this.profiles.set(data.profile.id, data.profile);
    this.plans.set(data.profile.id, data.plans);
  }

  /**
   * 전체 데이터 내보내기
   */
  exportAll(): {
    profiles: StudentProfile[];
    plans: Record<string, StudyPlan[]>;
  } {
    const plansRecord: Record<string, StudyPlan[]> = {};
    for (const [studentId, studentPlans] of this.plans) {
      plansRecord[studentId] = studentPlans;
    }

    return {
      profiles: Array.from(this.profiles.values()),
      plans: plansRecord,
    };
  }

  /**
   * 전체 데이터 가져오기
   */
  importAll(data: {
    profiles: StudentProfile[];
    plans: Record<string, StudyPlan[]>;
  }): void {
    this.profiles.clear();
    this.plans.clear();

    for (const profile of data.profiles) {
      this.profiles.set(profile.id, profile);
    }

    for (const [studentId, studentPlans] of Object.entries(data.plans)) {
      this.plans.set(studentId, studentPlans);
    }
  }
}
