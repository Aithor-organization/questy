/**
 * QuestyCoachAgent Entry Point
 * 데모 및 테스트용 메인 스크립트
 * Supervisor Pattern 기반 Multi-Agent Orchestration
 */

import { Supervisor } from './core/orchestrator/index.js';
import { Director } from './core/director/index.js';
import type { AgentRequest, StudentProfile, Subject } from './types/index.js';

async function main() {
  console.log('🎓 QuestyCoachAgent v2.0 - Supervisor Pattern\n');

  // Supervisor 초기화 (새로운 아키텍처)
  const supervisor = new Supervisor({
    enableMemoryExtraction: true,
    enableBurnoutCheck: true,
    enableQuestSystem: true,
  });

  // 테스트 학생 생성
  const registry = supervisor.getStudentRegistry();
  const testStudent = registry.createStudent({
    name: '테스트 학생',
    grade: '고2',
    enrolledSubjects: ['MATH', 'KOREAN'] as Subject[],
    goals: ['수능 대비', '내신 관리'],
  });

  console.log(`✅ 학생 생성: ${testStudent.name} (${testStudent.id})\n`);

  // 학습 계획 추가
  const plan = registry.createPlan({
    studentId: testStudent.id,
    textbookId: 'textbook-math-001',
    subject: 'MATH',
    title: '수학 기본 개념 마스터',
    totalSessions: 30,
    targetEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    topics: [
      '수와 연산', '다항식', '방정식', '부등식', '함수',
      '직선의 방정식', '원의 방정식', '도형의 이동', '집합', '명제',
    ],
  });

  if (plan) {
    console.log(`📚 학습 계획 생성: ${plan.title} (${plan.totalSessions}회)\n`);
  }

  // 테스트 대화 시나리오
  const testCases: Array<{ message: string; description: string }> = [
    {
      message: '안녕! 처음 왔어',
      description: 'Admission Agent - 환영 메시지',
    },
    {
      message: '수학 공부 계획 세워줘',
      description: 'Planner Agent - 학습 계획',
    },
    {
      message: '이차방정식이 뭐야?',
      description: 'Coach Agent - 개념 설명',
    },
    {
      message: '내 진도 어때?',
      description: 'Analyst Agent - 진도 분석',
    },
    {
      message: '너무 힘들어 포기하고 싶어',
      description: 'Coach Agent - 감정 지원',
    },
  ];

  console.log('📋 테스트 시나리오 실행 (Supervisor Pattern)\n');
  console.log('='.repeat(60));

  for (const testCase of testCases) {
    console.log(`\n🧪 ${testCase.description}`);
    console.log(`👤 학생: "${testCase.message}"`);
    console.log('-'.repeat(50));

    const request: AgentRequest = {
      studentId: testStudent.id,
      message: testCase.message,
      conversationId: 'conv-supervisor-001',
    };

    try {
      const response = await supervisor.process(request);

      // 응답 출력 (긴 응답은 잘라서 표시)
      const displayMessage = response.message.length > 300
        ? response.message.slice(0, 300) + '...'
        : response.message;

      console.log(`🤖 [${response.agentRole}]: ${displayMessage}`);

      if (response.suggestedFollowUp && response.suggestedFollowUp.length > 0) {
        console.log(`💡 후속 제안: ${response.suggestedFollowUp.join(', ')}`);
      }

      // 실행 상태 확인
      const state = supervisor.getExecutionState('conv-supervisor-001');
      if (state) {
        const path = state.executionPath.map(p => p.agent).join(' → ');
        console.log(`🔄 실행 경로: ${path}`);
      }
    } catch (error) {
      console.error('❌ 오류:', error);
    }

    console.log('-'.repeat(50));
  }

  // Daily Quest 시스템 테스트
  console.log('\n📅 Daily Quest 시스템 테스트');
  console.log('='.repeat(60));

  const quests = await supervisor.generateDailyQuests(testStudent.id);
  if (quests) {
    console.log(`\n${quests.dailyMessage}`);
    console.log(`\n${quests.coachTip}`);
    console.log(`\n📋 오늘의 퀘스트:`);
    console.log(`  - 메인 퀘스트: ${quests.mainQuests.length}개`);
    console.log(`  - 복습 퀘스트: ${quests.reviewQuests.length}개`);
    console.log(`  - 보너스 퀘스트: ${quests.bonusQuests.length}개`);
    console.log(`  - 총 예상 시간: ${quests.summary.estimatedTotalMinutes}분`);
    console.log(`  - 획득 가능 XP: ${quests.summary.totalXpAvailable}`);
  }

  // Memory Lane 상태 확인
  console.log('\n📊 Memory Lane 상태');
  console.log('='.repeat(60));

  const memoryLane = supervisor.getMemoryLane();
  const memories = memoryLane.getAllMemories(testStudent.id);
  console.log(`총 기억: ${memories.length}개`);

  const recommendations = memoryLane.getReviewRecommendations(testStudent.id);
  if (recommendations.length > 0) {
    console.log(`복습 권장: ${recommendations.join(', ')}`);
  }

  // 학생 진행 현황
  console.log('\n📈 학생 진행 현황');
  console.log('='.repeat(60));

  const progress = registry.getStudentProgress(testStudent.id);
  console.log(`총 계획: ${progress.totalPlans}개`);
  console.log(`활성 계획: ${progress.activePlans}개`);
  console.log(`완료된 계획: ${progress.completedPlans}개`);
  console.log(`전체 진행률: ${(progress.overallProgress * 100).toFixed(1)}%`);

  console.log('\n✅ QuestyCoachAgent v2.0 테스트 완료!');
  console.log('   Supervisor Pattern 기반 Multi-Agent Orchestration 정상 동작\n');
}

// Legacy Director 테스트 (하위 호환성)
async function testLegacyDirector() {
  console.log('\n🔄 Legacy Director 테스트 (하위 호환성)\n');

  const director = new Director({
    enableMemoryExtraction: true,
    enableBurnoutCheck: true,
  });

  const testProfile: StudentProfile = {
    id: 'student-legacy-001',
    name: 'Legacy 학생',
    grade: '고3',
    enrolledSubjects: ['ENGLISH'],
    goals: ['영어 마스터'],
    createdAt: new Date(),
    lastActiveAt: new Date(),
  };

  director.setStudentProfile(testProfile);

  const request: AgentRequest = {
    studentId: testProfile.id,
    message: '영어 문법 도와줘',
    conversationId: 'conv-legacy-001',
  };

  const response = await director.process(request);
  console.log(`🤖 [${response.agentRole}]: ${response.message.slice(0, 200)}...`);
  console.log('\n✅ Legacy Director 정상 동작');
}

// 메인 실행
main()
  .then(() => testLegacyDirector())
  .catch(console.error);
