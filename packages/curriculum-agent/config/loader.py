# 설정 로더 - YAML 기반 설정 관리
import os
import yaml
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

# ============================================
# 설정 데이터클래스
# ============================================

@dataclass
class ModelConfig:
    teacher: str = "openai/gpt-5.2"
    student_medium: str = "openai/gpt-5-mini"
    student_fast: str = "openai/gpt-5-nano"
    vision: str = "google/gemini-3-flash-preview"


@dataclass
class PineconeConfig:
    index_name: str = "questy-curriculum"
    namespaces: Dict[str, str] = field(default_factory=lambda: {
        "lecturers": "lecturers",
        "courses": "courses",
        "success_patterns": "success_patterns",
        "exam_trends": "exam_trends"
    })


@dataclass
class SearchConfig:
    top_k: int = 10
    min_score: float = 0.5
    semantic_weight: float = 0.7
    keyword_weight: float = 0.3
    enable_hybrid: bool = True


@dataclass
class RAGOptimizationConfig:
    max_lecturers: int = 5
    max_courses: int = 8
    max_patterns: int = 3
    max_trends: int = 4
    min_relevance_score: float = 0.3
    max_token_budget: int = 1500


@dataclass
class RAGConfig:
    pinecone: PineconeConfig = field(default_factory=PineconeConfig)
    search: SearchConfig = field(default_factory=SearchConfig)
    optimization: RAGOptimizationConfig = field(default_factory=RAGOptimizationConfig)


@dataclass
class MemoryStorageConfig:
    type: str = "chromadb"
    path: str = "./memory_store"
    collection_name: str = "curriculum_memory"


@dataclass
class RerankingConfig:
    vector_similarity: float = 0.55
    recency: float = 0.15
    confidence: float = 0.15
    type_boost: float = 0.15


@dataclass
class MemoryConfig:
    storage: MemoryStorageConfig = field(default_factory=MemoryStorageConfig)
    types: List[str] = field(default_factory=lambda: [
        "correction", "decision", "insight", "pattern", "gap", "learning"
    ])
    reranking: RerankingConfig = field(default_factory=RerankingConfig)


@dataclass
class RouterConfig:
    thresholds: Dict[str, float] = field(default_factory=lambda: {
        "simple": 0.3,
        "medium": 0.7,
        "complex": 1.0
    })


@dataclass
class CurriculumConfig:
    mode: str = "two_stage"


@dataclass
class ObservabilityConfig:
    logging_level: str = "INFO"
    metrics_enabled: bool = True
    cost_tracking_enabled: bool = True


@dataclass
class APIConfig:
    timeout_default: int = 30000
    timeout_complex: int = 120000
    retry_max_attempts: int = 3
    retry_backoff_multiplier: float = 1.5


@dataclass
class Settings:
    """전체 설정 컨테이너"""
    models: ModelConfig = field(default_factory=ModelConfig)
    rag: RAGConfig = field(default_factory=RAGConfig)
    memory: MemoryConfig = field(default_factory=MemoryConfig)
    router: RouterConfig = field(default_factory=RouterConfig)
    curriculum: CurriculumConfig = field(default_factory=CurriculumConfig)
    observability: ObservabilityConfig = field(default_factory=ObservabilityConfig)
    api: APIConfig = field(default_factory=APIConfig)

    # 프롬프트
    system_prefix: str = ""
    rag_context_template: str = ""


# ============================================
# 글로벌 설정 인스턴스
# ============================================

_settings: Optional[Settings] = None


def load_config(config_path: Optional[str] = None) -> Settings:
    """YAML 설정 파일 로드"""
    global _settings

    if config_path is None:
        # 기본 경로: config/settings.yaml
        base_dir = Path(__file__).parent.parent
        config_path = base_dir / "config" / "settings.yaml"
    else:
        config_path = Path(config_path)

    if not config_path.exists():
        import sys; print(f"⚠️ 설정 파일 없음: {config_path}, 기본값 사용", file=sys.stderr)
        _settings = Settings()
        return _settings

    with open(config_path, 'r', encoding='utf-8') as f:
        raw_config = yaml.safe_load(f)

    _settings = _parse_config(raw_config)
    return _settings


def _parse_config(raw: Dict[str, Any]) -> Settings:
    """원시 YAML 딕셔너리를 Settings로 변환"""
    settings = Settings()

    # 모델 설정
    if "models" in raw:
        m = raw["models"]
        settings.models = ModelConfig(
            teacher=m.get("teacher", settings.models.teacher),
            student_medium=m.get("student_medium", settings.models.student_medium),
            student_fast=m.get("student_fast", settings.models.student_fast),
            vision=m.get("vision", settings.models.vision)
        )

    # RAG 설정
    if "rag" in raw:
        r = raw["rag"]
        pinecone = PineconeConfig()
        if "pinecone" in r:
            pinecone.index_name = r["pinecone"].get("index_name", pinecone.index_name)
            pinecone.namespaces = r["pinecone"].get("namespaces", pinecone.namespaces)

        search = SearchConfig()
        if "search" in r:
            s = r["search"]
            search.top_k = s.get("top_k", search.top_k)
            search.min_score = s.get("min_score", search.min_score)
            search.semantic_weight = s.get("semantic_weight", search.semantic_weight)
            search.keyword_weight = s.get("keyword_weight", search.keyword_weight)
            search.enable_hybrid = s.get("enable_hybrid", search.enable_hybrid)

        optimization = RAGOptimizationConfig()
        if "optimization" in r:
            o = r["optimization"]
            optimization.max_lecturers = o.get("max_lecturers", optimization.max_lecturers)
            optimization.max_courses = o.get("max_courses", optimization.max_courses)
            optimization.max_patterns = o.get("max_patterns", optimization.max_patterns)
            optimization.max_trends = o.get("max_trends", optimization.max_trends)
            optimization.min_relevance_score = o.get("min_relevance_score", optimization.min_relevance_score)
            optimization.max_token_budget = o.get("max_token_budget", optimization.max_token_budget)

        settings.rag = RAGConfig(pinecone=pinecone, search=search, optimization=optimization)

    # Memory 설정
    if "memory" in raw:
        mem = raw["memory"]
        storage = MemoryStorageConfig()
        if "storage" in mem:
            st = mem["storage"]
            storage.type = st.get("type", storage.type)
            storage.path = st.get("path", storage.path)
            storage.collection_name = st.get("collection_name", storage.collection_name)

        reranking = RerankingConfig()
        if "reranking" in mem:
            rr = mem["reranking"]
            reranking.vector_similarity = rr.get("vector_similarity", reranking.vector_similarity)
            reranking.recency = rr.get("recency", reranking.recency)
            reranking.confidence = rr.get("confidence", reranking.confidence)
            reranking.type_boost = rr.get("type_boost", reranking.type_boost)

        settings.memory = MemoryConfig(
            storage=storage,
            types=mem.get("types", settings.memory.types),
            reranking=reranking
        )

    # Router 설정
    if "router" in raw:
        settings.router = RouterConfig(
            thresholds=raw["router"].get("thresholds", settings.router.thresholds)
        )

    # Curriculum 설정
    if "curriculum" in raw:
        settings.curriculum = CurriculumConfig(
            mode=raw["curriculum"].get("mode", settings.curriculum.mode)
        )

    # 프롬프트
    if "prompts" in raw:
        settings.system_prefix = raw["prompts"].get("system_prefix", "")
        settings.rag_context_template = raw["prompts"].get("rag_context_template", "")

    return settings


def get_config() -> Settings:
    """현재 설정 반환 (없으면 로드)"""
    global _settings
    if _settings is None:
        return load_config()
    return _settings


def get_env(key: str, default: str = "") -> str:
    """환경변수 조회 with 기본값"""
    return os.getenv(key, default)
