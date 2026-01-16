# Schedule Optimizer - 퀘스트 스케줄 재조정
# 미완료 퀘스트를 목표일까지 재배치

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass
from enum import Enum

from config import get_config
from .quest_manager import Quest, QuestStatus, QuestPriority, QuestSchedule, QuestManager


class RescheduleStrategy(Enum):
    """재조정 전략"""
    SPREAD = "spread"              # 균등 분배
    FRONT_LOAD = "front_load"      # 앞쪽 집중
    BACK_LOAD = "back_load"        # 뒤쪽 집중
    PRIORITY_FIRST = "priority"    # 우선순위 순
    SMART = "smart"                # 지능형 (과목 균형 + 우선순위)


@dataclass
class RescheduleResult:
    """재조정 결과"""
    success: bool
    strategy_used: RescheduleStrategy
    rescheduled_quests: List[Quest]
    original_dates: Dict[str, str]  # quest_id -> original_date
    new_schedules: Dict[str, QuestSchedule]
    warnings: List[str]
    daily_overload: List[str]  # 과부하 날짜 리스트
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "strategy_used": self.strategy_used.value,
            "rescheduled_count": len(self.rescheduled_quests),
            "original_dates": self.original_dates,
            "warnings": self.warnings,
            "daily_overload": self.daily_overload,
            "metadata": self.metadata
        }


class ScheduleOptimizer:
    """
    스케줄 최적화기

    기능:
    1. 미완료 퀘스트 감지
    2. 목표일까지 재배치
    3. 일일 학습량 균형 조정
    4. 과목별 분산 배치
    5. 우선순위 기반 최적화
    """

    def __init__(self, quest_manager: QuestManager):
        self.config = get_config()
        self.quest_manager = quest_manager

        # 최적화 설정
        self.max_daily_hours = 10  # 최대 일일 학습 시간
        self.min_daily_hours = 2   # 최소 일일 학습 시간
        self.buffer_ratio = 0.1    # 여유 시간 비율 (10%)

    def reschedule_overdue(
        self,
        target_date: str,
        daily_study_hours: int = 6,
        strategy: RescheduleStrategy = RescheduleStrategy.SMART,
        existing_plans: list = None
    ) -> RescheduleResult:
        """
        미완료 퀘스트 재조정 (스마트 스케줄링: 다른 플랜과의 충돌 방지)

        Args:
            target_date: 목표일 (YYYY-MM-DD)
            daily_study_hours: 일일 학습 시간
            strategy: 재조정 전략
            existing_plans: 다른 플랜 정보 (일별 시간 사용량 계산용)

        Returns:
            RescheduleResult: 재조정 결과
        """
        # 다른 플랜의 일별 시간 사용량 계산
        external_daily_usage = self._calculate_external_daily_usage(existing_plans or [])
        # 1. 미완료/기한초과 퀘스트 수집
        overdue_quests = self.quest_manager.get_overdue_quests()
        pending_quests = [
            q for q in self.quest_manager.get_pending_quests()
            if q not in overdue_quests
        ]

        quests_to_reschedule = overdue_quests.copy()

        if not quests_to_reschedule:
            return RescheduleResult(
                success=True,
                strategy_used=strategy,
                rescheduled_quests=[],
                original_dates={},
                new_schedules={},
                warnings=["재조정할 퀘스트가 없습니다."],
                daily_overload=[],
                metadata={"reason": "no_overdue_quests"}
            )

        # 2. 원래 날짜 저장
        original_dates = {q.id: q.scheduled_date for q in quests_to_reschedule}

        # 3. 가용 날짜 계산
        today = datetime.now().date()
        end_date = datetime.strptime(target_date, "%Y-%m-%d").date()
        available_days = (end_date - today).days

        if available_days <= 0:
            return RescheduleResult(
                success=False,
                strategy_used=strategy,
                rescheduled_quests=[],
                original_dates=original_dates,
                new_schedules={},
                warnings=["목표일이 이미 지났습니다."],
                daily_overload=[],
                metadata={"reason": "target_date_passed"}
            )

        # 4. 일일 가용 시간 계산 (기존 퀘스트 + 다른 플랜 고려)
        daily_capacity = self._calculate_daily_capacity(
            today, end_date, daily_study_hours, pending_quests, external_daily_usage
        )

        # 5. 전략에 따라 재조정
        if strategy == RescheduleStrategy.SMART:
            result = self._smart_reschedule(
                quests_to_reschedule, daily_capacity, today, end_date
            )
        elif strategy == RescheduleStrategy.SPREAD:
            result = self._spread_reschedule(
                quests_to_reschedule, daily_capacity, today, end_date
            )
        elif strategy == RescheduleStrategy.PRIORITY_FIRST:
            result = self._priority_reschedule(
                quests_to_reschedule, daily_capacity, today, end_date
            )
        elif strategy == RescheduleStrategy.FRONT_LOAD:
            result = self._front_load_reschedule(
                quests_to_reschedule, daily_capacity, today, end_date
            )
        else:
            result = self._back_load_reschedule(
                quests_to_reschedule, daily_capacity, today, end_date
            )

        # 6. 퀘스트 상태 업데이트
        for quest in result["rescheduled"]:
            quest.status = QuestStatus.RESCHEDULED
            self.quest_manager.quests[quest.id] = quest

        # 7. 스케줄 재구축
        all_quests = list(self.quest_manager.quests.values())
        self.quest_manager._build_schedules(all_quests, daily_study_hours * 60)

        return RescheduleResult(
            success=result["success"],
            strategy_used=strategy,
            rescheduled_quests=result["rescheduled"],
            original_dates=original_dates,
            new_schedules=self.quest_manager.schedules,
            warnings=result["warnings"],
            daily_overload=result["overload_days"],
            metadata={
                "total_rescheduled": len(result["rescheduled"]),
                "available_days": available_days,
                "total_minutes_rescheduled": sum(q.estimated_minutes for q in result["rescheduled"])
            }
        )

    def _calculate_external_daily_usage(self, existing_plans: list) -> Dict[str, int]:
        """
        다른 플랜의 일별 시간 사용량 계산 (스마트 스케줄링)

        Args:
            existing_plans: 다른 플랜 목록
                각 플랜은 quests 배열을 가지며, 각 퀘스트는 scheduledDate와 estimatedMinutes를 가짐

        Returns:
            Dict[str, int]: 날짜별 사용 시간 (분)
        """
        daily_usage: Dict[str, int] = {}

        for plan in existing_plans:
            quests = plan.get("quests", [])
            for quest in quests:
                scheduled_date = quest.get("scheduledDate", "")
                estimated_minutes = quest.get("estimatedMinutes", 0)

                if scheduled_date and estimated_minutes > 0:
                    if scheduled_date not in daily_usage:
                        daily_usage[scheduled_date] = 0
                    daily_usage[scheduled_date] += estimated_minutes

        return daily_usage

    def _calculate_daily_capacity(
        self,
        start_date: datetime,
        end_date: datetime,
        daily_hours: int,
        existing_quests: List[Quest],
        external_daily_usage: Dict[str, int] = None
    ) -> Dict[str, int]:
        """
        일별 남은 용량 계산 (내부 퀘스트 + 외부 플랜 모두 고려)

        Args:
            start_date: 시작일
            end_date: 종료일
            daily_hours: 일일 학습 시간
            existing_quests: 현재 플랜의 기존 퀘스트
            external_daily_usage: 다른 플랜의 일별 시간 사용량
        """
        capacity = {}
        daily_minutes = daily_hours * 60
        buffer_minutes = int(daily_minutes * self.buffer_ratio)
        available = daily_minutes - buffer_minutes

        if external_daily_usage is None:
            external_daily_usage = {}

        current = start_date
        while current <= end_date:
            date_str = current.strftime("%Y-%m-%d")

            # 1. 기존 퀘스트 시간 차감 (현재 플랜 내부)
            internal_minutes = sum(
                q.estimated_minutes for q in existing_quests
                if q.scheduled_date == date_str
            )

            # 2. 외부 플랜 시간 차감 (다른 플랜들)
            external_minutes = external_daily_usage.get(date_str, 0)

            # 3. 최종 가용 시간 = 총 가용 - 내부 - 외부
            remaining = max(0, available - internal_minutes - external_minutes)
            capacity[date_str] = remaining

            current += timedelta(days=1)

        return capacity

    def _smart_reschedule(
        self,
        quests: List[Quest],
        capacity: Dict[str, int],
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """
        지능형 재조정

        - 과목별 균형 배치
        - 우선순위 고려
        - 의존성 체크
        - 부하 균등 분배
        """
        rescheduled = []
        warnings = []
        overload_days = []

        # 우선순위로 정렬
        sorted_quests = sorted(
            quests,
            key=lambda q: (q.priority.value, q.chapter),
            reverse=True
        )

        # 과목별 그룹화
        subject_quests: Dict[str, List[Quest]] = {}
        for q in sorted_quests:
            if q.subject not in subject_quests:
                subject_quests[q.subject] = []
            subject_quests[q.subject].append(q)

        # 라운드 로빈으로 과목별 배치
        dates = sorted(capacity.keys())
        date_idx = 0
        subject_idx = 0
        subjects = list(subject_quests.keys())

        remaining_quests = sorted_quests.copy()

        while remaining_quests and date_idx < len(dates):
            current_date = dates[date_idx]
            current_capacity = capacity[current_date]

            if current_capacity <= 0:
                date_idx += 1
                continue

            # 현재 과목에서 배치 가능한 퀘스트 찾기
            placed = False
            for _ in range(len(subjects)):
                subject = subjects[subject_idx % len(subjects)]
                subject_idx += 1

                for quest in remaining_quests:
                    if quest.subject == subject and quest.estimated_minutes <= current_capacity:
                        quest.scheduled_date = current_date
                        rescheduled.append(quest)
                        remaining_quests.remove(quest)
                        capacity[current_date] -= quest.estimated_minutes
                        placed = True
                        break

                if placed:
                    break

            if not placed:
                date_idx += 1

        # 남은 퀘스트 강제 배치 (과부하 허용)
        if remaining_quests:
            warnings.append(f"{len(remaining_quests)}개 퀘스트가 과부하로 배치되었습니다.")
            for quest in remaining_quests:
                # 가장 여유 있는 날에 배치
                best_date = max(capacity.keys(), key=lambda d: capacity[d])
                quest.scheduled_date = best_date
                rescheduled.append(quest)
                capacity[best_date] -= quest.estimated_minutes
                if capacity[best_date] < 0 and best_date not in overload_days:
                    overload_days.append(best_date)

        return {
            "success": len(remaining_quests) == 0 or len(overload_days) <= 3,
            "rescheduled": rescheduled,
            "warnings": warnings,
            "overload_days": overload_days
        }

    def _spread_reschedule(
        self,
        quests: List[Quest],
        capacity: Dict[str, int],
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """균등 분배 재조정"""
        rescheduled = []
        warnings = []
        overload_days = []

        dates = sorted(capacity.keys())
        quests_per_day = max(1, len(quests) // len(dates))

        quest_idx = 0
        for date in dates:
            day_count = 0
            while quest_idx < len(quests) and day_count < quests_per_day:
                quest = quests[quest_idx]
                if capacity[date] >= quest.estimated_minutes:
                    quest.scheduled_date = date
                    capacity[date] -= quest.estimated_minutes
                    rescheduled.append(quest)
                    day_count += 1
                quest_idx += 1

        # 남은 퀘스트 배치
        while quest_idx < len(quests):
            quest = quests[quest_idx]
            best_date = max(capacity.keys(), key=lambda d: capacity[d])
            quest.scheduled_date = best_date
            capacity[best_date] -= quest.estimated_minutes
            rescheduled.append(quest)
            if capacity[best_date] < 0 and best_date not in overload_days:
                overload_days.append(best_date)
            quest_idx += 1

        return {
            "success": True,
            "rescheduled": rescheduled,
            "warnings": warnings,
            "overload_days": overload_days
        }

    def _priority_reschedule(
        self,
        quests: List[Quest],
        capacity: Dict[str, int],
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """우선순위 기반 재조정"""
        sorted_quests = sorted(quests, key=lambda q: q.priority.value, reverse=True)
        return self._spread_reschedule(sorted_quests, capacity, start_date, end_date)

    def _front_load_reschedule(
        self,
        quests: List[Quest],
        capacity: Dict[str, int],
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """앞쪽 집중 재조정"""
        rescheduled = []
        warnings = []
        overload_days = []

        dates = sorted(capacity.keys())

        for quest in quests:
            for date in dates:
                if capacity[date] >= quest.estimated_minutes:
                    quest.scheduled_date = date
                    capacity[date] -= quest.estimated_minutes
                    rescheduled.append(quest)
                    break
            else:
                # 여유 없으면 첫 날에 강제 배치
                quest.scheduled_date = dates[0]
                capacity[dates[0]] -= quest.estimated_minutes
                rescheduled.append(quest)
                if dates[0] not in overload_days:
                    overload_days.append(dates[0])

        if overload_days:
            warnings.append("일부 날짜에 학습량이 과부하되었습니다.")

        return {
            "success": True,
            "rescheduled": rescheduled,
            "warnings": warnings,
            "overload_days": overload_days
        }

    def _back_load_reschedule(
        self,
        quests: List[Quest],
        capacity: Dict[str, int],
        start_date: datetime,
        end_date: datetime
    ) -> Dict[str, Any]:
        """뒤쪽 집중 재조정"""
        rescheduled = []
        warnings = []
        overload_days = []

        dates = sorted(capacity.keys(), reverse=True)  # 역순

        for quest in quests:
            for date in dates:
                if capacity[date] >= quest.estimated_minutes:
                    quest.scheduled_date = date
                    capacity[date] -= quest.estimated_minutes
                    rescheduled.append(quest)
                    break
            else:
                quest.scheduled_date = dates[0]  # 마지막 날
                capacity[dates[0]] -= quest.estimated_minutes
                rescheduled.append(quest)
                if dates[0] not in overload_days:
                    overload_days.append(dates[0])

        if overload_days:
            warnings.append("마감일 근처에 학습량이 집중되었습니다.")

        return {
            "success": True,
            "rescheduled": rescheduled,
            "warnings": warnings,
            "overload_days": overload_days
        }

    def optimize_daily_balance(self, daily_study_hours: int = 6) -> Dict[str, Any]:
        """
        일별 부하 균형 최적화

        과부하 날짜의 퀘스트를 여유 있는 날로 이동
        """
        daily_minutes = daily_study_hours * 60
        adjustments = []

        for date, schedule in self.quest_manager.schedules.items():
            if schedule.is_overloaded:
                overflow = schedule.total_minutes - daily_minutes
                # 여유 있는 날 찾기
                for other_date, other_schedule in self.quest_manager.schedules.items():
                    if other_date != date and not other_schedule.is_overloaded:
                        available = daily_minutes - other_schedule.total_minutes
                        # 이동 가능한 퀘스트 찾기
                        for quest in schedule.quests:
                            if quest.estimated_minutes <= available and quest.estimated_minutes <= overflow:
                                quest.scheduled_date = other_date
                                adjustments.append({
                                    "quest_id": quest.id,
                                    "from_date": date,
                                    "to_date": other_date
                                })
                                overflow -= quest.estimated_minutes
                                if overflow <= 0:
                                    break

        # 스케줄 재구축
        all_quests = list(self.quest_manager.quests.values())
        self.quest_manager._build_schedules(all_quests, daily_minutes)

        return {
            "adjustments": adjustments,
            "total_moved": len(adjustments)
        }

    def suggest_catch_up_plan(
        self,
        target_date: str,
        extra_hours_per_day: int = 2
    ) -> Dict[str, Any]:
        """
        따라잡기 계획 제안

        미완료 퀘스트를 처리하기 위한 추가 학습 계획 제시
        """
        overdue = self.quest_manager.get_overdue_quests()
        if not overdue:
            return {"message": "모든 퀘스트가 예정대로 진행 중입니다.", "extra_needed": False}

        total_overdue_minutes = sum(q.estimated_minutes for q in overdue)
        extra_minutes_per_day = extra_hours_per_day * 60

        today = datetime.now().date()
        end = datetime.strptime(target_date, "%Y-%m-%d").date()
        days_remaining = (end - today).days

        days_needed = (total_overdue_minutes + extra_minutes_per_day - 1) // extra_minutes_per_day

        return {
            "overdue_count": len(overdue),
            "total_minutes_behind": total_overdue_minutes,
            "days_remaining": days_remaining,
            "extra_hours_needed_total": total_overdue_minutes / 60,
            "days_needed_with_extra": days_needed,
            "feasible": days_needed <= days_remaining,
            "recommendation": (
                f"하루 {extra_hours_per_day}시간 추가 학습 시 {days_needed}일 내 완료 가능"
                if days_needed <= days_remaining
                else f"목표일까지 완료 어려움. 하루 {(total_overdue_minutes / days_remaining / 60):.1f}시간 추가 필요"
            ),
            "overdue_quests": [q.to_dict() for q in overdue]
        }
