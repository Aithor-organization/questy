# 문제풀이 퀘스트 기능 테스트

import pytest
from datetime import datetime, timedelta
from handlers.quest_manager import (
    QuestManager, Quest, QuestStatus, QuestType, QuestPriority
)


class TestPracticeQuestGeneration:
    """문제풀이 퀘스트 생성 테스트"""

    @pytest.fixture
    def manager(self):
        return QuestManager()

    @pytest.fixture
    def sample_courses(self):
        """테스트용 강좌 데이터"""
        return [
            {
                "id": "course-001",
                "courseName": "국어 기본편",
                "lecturer": "강민철",
                "subject": "국어",
                "chapters": [
                    {
                        "num": 1,
                        "title": "Code.1",
                        "duration": "65:00",
                        "sections": ["독서의 원리"]
                    },
                    {
                        "num": 2,
                        "title": "Code.2",
                        "duration": "55:00",
                        "sections": ["독서의 적용"]
                    }
                ]
            }
        ]

    @pytest.fixture
    def subject_hours(self):
        """과목별 시간 설정"""
        return {
            "국어": 4,
            "수학": 0,
            "영어": 0,
            "한국사": 0,
            "탐구": 0
        }

    def test_practice_quest_type_exists(self):
        """QuestType.PRACTICE가 존재하는지 확인"""
        assert hasattr(QuestType, 'PRACTICE')
        assert QuestType.PRACTICE.value == "practice"

    def test_practice_quest_generation(self, manager, sample_courses, subject_hours):
        """과목별 시간 설정 시 문제풀이 퀘스트가 생성되는지 확인"""
        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        quests = manager.generate_quests_from_curriculum(
            course_contents=sample_courses,
            target_date=target,
            daily_study_hours=6,
            subject_hours=subject_hours,
            review_settings={
                "enabled": True,
                "sameDayReview": True,
                "reviewDuration": 15
            }
        )

        # 문제풀이 퀘스트 필터링
        practice_quests = [q for q in quests if q.quest_type == QuestType.PRACTICE]

        # 과목별 시간 설정이 있으면 문제풀이 퀘스트가 생성되어야 함
        assert len(practice_quests) > 0, "문제풀이 퀘스트가 생성되지 않음"

    def test_practice_quest_metadata(self, manager, sample_courses, subject_hours):
        """문제풀이 퀘스트의 메타데이터 확인"""
        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        quests = manager.generate_quests_from_curriculum(
            course_contents=sample_courses,
            target_date=target,
            daily_study_hours=6,
            subject_hours=subject_hours,
            review_settings={
                "enabled": True,
                "sameDayReview": True,
                "reviewDuration": 15
            }
        )

        practice_quests = [q for q in quests if q.quest_type == QuestType.PRACTICE]

        for quest in practice_quests:
            # 메타데이터 확인
            assert quest.metadata is not None
            assert "editable" in quest.metadata
            assert quest.metadata["editable"] is True
            assert "practice_note" in quest.metadata
            assert "related_lectures" in quest.metadata

    def test_practice_quest_related_lectures(self, manager, sample_courses, subject_hours):
        """문제풀이 퀘스트에 관련 강의 정보가 포함되는지 확인"""
        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        quests = manager.generate_quests_from_curriculum(
            course_contents=sample_courses,
            target_date=target,
            daily_study_hours=6,
            subject_hours=subject_hours,
            review_settings={
                "enabled": True,
                "sameDayReview": True,
                "reviewDuration": 15
            }
        )

        practice_quests = [q for q in quests if q.quest_type == QuestType.PRACTICE]

        # 첫 번째 날의 문제풀이 퀘스트 확인
        if practice_quests:
            first_practice = practice_quests[0]
            related = first_practice.metadata.get("related_lectures", [])
            # 관련 강의 목록이 있어야 함 (해당 날짜에 강의가 있으면)
            assert isinstance(related, list)

    def test_practice_quest_time_calculation(self, manager, sample_courses, subject_hours):
        """문제풀이 시간이 올바르게 계산되는지 확인"""
        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        quests = manager.generate_quests_from_curriculum(
            course_contents=sample_courses,
            target_date=target,
            daily_study_hours=6,
            subject_hours=subject_hours,
            review_settings={
                "enabled": True,
                "sameDayReview": True,
                "reviewDuration": 15
            }
        )

        practice_quests = [q for q in quests if q.quest_type == QuestType.PRACTICE]

        for quest in practice_quests:
            # 최소 10분 이상
            assert quest.estimated_minutes >= 10, "문제풀이 시간이 10분 미만"
            # 5분 단위로 반올림되어야 함
            assert quest.estimated_minutes % 5 == 0, "5분 단위가 아님"

    def test_practice_quest_empty_note(self, manager, sample_courses, subject_hours):
        """문제풀이 퀘스트의 메모가 빈 문자열로 초기화되는지 확인"""
        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        quests = manager.generate_quests_from_curriculum(
            course_contents=sample_courses,
            target_date=target,
            daily_study_hours=6,
            subject_hours=subject_hours,
            review_settings={
                "enabled": True,
                "sameDayReview": True,
                "reviewDuration": 15
            }
        )

        practice_quests = [q for q in quests if q.quest_type == QuestType.PRACTICE]

        for quest in practice_quests:
            # practice_note는 빈 문자열이어야 함
            assert quest.metadata.get("practice_note") == "", \
                f"practice_note가 빈 문자열이 아님: {quest.metadata.get('practice_note')}"

    def test_practice_quest_description_auto_generated(self, manager, sample_courses, subject_hours):
        """문제풀이 퀘스트의 설명이 자동 생성되는지 확인"""
        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        quests = manager.generate_quests_from_curriculum(
            course_contents=sample_courses,
            target_date=target,
            daily_study_hours=6,
            subject_hours=subject_hours,
            review_settings={
                "enabled": True,
                "sameDayReview": True,
                "reviewDuration": 15
            }
        )

        practice_quests = [q for q in quests if q.quest_type == QuestType.PRACTICE]

        for quest in practice_quests:
            # description은 비어있지 않아야 함
            assert quest.description, "description이 비어있음"
            # 관련 강의가 있으면 해당 내용이 포함되어야 함
            related = quest.metadata.get("related_lectures", [])
            if related:
                assert "문제 풀이" in quest.description or "관련" in quest.description


class TestQuestTypeEnum:
    """QuestType Enum 테스트"""

    def test_all_quest_types(self):
        """모든 퀘스트 타입이 존재하는지 확인"""
        expected_types = ["lecture", "problem_set", "review", "practice", "mock_exam", "concept"]

        for type_value in expected_types:
            matching = [qt for qt in QuestType if qt.value == type_value]
            assert len(matching) == 1, f"QuestType '{type_value}'가 없음"


class TestQuestSerialization:
    """퀘스트 직렬화 테스트 - 문제풀이 전용"""

    def test_practice_quest_serialization(self):
        """문제풀이 퀘스트 직렬화 테스트"""
        quest = Quest(
            id="practice-001",
            title="국어 문제풀이",
            description="오늘 학습한 Code.1, Code.2 관련 문제 풀이",
            quest_type=QuestType.PRACTICE,
            subject="국어",
            course_id="course-001",
            chapter="",
            section="",
            scheduled_date="2026-01-15",
            estimated_minutes=70,
            status=QuestStatus.PENDING,
            priority=QuestPriority.MEDIUM,
            metadata={
                "editable": True,
                "practice_note": "",
                "related_lectures": ["Code.1", "Code.2"],
                "practice_type": "daily"
            }
        )

        # 직렬화
        data = quest.to_dict()

        assert data["quest_type"] == "practice"
        assert data["metadata"]["editable"] is True
        assert data["metadata"]["practice_note"] == ""
        assert "Code.1" in data["metadata"]["related_lectures"]

        # 역직렬화
        restored = Quest.from_dict(data)

        assert restored.quest_type == QuestType.PRACTICE
        assert restored.metadata["editable"] is True
        assert restored.metadata["practice_note"] == ""


class TestStartFromChapter:
    """이어듣기 (startFromChapter) 기능 테스트"""

    @pytest.fixture
    def manager(self):
        return QuestManager()

    @pytest.fixture
    def course_with_many_chapters(self):
        """여러 챕터가 있는 테스트용 강좌 데이터"""
        return [
            {
                "id": "course-002",
                "courseName": "수학 개념완성",
                "lecturer": "김수학",
                "subject": "수학",
                "chapters": [
                    {"num": 1, "title": "1강. 집합", "duration": "30:00"},
                    {"num": 2, "title": "2강. 명제", "duration": "35:00"},
                    {"num": 3, "title": "3강. 함수", "duration": "40:00"},
                    {"num": 4, "title": "4강. 수열", "duration": "45:00"},
                    {"num": 5, "title": "5강. 극한", "duration": "50:00"},
                ]
            }
        ]

    def test_start_from_beginning(self, manager, course_with_many_chapters):
        """startFromChapter가 없으면 처음부터 시작"""
        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        quests = manager.generate_quests_from_curriculum(
            course_contents=course_with_many_chapters,
            target_date=target,
            daily_study_hours=6,
            subject_hours={"수학": 4, "국어": 0, "영어": 0, "한국사": 0, "탐구": 0}
        )

        # 강의 퀘스트만 필터링
        lecture_quests = [q for q in quests if q.quest_type == QuestType.LECTURE]

        # 5개 강의 모두 포함되어야 함
        assert len(lecture_quests) == 5, f"강의 퀘스트 수: {len(lecture_quests)}"
        # 첫 번째 강의 확인
        assert "1강" in lecture_quests[0].chapter or "집합" in lecture_quests[0].chapter

    def test_start_from_chapter_3(self, manager, course_with_many_chapters):
        """startFromChapter=2이면 3강부터 시작 (0-indexed)"""
        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        # 이어듣기: 챕터 인덱스 2부터 (3강부터)
        course_with_many_chapters[0]["startFromChapter"] = 2

        quests = manager.generate_quests_from_curriculum(
            course_contents=course_with_many_chapters,
            target_date=target,
            daily_study_hours=6,
            subject_hours={"수학": 4, "국어": 0, "영어": 0, "한국사": 0, "탐구": 0}
        )

        # 강의 퀘스트만 필터링
        lecture_quests = [q for q in quests if q.quest_type == QuestType.LECTURE]

        # 3강, 4강, 5강만 포함되어야 함 (3개)
        assert len(lecture_quests) == 3, f"강의 퀘스트 수: {len(lecture_quests)}, 예상: 3"

        # 첫 번째 퀘스트가 3강이어야 함
        first_lecture = lecture_quests[0]
        assert "3강" in first_lecture.chapter or "함수" in first_lecture.chapter, \
            f"첫 강의가 3강이 아님: {first_lecture.chapter}"

    def test_start_from_last_chapter(self, manager, course_with_many_chapters):
        """마지막 강의만 남은 경우"""
        target = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        # 이어듣기: 챕터 인덱스 4부터 (5강, 마지막)
        course_with_many_chapters[0]["startFromChapter"] = 4

        quests = manager.generate_quests_from_curriculum(
            course_contents=course_with_many_chapters,
            target_date=target,
            daily_study_hours=6,
            subject_hours={"수학": 4, "국어": 0, "영어": 0, "한국사": 0, "탐구": 0}
        )

        # 강의 퀘스트만 필터링
        lecture_quests = [q for q in quests if q.quest_type == QuestType.LECTURE]

        # 5강만 포함되어야 함 (1개)
        assert len(lecture_quests) == 1, f"강의 퀘스트 수: {len(lecture_quests)}, 예상: 1"
        assert "5강" in lecture_quests[0].chapter or "극한" in lecture_quests[0].chapter


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
