# Router 테스트
# SmartRouter의 복잡도 기반 라우팅 검증

import pytest
from core.router import SmartRouter, ComplexityLevel, RoutingResult


class TestSmartRouter:
    """SmartRouter 테스트"""

    def setup_method(self):
        """테스트 설정"""
        self.router = SmartRouter()

    def test_simple_query_routes_to_fast(self):
        """단순 쿼리는 fast 모델로 라우팅"""
        result = self.router.route("안녕")
        assert result.complexity == ComplexityLevel.SIMPLE
        assert result.model == "openai/gpt-5-nano"

    def test_complex_query_routes_to_teacher(self):
        """복잡한 쿼리는 teacher 모델로 라우팅"""
        result = self.router.route("12주 커리큘럼을 생성해줘")
        assert result.complexity == ComplexityLevel.COMPLEX
        assert result.model == "openai/gpt-5.2"

    def test_medium_query_routes_to_student(self):
        """중간 복잡도 쿼리는 student medium으로 라우팅"""
        result = self.router.route("수학 강사를 추천해줘")
        assert result.complexity == ComplexityLevel.MEDIUM
        assert result.model == "openai/gpt-5-mini"

    def test_rag_required_for_recommendation(self):
        """추천 쿼리는 RAG 필요"""
        result = self.router.route("좋은 영어 강좌를 추천해줘")
        assert result.requires_rag is True

    def test_force_teacher_overrides_routing(self):
        """force_teacher는 라우팅을 무시하고 teacher 사용"""
        result = self.router.force_teacher("간단한 질문")
        assert result.complexity == ComplexityLevel.COMPLEX
        assert result.model == "openai/gpt-5.2"

    def test_context_affects_routing(self):
        """컨텍스트가 라우팅에 영향"""
        context = {"previous_complexity": ComplexityLevel.COMPLEX}
        result = self.router.route("그래서?", context)
        # 이전이 복잡했으면 현재도 복잡도 상승
        assert result.score > 0.3

    def test_long_query_increases_complexity(self):
        """긴 쿼리는 복잡도 증가"""
        short_result = self.router.route("안녕")
        long_result = self.router.route(
            "수학 1등급을 목표로 하는 고3 학생인데 현재 3등급이고 "
            "미적분이 약해서 개념부터 다시 잡고 싶어요"
        )
        assert long_result.score > short_result.score

    def test_multiple_questions_increase_complexity(self):
        """여러 질문은 복잡도 증가"""
        single = self.router.route("수학 강사 추천해줘")
        multiple = self.router.route("수학 강사 추천해줘? 그리고 영어도?")
        assert multiple.score > single.score


class TestComplexityKeywords:
    """복잡도 키워드 테스트"""

    def setup_method(self):
        self.router = SmartRouter()

    def test_high_complexity_keywords(self):
        """고복잡도 키워드 테스트"""
        high_keywords = ["커리큘럼 생성", "학습 계획", "분석해줘"]
        for keyword in high_keywords:
            result = self.router.route(keyword)
            assert result.score >= 0.5, f"{keyword}의 복잡도가 낮음"

    def test_low_complexity_keywords(self):
        """저복잡도 키워드 테스트"""
        low_keywords = ["안녕", "있어", "고마워"]
        for keyword in low_keywords:
            result = self.router.route(keyword)
            assert result.score < 0.4, f"{keyword}의 복잡도가 높음"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
