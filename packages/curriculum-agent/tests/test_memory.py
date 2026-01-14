# Memory Lane 테스트
# Type-Aware Memory System 검증

import pytest
import asyncio
from datetime import datetime
from memory.memory_lane import MemoryLane, MemoryType, MemoryEntry


class TestMemoryLane:
    """MemoryLane 테스트"""

    @pytest.fixture
    def memory(self, tmp_path):
        """임시 경로로 MemoryLane 생성"""
        return MemoryLane(storage_path=str(tmp_path / "test_memory"))

    @pytest.mark.asyncio
    async def test_save_and_retrieve(self, memory):
        """메모리 저장 및 검색"""
        # 저장
        entry = await memory.save(
            content="수학 강사 현우진 추천",
            memory_type=MemoryType.LEARNING,
            context="수학 강사 추천",
            confidence=0.8
        )

        assert entry.id is not None
        assert entry.memory_type == MemoryType.LEARNING

        # 검색
        result = await memory.retrieve("수학 강사")
        assert len(result["memories"]) > 0
        assert result["total_found"] >= 1

    @pytest.mark.asyncio
    async def test_query_boosting(self, memory):
        """쿼리 부스팅 테스트"""
        # CORRECTION 메모리 저장
        await memory.save(
            content="실수: 잘못된 강사 추천",
            memory_type=MemoryType.CORRECTION,
            context="오류 수정",
            confidence=0.9
        )

        # LEARNING 메모리 저장
        await memory.save(
            content="일반 학습 내용",
            memory_type=MemoryType.LEARNING,
            context="일반 학습",
            confidence=0.9
        )

        # "실수" 키워드로 검색 → CORRECTION 부스트
        result = await memory.retrieve("이전에 한 실수가 뭐야?")
        assert MemoryType.CORRECTION.value in result["boosted_types"]

    @pytest.mark.asyncio
    async def test_memory_types(self, memory):
        """메모리 유형별 저장"""
        types = [
            MemoryType.CORRECTION,
            MemoryType.DECISION,
            MemoryType.INSIGHT,
            MemoryType.PATTERN,
            MemoryType.GAP,
            MemoryType.LEARNING
        ]

        for mem_type in types:
            entry = await memory.save(
                content=f"{mem_type.value} 테스트 내용",
                memory_type=mem_type,
                context="테스트",
                confidence=0.8
            )
            assert entry.memory_type == mem_type

    @pytest.mark.asyncio
    async def test_get_by_type(self, memory):
        """유형별 메모리 조회"""
        # DECISION 메모리 저장
        await memory.save(
            content="PostgreSQL 사용 결정",
            memory_type=MemoryType.DECISION,
            context="DB 선택",
            confidence=0.9
        )

        await memory.save(
            content="일반 학습",
            memory_type=MemoryType.LEARNING,
            context="학습",
            confidence=0.8
        )

        # DECISION만 조회
        decisions = await memory.get_by_type(MemoryType.DECISION)
        assert len(decisions) >= 1
        assert all(d["memory_type"] == "decision" for d in decisions)

    @pytest.mark.asyncio
    async def test_delete_memory(self, memory):
        """메모리 삭제"""
        entry = await memory.save(
            content="삭제할 메모리",
            memory_type=MemoryType.LEARNING,
            context="삭제 테스트",
            confidence=0.5
        )

        result = await memory.delete(entry.id)
        assert result is True

        # 삭제 확인
        retrieved = await memory.retrieve("삭제할 메모리")
        found_ids = [m["id"] for m in retrieved["memories"]]
        assert entry.id not in found_ids

    def test_stats(self, memory):
        """통계 조회"""
        stats = memory.get_stats()
        assert "total_memories" in stats
        assert "storage_type" in stats


class TestQueryTypeDetection:
    """쿼리 유형 감지 테스트"""

    @pytest.fixture
    def memory(self, tmp_path):
        return MemoryLane(storage_path=str(tmp_path / "test_memory"))

    def test_correction_keywords(self, memory):
        """CORRECTION 키워드 감지"""
        queries = ["실수했어", "잘못됐어", "아니 수정해줘"]
        for query in queries:
            types = memory._detect_query_types(query)
            assert MemoryType.CORRECTION in types

    def test_decision_keywords(self, memory):
        """DECISION 키워드 감지"""
        queries = ["결정했어", "선택했어", "쓰기로 했어"]
        for query in queries:
            types = memory._detect_query_types(query)
            assert MemoryType.DECISION in types

    def test_pattern_keywords(self, memory):
        """PATTERN 키워드 감지"""
        queries = ["패턴이 뭐야", "보통 어떻게 해"]
        for query in queries:
            types = memory._detect_query_types(query)
            assert MemoryType.PATTERN in types

    def test_no_keywords_empty(self, memory):
        """키워드 없으면 빈 리스트"""
        types = memory._detect_query_types("그냥 일반 질문")
        assert len(types) == 0


class TestReRanking:
    """Re-Ranking 알고리즘 테스트"""

    @pytest.fixture
    def memory(self, tmp_path):
        return MemoryLane(storage_path=str(tmp_path / "test_memory"))

    def test_rerank_with_type_boost(self, memory):
        """유형 부스트 적용 테스트"""
        results = [
            {
                "id": "1",
                "content": "내용1",
                "memory_type": "correction",
                "confidence": 0.8,
                "similarity": 0.7,
                "created_at": datetime.now().isoformat()
            },
            {
                "id": "2",
                "content": "내용2",
                "memory_type": "learning",
                "confidence": 0.9,
                "similarity": 0.8,
                "created_at": datetime.now().isoformat()
            }
        ]

        # CORRECTION 부스트
        boosted = [MemoryType.CORRECTION]
        reranked = memory._rerank(results, boosted)

        # CORRECTION이 부스트되어 상위로
        assert reranked[0]["memory_type"] == "correction"

    def test_rerank_without_boost(self, memory):
        """부스트 없이 기본 랭킹"""
        results = [
            {
                "id": "1",
                "content": "낮은 유사도",
                "memory_type": "learning",
                "confidence": 0.5,
                "similarity": 0.5,
                "created_at": datetime.now().isoformat()
            },
            {
                "id": "2",
                "content": "높은 유사도",
                "memory_type": "learning",
                "confidence": 0.9,
                "similarity": 0.9,
                "created_at": datetime.now().isoformat()
            }
        ]

        reranked = memory._rerank(results, [])

        # 유사도 높은 것이 상위
        assert reranked[0]["similarity"] > reranked[1]["similarity"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
