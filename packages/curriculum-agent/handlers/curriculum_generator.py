# Curriculum Generator - 커리큘럼 생성 핸들러
# RAG 데이터 기반 맞춤형 커리큘럼 생성

import os
import json
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from datetime import datetime

from config import get_config


@dataclass
class CurriculumPlan:
    """생성된 커리큘럼 계획"""
    title: str
    duration_weeks: int
    subjects: List[Dict[str, Any]]
    daily_routine: Dict[str, Any]
    key_milestones: List[str]
    personalization_notes: str
    recommended_lecturers: List[Dict[str, Any]]
    recommended_courses: List[Dict[str, Any]]
    metadata: Dict[str, Any]


class CurriculumGenerator:
    """
    커리큘럼 생성기

    기능:
    1. 학생 프로필 기반 맞춤형 커리큘럼 생성
    2. RAG 데이터 (강사, 강좌, 성공 패턴) 활용
    3. 주간/일간 학습 계획 수립
    4. 마일스톤 및 진도 체크포인트 설정

    생성 파이프라인:
    1. 학생 분석: 현재 수준, 목표, 가용 시간 파악
    2. RAG 조회: 관련 강사/강좌/성공 패턴 검색
    3. 커리큘럼 설계: 주간 계획, 강사 배정, 교재 선정
    4. 개인화: 학습 스타일, 약점 보완 반영
    """

    # 과목별 기본 주당 시간
    DEFAULT_WEEKLY_HOURS = {
        "국어": 5,
        "수학": 8,
        "영어": 5,
        "탐구": 4,  # 사탐/과탐
        "제2외국어": 2
    }

    # 수준별 권장 강사 특성
    LEVEL_LECTURER_MATCH = {
        "초급": ["기초", "개념", "쉬운", "입문"],
        "중급": ["심화", "유형", "기출"],
        "고급": ["N제", "킬러", "변별력", "고난도"]
    }

    def __init__(self, rag_handler=None):
        self.config = get_config()
        self.rag_handler = rag_handler

    async def generate(
        self,
        student_profile: Dict[str, Any],
        subjects: List[str],
        duration_weeks: int = 12,
        rag_context: Optional[Dict[str, Any]] = None
    ) -> CurriculumPlan:
        """
        커리큘럼 생성

        Args:
            student_profile: 학생 프로필
            subjects: 과목 목록
            duration_weeks: 기간 (주)
            rag_context: RAG 검색 결과 (사전 조회된 경우)

        Returns:
            CurriculumPlan: 생성된 커리큘럼
        """
        # 1. RAG 컨텍스트 조회 (없으면)
        if not rag_context and self.rag_handler:
            rag_context = await self._fetch_rag_context(subjects, student_profile)

        # 2. 과목별 계획 생성
        subject_plans = []
        for subject in subjects:
            plan = self._generate_subject_plan(
                subject=subject,
                student_profile=student_profile,
                duration_weeks=duration_weeks,
                rag_context=rag_context
            )
            subject_plans.append(plan)

        # 3. 일일 루틴 생성
        daily_routine = self._generate_daily_routine(
            subjects=subjects,
            student_profile=student_profile
        )

        # 4. 마일스톤 생성
        milestones = self._generate_milestones(
            subjects=subjects,
            duration_weeks=duration_weeks,
            student_profile=student_profile
        )

        # 5. 개인화 노트 생성
        personalization = self._generate_personalization_notes(
            student_profile=student_profile,
            rag_context=rag_context
        )

        # 6. 추천 강사/강좌 추출
        recommended_lecturers = self._extract_recommended_lecturers(rag_context)
        recommended_courses = self._extract_recommended_courses(rag_context)

        return CurriculumPlan(
            title=self._generate_title(student_profile, subjects),
            duration_weeks=duration_weeks,
            subjects=subject_plans,
            daily_routine=daily_routine,
            key_milestones=milestones,
            personalization_notes=personalization,
            recommended_lecturers=recommended_lecturers,
            recommended_courses=recommended_courses,
            metadata={
                "generated_at": datetime.now().isoformat(),
                "student_level": student_profile.get("level", ""),
                "target_score": student_profile.get("targetScore", ""),
                "rag_used": rag_context is not None
            }
        )

    async def _fetch_rag_context(
        self,
        subjects: List[str],
        student_profile: Dict[str, Any]
    ) -> Dict[str, Any]:
        """RAG 컨텍스트 조회"""
        if not self.rag_handler:
            return {}

        combined_query = " ".join(subjects)
        level = student_profile.get("level", "")
        if level:
            combined_query += f" {level}"

        return await self.rag_handler.search(
            query=combined_query,
            student_profile=student_profile
        )

    def _generate_subject_plan(
        self,
        subject: str,
        student_profile: Dict[str, Any],
        duration_weeks: int,
        rag_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """과목별 계획 생성"""
        # 주당 시간 결정
        base_hours = self.DEFAULT_WEEKLY_HOURS.get(subject, 4)

        # 약점 과목이면 시간 증가
        weak_subjects = student_profile.get("weakSubjects", [])
        if subject in weak_subjects:
            base_hours = int(base_hours * 1.3)

        # 관련 강사/강좌 추출
        related_lecturers = self._filter_by_subject(
            rag_context.get("lecturers", []) if rag_context else [],
            subject
        )
        related_courses = self._filter_by_subject(
            rag_context.get("courses", []) if rag_context else [],
            subject
        )

        # 주간 계획 생성
        weekly_plan = self._generate_weekly_plan(
            subject=subject,
            duration_weeks=duration_weeks,
            level=student_profile.get("level", "중급")
        )

        return {
            "name": subject,
            "weekly_hours": base_hours,
            "is_weak_subject": subject in weak_subjects,
            "recommended_lecturers": [l.get("name", "") for l in related_lecturers[:3]],
            "recommended_courses": [c.get("courseName", c.get("title", "")) for c in related_courses[:3]],
            "weekly_plan": weekly_plan,
            "focus_areas": self._get_focus_areas(subject, student_profile)
        }

    def _generate_weekly_plan(
        self,
        subject: str,
        duration_weeks: int,
        level: str
    ) -> List[Dict[str, Any]]:
        """주간 계획 생성"""
        plan = []

        # 단계별 구분 (개념 → 유형 → 실전)
        concept_weeks = max(1, duration_weeks // 3)
        practice_weeks = max(1, duration_weeks // 3)
        review_weeks = duration_weeks - concept_weeks - practice_weeks

        for week in range(1, duration_weeks + 1):
            if week <= concept_weeks:
                phase = "개념 정립"
                topics = [f"{subject} 개념 {week}단원"]
                goals = ["기본 개념 이해", "필수 공식 암기"]
            elif week <= concept_weeks + practice_weeks:
                phase = "유형 학습"
                topics = [f"{subject} 유형 연습 {week - concept_weeks}"]
                goals = ["대표 유형 풀이", "오답 분석"]
            else:
                phase = "실전 대비"
                topics = [f"{subject} 모의고사 {week - concept_weeks - practice_weeks}회"]
                goals = ["실전 시간 관리", "취약점 보완"]

            plan.append({
                "week": week,
                "phase": phase,
                "topics": topics,
                "goals": goals
            })

        return plan

    def _generate_daily_routine(
        self,
        subjects: List[str],
        student_profile: Dict[str, Any]
    ) -> Dict[str, Any]:
        """일일 루틴 생성"""
        available_hours = student_profile.get("dailyStudyHours", 6)

        return {
            "weekday": {
                "study_hours": available_hours,
                "schedule": self._create_daily_schedule(subjects, available_hours, is_weekend=False)
            },
            "weekend": {
                "study_hours": min(available_hours + 2, 10),
                "schedule": self._create_daily_schedule(subjects, min(available_hours + 2, 10), is_weekend=True)
            }
        }

    def _create_daily_schedule(
        self,
        subjects: List[str],
        total_hours: int,
        is_weekend: bool
    ) -> str:
        """일일 스케줄 생성"""
        if total_hours <= 4:
            return f"핵심 과목 집중 ({total_hours}시간): " + ", ".join(subjects[:2])
        elif total_hours <= 6:
            return f"균형 학습 ({total_hours}시간): 오전 {subjects[0] if subjects else '국어'}, 오후 {subjects[1] if len(subjects) > 1 else '수학'}"
        else:
            return f"종합 학습 ({total_hours}시간): 오전 개념, 오후 문제풀이, 저녁 오답정리"

    def _generate_milestones(
        self,
        subjects: List[str],
        duration_weeks: int,
        student_profile: Dict[str, Any]
    ) -> List[str]:
        """마일스톤 생성"""
        milestones = []

        # 1/4 지점
        week_1 = max(1, duration_weeks // 4)
        milestones.append(f"{week_1}주차: 기본 개념 완료 - 과목별 개념 테스트")

        # 1/2 지점
        week_2 = duration_weeks // 2
        milestones.append(f"{week_2}주차: 유형 학습 완료 - 중간 모의고사")

        # 3/4 지점
        week_3 = (duration_weeks * 3) // 4
        milestones.append(f"{week_3}주차: 실전 연습 - 실전 모의고사")

        # 최종
        milestones.append(f"{duration_weeks}주차: 최종 점검 - 취약점 집중 보완")

        return milestones

    def _generate_personalization_notes(
        self,
        student_profile: Dict[str, Any],
        rag_context: Optional[Dict[str, Any]] = None
    ) -> str:
        """개인화 노트 생성"""
        notes = []

        level = student_profile.get("level", "")
        if level == "초급":
            notes.append("기초 개념부터 차근차근 학습하세요.")
        elif level == "고급":
            notes.append("고난도 문제 중심으로 변별력을 키우세요.")

        weak_subjects = student_profile.get("weakSubjects", [])
        if weak_subjects:
            notes.append(f"약점 과목({', '.join(weak_subjects)})에 추가 시간을 배정했습니다.")

        learning_style = student_profile.get("learningStyle", "")
        if learning_style == "시각적":
            notes.append("마인드맵과 도식화를 적극 활용하세요.")
        elif learning_style == "청각적":
            notes.append("인강을 1.2배속으로 반복 청취하세요.")

        # 성공 패턴 참조
        if rag_context and rag_context.get("successPatterns"):
            patterns = rag_context["successPatterns"]
            if patterns:
                notes.append(f"비슷한 학생의 성공 전략: {patterns[0].get('keyFactors', ['꾸준한 학습'])[0]}")

        return " ".join(notes) if notes else "꾸준한 학습과 복습이 핵심입니다."

    def _filter_by_subject(
        self,
        items: List[Dict[str, Any]],
        subject: str
    ) -> List[Dict[str, Any]]:
        """과목으로 필터링"""
        return [
            item for item in items
            if subject in item.get("subject", "") or
               subject in item.get("subjects", []) or
               subject in str(item.get("tags", []))
        ]

    def _get_focus_areas(
        self,
        subject: str,
        student_profile: Dict[str, Any]
    ) -> List[str]:
        """집중 영역 반환"""
        # 기본 집중 영역
        base_areas = {
            "국어": ["비문학 독해", "문학 감상", "화법과 작문"],
            "수학": ["함수와 미적분", "확률과 통계", "기하"],
            "영어": ["독해", "어휘", "듣기"],
            "탐구": ["개념 이해", "자료 해석", "추론"]
        }

        areas = base_areas.get(subject, ["개념 학습", "문제 풀이"])

        # 약점이면 기초 강조
        if subject in student_profile.get("weakSubjects", []):
            areas.insert(0, "기초 개념 보강")

        return areas[:3]

    def _extract_recommended_lecturers(
        self,
        rag_context: Optional[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """추천 강사 추출"""
        if not rag_context:
            return []

        lecturers = rag_context.get("lecturers", [])
        return [
            {
                "name": l.get("name", ""),
                "subject": l.get("subject", ""),
                "specialization": l.get("specialization", l.get("specialties", [])),
                "platform": l.get("platform", ""),
                "relevanceScore": l.get("relevanceScore", 0)
            }
            for l in lecturers[:5]
        ]

    def _extract_recommended_courses(
        self,
        rag_context: Optional[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """추천 강좌 추출"""
        if not rag_context:
            return []

        courses = rag_context.get("courses", [])
        return [
            {
                "courseName": c.get("courseName", c.get("title", "")),
                "lecturer": c.get("lecturer", c.get("lecturerName", "")),
                "subject": c.get("subject", ""),
                "duration": c.get("duration", ""),
                "relevanceScore": c.get("relevanceScore", 0)
            }
            for c in courses[:5]
        ]

    def _generate_title(
        self,
        student_profile: Dict[str, Any],
        subjects: List[str]
    ) -> str:
        """커리큘럼 제목 생성"""
        level = student_profile.get("level", "")
        target = student_profile.get("targetScore", "")

        title_parts = []
        if level:
            title_parts.append(f"{level}")
        if target:
            title_parts.append(f"{target} 목표")
        title_parts.append(f"{'/'.join(subjects[:3])} 학습 커리큘럼")

        return " ".join(title_parts)

    def to_json(self, plan: CurriculumPlan) -> Dict[str, Any]:
        """CurriculumPlan을 JSON 형태로 변환"""
        return {
            "curriculum": {
                "title": plan.title,
                "duration_weeks": plan.duration_weeks,
                "subjects": plan.subjects,
                "daily_routine": plan.daily_routine,
                "key_milestones": plan.key_milestones,
                "personalization_notes": plan.personalization_notes
            },
            "recommendations": {
                "lecturers": plan.recommended_lecturers,
                "courses": plan.recommended_courses
            },
            "metadata": plan.metadata
        }
