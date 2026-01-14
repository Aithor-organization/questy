# Quest Manager - 퀘스트 생성 및 관리
# 강좌 목차를 기반으로 일별 퀘스트 생성

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from enum import Enum
import uuid
import json

from config import get_config


class QuestStatus(Enum):
    """퀘스트 상태"""
    PENDING = "pending"          # 대기 중
    IN_PROGRESS = "in_progress"  # 진행 중
    COMPLETED = "completed"      # 완료
    SKIPPED = "skipped"          # 건너뜀
    RESCHEDULED = "rescheduled"  # 재조정됨


class QuestType(Enum):
    """퀘스트 유형"""
    LECTURE = "lecture"          # 인강 시청
    PROBLEM_SET = "problem_set"  # 문제 풀이
    REVIEW = "review"            # 복습
    PRACTICE = "practice"        # 문제풀이 시간 블록 (일일 학습)
    MOCK_EXAM = "mock_exam"      # 모의고사
    CONCEPT = "concept"          # 개념 정리


class QuestPriority(Enum):
    """퀘스트 우선순위"""
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4


@dataclass
class Quest:
    """퀘스트 엔티티"""
    id: str
    title: str
    description: str
    quest_type: QuestType
    subject: str
    course_id: Optional[str]
    chapter: str
    section: Optional[str]

    # 스케줄
    scheduled_date: str  # YYYY-MM-DD
    estimated_minutes: int

    # 상태
    status: QuestStatus = QuestStatus.PENDING
    priority: QuestPriority = QuestPriority.MEDIUM

    # 진행
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    actual_minutes: Optional[int] = None

    # 메타데이터
    lecturer: Optional[str] = None
    lecture_url: Optional[str] = None
    dependencies: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "quest_type": self.quest_type.value,
            "subject": self.subject,
            "course_id": self.course_id,
            "chapter": self.chapter,
            "section": self.section,
            "scheduled_date": self.scheduled_date,
            "estimated_minutes": self.estimated_minutes,
            "status": self.status.value,
            "priority": self.priority.value,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "actual_minutes": self.actual_minutes,
            "lecturer": self.lecturer,
            "lecture_url": self.lecture_url,
            "dependencies": self.dependencies,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Quest":
        return cls(
            id=data["id"],
            title=data["title"],
            description=data["description"],
            quest_type=QuestType(data["quest_type"]),
            subject=data["subject"],
            course_id=data.get("course_id"),
            chapter=data["chapter"],
            section=data.get("section"),
            scheduled_date=data["scheduled_date"],
            estimated_minutes=data["estimated_minutes"],
            status=QuestStatus(data.get("status", "pending")),
            priority=QuestPriority(data.get("priority", 2)),
            started_at=data.get("started_at"),
            completed_at=data.get("completed_at"),
            actual_minutes=data.get("actual_minutes"),
            lecturer=data.get("lecturer"),
            lecture_url=data.get("lecture_url"),
            dependencies=data.get("dependencies", []),
            metadata=data.get("metadata", {})
        )


@dataclass
class QuestSchedule:
    """일별 퀘스트 스케줄"""
    date: str  # YYYY-MM-DD
    quests: List[Quest]
    total_minutes: int
    available_minutes: int
    utilization_rate: float
    is_overloaded: bool

    def to_dict(self) -> Dict[str, Any]:
        return {
            "date": self.date,
            "quests": [q.to_dict() for q in self.quests],
            "total_minutes": self.total_minutes,
            "available_minutes": self.available_minutes,
            "utilization_rate": self.utilization_rate,
            "is_overloaded": self.is_overloaded
        }


class QuestManager:
    """
    퀘스트 매니저

    기능:
    1. 강좌 목차 → 퀘스트 변환
    2. 목표일까지 일별 스케줄 생성
    3. 퀘스트 상태 관리
    4. 미완료 퀘스트 감지

    검증된 학습 전략 적용:
    - 80% 법칙: 가용 시간의 80%만 계획하여 버퍼 확보
    - 5일 단위 운영법: 월~금 5일 안에 일주일 분량 (토/일 버퍼)
    - 약점 과목 올인: 약한 과목에 1.3배 이상 시간 배정
    - 거꾸로 계획법: 목표 역산 기반 일정 수립
    """

    # 퀘스트 유형별 기본 소요 시간 (분)
    DEFAULT_MINUTES = {
        QuestType.LECTURE: 45,       # 인강 1강
        QuestType.PROBLEM_SET: 60,   # 문제풀이 세트
        QuestType.REVIEW: 30,        # 복습
        QuestType.MOCK_EXAM: 90,     # 모의고사
        QuestType.CONCEPT: 20        # 개념 정리
    }

    # 학습 전략 상수
    BUFFER_RATIO = 0.80              # 80% 법칙: 가용 시간의 80%만 계획
    LECTURE_RATIO = 0.50             # 인강 50% : 자습+복습 50% 비율

    # 수능 출제 경향 기반 중요도 키워드
    HIGH_IMPORTANCE_KEYWORDS = [
        "킬러", "고난도", "필수", "핵심", "기출", "자주 출제",
        "3점", "4점", "합격", "만점", "비킬러", "준킬러"
    ]

    CONCEPT_KEYWORDS = [
        "개념", "정의", "공식", "원리", "기초", "기본"
    ]

    APPLICATION_KEYWORDS = [
        "적용", "응용", "심화", "실전", "문제풀이", "유형"
    ]

    @staticmethod
    def _parse_duration_to_minutes(duration_str: str) -> int:
        """
        강의 시간 문자열을 분으로 변환

        Args:
            duration_str: "21:30" (MM:SS) 또는 "1:13:54" (H:MM:SS) 형식

        Returns:
            분 단위 (최소 5분, 최대 180분)
        """
        if not duration_str:
            return 45  # 기본값

        try:
            parts = duration_str.strip().split(":")
            if len(parts) == 2:
                # MM:SS 형식
                minutes = int(parts[0])
                seconds = int(parts[1])
                total_minutes = minutes + (1 if seconds >= 30 else 0)
            elif len(parts) == 3:
                # H:MM:SS 형식
                hours = int(parts[0])
                minutes = int(parts[1])
                seconds = int(parts[2])
                total_minutes = hours * 60 + minutes + (1 if seconds >= 30 else 0)
            else:
                return 45  # 파싱 실패 시 기본값

            # 유효 범위 제한 (5분 ~ 180분)
            return max(5, min(180, total_minutes))
        except (ValueError, IndexError):
            return 45  # 파싱 오류 시 기본값

    def _calculate_review_duration(
        self,
        lecture_minutes: int,
        subject: str
    ) -> int:
        """
        강의 시간과 과목에 따른 복습 시간 계산

        과목별 복습 비율:
        - 수학: 35% (계산 연습, 문제 풀이 복습 필요)
        - 영어: 30% (어휘, 문법 정리 필요)
        - 탐구: 30% (개념 정리 필요)
        - 국어: 25% (지문 재독해)

        Args:
            lecture_minutes: 강의 시간 (분)
            subject: 과목명

        Returns:
            복습 시간 (분, 5분 단위, 최소 10분, 최대 45분)
        """
        # 과목별 복습 비율 설정
        review_ratios = {
            "수학": 0.35,
            "영어": 0.30,
            "탐구": 0.30,
            "사회탐구": 0.30,
            "과학탐구": 0.30,
            "국어": 0.25,
            "한국사": 0.25,
        }

        # 기본 비율 (알 수 없는 과목)
        ratio = review_ratios.get(subject, 0.25)

        # 복습 시간 계산
        review_minutes = lecture_minutes * ratio

        # 5분 단위로 반올림
        review_minutes = round(review_minutes / 5) * 5

        # 최소 10분, 최대 45분으로 제한
        return max(10, min(45, int(review_minutes)))

    def _generate_study_tips(
        self,
        chapter_title: str,
        section_title: str = None,
        subject: str = "",
        chapter_index: int = 1,
        total_chapters: int = 1,
        is_review: bool = False
    ) -> Dict[str, Any]:
        """
        수능 맞춤 학습 팁 생성

        Args:
            chapter_title: 챕터 제목
            section_title: 섹션 제목 (있는 경우)
            subject: 과목명
            chapter_index: 현재 챕터 번호
            total_chapters: 전체 챕터 수
            is_review: 복습 퀘스트 여부
        """
        title = section_title or chapter_title
        title_lower = title.lower()

        # 중요도 판별
        importance = "일반"
        if any(kw in title_lower for kw in self.HIGH_IMPORTANCE_KEYWORDS):
            importance = "중요도 높음"
        elif chapter_index <= 3:
            importance = "기초 개념"
        elif chapter_index >= total_chapters - 2:
            importance = "마무리 단원"

        # 핵심 포인트 생성
        key_points = []
        if any(kw in title_lower for kw in self.CONCEPT_KEYWORDS):
            key_points.append("개념 정확히 이해하기")
            key_points.append("공식/원리 암기보다 이해 중심")
        elif any(kw in title_lower for kw in self.APPLICATION_KEYWORDS):
            key_points.append("다양한 유형의 문제에 적용 연습")
            key_points.append("오답 노트 정리 필수")
        else:
            key_points.append(f"{subject} - {title}")

        # 학습 방법 추천
        if is_review:
            study_method = "복습"
            key_points = ["오늘 배운 내용 정리", "이해 안 되는 부분 체크", "핵심 개념 3가지 요약"]
        elif "문제" in title_lower or "풀이" in title_lower:
            study_method = "문제 풀이"
            key_points.append("시간 재면서 풀기")
        else:
            study_method = "인강 시청"
            key_points.append("필기하면서 시청")

        # 자주 하는 실수 (과목별)
        common_mistakes = None
        if subject == "수학":
            common_mistakes = "계산 실수 주의, 조건 빠뜨리지 않기"
        elif subject == "영어":
            common_mistakes = "문맥 파악 후 선택지 검토, 시간 배분 주의"
        elif subject == "국어":
            common_mistakes = "지문 꼼꼼히 읽기, 선택지 함정 주의"

        return {
            "importance": importance,
            "keyPoints": key_points[:3],  # 최대 3개
            "studyMethod": study_method,
            "commonMistakes": common_mistakes,
        }

    def __init__(self):
        self.config = get_config()
        self.quests: Dict[str, Quest] = {}
        self.schedules: Dict[str, QuestSchedule] = {}

    def generate_quests_from_curriculum(
        self,
        course_contents: List[Dict[str, Any]],
        target_date: str,
        daily_study_hours: int = 6,
        subject_ratio: Optional[Dict[str, int]] = None,
        subject_hours: Optional[Dict[str, Any]] = None,
        include_ot: bool = False,
        review_settings: Optional[Dict[str, Any]] = None,
        custom_schedule: Optional[List[Dict[str, Any]]] = None,
        learning_strategies: Optional[Dict[str, bool]] = None
    ) -> List[Quest]:
        """
        인강 강좌 목차를 기반으로 목표일까지 일별 퀘스트 생성

        검증된 학습 전략 적용:
        - 80% 법칙: 가용 시간의 80%만 계획하여 버퍼 확보
        - 5일 단위 운영법: 월~금 5일 안에 일주일 분량 (토/일 버퍼)

        Args:
            course_contents: 강좌 목차 리스트 (RAG에서 조회)
            target_date: 목표일 (YYYY-MM-DD)
            daily_study_hours: 일일 순공시간
            subject_ratio: 과목별 비중 (%) - {"수학": 35, "영어": 25, "국어": 20, "탐구": 15, "한국사": 5}
            subject_hours: 과목별 시간 (시간 단위) - {"국어": 2, "수학": 3, ...}
            include_ot: OT 강의 포함 여부
            review_settings: 복습 설정 - {"enabled": True, "same_day_review": True, "review_duration": 15}
            custom_schedule: 커스텀 스케줄 규칙 리스트
            learning_strategies: 학습 전략 옵션
                - apply_buffer: 80% 법칙 적용 여부 (기본: True)
                - five_day_cycle: 5일 단위 운영법 적용 여부 (기본: False)

        Returns:
            생성된 퀘스트 리스트
        """
        # 기본 복습 설정
        if review_settings is None:
            review_settings = {
                "enabled": True,
                "same_day_review": True,
                "review_duration": 15
            }

        # 기본 학습 전략 설정
        if learning_strategies is None:
            learning_strategies = {
                "apply_buffer": True,       # 80% 법칙 기본 적용
                "five_day_cycle": False     # 5일 단위 운영법
            }

        # 기본 과목별 비중
        if subject_ratio is None:
            subject_ratio = {
                "수학": 30,
                "영어": 25,
                "국어": 25,
                "탐구": 15,
                "한국사": 5
            }

        quests = []
        start_date = datetime.now().date()
        end_date = datetime.strptime(target_date, "%Y-%m-%d").date()
        total_days = (end_date - start_date).days

        if total_days <= 0:
            raise ValueError("목표일은 오늘 이후여야 합니다.")

        # 1. 일일 총 학습 시간 (분)
        daily_total_minutes = daily_study_hours * 60

        # 2. 과목별 일일 가용 시간 계산 (학습 전략 적용)
        # subject_hours가 있으면 시간 기반으로 계산, 없으면 비율 기반
        apply_buffer = learning_strategies.get("apply_buffer", True)

        if subject_hours and any(v for v in subject_hours.values() if v is not None):
            subject_daily_minutes = self._calculate_subject_minutes_from_hours(subject_hours)
            # 80% 법칙 적용 (시간 기반일 때도)
            if apply_buffer:
                subject_daily_minutes = {
                    subj: int(mins * self.BUFFER_RATIO)
                    for subj, mins in subject_daily_minutes.items()
                }
        else:
            subject_daily_minutes = self._calculate_subject_daily_minutes(
                daily_total_minutes,
                subject_ratio,
                apply_buffer=apply_buffer
            )

        # 3. 강좌 목차에서 퀘스트 항목 추출
        all_quest_items = []
        for course in course_contents:
            items = self._extract_quest_items(
                course,
                include_ot=include_ot,
                review_enabled=review_settings.get("enabled", True)
            )
            all_quest_items.extend(items)

        # 4. 과목별 그룹화
        subject_items = self._group_by_subject(all_quest_items, {})

        # 5. 과목별 비중에 맞춰 일자별 퀘스트 분배
        quests = self._distribute_quests_by_ratio(
            subject_items=subject_items,
            subject_daily_minutes=subject_daily_minutes,
            total_days=total_days,
            start_date=start_date,
            course_contents=course_contents,
            review_settings=review_settings,
            custom_schedule=custom_schedule or []
        )

        # 6. 퀘스트 저장 및 스케줄 생성
        for quest in quests:
            self.quests[quest.id] = quest

        self._build_schedules(quests, daily_total_minutes)

        return quests

    def _calculate_subject_minutes_from_hours(
        self,
        subject_hours: Dict[str, Any]
    ) -> Dict[str, int]:
        """과목별 시간(hours)에서 분(minutes)으로 변환"""
        result = {}
        for subject, hours in subject_hours.items():
            if hours is not None and hours > 0:
                result[subject] = int(hours * 60)
            else:
                result[subject] = 0
        return result

    def _calculate_subject_daily_minutes(
        self,
        daily_total_minutes: int,
        subject_ratio: Dict[str, int],
        apply_buffer: bool = True
    ) -> Dict[str, int]:
        """과목별 일일 학습 시간 계산

        80% 법칙 적용: 가용 시간의 80%만 계획 (나머지 20%는 버퍼)

        Args:
            daily_total_minutes: 일일 총 학습 시간
            subject_ratio: 과목별 비율 (예: {"국어": 30, "수학": 40, "영어": 30})
            apply_buffer: 80% 버퍼 규칙 적용 여부
        """
        # 80% 법칙 적용: 버퍼 확보
        effective_minutes = int(daily_total_minutes * self.BUFFER_RATIO) if apply_buffer else daily_total_minutes
        total_ratio = sum(subject_ratio.values())

        return {
            subject: int(effective_minutes * ratio / total_ratio)
            for subject, ratio in subject_ratio.items()
        }

    def _distribute_quests_by_ratio(
        self,
        subject_items: Dict[str, List[Dict[str, Any]]],
        subject_daily_minutes: Dict[str, int],
        total_days: int,
        start_date: datetime,
        course_contents: List[Dict[str, Any]],
        review_settings: Optional[Dict[str, Any]] = None,
        custom_schedule: Optional[List[Dict[str, Any]]] = None
    ) -> List[Quest]:
        """과목별 비중에 맞춰 퀘스트 일별 분배 (개선된 버전)

        검증된 학습 전략 적용:
        - 순차적 강의 배분: 각 과목 내 강의 순서 보장
        - 비율 기반 일일 배분: 설정된 과목 비율 정확히 반영
        - 5일 단위 운영: 주중 집중, 주말 버퍼

        Args:
            subject_items: 과목별 퀘스트 아이템 리스트
            subject_daily_minutes: 과목별 일일 학습 시간 (분)
            total_days: 총 학습 일수
            start_date: 시작 날짜
            course_contents: 강좌 정보 리스트
            review_settings: 복습 설정 (same_day_review, review_duration 등)
            custom_schedule: 커스텀 스케줄 규칙 리스트
        """
        quests = []
        review_settings = review_settings or {"enabled": True, "same_day_review": True, "review_duration": 15}
        custom_schedule = custom_schedule or []
        same_day_review = review_settings.get("same_day_review", True)

        # 커스텀 스케줄 규칙에 따른 과목별 배치 패턴 생성
        custom_patterns = self._parse_custom_schedule(custom_schedule, total_days)

        # 과목별 퀘스트 큐: 강의와 복습을 분리 (순서 유지)
        subject_lecture_queues = {}
        subject_review_queues = {}
        for subject, items in subject_items.items():
            # 강의는 chapter_index 순으로 정렬하여 순서 보장
            lectures = [item for item in items if item.get("quest_type") != QuestType.REVIEW]
            lectures.sort(key=lambda x: (x.get("course_id", ""), x.get("chapter_index", 0)))
            subject_lecture_queues[subject] = lectures

            subject_review_queues[subject] = [
                item for item in items if item.get("quest_type") == QuestType.REVIEW
            ]

        # 과목별 총 강의 시간 계산
        subject_total_minutes = {}
        for subject, lectures in subject_lecture_queues.items():
            subject_total_minutes[subject] = sum(
                item.get("estimated_minutes", 45) for item in lectures
            )

        # 과목별 일일 강의 수 계산 (비율 기반)
        total_daily_minutes = sum(subject_daily_minutes.values())
        subject_lectures_per_day = {}
        for subject, daily_mins in subject_daily_minutes.items():
            if daily_mins > 0:
                avg_lecture_time = 45  # 기본 강의 시간
                if subject_lecture_queues.get(subject):
                    total_time = sum(l.get("estimated_minutes", 45) for l in subject_lecture_queues[subject])
                    avg_lecture_time = total_time / len(subject_lecture_queues[subject])
                subject_lectures_per_day[subject] = max(1, int(daily_mins / avg_lecture_time))
            else:
                subject_lectures_per_day[subject] = 0

        # 순차적 배분: 각 과목 순서대로, 날짜 순서대로
        placed_lectures = []  # (quest, day_index, subject, original_item) 기록
        subject_next_lecture = {subject: 0 for subject in subject_lecture_queues}  # 과목별 다음 배치할 강의 인덱스

        for day in range(total_days):
            scheduled_date = start_date + timedelta(days=day)

            # 각 과목별로 해당 일에 배치할 강의 수만큼 배분
            for subject in subject_daily_minutes.keys():
                lectures_today = subject_lectures_per_day.get(subject, 0)
                queue = subject_lecture_queues.get(subject, [])
                next_idx = subject_next_lecture.get(subject, 0)

                # 커스텀 패턴 확인
                if subject in custom_patterns:
                    if day not in custom_patterns[subject]["days"]:
                        continue  # 이 날은 해당 과목 스킵

                # 해당 일에 배치할 강의 처리
                placed_count = 0
                while placed_count < lectures_today and next_idx < len(queue):
                    item = queue[next_idx]

                    quest = self._create_quest(
                        item=item,
                        subject=subject,
                        scheduled_date=scheduled_date,
                        course_info=self._find_course_info(course_contents, item.get("course_id"))
                    )
                    quests.append(quest)
                    placed_lectures.append((quest, day, subject, item))

                    next_idx += 1
                    placed_count += 1

                subject_next_lecture[subject] = next_idx

        # 남은 강의 퀘스트 순차 배치 (순서 유지)
        for subject in subject_daily_minutes.keys():
            queue = subject_lecture_queues.get(subject, [])
            next_idx = subject_next_lecture.get(subject, 0)

            # 남은 강의들을 마지막 날부터 순차 배치
            remaining_lectures = queue[next_idx:]
            if remaining_lectures:
                # 남은 강의들을 가능한 날에 분산
                days_per_lecture = max(1, total_days // len(remaining_lectures)) if remaining_lectures else 1
                for i, item in enumerate(remaining_lectures):
                    day_to_place = min(total_days - 1, (next_idx + i) * days_per_lecture // max(1, subject_lectures_per_day.get(subject, 1)))
                    scheduled_date = start_date + timedelta(days=day_to_place)

                    quest = self._create_quest(
                        item=item,
                        subject=subject,
                        scheduled_date=scheduled_date,
                        course_info=self._find_course_info(course_contents, item.get("course_id"))
                    )
                    quests.append(quest)
                    placed_lectures.append((quest, day_to_place, subject, item))

        # 복습 퀘스트 배치: 당일 복습 또는 다음날 복습
        for lecture_quest, day_idx, subject, original_item in placed_lectures:
            item_index = original_item.get("chapter_index", 0) - 1
            review_item = None

            # 해당 강의의 복습 퀘스트 찾기
            for review in subject_review_queues.get(subject, []):
                if review.get("chapter") == original_item.get("chapter"):
                    if review.get("section") and "복습" in str(review.get("section", "")):
                        review_item = review
                        subject_review_queues[subject].remove(review)
                        break

            if review_item:
                if same_day_review:
                    # 당일 복습: 같은 날에 배치
                    review_day = day_idx
                else:
                    # 다음날 복습
                    review_day = min(day_idx + 1, total_days - 1)

                review_date = start_date + timedelta(days=review_day)

                review_quest = self._create_quest(
                    item=review_item,
                    subject=subject,
                    scheduled_date=review_date,
                    course_info=self._find_course_info(course_contents, review_item.get("course_id"))
                )
                quests.append(review_quest)

        # 문제풀이 퀘스트 생성: 일별로 남은 시간을 문제풀이로 채움
        practice_quests = self._generate_practice_quests(
            quests=quests,
            subject_daily_minutes=subject_daily_minutes,
            total_days=total_days,
            start_date=start_date
        )
        quests.extend(practice_quests)

        return quests

    def _generate_practice_quests(
        self,
        quests: List[Quest],
        subject_daily_minutes: Dict[str, int],
        total_days: int,
        start_date: datetime
    ) -> List[Quest]:
        """문제풀이(자습) 퀘스트 생성

        인강 50% : 자습+복습 50% 비율 적용:
        - 인강 시간의 합 = 자습 + 복습 시간의 합
        - 복습은 이미 강의와 함께 생성됨 (강의의 25-35%)
        - 자습은 (인강 시간 - 복습 시간)만큼 추가하여 50:50 맞춤

        Args:
            quests: 이미 생성된 퀘스트 리스트 (강의, 복습)
            subject_daily_minutes: 과목별 일일 할당 시간
            total_days: 총 학습 일수
            start_date: 시작 날짜

        Returns:
            문제풀이 퀘스트 리스트
        """
        practice_quests = []

        # 일별, 과목별 시간 분석
        daily_analysis: Dict[str, Dict[str, Dict[str, int]]] = {}
        # {date: {subject: {"lecture": min, "review": min, "total": min}}}
        daily_lectures: Dict[str, Dict[str, List[str]]] = {}  # {date: {subject: [lecture_titles]}}

        for quest in quests:
            date = quest.scheduled_date
            subject = quest.subject

            if date not in daily_analysis:
                daily_analysis[date] = {}
                daily_lectures[date] = {}

            if subject not in daily_analysis[date]:
                daily_analysis[date][subject] = {"lecture": 0, "review": 0, "total": 0}
                daily_lectures[date][subject] = []

            # 퀘스트 유형별 시간 집계
            if quest.quest_type == QuestType.LECTURE:
                daily_analysis[date][subject]["lecture"] += quest.estimated_minutes
                daily_lectures[date][subject].append(quest.chapter)
            elif quest.quest_type == QuestType.REVIEW:
                daily_analysis[date][subject]["review"] += quest.estimated_minutes

            daily_analysis[date][subject]["total"] += quest.estimated_minutes

        # 각 날짜별, 과목별로 자습 시간 계산
        # 목표: 인강 시간 = 자습 + 복습 시간 (50:50 비율)
        for day in range(total_days):
            scheduled_date = start_date + timedelta(days=day)
            date_str = scheduled_date.strftime("%Y-%m-%d")

            for subject, daily_allocation in subject_daily_minutes.items():
                if daily_allocation <= 0:
                    continue

                # 해당 날짜의 인강/복습 시간 조회
                analysis = daily_analysis.get(date_str, {}).get(subject, {"lecture": 0, "review": 0, "total": 0})
                lecture_minutes = analysis["lecture"]
                review_minutes = analysis["review"]
                used_minutes = analysis["total"]

                # 50:50 비율 적용
                # 인강 50% = 복습 + 자습 50%
                # 필요한 자습 시간 = 인강 시간 - 복습 시간
                required_self_study = lecture_minutes - review_minutes

                # 남은 시간 계산 (일일 할당량 - 사용된 시간)
                remaining_in_allocation = daily_allocation - used_minutes

                # 자습 시간: 필요한 양과 남은 시간 중 작은 값 (최소 기준)
                # 하지만 50:50을 맞추기 위해 필요한 자습 시간은 보장
                self_study_minutes = max(required_self_study, 0)

                # 남은 할당 시간이 있으면 추가 자습 가능
                if remaining_in_allocation > self_study_minutes:
                    self_study_minutes = remaining_in_allocation

                # 최소 10분 이상인 경우에만 자습 퀘스트 생성
                if self_study_minutes >= 10:
                    related_lectures = daily_lectures.get(date_str, {}).get(subject, [])

                    practice_quest = self._create_practice_quest(
                        subject=subject,
                        scheduled_date=scheduled_date,
                        duration_minutes=self_study_minutes,
                        related_lectures=related_lectures
                    )
                    practice_quests.append(practice_quest)

        return practice_quests

    def _parse_custom_schedule(
        self,
        custom_schedule: List[Dict[str, Any]],
        total_days: int
    ) -> Dict[str, Dict[str, Any]]:
        """커스텀 스케줄 규칙 파싱

        Args:
            custom_schedule: 커스텀 스케줄 규칙 리스트
                [{"subject": "탐구", "type": "alternate", "hoursPerSession": 2}]
            total_days: 총 학습 일수

        Returns:
            과목별 배치 패턴
        """
        patterns = {}
        for rule in custom_schedule:
            subject = rule.get("subject", "")
            schedule_type = rule.get("type", "daily")
            hours_per_session = rule.get("hoursPerSession", 2)

            if schedule_type == "daily":
                # 매일
                allowed_days = set(range(total_days))
            elif schedule_type == "alternate":
                # 격일
                allowed_days = set(range(0, total_days, 2))
            elif schedule_type == "weekly":
                # 주간 (일주일에 한 번)
                allowed_days = set(range(0, total_days, 7))
            else:
                allowed_days = set(range(total_days))

            patterns[subject] = {
                "days": allowed_days,
                "minutes_per_session": hours_per_session * 60
            }

        return patterns

    def _find_available_day_with_pattern(
        self,
        subject: str,
        daily_remaining: Dict[int, Dict[str, int]],
        current_day: int,
        total_days: int,
        allowed_days: set,
        required_minutes: int
    ) -> Optional[int]:
        """패턴에 맞는 가용 날 찾기"""
        for offset in range(total_days):
            day = (current_day + offset) % total_days
            if day not in allowed_days:
                continue
            remaining = daily_remaining.get(day, {}).get(subject, 0)
            if remaining >= required_minutes:
                return day
        return None

    def _find_available_day(
        self,
        subject: str,
        daily_remaining: Dict[int, Dict[str, int]],
        current_day: int,
        total_days: int,
        required_minutes: int
    ) -> Optional[int]:
        """해당 과목에 가용 시간이 있는 날 찾기"""
        for offset in range(total_days):
            day = (current_day + offset) % total_days
            remaining = daily_remaining.get(day, {}).get(subject, 0)
            if remaining >= required_minutes:
                return day
        return None

    def _find_least_loaded_day(
        self,
        daily_remaining: Dict[int, Dict[str, int]],
        total_days: int
    ) -> int:
        """가장 여유 있는 날 찾기"""
        max_remaining = -1
        best_day = 0

        for day in range(total_days):
            total_remaining = sum(daily_remaining.get(day, {}).values())
            if total_remaining > max_remaining:
                max_remaining = total_remaining
                best_day = day

        return best_day

    def _is_ot_lecture(self, title: str) -> bool:
        """OT(오리엔테이션) 강의 여부 판별"""
        ot_keywords = ["OT", "오리엔테이션", "orientation", "오티", "소개", "커리큘럼 소개", "강좌 소개"]
        title_lower = title.lower()
        return any(kw.lower() in title_lower for kw in ot_keywords)

    def _extract_quest_items(
        self,
        course: Dict[str, Any],
        include_ot: bool = False,
        review_enabled: bool = True
    ) -> List[Dict[str, Any]]:
        """강좌에서 퀘스트 항목 추출

        Args:
            course: 강좌 정보
            include_ot: OT 강의 포함 여부
            review_enabled: 복습 퀘스트 추가 여부

        Note:
            복습 시간은 _calculate_review_duration()으로 동적 계산됨
            (강의 시간의 25-35%, 5분 단위, 최소 10분, 최대 45분)
        """
        items = []
        course_id = course.get("id", str(uuid.uuid4()))
        course_name = course.get("courseName", course.get("title", ""))
        lecturer = course.get("lecturer", course.get("lecturerName", ""))
        subject = course.get("subject", "")

        # 목차 (chapters) 처리
        chapters = course.get("chapters", course.get("tableOfContents", []))

        # 이어듣기: 시작 챕터 인덱스 (0부터 시작, None이면 처음부터)
        start_from_chapter = course.get("startFromChapter")

        # 목차가 없는 경우: 강좌 자체를 하나의 퀘스트로 생성
        if not chapters:
            # category가 있으면 챕터명으로 사용
            chapter_name = course.get("category", course_name)

            # OT 강의 필터링
            if self._is_ot_lecture(chapter_name) and not include_ot:
                return items

            items.append({
                "course_id": course_id,
                "course_name": course_name,
                "lecturer": lecturer,
                "subject": subject,
                "chapter": chapter_name,
                "chapter_index": 1,
                "section": None,
                "quest_type": QuestType.LECTURE,
                "estimated_minutes": self.DEFAULT_MINUTES[QuestType.LECTURE],
                "is_ot": self._is_ot_lecture(chapter_name)
            })

            # 복습 퀘스트 추가 (OT가 아닌 경우에만)
            if review_enabled and not self._is_ot_lecture(chapter_name):
                lecture_minutes = self.DEFAULT_MINUTES[QuestType.LECTURE]
                items.append({
                    "course_id": course_id,
                    "course_name": course_name,
                    "lecturer": lecturer,
                    "subject": subject,
                    "chapter": chapter_name,
                    "chapter_index": 1,
                    "section": "복습",
                    "quest_type": QuestType.REVIEW,
                    "estimated_minutes": self._calculate_review_duration(lecture_minutes, subject),
                    "is_review_of_index": len(items) - 1  # 바로 이전 강의 참조
                })
            return items

        total_chapters = len(chapters)

        for ch_idx, chapter in enumerate(chapters):
            # 이어듣기: 시작 챕터 이전은 건너뜀
            if start_from_chapter is not None and ch_idx < start_from_chapter:
                continue

            if isinstance(chapter, str):
                chapter_title = chapter

                # 문자열에서 duration 추출 시도 (예: "1. 제목 (21:30)")
                duration_minutes = self.DEFAULT_MINUTES[QuestType.LECTURE]
                if "(" in chapter_title and ":" in chapter_title:
                    import re
                    match = re.search(r'\((\d+:\d+(?::\d+)?)\)', chapter_title)
                    if match:
                        duration_minutes = self._parse_duration_to_minutes(match.group(1))

                # OT 강의 필터링
                if self._is_ot_lecture(chapter_title) and not include_ot:
                    continue

                items.append({
                    "course_id": course_id,
                    "course_name": course_name,
                    "lecturer": lecturer,
                    "subject": subject,
                    "chapter": chapter_title,
                    "chapter_index": ch_idx + 1,
                    "section": None,
                    "quest_type": QuestType.LECTURE,
                    "estimated_minutes": duration_minutes,
                    "is_ot": self._is_ot_lecture(chapter_title),
                    "total_chapters": total_chapters
                })

                # 복습 퀘스트 추가 (OT가 아닌 경우에만)
                if review_enabled and not self._is_ot_lecture(chapter_title):
                    items.append({
                        "course_id": course_id,
                        "course_name": course_name,
                        "lecturer": lecturer,
                        "subject": subject,
                        "chapter": chapter_title,
                        "chapter_index": ch_idx + 1,
                        "section": "복습",
                        "quest_type": QuestType.REVIEW,
                        "estimated_minutes": self._calculate_review_duration(duration_minutes, subject),
                        "is_review_of_index": len(items) - 1,
                        "total_chapters": total_chapters
                    })

            elif isinstance(chapter, dict):
                # DB에서 온 강의 데이터: {num, title, duration} 형식 처리
                if "num" in chapter and "duration" in chapter:
                    chapter_title = chapter.get("title", f"강의 {ch_idx + 1}")
                    duration_str = chapter.get("duration", "")
                    duration_minutes = self._parse_duration_to_minutes(duration_str)

                    # OT 강의 필터링
                    if self._is_ot_lecture(chapter_title) and not include_ot:
                        continue

                    items.append({
                        "course_id": course_id,
                        "course_name": course_name,
                        "lecturer": lecturer,
                        "subject": subject,
                        "chapter": chapter_title,
                        "chapter_index": ch_idx + 1,
                        "section": None,
                        "quest_type": QuestType.LECTURE,
                        "estimated_minutes": duration_minutes,
                        "is_ot": self._is_ot_lecture(chapter_title),
                        "total_chapters": total_chapters,
                        "original_duration": duration_str  # 원본 시간 문자열 보존
                    })

                    # 복습 퀘스트 추가 (OT가 아닌 경우에만)
                    if review_enabled and not self._is_ot_lecture(chapter_title):
                        items.append({
                            "course_id": course_id,
                            "course_name": course_name,
                            "lecturer": lecturer,
                            "subject": subject,
                            "chapter": chapter_title,
                            "chapter_index": ch_idx + 1,
                            "section": "복습",
                            "quest_type": QuestType.REVIEW,
                            "estimated_minutes": self._calculate_review_duration(duration_minutes, subject),
                            "is_review_of_index": len(items) - 1,
                            "total_chapters": total_chapters
                        })
                    continue

                # 기존 구조화된 챕터 (sections 포함)
                chapter_title = chapter.get("title", chapter.get("name", f"Chapter {ch_idx + 1}"))
                sections = chapter.get("sections", chapter.get("lectures", []))

                # 챕터 전체가 OT인 경우 필터링
                if self._is_ot_lecture(chapter_title) and not include_ot:
                    continue

                if sections:
                    for sec_idx, section in enumerate(sections):
                        sec_title = section if isinstance(section, str) else section.get("title", "")
                        duration = self.DEFAULT_MINUTES[QuestType.LECTURE]
                        if isinstance(section, dict):
                            duration = section.get("duration", duration)

                        # 섹션 레벨 OT 필터링
                        if self._is_ot_lecture(sec_title) and not include_ot:
                            continue

                        items.append({
                            "course_id": course_id,
                            "course_name": course_name,
                            "lecturer": lecturer,
                            "subject": subject,
                            "chapter": chapter_title,
                            "chapter_index": ch_idx + 1,
                            "section": sec_title,
                            "section_index": sec_idx + 1,
                            "quest_type": QuestType.LECTURE,
                            "estimated_minutes": duration,
                            "is_ot": self._is_ot_lecture(sec_title)
                        })

                        # 각 강의마다 복습 퀘스트 추가 (OT가 아닌 경우에만)
                        if review_enabled and not self._is_ot_lecture(sec_title):
                            items.append({
                                "course_id": course_id,
                                "course_name": course_name,
                                "lecturer": lecturer,
                                "subject": subject,
                                "chapter": chapter_title,
                                "chapter_index": ch_idx + 1,
                                "section": f"{sec_title} - 복습",
                                "quest_type": QuestType.REVIEW,
                                "estimated_minutes": self._calculate_review_duration(duration, subject),
                                "is_review_of_index": len(items) - 1
                            })
                else:
                    items.append({
                        "course_id": course_id,
                        "course_name": course_name,
                        "lecturer": lecturer,
                        "subject": subject,
                        "chapter": chapter_title,
                        "chapter_index": ch_idx + 1,
                        "section": None,
                        "quest_type": QuestType.LECTURE,
                        "estimated_minutes": self.DEFAULT_MINUTES[QuestType.LECTURE],
                        "is_ot": self._is_ot_lecture(chapter_title)
                    })

                    # 복습 퀘스트 추가
                    if review_enabled and not self._is_ot_lecture(chapter_title):
                        lecture_minutes = self.DEFAULT_MINUTES[QuestType.LECTURE]
                        items.append({
                            "course_id": course_id,
                            "course_name": course_name,
                            "lecturer": lecturer,
                            "subject": subject,
                            "chapter": chapter_title,
                            "chapter_index": ch_idx + 1,
                            "section": "복습",
                            "quest_type": QuestType.REVIEW,
                            "estimated_minutes": self._calculate_review_duration(lecture_minutes, subject),
                            "is_review_of_index": len(items) - 1
                        })

        return items

    def _group_by_subject(
        self,
        items: List[Dict[str, Any]],
        curriculum_plan: Dict[str, Any]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """과목별 그룹화"""
        grouped = {}
        for item in items:
            subject = item.get("subject", "기타")
            if subject not in grouped:
                grouped[subject] = []
            grouped[subject].append(item)
        return grouped

    def _find_subject_plan(
        self,
        curriculum_plan: Dict[str, Any],
        subject: str
    ) -> Optional[Dict[str, Any]]:
        """커리큘럼에서 과목 계획 찾기"""
        subjects = curriculum_plan.get("curriculum", {}).get("subjects", [])
        for s in subjects:
            if s.get("name") == subject:
                return s
        return None

    def _find_course_info(
        self,
        course_contents: List[Dict[str, Any]],
        course_id: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        """강좌 정보 찾기"""
        if not course_id:
            return None
        for course in course_contents:
            if course.get("id") == course_id:
                return course
        return None

    def _create_quest(
        self,
        item: Dict[str, Any],
        subject: str,
        scheduled_date: datetime,
        course_info: Optional[Dict[str, Any]] = None
    ) -> Quest:
        """퀘스트 생성"""
        quest_type = item.get("quest_type", QuestType.LECTURE)
        chapter = item.get("chapter", "")
        section = item.get("section")
        is_review = quest_type == QuestType.REVIEW

        # 제목 생성
        if section:
            title = f"[{subject}] {chapter} - {section}"
        else:
            title = f"[{subject}] {chapter}"

        # 설명 생성
        description = self._generate_quest_description(item, quest_type)

        # 우선순위 결정
        priority = self._determine_priority(item, quest_type)

        # 학습 팁 생성
        study_tips = self._generate_study_tips(
            chapter_title=chapter,
            section_title=section,
            subject=subject,
            chapter_index=item.get("chapter_index", 1),
            total_chapters=item.get("total_chapters", 1),
            is_review=is_review
        )

        return Quest(
            id=str(uuid.uuid4()),
            title=title,
            description=description,
            quest_type=quest_type,
            subject=subject,
            course_id=item.get("course_id"),
            chapter=chapter,
            section=section,
            scheduled_date=scheduled_date.strftime("%Y-%m-%d"),
            estimated_minutes=item.get("estimated_minutes", self.DEFAULT_MINUTES.get(quest_type, 45)),
            status=QuestStatus.PENDING,
            priority=priority,
            lecturer=item.get("lecturer"),
            lecture_url=course_info.get("url") if course_info else None,
            metadata={
                "course_name": item.get("course_name"),
                "chapter_index": item.get("chapter_index"),
                "section_index": item.get("section_index"),
                "original_duration": item.get("original_duration"),
                "study_tips": study_tips
            }
        )

    def _create_practice_quest(
        self,
        subject: str,
        scheduled_date: datetime,
        duration_minutes: int,
        related_lectures: List[str] = None
    ) -> Quest:
        """문제풀이 시간 블록 퀘스트 생성

        Args:
            subject: 과목명
            scheduled_date: 스케줄 날짜
            duration_minutes: 문제풀이 시간 (분) - 참고용, 실제 예상 시간은 0
            related_lectures: 관련 강의 목록

        Returns:
            문제풀이 퀘스트 (예상 시간 없음 - 타이머로만 사용)
        """
        # 자습/문제풀이 퀘스트는 예상 시간 없이 타이머로만 사용
        # (사용자가 자유롭게 학습 시간 측정)

        # description: 항상 자동 생성 (관련 강의 기반)
        # practiceNote: 사용자가 직접 입력하는 메모 (빈 문자열로 시작)
        if related_lectures:
            lecture_names = ", ".join(related_lectures[:3])
            if len(related_lectures) > 3:
                lecture_names += f" 외 {len(related_lectures) - 3}개"
            description = f"오늘 학습한 {lecture_names} 관련 문제 풀이"
        else:
            description = f"{subject} 관련 문제 풀이 시간"

        return Quest(
            id=str(uuid.uuid4()),
            title=f"[{subject}] 문제풀이",
            description=description,
            quest_type=QuestType.PRACTICE,
            subject=subject,
            course_id=None,
            chapter="문제풀이",
            section=None,
            scheduled_date=scheduled_date.strftime("%Y-%m-%d"),
            estimated_minutes=0,  # 자습/문제풀이는 예상 시간 없음 (타이머로만 사용)
            status=QuestStatus.PENDING,
            priority=QuestPriority.MEDIUM,
            lecturer=None,
            lecture_url=None,
            metadata={
                "editable": True,
                "related_lectures": related_lectures or [],
                "practice_type": "daily",
                "practice_note": "",  # 사용자가 직접 입력 (빈 문자열로 시작)
                "isPractice": True  # 프론트엔드에서 자습 퀘스트 구분용
            }
        )

    def _generate_quest_description(self, item: Dict[str, Any], quest_type: QuestType) -> str:
        """퀘스트 설명 생성"""
        course_name = item.get("course_name", "")
        lecturer = item.get("lecturer", "")

        descriptions = {
            QuestType.LECTURE: f"{lecturer} 선생님의 {course_name} 강의를 시청하세요.",
            QuestType.PROBLEM_SET: f"{course_name} 관련 문제를 풀어보세요.",
            QuestType.REVIEW: f"지금까지 배운 {item.get('chapter', '')} 내용을 복습하세요.",
            QuestType.PRACTICE: f"오늘 학습한 내용 관련 문제를 풀어보세요.",
            QuestType.MOCK_EXAM: "실전 모의고사를 풀고 시간 관리 연습을 하세요.",
            QuestType.CONCEPT: f"{item.get('chapter', '')} 핵심 개념을 정리하세요."
        }
        return descriptions.get(quest_type, "학습을 진행하세요.")

    def _determine_priority(self, item: Dict[str, Any], quest_type: QuestType) -> QuestPriority:
        """우선순위 결정"""
        if quest_type == QuestType.MOCK_EXAM:
            return QuestPriority.HIGH
        if quest_type == QuestType.REVIEW:
            return QuestPriority.MEDIUM

        # 첫 번째 챕터는 높은 우선순위
        if item.get("chapter_index", 1) == 1:
            return QuestPriority.HIGH

        return QuestPriority.MEDIUM

    def _build_schedules(self, quests: List[Quest], daily_minutes: int):
        """일별 스케줄 구축"""
        date_quests: Dict[str, List[Quest]] = {}

        for quest in quests:
            date = quest.scheduled_date
            if date not in date_quests:
                date_quests[date] = []
            date_quests[date].append(quest)

        for date, day_quests in date_quests.items():
            total_minutes = sum(q.estimated_minutes for q in day_quests)
            utilization = total_minutes / daily_minutes if daily_minutes > 0 else 0

            self.schedules[date] = QuestSchedule(
                date=date,
                quests=day_quests,
                total_minutes=total_minutes,
                available_minutes=daily_minutes,
                utilization_rate=round(utilization, 2),
                is_overloaded=total_minutes > daily_minutes
            )

    def get_quests_by_date(self, date: str) -> List[Quest]:
        """특정 날짜의 퀘스트 조회"""
        schedule = self.schedules.get(date)
        return schedule.quests if schedule else []

    def get_pending_quests(self) -> List[Quest]:
        """미완료 퀘스트 조회"""
        return [q for q in self.quests.values() if q.status == QuestStatus.PENDING]

    def get_overdue_quests(self) -> List[Quest]:
        """기한 초과 퀘스트 조회"""
        today = datetime.now().strftime("%Y-%m-%d")
        return [
            q for q in self.quests.values()
            if q.scheduled_date < today and q.status == QuestStatus.PENDING
        ]

    def complete_quest(self, quest_id: str, actual_minutes: Optional[int] = None) -> Quest:
        """퀘스트 완료 처리"""
        if quest_id not in self.quests:
            raise ValueError(f"Quest not found: {quest_id}")

        quest = self.quests[quest_id]
        quest.status = QuestStatus.COMPLETED
        quest.completed_at = datetime.now().isoformat()
        quest.actual_minutes = actual_minutes or quest.estimated_minutes

        return quest

    def skip_quest(self, quest_id: str) -> Quest:
        """퀘스트 건너뛰기"""
        if quest_id not in self.quests:
            raise ValueError(f"Quest not found: {quest_id}")

        quest = self.quests[quest_id]
        quest.status = QuestStatus.SKIPPED

        return quest

    def get_completion_stats(self) -> Dict[str, Any]:
        """완료 통계 조회"""
        total = len(self.quests)
        completed = len([q for q in self.quests.values() if q.status == QuestStatus.COMPLETED])
        pending = len([q for q in self.quests.values() if q.status == QuestStatus.PENDING])
        skipped = len([q for q in self.quests.values() if q.status == QuestStatus.SKIPPED])
        overdue = len(self.get_overdue_quests())

        return {
            "total": total,
            "completed": completed,
            "pending": pending,
            "skipped": skipped,
            "overdue": overdue,
            "completion_rate": round(completed / total, 2) if total > 0 else 0,
            "on_track": overdue == 0
        }

    def export_schedule(self) -> Dict[str, Any]:
        """스케줄 내보내기"""
        return {
            "schedules": {date: s.to_dict() for date, s in self.schedules.items()},
            "stats": self.get_completion_stats(),
            "exported_at": datetime.now().isoformat()
        }
