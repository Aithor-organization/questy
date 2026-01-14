# Memory Lane - Type-Aware Memory System
# ACE Framework V5.2 - Query Boosting + Re-Ranking

import os
import json
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path

try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    HAS_CHROMADB = True
except ImportError:
    HAS_CHROMADB = False
    print("⚠️ ChromaDB not installed. Memory Lane will use file-based storage.")

from config import get_config


class MemoryType(Enum):
    """메모리 유형 (Teacher가 분류)"""
    CORRECTION = "correction"
    DECISION = "decision"
    INSIGHT = "insight"
    PATTERN = "pattern"
    GAP = "gap"
    LEARNING = "learning"


@dataclass
class MemoryEntry:
    """메모리 엔트리"""
    id: str
    content: str
    memory_type: MemoryType
    context: str
    confidence: float
    insight: str
    created_at: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "content": self.content,
            "memory_type": self.memory_type.value,
            "context": self.context,
            "confidence": self.confidence,
            "insight": self.insight,
            "created_at": self.created_at,
            "metadata": self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MemoryEntry":
        return cls(
            id=data["id"],
            content=data["content"],
            memory_type=MemoryType(data["memory_type"]),
            context=data["context"],
            confidence=data["confidence"],
            insight=data["insight"],
            created_at=data["created_at"],
            metadata=data.get("metadata", {})
        )


class MemoryLane:
    """
    Memory Lane - Type-Aware Memory System

    특징:
    1. Type-Aware Memory: 6가지 메모리 유형 (Teacher 분류)
    2. Query-Aware Boosting: 쿼리 의도 기반 15% 부스트
    3. Re-Ranking: Recency + Confidence + Type Boost

    설계 원칙:
    - 즉시 저장 (안정성 보장)
    - Teacher 분류로 정확한 유형 분류
    - 쿼리 키워드 기반 부스팅
    """

    # Query-Aware Boosting 키워드
    QUERY_BOOST_KEYWORDS = {
        MemoryType.CORRECTION: ["실수", "잘못", "수정", "아니", "error", "틀렸", "바꿔"],
        MemoryType.DECISION: ["결정", "선택", "쓰기로", "decide", "정했", "하기로"],
        MemoryType.PATTERN: ["패턴", "방법", "how", "항상", "보통", "평소"],
        MemoryType.INSIGHT: ["배움", "깨달음", "insight", "발견", "알게"],
        MemoryType.GAP: ["실패", "안됨", "못함", "fail", "에러", "오류"],
    }

    def __init__(self, storage_path: Optional[str] = None):
        self.config = get_config()
        self.storage_path = storage_path or self.config.memory.storage.path
        self.collection_name = self.config.memory.storage.collection_name

        # Re-Ranking 가중치
        self.weights = {
            "vector_similarity": self.config.memory.reranking.vector_similarity,
            "recency": self.config.memory.reranking.recency,
            "confidence": self.config.memory.reranking.confidence,
            "type_boost": self.config.memory.reranking.type_boost
        }

        # 저장소 초기화
        self._init_storage()

    def _init_storage(self):
        """저장소 초기화"""
        Path(self.storage_path).mkdir(parents=True, exist_ok=True)

        if HAS_CHROMADB:
            self.client = chromadb.PersistentClient(
                path=self.storage_path,
                settings=ChromaSettings(anonymized_telemetry=False)
            )
            self.collection = self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"}
            )
            self.use_chromadb = True
        else:
            # 파일 기반 저장소
            self.memories_file = Path(self.storage_path) / "memories.json"
            self.memories: List[MemoryEntry] = self._load_memories_from_file()
            self.use_chromadb = False

    def _load_memories_from_file(self) -> List[MemoryEntry]:
        """파일에서 메모리 로드"""
        if self.memories_file.exists():
            with open(self.memories_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return [MemoryEntry.from_dict(m) for m in data]
        return []

    def _save_memories_to_file(self):
        """파일에 메모리 저장"""
        with open(self.memories_file, 'w', encoding='utf-8') as f:
            json.dump([m.to_dict() for m in self.memories], f, ensure_ascii=False, indent=2)

    async def save(
        self,
        content: str,
        memory_type: MemoryType,
        context: str,
        confidence: float = 0.7,
        insight: str = "",
        metadata: Optional[Dict[str, Any]] = None
    ) -> MemoryEntry:
        """
        메모리 저장 (즉시 저장)

        Args:
            content: 저장할 내용
            memory_type: 메모리 유형 (Teacher 분류)
            context: 컨텍스트 (쿼리)
            confidence: 신뢰도 (0-1)
            insight: 인사이트
            metadata: 추가 메타데이터

        Returns:
            MemoryEntry: 저장된 메모리
        """
        entry = MemoryEntry(
            id=str(uuid.uuid4()),
            content=content,
            memory_type=memory_type,
            context=context,
            confidence=confidence,
            insight=insight,
            created_at=datetime.now().isoformat(),
            metadata=metadata or {}
        )

        if self.use_chromadb:
            self.collection.add(
                ids=[entry.id],
                documents=[content],
                metadatas=[{
                    "memory_type": memory_type.value,
                    "context": context,
                    "confidence": confidence,
                    "insight": insight,
                    "created_at": entry.created_at,
                    **(metadata or {})
                }]
            )
        else:
            self.memories.append(entry)
            self._save_memories_to_file()

        return entry

    async def retrieve(
        self,
        query: str,
        top_k: int = 5,
        memory_types: Optional[List[MemoryType]] = None
    ) -> Dict[str, Any]:
        """
        메모리 검색 (Query-Aware Boosting + Re-Ranking)

        Args:
            query: 검색 쿼리
            top_k: 반환할 최대 개수
            memory_types: 필터할 메모리 유형

        Returns:
            검색 결과
        """
        # 1. Query-Aware Type Detection
        boosted_types = self._detect_query_types(query)

        # 2. 기본 검색
        if self.use_chromadb:
            results = self._search_chromadb(query, top_k * 2)  # Re-ranking 위해 더 많이
        else:
            results = self._search_file_based(query, top_k * 2)

        # 3. 타입 필터링
        if memory_types:
            results = [r for r in results if r["memory_type"] in [t.value for t in memory_types]]

        # 4. Re-Ranking
        reranked = self._rerank(results, boosted_types)

        # 5. Top-K 반환
        return {
            "memories": reranked[:top_k],
            "boosted_types": [t.value for t in boosted_types],
            "total_found": len(results)
        }

    def _detect_query_types(self, query: str) -> List[MemoryType]:
        """쿼리에서 부스트할 메모리 유형 감지"""
        query_lower = query.lower()
        detected = []

        for mem_type, keywords in self.QUERY_BOOST_KEYWORDS.items():
            for keyword in keywords:
                if keyword in query_lower:
                    detected.append(mem_type)
                    break

        return detected

    def _search_chromadb(self, query: str, top_k: int) -> List[Dict[str, Any]]:
        """ChromaDB 검색"""
        results = self.collection.query(
            query_texts=[query],
            n_results=top_k
        )

        memories = []
        if results and results['ids'] and results['ids'][0]:
            for i, id in enumerate(results['ids'][0]):
                metadata = results['metadatas'][0][i] if results['metadatas'] else {}
                memories.append({
                    "id": id,
                    "content": results['documents'][0][i] if results['documents'] else "",
                    "memory_type": metadata.get("memory_type", "learning"),
                    "context": metadata.get("context", ""),
                    "confidence": metadata.get("confidence", 0.5),
                    "insight": metadata.get("insight", ""),
                    "created_at": metadata.get("created_at", ""),
                    "similarity": 1 - (results['distances'][0][i] if results['distances'] else 0)
                })

        return memories

    def _search_file_based(self, query: str, top_k: int) -> List[Dict[str, Any]]:
        """파일 기반 검색 (간단한 키워드 매칭)"""
        query_words = set(query.lower().split())
        scored = []

        for mem in self.memories:
            content_words = set(mem.content.lower().split())
            context_words = set(mem.context.lower().split())
            all_words = content_words | context_words

            # 간단한 Jaccard 유사도
            intersection = len(query_words & all_words)
            union = len(query_words | all_words)
            similarity = intersection / union if union > 0 else 0

            scored.append({
                "id": mem.id,
                "content": mem.content,
                "memory_type": mem.memory_type.value,
                "context": mem.context,
                "confidence": mem.confidence,
                "insight": mem.insight,
                "created_at": mem.created_at,
                "similarity": similarity
            })

        # 유사도 순 정렬
        scored.sort(key=lambda x: x["similarity"], reverse=True)
        return scored[:top_k]

    def _rerank(
        self,
        results: List[Dict[str, Any]],
        boosted_types: List[MemoryType]
    ) -> List[Dict[str, Any]]:
        """
        Re-Ranking 수행

        Final Score = (Vector Similarity × 0.55)
                    + (Recency × 0.15)
                    + (Confidence × 0.15)
                    + (Type Boost × 0.15)
        """
        now = datetime.now()
        boosted_type_values = [t.value for t in boosted_types]

        for result in results:
            # 1. Vector Similarity
            sim_score = result.get("similarity", 0) * self.weights["vector_similarity"]

            # 2. Recency (최근 것일수록 높음)
            try:
                created = datetime.fromisoformat(result.get("created_at", ""))
                days_ago = (now - created).days
                recency_score = max(0, 1 - (days_ago / 30)) * self.weights["recency"]
            except:
                recency_score = 0

            # 3. Confidence
            conf_score = result.get("confidence", 0.5) * self.weights["confidence"]

            # 4. Type Boost (부스트된 유형이면 +15%)
            type_boost = 0
            if result.get("memory_type") in boosted_type_values:
                type_boost = 0.15 * self.weights["type_boost"]

            # Final Score
            result["final_score"] = sim_score + recency_score + conf_score + type_boost

        # 최종 점수 순 정렬
        results.sort(key=lambda x: x.get("final_score", 0), reverse=True)
        return results

    async def get_by_type(
        self,
        memory_type: MemoryType,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """특정 유형의 메모리 조회"""
        if self.use_chromadb:
            results = self.collection.get(
                where={"memory_type": memory_type.value},
                limit=limit
            )
            memories = []
            if results and results['ids']:
                for i, id in enumerate(results['ids']):
                    metadata = results['metadatas'][i] if results['metadatas'] else {}
                    memories.append({
                        "id": id,
                        "content": results['documents'][i] if results['documents'] else "",
                        **metadata
                    })
            return memories
        else:
            return [
                m.to_dict() for m in self.memories
                if m.memory_type == memory_type
            ][:limit]

    async def delete(self, memory_id: str) -> bool:
        """메모리 삭제"""
        if self.use_chromadb:
            try:
                self.collection.delete(ids=[memory_id])
                return True
            except:
                return False
        else:
            self.memories = [m for m in self.memories if m.id != memory_id]
            self._save_memories_to_file()
            return True

    def get_stats(self) -> Dict[str, Any]:
        """메모리 통계"""
        if self.use_chromadb:
            count = self.collection.count()
            return {
                "total_memories": count,
                "storage_type": "chromadb",
                "collection_name": self.collection_name
            }
        else:
            type_counts = {}
            for mem in self.memories:
                t = mem.memory_type.value
                type_counts[t] = type_counts.get(t, 0) + 1

            return {
                "total_memories": len(self.memories),
                "storage_type": "file",
                "by_type": type_counts
            }
