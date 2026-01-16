/**
 * ActionButtons
 * 채팅 메시지 내 액션 버튼 컴포넌트
 * - 플랜 재설정, 내비게이션, 스마트 재스케줄링, 커리큘럼 생성 등 다양한 액션 지원
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MessageAction } from '../../../stores/chatStore';
import { useChatStore } from '../../../stores/chatStore';
import { useQuestStore } from '../../../stores/questStore';
import { API_BASE_URL } from '../../../config';

interface ActionButtonsProps {
  actions: MessageAction[];
  roomId: string;
}

export function ActionButtons({ actions, roomId }: ActionButtonsProps) {
  const navigate = useNavigate();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const { addMessage } = useChatStore();
  const { postponeTodayQuests, rescheduleQuest, smartRescheduleQuests, addPlan, plans, toggleQuestComplete, removePlan } = useQuestStore();

  const handleAction = async (action: MessageAction) => {
    if (completedIds.has(action.id)) return;

    setLoadingId(action.id);

    try {
      switch (action.type) {
        case 'POSTPONE_TODAY': {
          const daysToAdd = action.data?.daysToAdd ?? 1;
          postponeTodayQuests(daysToAdd);

          // 성공 메시지
          addMessage(roomId, {
            role: 'assistant',
            content: `✅ 오늘 퀘스트를 ${daysToAdd}일 뒤로 미뤘어요! 내일 다시 화이팅! 💪`,
            agentRole: 'COACH',
          });

          setCompletedIds(prev => new Set(prev).add(action.id));
          break;
        }

        case 'RESCHEDULE_QUEST': {
          const { planId, questId, newDate } = action.data ?? {};
          if (planId && questId && newDate) {
            const success = rescheduleQuest(planId, questId, newDate);

            if (success) {
              addMessage(roomId, {
                role: 'assistant',
                content: `✅ 퀘스트 일정이 ${newDate}로 변경되었어요!`,
                agentRole: 'PLANNER',
              });
            } else {
              addMessage(roomId, {
                role: 'assistant',
                content: '❌ 일정 변경에 실패했어요. 이미 완료된 퀘스트이거나 존재하지 않는 퀘스트예요.',
                agentRole: 'COACH',
              });
            }
          }

          setCompletedIds(prev => new Set(prev).add(action.id));
          break;
        }

        case 'NAVIGATE': {
          const navigateTo = action.data?.navigateTo;
          if (navigateTo) {
            navigate(navigateTo);
          }
          break;
        }

        case 'SMART_RESCHEDULE': {
          const { planId, targetDate, strategy = 'smart' } = action.data ?? {};
          if (planId && targetDate) {
            const result = await smartRescheduleQuests(planId, targetDate, strategy);

            if (result?.success) {
              const message = result.warnings?.length
                ? `✅ ${result.rescheduledCount}개 퀘스트를 재조정했어요!\n⚠️ 주의: ${result.warnings.join(', ')}`
                : `✅ ${result.rescheduledCount}개 퀘스트를 스마트하게 재조정했어요! 다른 플랜과의 충돌도 고려했습니다. 📅`;

              addMessage(roomId, {
                role: 'assistant',
                content: message,
                agentRole: 'PLANNER',
              });
            } else {
              addMessage(roomId, {
                role: 'assistant',
                content: '❌ 재조정에 실패했어요. 다시 시도해주세요.',
                agentRole: 'COACH',
              });
            }
          }

          setCompletedIds(prev => new Set(prev).add(action.id));
          break;
        }

        case 'GENERATE_CURRICULUM': {
          const { materialName, targetDays, dailyStudyHours = 10, units } = action.data ?? {};
          if (materialName && targetDays && units && units.length > 0) {
            // 다른 플랜 정보 수집
            const existingPlans = plans.map(p => ({
              id: p.id,
              title: p.materialName,
              quests: p.dailyQuests.map(q => ({
                scheduledDate: q.date,
                estimatedMinutes: q.estimatedMinutes,
              })),
            }));

            // 코치 API를 통해 커리큘럼 생성
            const response = await fetch(`${API_BASE_URL}/api/coach/curriculum/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentId: 'guest',
                materialName,
                targetDays,
                dailyStudyHours,
                units,
                existingPlans,
              }),
            });

            const result = await response.json();

            if (result.success && result.data?.curriculum) {
              // 플랜을 스토어에 추가
              addPlan({
                materialName,
                dailyQuests: result.data.curriculum.dailyQuests || [],
                summary: result.data.curriculum.summary || {
                  totalDays: targetDays,
                  totalUnits: units.length,
                  averageMinutesPerDay: 0,
                },
              });

              addMessage(roomId, {
                role: 'assistant',
                content: result.data.coachMessage || `✨ "${materialName}" 커리큘럼을 만들었어요!`,
                agentRole: 'PLANNER',
              });
            } else {
              addMessage(roomId, {
                role: 'assistant',
                content: '❌ 커리큘럼 생성에 실패했어요. 다시 시도해주세요.',
                agentRole: 'COACH',
              });
            }
          }

          setCompletedIds(prev => new Set(prev).add(action.id));
          break;
        }

        case 'CUSTOM': {
          console.log('[ActionButtons] Custom action:', action.data?.customHandler);
          setCompletedIds(prev => new Set(prev).add(action.id));
          break;
        }

        case 'COMPLETE_QUEST': {
          const { planId, questId, completed = true } = action.data ?? {};
          if (planId && questId) {
            toggleQuestComplete(planId, questId);

            const plan = plans.find(p => p.id === planId);
            const quest = plan?.dailyQuests.find(q => q.id === questId);
            const questTitle = quest?.unitTitle || '퀘스트';

            addMessage(roomId, {
              role: 'assistant',
              content: completed
                ? `✅ "${questTitle}" 퀘스트를 완료 처리했어요! 수고하셨습니다! 🎉`
                : `🔄 "${questTitle}" 퀘스트를 미완료로 변경했어요.`,
              agentRole: 'COACH',
            });
          }

          setCompletedIds(prev => new Set(prev).add(action.id));
          break;
        }

        case 'DELETE_PLAN': {
          const { planId } = action.data ?? {};
          if (planId) {
            const plan = plans.find(p => p.id === planId);
            const planName = plan?.materialName || '플랜';

            removePlan(planId);

            addMessage(roomId, {
              role: 'assistant',
              content: `🗑️ "${planName}" 플랜을 삭제했어요. 새로운 계획이 필요하시면 말씀해주세요!`,
              agentRole: 'PLANNER',
            });
          }

          setCompletedIds(prev => new Set(prev).add(action.id));
          break;
        }
      }
    } catch (error) {
      console.error('[ActionButtons] Action failed:', error);
      addMessage(roomId, {
        role: 'assistant',
        content: '❌ 작업 중 오류가 발생했어요. 다시 시도해주세요.',
        agentRole: 'COACH',
      });
    } finally {
      setLoadingId(null);
    }
  };

  const getButtonStyle = (action: MessageAction) => {
    if (completedIds.has(action.id)) {
      return 'bg-gray-200 text-gray-500 cursor-not-allowed';
    }
    if (loadingId === action.id) {
      return 'bg-[var(--ink-blue)] text-white opacity-70 cursor-wait';
    }
    return 'bg-[var(--ink-blue)] text-white hover:bg-opacity-90 active:scale-95';
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={() => handleAction(action)}
          disabled={loadingId === action.id || completedIds.has(action.id)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${getButtonStyle(action)}`}
        >
          {action.icon && <span className="mr-1">{action.icon}</span>}
          {loadingId === action.id ? '처리 중...' : completedIds.has(action.id) ? '✓ 완료' : action.label}
        </button>
      ))}
    </div>
  );
}
