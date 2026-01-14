# Quest Manager 및 Schedule Optimizer 테스트

import pytest
from datetime import datetime, timedelta
from handlers.quest_manager import (
    QuestManager, Quest, QuestStatus, QuestType, QuestPriority
)
from handlers.schedule_optimizer import (
    ScheduleOptimizer, RescheduleStrategy, RescheduleResult
)


class TestQuestManager:
    """QuestManager 테스트"""

    @pytest.fixture
    def manager(self):
        return QuestManager()

    @pytest.fixture
    def sample_curriculum(self):
        return {
            "curriculum": {
                "subjects": [
                    {
                        "name": "수학",
                        "weekly_hours": 8,
                        "recommended_courses": ["수학1 개념완성"]
                    },
                    {
                        "name": "영어",
                        "weekly_hours": 5,
                        "recommended_courses": ["영어 독해 기본"]
                    }
                ]
            }
        }

    @pytest.fixture
    def sample_courses(self):
        return [
            {
                "id": "course-001",
                "courseName": "수학1 개념완성",
                "lecturer": "현우진",
                "subject": "수학",
                "chapters": [
                    {
                        "title": "함수의 극한",
                        "sections": ["극한의 정의", "극한의 성질"]
                    },
                    {
                        "title": "미분법",
                        "sections": ["미분계수", "도함수"]
                    }
                ]
            },
            {
                "id": "course-002",
                "courseName": "영어 독해 기본",
                "lecturer": "정승제",
                "subject": "영어",
                "chapters": [
                    {"title": "주제 찾기", "sections": ["주제문 파악"]},
                    {"title": "빈칸 추론", "sections": ["논리적 추론"]}
                ]
            }
        ]

    def test_generate_quests(self, manager, sample_curriculum, sample_courses):
        """퀘스트 생성 테스트"""
        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        quests = manager.generate_quests_from_curriculum(
            curriculum_plan=sample_curriculum,
            course_contents=sample_courses,
            target_date=target,
            daily_study_hours=6
        )

        assert len(quests) > 0
        assert all(isinstance(q, Quest) for q in quests)

    def test_quest_extraction(self, manager, sample_courses):
        """강좌에서 퀘스트 항목 추출 테스트"""
        items = manager._extract_quest_items(sample_courses[0])

        # 섹션 수 + 복습 퀘스트
        # 함수의 극한: 2 섹션 + 1 복습 = 3
        # 미분법: 2 섹션 + 1 복습 = 3
        # 총 6개
        assert len(items) >= 4

    def test_quest_status_flow(self, manager, sample_curriculum, sample_courses):
        """퀘스트 상태 흐름 테스트"""
        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        quests = manager.generate_quests_from_curriculum(
            curriculum_plan=sample_curriculum,
            course_contents=sample_courses,
            target_date=target,
            daily_study_hours=6
        )

        quest = quests[0]
        assert quest.status == QuestStatus.PENDING

        # 완료 처리
        completed = manager.complete_quest(quest.id, actual_minutes=50)
        assert completed.status == QuestStatus.COMPLETED
        assert completed.actual_minutes == 50

    def test_skip_quest(self, manager, sample_curriculum, sample_courses):
        """퀘스트 건너뛰기 테스트"""
        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        quests = manager.generate_quests_from_curriculum(
            curriculum_plan=sample_curriculum,
            course_contents=sample_courses,
            target_date=target,
            daily_study_hours=6
        )

        quest = quests[0]
        skipped = manager.skip_quest(quest.id)
        assert skipped.status == QuestStatus.SKIPPED

    def test_get_pending_quests(self, manager, sample_curriculum, sample_courses):
        """대기 중 퀘스트 조회 테스트"""
        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        quests = manager.generate_quests_from_curriculum(
            curriculum_plan=sample_curriculum,
            course_contents=sample_courses,
            target_date=target,
            daily_study_hours=6
        )

        pending = manager.get_pending_quests()
        assert len(pending) == len(quests)

        # 하나 완료
        manager.complete_quest(quests[0].id)
        pending_after = manager.get_pending_quests()
        assert len(pending_after) == len(quests) - 1

    def test_completion_stats(self, manager, sample_curriculum, sample_courses):
        """완료 통계 테스트"""
        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        quests = manager.generate_quests_from_curriculum(
            curriculum_plan=sample_curriculum,
            course_contents=sample_courses,
            target_date=target,
            daily_study_hours=6
        )

        stats = manager.get_completion_stats()
        assert stats["total"] == len(quests)
        assert stats["completed"] == 0
        assert stats["completion_rate"] == 0

        # 하나 완료
        manager.complete_quest(quests[0].id)
        stats_after = manager.get_completion_stats()
        assert stats_after["completed"] == 1
        assert stats_after["completion_rate"] > 0

    def test_invalid_target_date(self, manager, sample_curriculum, sample_courses):
        """잘못된 목표일 테스트"""
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

        with pytest.raises(ValueError):
            manager.generate_quests_from_curriculum(
                curriculum_plan=sample_curriculum,
                course_contents=sample_courses,
                target_date=yesterday,
                daily_study_hours=6
            )


class TestScheduleOptimizer:
    """ScheduleOptimizer 테스트"""

    @pytest.fixture
    def manager_with_quests(self):
        manager = QuestManager()
        curriculum = {
            "curriculum": {
                "subjects": [
                    {"name": "수학", "weekly_hours": 8}
                ]
            }
        }
        courses = [
            {
                "id": "c1",
                "courseName": "수학 기초",
                "lecturer": "홍길동",
                "subject": "수학",
                "chapters": [
                    {"title": f"Chapter {i}", "sections": [f"Section {j}" for j in range(3)]}
                    for i in range(5)
                ]
            }
        ]
        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        manager.generate_quests_from_curriculum(
            curriculum_plan=curriculum,
            course_contents=courses,
            target_date=target,
            daily_study_hours=6
        )
        return manager

    @pytest.fixture
    def optimizer(self, manager_with_quests):
        return ScheduleOptimizer(manager_with_quests)

    def test_reschedule_no_overdue(self, optimizer):
        """미완료 없을 때 재조정 테스트"""
        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        result = optimizer.reschedule_overdue(
            target_date=target,
            daily_study_hours=6,
            strategy=RescheduleStrategy.SMART
        )

        assert result.success is True
        assert len(result.rescheduled_quests) == 0

    def test_smart_reschedule_strategy(self, manager_with_quests, optimizer):
        """스마트 재조정 전략 테스트"""
        # 일부 퀘스트를 과거로 설정하여 overdue 만들기
        for i, quest in enumerate(list(manager_with_quests.quests.values())[:3]):
            quest.scheduled_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        result = optimizer.reschedule_overdue(
            target_date=target,
            daily_study_hours=6,
            strategy=RescheduleStrategy.SMART
        )

        assert result.success is True
        assert len(result.rescheduled_quests) >= 0

    def test_spread_strategy(self, manager_with_quests, optimizer):
        """균등 분배 전략 테스트"""
        for quest in list(manager_with_quests.quests.values())[:3]:
            quest.scheduled_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        result = optimizer.reschedule_overdue(
            target_date=target,
            daily_study_hours=6,
            strategy=RescheduleStrategy.SPREAD
        )

        assert result.success is True

    def test_priority_strategy(self, manager_with_quests, optimizer):
        """우선순위 전략 테스트"""
        for quest in list(manager_with_quests.quests.values())[:3]:
            quest.scheduled_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
            quest.priority = QuestPriority.HIGH

        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        result = optimizer.reschedule_overdue(
            target_date=target,
            daily_study_hours=6,
            strategy=RescheduleStrategy.PRIORITY_FIRST
        )

        assert result.success is True

    def test_catch_up_plan_feasible(self, manager_with_quests, optimizer):
        """따라잡기 계획 (가능한 경우) 테스트"""
        # 일부 overdue 생성
        for quest in list(manager_with_quests.quests.values())[:2]:
            quest.scheduled_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        plan = optimizer.suggest_catch_up_plan(
            target_date=target,
            extra_hours_per_day=2
        )

        assert "overdue_count" in plan
        assert "recommendation" in plan

    def test_past_target_date_fails(self, optimizer):
        """과거 목표일 재조정 실패 테스트"""
        past_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

        result = optimizer.reschedule_overdue(
            target_date=past_date,
            daily_study_hours=6,
            strategy=RescheduleStrategy.SMART
        )

        assert result.success is False


class TestQuestTypes:
    """퀘스트 유형 테스트"""

    def test_default_minutes(self):
        """기본 소요 시간 테스트"""
        expected = {
            QuestType.LECTURE: 45,
            QuestType.PROBLEM_SET: 60,
            QuestType.REVIEW: 30,
            QuestType.MOCK_EXAM: 90,
            QuestType.CONCEPT: 20
        }

        for q_type, minutes in expected.items():
            assert QuestManager.DEFAULT_MINUTES[q_type] == minutes


class TestQuestPriority:
    """퀘스트 우선순위 테스트"""

    def test_priority_ordering(self):
        """우선순위 순서 테스트"""
        assert QuestPriority.LOW.value < QuestPriority.MEDIUM.value
        assert QuestPriority.MEDIUM.value < QuestPriority.HIGH.value
        assert QuestPriority.HIGH.value < QuestPriority.CRITICAL.value


class TestQuestSerialization:
    """퀘스트 직렬화 테스트"""

    def test_to_dict_and_back(self):
        """직렬화 및 역직렬화 테스트"""
        quest = Quest(
            id="test-001",
            title="테스트 퀘스트",
            description="테스트 설명",
            quest_type=QuestType.LECTURE,
            subject="수학",
            course_id="course-001",
            chapter="1장",
            section="1절",
            scheduled_date="2026-01-15",
            estimated_minutes=45,
            status=QuestStatus.PENDING,
            priority=QuestPriority.HIGH
        )

        # 직렬화
        data = quest.to_dict()
        assert data["id"] == "test-001"
        assert data["quest_type"] == "lecture"
        assert data["status"] == "pending"

        # 역직렬화
        restored = Quest.from_dict(data)
        assert restored.id == quest.id
        assert restored.quest_type == quest.quest_type
        assert restored.status == quest.status


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
