# Smart Router - 복잡도 기반 모델 라우팅
# ACE Framework V5.2 - 3-Level 라우팅

import re
from enum import Enum
from dataclasses import dataclass
from typing import Optional, List, Dict

from config import get_config


class ComplexityLevel(Enum):
    """복잡도 레벨"""
    SIMPLE = "simple"      # student_fast (nano)
    MEDIUM = "medium"      # student_medium (mini)
    COMPLEX = "complex"    # teacher (gpt-5.2)


@dataclass
class RoutingResult:
    """라우팅 결과"""
    level: ComplexityLevel
    model: str
    score: float
    reason: str


class SmartRouter:
    """
    복잡도 기반 스마트 라우터

    설계 철학:
    - 기억 형성(Extraction)과 기억 인출(Retrieval)은 다른 지능 수준 요구
    - 라우팅은 키워드 기반 예측 가능한 방식으로 (디버깅 용이)
    - 모든 평가는 Teacher가 담당 (메모리 품질 보장)
    """

    # 복잡도 키워드 가중치
    HIGH_COMPLEXITY_KEYWORDS = [
        ("분석해줘", 0.4),
        ("커리큘럼 생성", 0.5),
        ("종합적으로", 0.4),
        ("비교해줘", 0.35),
        ("전략 수립", 0.45),
        ("계획 세워줘", 0.4),
        ("왜 그런지", 0.3),
        ("추론해줘", 0.4),
        ("평가해줘", 0.35),
        ("설계해줘", 0.4),
    ]

    MEDIUM_COMPLEXITY_KEYWORDS = [
        ("추천해줘", 0.2),
        ("알려줘", 0.15),
        ("검색해줘", 0.2),
        ("찾아줘", 0.2),
        ("요약해줘", 0.25),
        ("설명해줘", 0.2),
        ("정리해줘", 0.2),
        ("어떤 강사", 0.2),
        ("어떤 강좌", 0.2),
    ]

    LOW_COMPLEXITY_KEYWORDS = [
        ("확인", 0.1),
        ("보여줘", 0.1),
        ("어때", 0.1),
        ("몇 개", 0.1),
        ("있어", 0.05),
        ("뭐야", 0.1),
    ]

    def __init__(self):
        self.config = get_config()
        self.thresholds = self.config.router.thresholds

    def route(self, query: str, context: Optional[Dict] = None) -> RoutingResult:
        """
        쿼리 복잡도 분석 및 적절한 모델 선택

        Args:
            query: 사용자 쿼리
            context: 추가 컨텍스트 (이전 대화 등)

        Returns:
            RoutingResult: 라우팅 결과
        """
        score = self._calculate_complexity_score(query)

        # 컨텍스트 기반 조정
        if context:
            score = self._adjust_for_context(score, context)

        # 레벨 결정
        level = self._determine_level(score)

        # 모델 매핑
        model = self._get_model_for_level(level)

        # 이유 생성
        reason = self._generate_reason(query, level, score)

        return RoutingResult(
            level=level,
            model=model,
            score=score,
            reason=reason
        )

    def _calculate_complexity_score(self, query: str) -> float:
        """키워드 기반 복잡도 점수 계산"""
        query_lower = query.lower()
        score = 0.0

        # 고복잡도 키워드 체크
        for keyword, weight in self.HIGH_COMPLEXITY_KEYWORDS:
            if keyword in query_lower:
                score += weight

        # 중간 복잡도 키워드 체크
        for keyword, weight in self.MEDIUM_COMPLEXITY_KEYWORDS:
            if keyword in query_lower:
                score += weight

        # 저복잡도 키워드 체크
        for keyword, weight in self.LOW_COMPLEXITY_KEYWORDS:
            if keyword in query_lower:
                score += weight

        # 쿼리 길이 기반 가중치 (긴 쿼리 = 더 복잡)
        word_count = len(query.split())
        if word_count > 20:
            score += 0.2
        elif word_count > 10:
            score += 0.1

        # 질문 수 체크 (여러 질문 = 더 복잡)
        question_marks = query.count("?")
        if question_marks > 2:
            score += 0.15
        elif question_marks > 1:
            score += 0.08

        # 정규화 (0-1 범위)
        return min(1.0, max(0.0, score))

    def _adjust_for_context(self, score: float, context: Dict) -> float:
        """컨텍스트 기반 점수 조정"""
        # 이전 대화가 복잡했으면 현재도 복잡할 가능성
        if context.get("previous_level") == ComplexityLevel.COMPLEX:
            score = min(1.0, score + 0.1)

        # RAG 필요 여부
        if context.get("requires_rag", False):
            score = min(1.0, score + 0.15)

        # 커리큘럼 생성 모드
        if context.get("curriculum_mode", False):
            score = min(1.0, score + 0.3)

        return score

    def _determine_level(self, score: float) -> ComplexityLevel:
        """점수 기반 복잡도 레벨 결정"""
        if score <= self.thresholds.get("simple", 0.3):
            return ComplexityLevel.SIMPLE
        elif score <= self.thresholds.get("medium", 0.7):
            return ComplexityLevel.MEDIUM
        else:
            return ComplexityLevel.COMPLEX

    def _get_model_for_level(self, level: ComplexityLevel) -> str:
        """레벨에 따른 모델 반환"""
        if level == ComplexityLevel.SIMPLE:
            return self.config.models.student_fast
        elif level == ComplexityLevel.MEDIUM:
            return self.config.models.student_medium
        else:
            return self.config.models.teacher

    def _generate_reason(self, query: str, level: ComplexityLevel, score: float) -> str:
        """라우팅 이유 생성"""
        if level == ComplexityLevel.SIMPLE:
            return f"단순 쿼리 (score={score:.2f}): 빠른 응답 모델 사용"
        elif level == ComplexityLevel.MEDIUM:
            return f"중간 복잡도 (score={score:.2f}): RAG 기반 답변에 적합"
        else:
            return f"복잡한 추론 필요 (score={score:.2f}): Teacher 모델 사용"

    def force_teacher(self) -> RoutingResult:
        """Teacher 모델 강제 사용 (평가, 커리큘럼 생성 등)"""
        return RoutingResult(
            level=ComplexityLevel.COMPLEX,
            model=self.config.models.teacher,
            score=1.0,
            reason="평가/생성 작업: Teacher 모델 강제 사용"
        )

    def get_all_keywords(self) -> Dict[str, List[str]]:
        """디버깅용: 모든 키워드 반환"""
        return {
            "high": [k for k, _ in self.HIGH_COMPLEXITY_KEYWORDS],
            "medium": [k for k, _ in self.MEDIUM_COMPLEXITY_KEYWORDS],
            "low": [k for k, _ in self.LOW_COMPLEXITY_KEYWORDS]
        }
