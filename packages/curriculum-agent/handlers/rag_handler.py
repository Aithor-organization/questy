# RAG Handler - Pinecone 연동 핸들러
# 인강 강사 데이터 (목차, 커리큘럼, 강사 특징, 교재 목차) 기반 검색

import os
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum

try:
    from pinecone import Pinecone
    HAS_PINECONE = True
except ImportError:
    HAS_PINECONE = False
    print("⚠️ Pinecone not installed. RAG Handler will return empty results.")

try:
    from openai import OpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False
    print("⚠️ OpenAI not installed. Embeddings will not be available.")

from config import get_config


class PineconeNamespace(Enum):
    """Pinecone 네임스페이스"""
    LECTURERS = "lecturers"           # 강사 정보
    COURSES = "courses"               # 강좌 정보
    SUCCESS_PATTERNS = "success_patterns"  # 성공 패턴
    EXAM_TRENDS = "exam_trends"       # 시험 트렌드


@dataclass
class RAGResult:
    """RAG 검색 결과"""
    lecturers: List[Dict[str, Any]]
    courses: List[Dict[str, Any]]
    success_patterns: List[Dict[str, Any]]
    exam_trends: List[Dict[str, Any]]
    total_results: int
    processing_time_ms: int


class RAGHandler:
    """
    RAG 핸들러 - Pinecone 기반 하이브리드 검색

    데이터 구조:
    - lecturers: 강사 정보 (이름, 과목, 특징, 전문성)
    - courses: 강좌 정보 (강좌명, 목차, 커리큘럼, 교재)
    - success_patterns: 성공 패턴 (학생 사례, 전략)
    - exam_trends: 시험 트렌드 (출제 경향, 난이도)

    검색 방식:
    - Semantic Search: 임베딩 기반 유사도 검색
    - Keyword Extraction: 쿼리에서 핵심 키워드 추출
    - Hybrid: Semantic + Keyword 융합
    """

    def __init__(self):
        self.config = get_config()
        self.index_name = self.config.rag.pinecone.index_name
        self.namespaces = self.config.rag.pinecone.namespaces

        # Pinecone 초기화
        self.pinecone = None
        self.index = None
        if HAS_PINECONE:
            api_key = os.getenv("PINECONE_API_KEY", "")
            if api_key:
                self.pinecone = Pinecone(api_key=api_key)
                try:
                    self.index = self.pinecone.Index(self.index_name)
                except Exception as e:
                    import sys; print(f"⚠️ Pinecone index '{self.index_name}' not found: {e}", file=sys.stderr)

        # OpenAI 호환 임베딩 클라이언트 (OpenRouter 지원)
        self.openai_client = None
        if HAS_OPENAI:
            # OpenRouter API Key 우선, 없으면 OpenAI API Key
            openrouter_key = os.getenv("OPENROUTER_API_KEY", "")
            openai_key = os.getenv("OPENAI_API_KEY", "")
            if openrouter_key:
                # OpenRouter는 임베딩 API를 지원하지 않으므로 Pinecone 자체 임베딩 사용
                self.use_pinecone_embedding = True
                self.openai_client = None
            elif openai_key:
                self.use_pinecone_embedding = False
                self.openai_client = OpenAI(api_key=openai_key)
            else:
                self.use_pinecone_embedding = True
                self.openai_client = None

        # 검색 설정
        self.top_k = self.config.rag.search.top_k
        self.min_score = self.config.rag.search.min_score
        self.semantic_weight = self.config.rag.search.semantic_weight

        # 최적화 설정
        self.max_lecturers = self.config.rag.optimization.max_lecturers
        self.max_courses = self.config.rag.optimization.max_courses
        self.max_patterns = self.config.rag.optimization.max_patterns
        self.max_trends = self.config.rag.optimization.max_trends

    async def search(
        self,
        query: str,
        student_profile: Optional[Dict[str, Any]] = None,
        namespaces: Optional[List[PineconeNamespace]] = None
    ) -> Dict[str, Any]:
        """
        통합 RAG 검색

        Args:
            query: 검색 쿼리
            student_profile: 학생 프로필 (개인화용)
            namespaces: 검색할 네임스페이스 (기본: 모두)

        Returns:
            검색 결과 (lecturers, courses, success_patterns, exam_trends)
        """
        import time
        start_time = time.time()

        if namespaces is None:
            namespaces = list(PineconeNamespace)

        # 쿼리 보강 (학생 프로필 반영)
        enhanced_query = self._enhance_query(query, student_profile)

        # 임베딩 생성
        query_embedding = await self._get_embedding(enhanced_query)

        # 각 네임스페이스 검색
        results = {
            "lecturers": [],
            "courses": [],
            "successPatterns": [],
            "examTrends": []
        }

        if query_embedding and self.index:
            for ns in namespaces:
                ns_results = self._search_namespace(
                    namespace=ns.value,
                    embedding=query_embedding,
                    top_k=self._get_top_k_for_namespace(ns)
                )

                if ns == PineconeNamespace.LECTURERS:
                    results["lecturers"] = ns_results
                elif ns == PineconeNamespace.COURSES:
                    results["courses"] = ns_results
                elif ns == PineconeNamespace.SUCCESS_PATTERNS:
                    results["successPatterns"] = ns_results
                elif ns == PineconeNamespace.EXAM_TRENDS:
                    results["examTrends"] = ns_results

        # 결과 최적화
        results = self._optimize_results(results, student_profile)

        processing_time = int((time.time() - start_time) * 1000)

        return {
            **results,
            "searchMetadata": {
                "query": query,
                "enhancedQuery": enhanced_query,
                "totalResults": sum(len(v) for v in results.values() if isinstance(v, list)),
                "processingTimeMs": processing_time
            }
        }

    async def search_lecturers(
        self,
        subject: str,
        level: Optional[str] = None,
        specialties: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """강사 전용 검색"""
        query = f"{subject} 강사"
        if level:
            query += f" {level}"
        if specialties:
            query += f" {' '.join(specialties)}"

        embedding = await self._get_embedding(query)
        if not embedding or not self.index:
            return []

        results = self._search_namespace(
            namespace=PineconeNamespace.LECTURERS.value,
            embedding=embedding,
            top_k=self.max_lecturers,
            filters=self._build_filters(subject=subject, level=level)
        )

        return results

    async def search_courses(
        self,
        subject: str,
        lecturer: Optional[str] = None,
        level: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """강좌 전용 검색"""
        if not self.index:
            return []

        query = f"{subject} 강좌"
        if lecturer:
            query += f" {lecturer}"
        if level:
            query += f" {level}"

        # 임베딩 시도
        embedding = await self._get_embedding(query)

        # 임베딩 성공 시 벡터 검색
        if embedding:
            results = self._search_namespace(
                namespace=PineconeNamespace.COURSES.value,
                embedding=embedding,
                top_k=self.max_courses * 5,  # 더 많은 결과 가져오기
                filters=self._build_filters(subject=subject)
            )
            # 강사명 필터링 (부분 매칭)
            if lecturer and results:
                results = [r for r in results if lecturer in r.get('lecturerName', '')]
            if results:
                return results[:self.max_courses]

        # 임베딩 실패 시 메타데이터 필터링으로 검색 (리스트 기반)
        return await self._search_by_metadata_extended(
            namespace=PineconeNamespace.COURSES.value,
            subject=subject,
            lecturer=lecturer,
            limit=self.max_courses
        )

    async def _search_by_metadata(
        self,
        namespace: str,
        filters: Dict[str, Any],
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """메타데이터 기반 검색 (임베딩 없이)"""
        if not self.index:
            return []

        try:
            results = []
            vector_ids = []

            # Pinecone list API - generator를 iterate
            for ids_batch in self.index.list(namespace=namespace):
                vector_ids.extend(ids_batch)
                if len(vector_ids) >= limit * 2:
                    break

            vector_ids = vector_ids[:limit * 2]

            # fetch로 메타데이터 조회
            if vector_ids:
                fetch_response = self.index.fetch(ids=vector_ids, namespace=namespace)

                for vec_id, vec_data in fetch_response.vectors.items():
                    metadata = vec_data.metadata or {}

                    # 필터 적용
                    if filters:
                        match = True
                        for key, value in filters.items():
                            if metadata.get(key) != value:
                                match = False
                                break
                        if not match:
                            continue

                    results.append({
                        "id": vec_id,
                        "relevanceScore": 1.0,
                        **metadata
                    })

                    if len(results) >= limit:
                        break

            return results
        except Exception as e:
            import sys; print(f"⚠️ 메타데이터 검색 실패: {e}", file=sys.stderr)
            return []

    async def _search_by_metadata_extended(
        self,
        namespace: str,
        subject: Optional[str] = None,
        lecturer: Optional[str] = None,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """확장 메타데이터 기반 검색 (강사명 부분 매칭 지원)"""
        if not self.index:
            return []

        try:
            results = []
            vector_ids = []

            # 모든 벡터 ID 수집 (강사 검색을 위해 전체 스캔 필요)
            max_scan = 500 if lecturer else limit * 3
            for ids_batch in self.index.list(namespace=namespace):
                vector_ids.extend(ids_batch)
                if len(vector_ids) >= max_scan:
                    break

            # 배치로 fetch
            batch_size = 100
            for i in range(0, len(vector_ids), batch_size):
                batch_ids = vector_ids[i:i+batch_size]
                fetch_response = self.index.fetch(ids=batch_ids, namespace=namespace)

                for vec_id, vec_data in fetch_response.vectors.items():
                    metadata = vec_data.metadata or {}

                    # 과목 필터
                    if subject and metadata.get('subject') != subject:
                        continue

                    # 강사명 부분 매칭 필터
                    if lecturer:
                        lecturer_name = metadata.get('lecturerName', '')
                        if lecturer not in lecturer_name:
                            continue

                    results.append({
                        "id": vec_id,
                        "relevanceScore": 1.0,
                        **metadata
                    })

                    if len(results) >= limit:
                        return results

            return results
        except Exception as e:
            import sys; print(f"⚠️ 확장 메타데이터 검색 실패: {e}", file=sys.stderr)
            return []

    def _enhance_query(
        self,
        query: str,
        student_profile: Optional[Dict[str, Any]] = None
    ) -> str:
        """쿼리 보강 (학생 프로필 반영)"""
        if not student_profile:
            return query

        enhancements = []

        # 학생 수준 반영
        level = student_profile.get("level", "")
        if level:
            enhancements.append(f"{level} 수준")

        # 목표 점수 반영
        target_score = student_profile.get("targetScore", "")
        if target_score:
            enhancements.append(f"목표 {target_score}")

        # 약점 과목 반영
        weak_subjects = student_profile.get("weakSubjects", [])
        if weak_subjects:
            enhancements.append(f"약점: {', '.join(weak_subjects[:2])}")

        if enhancements:
            return f"{query} ({' / '.join(enhancements)})"

        return query

    async def _get_embedding(self, text: str) -> Optional[List[float]]:
        """임베딩 생성 (Pinecone Inference 또는 OpenAI)"""
        # Pinecone Inference API 사용 (우선)
        if hasattr(self, 'use_pinecone_embedding') and self.use_pinecone_embedding and self.pinecone:
            try:
                # Pinecone의 inference API 사용
                embeddings = self.pinecone.inference.embed(
                    model="multilingual-e5-large",
                    inputs=[text],
                    parameters={"input_type": "query"}
                )
                if embeddings and len(embeddings) > 0:
                    return embeddings[0].values
            except Exception as e:
                import sys; print(f"⚠️ Pinecone Embedding 생성 실패: {e}", file=sys.stderr)
                # OpenAI 폴백 시도
                pass

        # OpenAI 폴백
        if self.openai_client:
            try:
                response = self.openai_client.embeddings.create(
                    model="text-embedding-3-small",
                    input=text
                )
                return response.data[0].embedding
            except Exception as e:
                import sys; print(f"⚠️ OpenAI Embedding 생성 실패: {e}", file=sys.stderr)
                return None

        return None

    def _search_namespace(
        self,
        namespace: str,
        embedding: List[float],
        top_k: int,
        filters: Optional[Dict] = None
    ) -> List[Dict[str, Any]]:
        """네임스페이스 검색"""
        if not self.index:
            return []

        try:
            query_params = {
                "vector": embedding,
                "top_k": top_k,
                "namespace": namespace,
                "include_metadata": True
            }

            if filters:
                query_params["filter"] = filters

            results = self.index.query(**query_params)

            return [
                {
                    "id": match.id,
                    "relevanceScore": match.score,
                    **match.metadata
                }
                for match in results.matches
                if match.score >= self.min_score
            ]
        except Exception as e:
            import sys; print(f"⚠️ Pinecone 검색 실패 ({namespace}): {e}", file=sys.stderr)
            return []

    def _get_top_k_for_namespace(self, namespace: PineconeNamespace) -> int:
        """네임스페이스별 top_k 반환"""
        mapping = {
            PineconeNamespace.LECTURERS: self.max_lecturers,
            PineconeNamespace.COURSES: self.max_courses,
            PineconeNamespace.SUCCESS_PATTERNS: self.max_patterns,
            PineconeNamespace.EXAM_TRENDS: self.max_trends
        }
        return mapping.get(namespace, self.top_k)

    def _build_filters(self, **kwargs) -> Optional[Dict]:
        """필터 빌드"""
        filters = {}
        for key, value in kwargs.items():
            if value:
                filters[key] = {"$eq": value}

        return filters if filters else None

    def _optimize_results(
        self,
        results: Dict[str, List],
        student_profile: Optional[Dict[str, Any]] = None
    ) -> Dict[str, List]:
        """결과 최적화 (중복 제거, Top-K 필터링)"""
        # 강사 중복 제거
        seen_lecturers = set()
        unique_lecturers = []
        for l in results.get("lecturers", []):
            name = l.get("name", l.get("lecturerName", ""))
            if name not in seen_lecturers:
                seen_lecturers.add(name)
                unique_lecturers.append(l)
        results["lecturers"] = unique_lecturers[:self.max_lecturers]

        # 강좌 중복 제거
        seen_courses = set()
        unique_courses = []
        for c in results.get("courses", []):
            name = c.get("courseName", c.get("title", ""))
            if name not in seen_courses:
                seen_courses.add(name)
                unique_courses.append(c)
        results["courses"] = unique_courses[:self.max_courses]

        # 성공 패턴 제한
        results["successPatterns"] = results.get("successPatterns", [])[:self.max_patterns]

        # 트렌드 제한
        results["examTrends"] = results.get("examTrends", [])[:self.max_trends]

        return results

    def get_status(self) -> Dict[str, Any]:
        """RAG 핸들러 상태"""
        return {
            "pinecone_available": HAS_PINECONE and self.index is not None,
            "openai_available": self.openai_client is not None,
            "index_name": self.index_name,
            "namespaces": list(self.namespaces.keys()),
            "search_config": {
                "top_k": self.top_k,
                "min_score": self.min_score,
                "semantic_weight": self.semantic_weight
            }
        }
