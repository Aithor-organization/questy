/**
 * ReportPage
 * 학습 리포트 페이지 - 주간/일간 분석
 * questStore의 실제 퀘스트 완료 데이터 연동
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotebookLayout } from '../components/notebook/NotebookLayout';
import { useQuestStore, getTodayDateString } from '../stores/questStore';

interface WeeklyReport {
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalStudyDays: number;
    totalStudyMinutes: number;
    completedQuests: number;
    earnedXp: number;
    currentStreak: number;
  };
  planProgress: Array<{
    planId: string;
    title: string;
    progress: number;
    sessionsCompleted: number;
    totalSessions: number;
  }>;
  achievements: Array<{
    id: string;
    title: string;
    icon: string;
    earnedAt: string;
  }>;
  coachFeedback: string;
}

export function ReportPage() {
  const navigate = useNavigate();
  const [studentName, setStudentName] = useState('학생');
  const [activeTab, setActiveTab] = useState<'weekly' | 'daily'>('weekly');
  const plans = useQuestStore((state) => state.plans);

  useEffect(() => {
    const storedName = localStorage.getItem('questybook_student_name');
    setStudentName(storedName || '학생');
  }, []);

  // questStore 데이터로 실제 리포트 계산
  const report = useMemo((): WeeklyReport => {
    const today = new Date();
    const todayStr = getTodayDateString();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);

    // 모든 퀘스트 수집
    const allQuests = plans.flatMap((plan) =>
      plan.dailyQuests.map((quest) => ({
        ...quest,
        planId: plan.id,
        planName: plan.materialName,
      }))
    );

    // 이번 주 퀘스트 필터링
    const weeklyQuests = allQuests.filter(
      (q) => q.date >= weekAgoStr && q.date <= todayStr
    );

    // 완료된 퀘스트
    const completedQuests = weeklyQuests.filter((q) => q.completed);

    // 완료된 날짜들 (중복 제거)
    const completedDates = [...new Set(completedQuests.map((q) => q.date))];

    // 총 학습 시간 (완료된 퀘스트의 estimatedMinutes 합계)
    const totalMinutes = completedQuests.reduce(
      (sum, q) => sum + (q.estimatedMinutes || 0),
      0
    );

    // 연속 학습일 계산
    let streak = 0;
    const checkDate = new Date(today);
    while (true) {
      const dateStr = checkDate.toISOString().slice(0, 10);
      const hasCompletedQuest = completedQuests.some((q) => q.date === dateStr);
      if (hasCompletedQuest) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // 플랜별 진행 현황
    const planProgress = plans.map((plan) => {
      const totalSessions = plan.dailyQuests.length;
      const sessionsCompleted = plan.dailyQuests.filter((q) => q.completed).length;
      const progress = totalSessions > 0 ? Math.round((sessionsCompleted / totalSessions) * 100) : 0;
      return {
        planId: plan.id,
        title: plan.materialName,
        progress,
        sessionsCompleted,
        totalSessions,
      };
    });

    // 업적 계산
    const achievements: WeeklyReport['achievements'] = [];
    if (completedQuests.length >= 1) {
      achievements.push({
        id: 'first-quest',
        title: '첫 퀘스트 완료',
        icon: '🎯',
        earnedAt: new Date().toISOString(),
      });
    }
    if (completedQuests.length >= 10) {
      achievements.push({
        id: 'ten-quests',
        title: '퀘스트 10개 완료',
        icon: '🌟',
        earnedAt: new Date().toISOString(),
      });
    }
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
        title: '7일 연속 학습',
        icon: '💪',
        earnedAt: new Date().toISOString(),
      });
    }

    // XP 계산 (퀘스트당 100XP)
    const earnedXp = completedQuests.length * 100;

    // 코치 피드백 생성
    let coachFeedback = '';
    if (completedQuests.length === 0) {
      coachFeedback = `아직 학습 기록이 없어요! 🌱\n\n오늘부터 첫 퀘스트를 시작해볼까요?`;
    } else if (streak >= 7) {
      coachFeedback = `${studentName}님, 정말 대단해요! 🎉\n\n7일 연속 학습 중이에요! 이 페이스를 유지하면 목표 달성은 시간문제예요! 💪`;
    } else if (streak >= 3) {
      coachFeedback = `${studentName}님, 잘하고 있어요! 🌟\n\n${streak}일 연속 학습 중이네요! 꾸준함이 실력을 만들어요!`;
    } else if (completedQuests.length >= 5) {
      coachFeedback = `${studentName}님, 좋은 진행이에요! 📚\n\n벌써 ${completedQuests.length}개의 퀘스트를 완료했네요! 계속 이 조자로!`;
    } else {
      coachFeedback = `${studentName}님, 시작이 반이에요! 🚀\n\n${completedQuests.length}개의 퀘스트를 완료했어요. 오늘도 함께 성장해요!`;
    }

    return {
      period: {
        start: weekAgoStr,
        end: todayStr,
      },
      summary: {
        totalStudyDays: completedDates.length,
        totalStudyMinutes: totalMinutes,
        completedQuests: completedQuests.length,
        earnedXp,
        currentStreak: streak,
      },
      planProgress,
      achievements,
      coachFeedback,
    };
  }, [plans, studentName]);

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}시간 ${mins}분`;
    }
    return `${mins}분`;
  };

  return (
    <NotebookLayout>
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="handwrite handwrite-xl text-[var(--ink-black)]">📊 학습 리포트</h1>
        <p className="text-[var(--pencil-gray)] mt-1">{studentName}님의 학습 현황</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('weekly')}
          className={`date-tab ${activeTab === 'weekly' ? 'active' : ''}`}
        >
          📅 주간
        </button>
        <button
          onClick={() => setActiveTab('daily')}
          className={`date-tab ${activeTab === 'daily' ? 'active' : ''}`}
        >
          📆 오늘
        </button>
      </div>

      <div className="space-y-6">
          {/* 기간 표시 */}
          <div className="notebook-page p-4">
            <p className="text-sm text-[var(--pencil-gray)]">
              {activeTab === 'weekly' ? `${report.period.start} ~ ${report.period.end}` : '오늘'}
            </p>
          </div>

          {/* 요약 통계 */}
          <div className="notebook-page p-4">
            <h2 className="handwrite text-lg text-[var(--ink-black)] mb-4">✨ 이번 주 요약</h2>
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                icon="🔥"
                label="연속 학습"
                value={`${report.summary.currentStreak}일`}
                highlight={report.summary.currentStreak >= 5}
              />
              <StatCard
                icon="⏱️"
                label="총 학습 시간"
                value={formatMinutes(report.summary.totalStudyMinutes)}
              />
              <StatCard
                icon="✅"
                label="완료한 퀘스트"
                value={`${report.summary.completedQuests}개`}
              />
              <StatCard
                icon="⭐"
                label="획득 XP"
                value={`${report.summary.earnedXp}`}
                highlight
              />
            </div>
          </div>

          {/* 스트릭 달력 */}
          <div className="notebook-page p-4">
            <h2 className="handwrite text-lg text-[var(--ink-black)] mb-4">📅 학습 기록</h2>
            <StreakCalendar streak={report.summary.currentStreak} />
          </div>

          {/* 플랜 진행 현황 */}
          {report.planProgress.length > 0 && (
            <div className="notebook-page p-4">
              <h2 className="handwrite text-lg text-[var(--ink-black)] mb-4">📚 플랜 진행 현황</h2>
              <div className="space-y-3">
                {report.planProgress.map(plan => (
                  <div key={plan.planId} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--ink-black)]">{plan.title}</span>
                      <span className="text-sm text-[var(--pencil-gray)]">
                        {plan.sessionsCompleted}/{plan.totalSessions}회
                      </span>
                    </div>
                    <div className="progress-bar-notebook">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${plan.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-right text-[var(--ink-blue)]">{plan.progress}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 업적 */}
          {report.achievements.length > 0 && (
            <div className="notebook-page p-4">
              <h2 className="handwrite text-lg text-[var(--ink-black)] mb-4">🏆 획득한 배지</h2>
              <div className="flex flex-wrap gap-2">
                {report.achievements.map(achievement => (
                  <div
                    key={achievement.id}
                    className="sticker sticker-gold flex items-center gap-1"
                  >
                    <span>{achievement.icon}</span>
                    <span>{achievement.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 코치 피드백 */}
          <div className="notebook-page p-4 bg-[var(--highlight-green)]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl flex-shrink-0">
                🤖
              </div>
              <div>
                <h3 className="font-bold text-[var(--ink-black)] mb-2">코치의 한마디</h3>
                <p className="text-[var(--ink-black)] whitespace-pre-wrap">{report.coachFeedback}</p>
              </div>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/chat')}
              className="flex-1 py-3 bg-[var(--sticker-mint)] text-white rounded-lg hover:bg-emerald-500 transition-colors"
            >
              💬 코치와 대화하기
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 py-3 bg-[var(--ink-blue)] text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              📚 오늘의 퀘스트
            </button>
          </div>
        </div>
    </NotebookLayout>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? 'bg-[var(--highlight-yellow)]' : 'bg-[var(--paper-cream)]'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-[var(--pencil-gray)]">{label}</span>
      </div>
      <p className="text-xl font-bold text-[var(--ink-black)]">{value}</p>
    </div>
  );
}

function StreakCalendar({ streak }: { streak: number }) {
  const today = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];

  // 최근 7일 생성
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (6 - i));
    return {
      date,
      day: days[date.getDay()],
      isToday: i === 6,
      completed: i >= 7 - streak, // 스트릭에 포함되면 완료로 표시
    };
  });

  return (
    <div className="flex justify-between">
      {weekDays.map((day, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span className="text-xs text-[var(--pencil-gray)]">{day.day}</span>
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
              day.isToday
                ? 'bg-[var(--ink-blue)] text-white'
                : day.completed
                ? 'bg-[var(--sticker-mint)] text-white'
                : 'bg-[var(--paper-lines)] text-[var(--pencil-gray)]'
            }`}
          >
            {day.date.getDate()}
          </div>
          {day.completed && <span className="text-xs">🔥</span>}
        </div>
      ))}
    </div>
  );
}
