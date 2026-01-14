# Teacher Brain - 평가 및 메모리 유형 분류
# ACE Framework V5.2 - Memory Lane 통합

import os
import json
import httpx
from enum import Enum
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from datetime import datetime

from config import get_config


class MemoryType(Enum):
    """메모리 유형 (Teacher가 분류)"""
    CORRECTION = "correction"   # 사용자 수정 요청
    DECISION = "decision"       # 명시적 결정
    INSIGHT = "insight"         # 새로운 깨달음
    PATTERN = "pattern"         # 반복되는 행동/선호
    GAP = "gap"                 # 실패/누락된 기능
    LEARNING = "learning"       # 일반 학습 (기본값)


@dataclass
class MemoryTypeClassification:
    """메모리 유형 분류 결과"""
    memory_type: MemoryType
    confidence: float
    reason: str


@dataclass
class TaskEvaluation:
    """작업 평가 결과"""
    success: bool
    insight: str
    reason: str
    memory_type: MemoryType
    confidence: float
    raw_response: Optional[str] = None


class TeacherBrain:
    """
    Teacher Brain - GPT-5.2 기반 평가 및 분류

    핵심 역할:
    1. 작업 결과 평가 (성공/실패)
    2. 인사이트 추출
    3. 메모리 유형 분류 (90%+ 정확도)

    설계 철학:
    - 모든 평가는 Teacher가 담당 (메모리 오염 방지)
    - 저렴한 모델로 평가하면 잘못된 메모리 축적
    - 추가 비용 10-15%는 메모리 품질로 보상됨
    """

    ANALYZE_PROMPT = """Analyze this task execution. Output JSON only:
{
    "success": true/false,
    "insight": "Key lesson learned (1 sentence max, Korean)",
    "reason": "Brief explanation (Korean)",
    "memory_type": "type from list below",
    "confidence": 0.0-1.0
}

Memory Types (choose ONE most appropriate):
- "correction": 사용자가 수정/변경 요청함 (예: "아니, X 말고 Y로 해줘")
- "decision": 명시적 결정이 내려짐 (예: "PostgreSQL 쓰기로 결정했어")
- "insight": 새로운 깨달음/학습 (예: "TDD가 버그를 줄인다는 걸 배웠어")
- "pattern": 반복되는 행동/선호 감지 (예: "항상 타입스크립트 사용")
- "gap": 시스템 실패/기능 누락 (예: "PDF 읽기 실패")
- "learning": 일반 학습/정보 (기본값)

Task: {task}
Result: {result}
User Message: {user_message}"""

    def __init__(self):
        self.config = get_config()
        self.api_key = os.getenv("OPENROUTER_API_KEY", "")
        self.base_url = "https://openrouter.ai/api/v1"
        self.model = self.config.models.teacher

    async def evaluate_task(
        self,
        task: str,
        result: str,
        user_message: Optional[str] = None
    ) -> TaskEvaluation:
        """
        작업 결과 평가 및 메모리 유형 분류

        Args:
            task: 수행한 작업
            result: 작업 결과
            user_message: 사용자 원본 메시지 (분류 정확도 향상)

        Returns:
            TaskEvaluation: 평가 결과
        """
        prompt = self.ANALYZE_PROMPT.format(
            task=task,
            result=result[:1000],  # 토큰 제한
            user_message=user_message or "N/A"
        )

        try:
            response = await self._call_llm(prompt)
            return self._parse_evaluation(response)
        except Exception as e:
            # 실패 시 기본값 반환
            return TaskEvaluation(
                success=False,
                insight=f"평가 실패: {str(e)}",
                reason="Teacher 호출 실패",
                memory_type=MemoryType.GAP,
                confidence=0.3,
                raw_response=str(e)
            )

    async def classify_memory_type(
        self,
        content: str,
        context: Optional[str] = None
    ) -> MemoryTypeClassification:
        """
        콘텐츠의 메모리 유형만 분류 (간단한 분류)

        Args:
            content: 분류할 콘텐츠
            context: 추가 컨텍스트

        Returns:
            MemoryTypeClassification: 분류 결과
        """
        prompt = f"""Classify this content into ONE memory type. Output JSON only:
{{
    "memory_type": "type from list",
    "confidence": 0.0-1.0,
    "reason": "Brief reason (Korean)"
}}

Memory Types:
- correction: 수정/변경
- decision: 결정
- insight: 깨달음
- pattern: 반복 패턴
- gap: 실패/누락
- learning: 일반 학습

Content: {content[:500]}
Context: {context or 'N/A'}"""

        try:
            response = await self._call_llm(prompt, max_tokens=200)
            data = self._extract_json(response)

            memory_type = MemoryType(data.get("memory_type", "learning"))
            return MemoryTypeClassification(
                memory_type=memory_type,
                confidence=data.get("confidence", 0.7),
                reason=data.get("reason", "")
            )
        except Exception as e:
            return MemoryTypeClassification(
                memory_type=MemoryType.LEARNING,
                confidence=0.5,
                reason=f"분류 실패: {str(e)}"
            )

    async def generate_curriculum_feedback(
        self,
        curriculum: Dict[str, Any],
        student_profile: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        생성된 커리큘럼에 대한 Teacher 피드백

        Args:
            curriculum: 생성된 커리큘럼
            student_profile: 학생 프로필

        Returns:
            피드백 및 개선점
        """
        prompt = f"""Evaluate this curriculum for the student. Output JSON:
{{
    "quality_score": 0-100,
    "strengths": ["strength1", "strength2"],
    "improvements": ["improvement1", "improvement2"],
    "personalization_score": 0-100,
    "recommendation": "Brief recommendation (Korean)"
}}

Student Profile:
{json.dumps(student_profile, ensure_ascii=False, indent=2)}

Curriculum:
{json.dumps(curriculum, ensure_ascii=False, indent=2)[:3000]}"""

        try:
            response = await self._call_llm(prompt, max_tokens=800)
            return self._extract_json(response)
        except Exception as e:
            return {
                "quality_score": 0,
                "error": str(e),
                "recommendation": "평가 실패"
            }

    async def _call_llm(
        self,
        prompt: str,
        max_tokens: int = 500,
        temperature: float = 0.3
    ) -> str:
        """OpenRouter API 호출"""
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY not set")

        timeout = httpx.Timeout(
            connect=10.0,
            read=60.0,
            write=10.0,
            pool=10.0
        )

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://questy.kr",
                    "X-Title": "Curriculum RAG Agent"
                },
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": "You are an expert evaluator. Output JSON only."},
                        {"role": "user", "content": prompt}
                    ],
                    "max_tokens": max_tokens,
                    "temperature": temperature
                }
            )

            if response.status_code != 200:
                raise Exception(f"API error: {response.status_code} - {response.text}")

            data = response.json()
            return data["choices"][0]["message"]["content"]

    def _parse_evaluation(self, response: str) -> TaskEvaluation:
        """평가 응답 파싱"""
        data = self._extract_json(response)

        memory_type_str = data.get("memory_type", "learning")
        try:
            memory_type = MemoryType(memory_type_str)
        except ValueError:
            memory_type = MemoryType.LEARNING

        return TaskEvaluation(
            success=data.get("success", True),
            insight=data.get("insight", ""),
            reason=data.get("reason", ""),
            memory_type=memory_type,
            confidence=data.get("confidence", 0.7),
            raw_response=response
        )

    def _extract_json(self, text: str) -> Dict[str, Any]:
        """텍스트에서 JSON 추출"""
        # JSON 블록 찾기
        if "```json" in text:
            start = text.find("```json") + 7
            end = text.find("```", start)
            text = text[start:end].strip()
        elif "```" in text:
            start = text.find("```") + 3
            end = text.find("```", start)
            text = text[start:end].strip()

        # 직접 파싱 시도
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # { } 사이 추출
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(text[start:end])
                except json.JSONDecodeError:
                    pass

        return {}

    def get_model_info(self) -> Dict[str, str]:
        """현재 Teacher 모델 정보"""
        return {
            "model": self.model,
            "role": "Teacher (평가/분류)",
            "capabilities": "작업 평가, 메모리 유형 분류, 커리큘럼 피드백"
        }
