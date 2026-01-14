# Curriculum Generator 테스트
# 커리큘럼 생성 로직 검증

import pytest
from handlers.curriculum_generator import CurriculumGenerator, CurriculumPlan


class TestCurriculumGenerator:
    """CurriculumGenerator 테스트"""

    @pytest.fixture
    def generator(self):
        """CurriculumGenerator 인스턴스"""
        return CurriculumGenerator()

    @pytest.fixture
    def student_profile(self):
        """테스트용 학생 프로필"""
        return {
            "level": "중급",
            "targetScore": "2등급",
            "weakSubjects": ["수학"],
            "dailyStudyHours": 6,
            "learningStyle": "청각적"
        }

    @pytest.mark.asyncio
    async def test_generate_curriculum(self, generator, student_profile):
        """커리큘럼 생성 테스트"""
        plan = await generator.generate(
            student_profile=student_profile,
            subjects=["국어", "수학", "영어"],
            duration_weeks=12
        )

        assert isinstance(plan, CurriculumPlan)
        assert plan.duration_weeks == 12
        assert len(plan.subjects) == 3

    @pytest.mark.asyncio
    async def test_weak_subject_gets_more_hours(self, generator, student_profile):
        """약점 과목 시간 증가 테스트"""
        plan = await generator.generate(
            student_profile=student_profile,
            subjects=["국어", "수학"],
            duration_weeks=12
        )

        # 수학은 약점이므로 더 많은 시간
        math_plan = next(s for s in plan.subjects if s["name"] == "수학")
        korean_plan = next(s for s in plan.subjects if s["name"] == "국어")

        # 수학 기본 8시간 * 1.3 = 10.4 → 10시간
        # 국어 기본 5시간
        assert math_plan["weekly_hours"] > korean_plan["weekly_hours"]
        assert math_plan["is_weak_subject"] is True

    def test_generate_weekly_plan(self, generator):
        """주간 계획 생성 테스트"""
        plan = generator._generate_weekly_plan(
            subject="수학",
            duration_weeks=12,
            level="중급"
        )

        assert len(plan) == 12

        # 단계별 구분 확인
        phases = [w["phase"] for w in plan]
        assert "개념 정립" in phases
        assert "유형 학습" in phases
        assert "실전 대비" in phases

    def test_generate_daily_routine(self, generator, student_profile):
        """일일 루틴 생성 테스트"""
        routine = generator._generate_daily_routine(
            subjects=["국어", "수학"],
            student_profile=student_profile
        )

        assert "weekday" in routine
        assert "weekend" in routine
        assert routine["weekday"]["study_hours"] == 6
        # 주말은 평일 + 2시간 (최대 10시간)
        assert routine["weekend"]["study_hours"] == 8

    def test_generate_milestones(self, generator, student_profile):
        """마일스톤 생성 테스트"""
        milestones = generator._generate_milestones(
            subjects=["국어", "수학"],
            duration_weeks=12,
            student_profile=student_profile
        )

        assert len(milestones) == 4  # 1/4, 1/2, 3/4, 최종
        assert "3주차" in milestones[0]
        assert "6주차" in milestones[1]
        assert "9주차" in milestones[2]
        assert "12주차" in milestones[3]

    def test_get_focus_areas(self, generator, student_profile):
        """집중 영역 테스트"""
        # 일반 과목
        areas = generator._get_focus_areas("수학", {"weakSubjects": []})
        assert "함수와 미적분" in areas

        # 약점 과목
        weak_areas = generator._get_focus_areas("수학", {"weakSubjects": ["수학"]})
        assert weak_areas[0] == "기초 개념 보강"

    def test_generate_title(self, generator, student_profile):
        """제목 생성 테스트"""
        title = generator._generate_title(
            student_profile=student_profile,
            subjects=["국어", "수학", "영어"]
        )

        assert "중급" in title
        assert "2등급" in title
        assert "국어" in title or "수학" in title

    def test_to_json(self, generator):
        """JSON 변환 테스트"""
        plan = CurriculumPlan(
            title="테스트 커리큘럼",
            duration_weeks=12,
            subjects=[],
            daily_routine={},
            key_milestones=[],
            personalization_notes="테스트",
            recommended_lecturers=[],
            recommended_courses=[],
            metadata={}
        )

        json_data = generator.to_json(plan)

        assert "curriculum" in json_data
        assert "recommendations" in json_data
        assert "metadata" in json_data
        assert json_data["curriculum"]["title"] == "테스트 커리큘럼"


class TestDefaultWeeklyHours:
    """기본 주당 시간 테스트"""

    def test_default_hours(self):
        """기본 시간 설정 확인"""
        expected = {
            "국어": 5,
            "수학": 8,
            "영어": 5,
            "탐구": 4,
            "제2외국어": 2
        }

        for subject, hours in expected.items():
            assert CurriculumGenerator.DEFAULT_WEEKLY_HOURS.get(subject) == hours


class TestLevelLecturerMatch:
    """수준별 강사 매칭 테스트"""

    def test_level_keywords(self):
        """수준별 키워드 확인"""
        match = CurriculumGenerator.LEVEL_LECTURER_MATCH

        assert "기초" in match["초급"]
        assert "심화" in match["중급"]
        assert "킬러" in match["고급"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
