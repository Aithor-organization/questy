# Curriculum RAG Agent - 메인 에이전트
# ACE Framework V5.2 + Memory Lane + Pinecone RAG + Quest System

import os
import json
import httpx
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from datetime import datetime

from config import get_config, Settings
from .router import SmartRouter, ComplexityLevel, RoutingResult
from .teacher import TeacherBrain, TaskEvaluation, MemoryType
from handlers.quest_manager import QuestManager, Quest, QuestStatus
from handlers.schedule_optimizer import ScheduleOptimizer, RescheduleStrategy


@dataclass
class AgentResponse:
    """에이전트 응답"""
    content: str
    model_used: str
    complexity_level: ComplexityLevel
    rag_context_used: bool
    tokens_used: int
    cost: float
    duration_ms: int
    memory_saved: bool
    memory_type: Optional[MemoryType] = None


class CurriculumRAGAgent:
    """
    커리큘럼 RAG 에이전트

    기능:
    1. 인강 강사 데이터(목차, 커리큘럼, 강사 특징, 교재 목차) 기반 RAG
    2. Memory Lane 통합 (Type-Aware Memory)
    3. Teacher-Student 아키텍처
    4. 복잡도 기반 스마트 라우팅

    설계 원칙:
    - 모든 응답 후 Teacher 평가 (메모리 품질 보장)
    - 즉시 저장 (안정성 보장)
    - 키워드 기반 예측 가능한 라우팅
    """

    def __init__(
        self,
        config: Optional[Settings] = None,
        rag_handler=None,
        memory_lane=None
    ):
        self.config = config or get_config()
        self.router = SmartRouter()
        self.teacher = TeacherBrain()
        self.rag_handler = rag_handler  # 외부에서 주입
        self.memory_lane = memory_lane  # 외부에서 주입

        self.api_key = os.getenv("OPENROUTER_API_KEY", "")
        self.base_url = "https://openrouter.ai/api/v1"

        # 퀘스트 관리
        self.quest_manager = QuestManager()
        self.schedule_optimizer = ScheduleOptimizer(self.quest_manager)

        # 세션 컨텍스트
        self.session_context: Dict[str, Any] = {}
        self.conversation_history: List[Dict[str, str]] = []

    async def run(
        self,
        query: str,
        student_profile: Optional[Dict[str, Any]] = None,
        use_rag: bool = True,
        save_memory: bool = True
    ) -> AgentResponse:
        """
        에이전트 실행

        Args:
            query: 사용자 쿼리
            student_profile: 학생 프로필 (커리큘럼 생성 시)
            use_rag: RAG 사용 여부
            save_memory: 메모리 저장 여부

        Returns:
            AgentResponse: 응답 결과
        """
        start_time = datetime.now()

        # 1. 라우팅
        context = {
            "previous_level": self.session_context.get("last_level"),
            "requires_rag": use_rag,
            "curriculum_mode": "커리큘럼" in query or "계획" in query
        }
        routing = self.router.route(query, context)

        # 2. RAG 컨텍스트 조회
        rag_context = None
        if use_rag and self.rag_handler:
            rag_context = await self._get_rag_context(query, student_profile)

        # 3. Memory Lane 조회
        memory_context = None
        if self.memory_lane:
            memory_context = await self.memory_lane.retrieve(query)

        # 4. 프롬프트 구성
        system_prompt = self._build_system_prompt(rag_context, memory_context, student_profile)
        messages = self._build_messages(query, system_prompt)

        # 5. LLM 호출
        response, tokens, cost = await self._call_llm(
            messages=messages,
            model=routing.model,
            max_tokens=self._get_max_tokens(routing.level)
        )

        # 6. Teacher 평가 (항상!)
        evaluation = await self.teacher.evaluate_task(
            task=query,
            result=response,
            user_message=query
        )

        # 7. Memory Lane 저장
        memory_saved = False
        if save_memory and self.memory_lane:
            await self.memory_lane.save(
                content=response,
                memory_type=evaluation.memory_type,
                context=query,
                confidence=evaluation.confidence,
                insight=evaluation.insight
            )
            memory_saved = True

        # 8. 세션 컨텍스트 업데이트
        self.session_context["last_level"] = routing.level
        self.conversation_history.append({
            "role": "user",
            "content": query
        })
        self.conversation_history.append({
            "role": "assistant",
            "content": response
        })

        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        return AgentResponse(
            content=response,
            model_used=routing.model,
            complexity_level=routing.level,
            rag_context_used=rag_context is not None,
            tokens_used=tokens,
            cost=cost,
            duration_ms=duration_ms,
            memory_saved=memory_saved,
            memory_type=evaluation.memory_type if memory_saved else None
        )

    async def generate_curriculum(
        self,
        student_profile: Dict[str, Any],
        subjects: List[str],
        duration_weeks: int = 12
    ) -> Dict[str, Any]:
        """
        커리큘럼 생성 (Teacher 모델 강제 사용)

        Args:
            student_profile: 학생 프로필
            subjects: 과목 목록
            duration_weeks: 기간 (주)

        Returns:
            생성된 커리큘럼
        """
        # RAG 컨텍스트 조회
        rag_context = None
        if self.rag_handler:
            rag_context = await self._get_rag_context_for_curriculum(
                subjects, student_profile
            )

        # Teacher 강제 사용
        routing = self.router.force_teacher()

        # 커리큘럼 생성 프롬프트
        prompt = self._build_curriculum_prompt(
            student_profile, subjects, duration_weeks, rag_context
        )

        messages = [
            {"role": "system", "content": self.config.system_prefix},
            {"role": "user", "content": prompt}
        ]

        # LLM 호출
        response, _, _ = await self._call_llm(
            messages=messages,
            model=routing.model,
            max_tokens=8192,
            temperature=0.4
        )

        # JSON 파싱
        curriculum = self._extract_curriculum_json(response)

        # Teacher 피드백
        feedback = await self.teacher.generate_curriculum_feedback(
            curriculum, student_profile
        )

        curriculum["_feedback"] = feedback
        curriculum["_metadata"] = {
            "generated_at": datetime.now().isoformat(),
            "model_used": routing.model,
            "rag_used": rag_context is not None
        }

        return curriculum

    async def generate_quests(
        self,
        curriculum_plan: Dict[str, Any],
        course_contents: List[Dict[str, Any]],
        target_date: str,
        daily_study_hours: int = 6
    ) -> Dict[str, Any]:
        """
        커리큘럼과 강좌 목차를 기반으로 퀘스트 생성

        Args:
            curriculum_plan: 커리큘럼 계획 (generate_curriculum 결과)
            course_contents: 강좌 목차 리스트 (RAG에서 조회)
            target_date: 목표일 (YYYY-MM-DD)
            daily_study_hours: 일일 학습 시간

        Returns:
            생성된 퀘스트 정보
        """
        # 퀘스트 생성
        quests = self.quest_manager.generate_quests_from_curriculum(
            curriculum_plan=curriculum_plan,
            course_contents=course_contents,
            target_date=target_date,
            daily_study_hours=daily_study_hours
        )

        # 통계 수집
        stats = self.quest_manager.get_completion_stats()
        schedule = self.quest_manager.export_schedule()

        # Memory Lane에 저장
        if self.memory_lane:
            await self.memory_lane.save(
                content=f"퀘스트 {len(quests)}개 생성 완료. 목표일: {target_date}",
                memory_type=MemoryType.DECISION,
                context="퀘스트 생성",
                confidence=0.9,
                insight=f"일일 {daily_study_hours}시간 학습 기준 스케줄 생성"
            )

        return {
            "quests": [q.to_dict() for q in quests],
            "total_quests": len(quests),
            "target_date": target_date,
            "daily_study_hours": daily_study_hours,
            "stats": stats,
            "schedule_preview": {
                date: {
                    "quest_count": len(s.quests),
                    "total_minutes": s.total_minutes,
                    "is_overloaded": s.is_overloaded
                }
                for date, s in list(self.quest_manager.schedules.items())[:7]  # 첫 7일만
            },
            "generated_at": datetime.now().isoformat()
        }

    async def complete_quest(self, quest_id: str, actual_minutes: Optional[int] = None) -> Dict[str, Any]:
        """
        퀘스트 완료 처리

        Args:
            quest_id: 퀘스트 ID
            actual_minutes: 실제 소요 시간 (분)

        Returns:
            완료된 퀘스트 정보
        """
        quest = self.quest_manager.complete_quest(quest_id, actual_minutes)

        # Memory Lane에 저장
        if self.memory_lane:
            await self.memory_lane.save(
                content=f"퀘스트 완료: {quest.title}",
                memory_type=MemoryType.LEARNING,
                context="퀘스트 완료",
                confidence=0.85,
                insight=f"예상 {quest.estimated_minutes}분, 실제 {actual_minutes or quest.estimated_minutes}분"
            )

        return {
            "quest": quest.to_dict(),
            "stats": self.quest_manager.get_completion_stats()
        }

    async def reschedule_quests(
        self,
        target_date: str,
        daily_study_hours: int = 6,
        strategy: str = "smart"
    ) -> Dict[str, Any]:
        """
        미완료 퀘스트 스케줄 재조정

        Args:
            target_date: 목표일 (YYYY-MM-DD)
            daily_study_hours: 일일 학습 시간
            strategy: 재조정 전략 (smart, spread, priority, front_load, back_load)

        Returns:
            재조정 결과
        """
        # 전략 변환
        strategy_map = {
            "smart": RescheduleStrategy.SMART,
            "spread": RescheduleStrategy.SPREAD,
            "priority": RescheduleStrategy.PRIORITY_FIRST,
            "front_load": RescheduleStrategy.FRONT_LOAD,
            "back_load": RescheduleStrategy.BACK_LOAD
        }
        reschedule_strategy = strategy_map.get(strategy, RescheduleStrategy.SMART)

        # 재조정 실행
        result = self.schedule_optimizer.reschedule_overdue(
            target_date=target_date,
            daily_study_hours=daily_study_hours,
            strategy=reschedule_strategy
        )

        # Memory Lane에 저장 (교정 메모리로)
        if self.memory_lane and result.rescheduled_quests:
            await self.memory_lane.save(
                content=f"퀘스트 {len(result.rescheduled_quests)}개 재조정 완료",
                memory_type=MemoryType.CORRECTION,
                context="스케줄 재조정",
                confidence=0.85,
                insight=f"전략: {strategy}, 성공: {result.success}"
            )

        return {
            "success": result.success,
            "strategy_used": result.strategy_used.value,
            "rescheduled_count": len(result.rescheduled_quests),
            "original_dates": result.original_dates,
            "warnings": result.warnings,
            "daily_overload": result.daily_overload,
            "new_schedule_preview": {
                date: {
                    "quest_count": len(s.quests),
                    "total_minutes": s.total_minutes,
                    "is_overloaded": s.is_overloaded
                }
                for date, s in list(result.new_schedules.items())[:7]
            },
            "metadata": result.metadata
        }

    def get_today_quests(self) -> List[Dict[str, Any]]:
        """오늘의 퀘스트 조회"""
        today = datetime.now().strftime("%Y-%m-%d")
        quests = self.quest_manager.get_quests_by_date(today)
        return [q.to_dict() for q in quests]

    def get_overdue_quests(self) -> List[Dict[str, Any]]:
        """미완료 퀘스트 조회"""
        quests = self.quest_manager.get_overdue_quests()
        return [q.to_dict() for q in quests]

    def get_catch_up_plan(self, target_date: str, extra_hours: int = 2) -> Dict[str, Any]:
        """따라잡기 계획 조회"""
        return self.schedule_optimizer.suggest_catch_up_plan(
            target_date=target_date,
            extra_hours_per_day=extra_hours
        )

    def get_quest_stats(self) -> Dict[str, Any]:
        """퀘스트 통계 조회"""
        return self.quest_manager.get_completion_stats()

    async def _get_rag_context(
        self,
        query: str,
        student_profile: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """RAG 컨텍스트 조회"""
        if not self.rag_handler:
            return None

        try:
            return await self.rag_handler.search(
                query=query,
                student_profile=student_profile
            )
        except Exception as e:
            import sys; print(f"⚠️ RAG 조회 실패: {e}", file=sys.stderr)
            return None

    async def _get_rag_context_for_curriculum(
        self,
        subjects: List[str],
        student_profile: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """커리큘럼용 RAG 컨텍스트 조회"""
        if not self.rag_handler:
            return None

        try:
            # 과목별 강사/강좌 조회
            results = {}
            for subject in subjects:
                query = f"{subject} 강사 추천 {student_profile.get('level', '')}"
                result = await self.rag_handler.search(query=query)
                results[subject] = result

            return {
                "by_subject": results,
                "combined_lecturers": self._merge_lecturers(results),
                "combined_courses": self._merge_courses(results)
            }
        except Exception as e:
            import sys; print(f"⚠️ 커리큘럼 RAG 조회 실패: {e}", file=sys.stderr)
            return None

    def _merge_lecturers(self, results: Dict) -> List[Dict]:
        """과목별 강사 결과 병합"""
        all_lecturers = []
        seen = set()
        for subject_result in results.values():
            if subject_result and "lecturers" in subject_result:
                for lecturer in subject_result["lecturers"]:
                    if lecturer.get("name") not in seen:
                        seen.add(lecturer.get("name"))
                        all_lecturers.append(lecturer)
        return all_lecturers

    def _merge_courses(self, results: Dict) -> List[Dict]:
        """과목별 강좌 결과 병합"""
        all_courses = []
        seen = set()
        for subject_result in results.values():
            if subject_result and "courses" in subject_result:
                for course in subject_result["courses"]:
                    if course.get("courseName") not in seen:
                        seen.add(course.get("courseName"))
                        all_courses.append(course)
        return all_courses

    def _build_system_prompt(
        self,
        rag_context: Optional[Dict],
        memory_context: Optional[Dict],
        student_profile: Optional[Dict]
    ) -> str:
        """시스템 프롬프트 구성"""
        prompt_parts = [self.config.system_prefix]

        # RAG 컨텍스트 추가
        if rag_context:
            rag_section = self._format_rag_context(rag_context)
            prompt_parts.append(rag_section)

        # 메모리 컨텍스트 추가
        if memory_context and memory_context.get("memories"):
            memory_section = self._format_memory_context(memory_context)
            prompt_parts.append(memory_section)

        # 학생 프로필 추가
        if student_profile:
            profile_section = f"\n## 🎓 학생 프로필\n{json.dumps(student_profile, ensure_ascii=False, indent=2)}"
            prompt_parts.append(profile_section)

        return "\n\n".join(prompt_parts)

    def _format_rag_context(self, rag_context: Dict) -> str:
        """RAG 컨텍스트 포맷팅"""
        template = self.config.rag_context_template
        if not template:
            template = """## 📚 관련 강사 정보
{lecturers}

## 📖 관련 강좌 정보
{courses}

## ✅ 성공 패턴
{success_patterns}

## 📊 시험 트렌드
{exam_trends}"""

        return template.format(
            lecturers=self._format_list(rag_context.get("lecturers", [])),
            courses=self._format_list(rag_context.get("courses", [])),
            success_patterns=self._format_list(rag_context.get("successPatterns", [])),
            exam_trends=self._format_list(rag_context.get("examTrends", []))
        )

    def _format_memory_context(self, memory_context: Dict) -> str:
        """메모리 컨텍스트 포맷팅"""
        memories = memory_context.get("memories", [])
        if not memories:
            return ""

        lines = ["## 🧠 관련 기억"]
        for mem in memories[:5]:  # 최대 5개
            mem_type = mem.get("type", "learning")
            content = mem.get("content", "")[:200]
            lines.append(f"- [{mem_type}] {content}")

        return "\n".join(lines)

    def _format_list(self, items: List[Dict]) -> str:
        """리스트 포맷팅"""
        if not items:
            return "없음"
        return "\n".join(
            f"- {json.dumps(item, ensure_ascii=False)}" for item in items[:5]
        )

    def _build_messages(self, query: str, system_prompt: str) -> List[Dict[str, str]]:
        """메시지 구성"""
        messages = [{"role": "system", "content": system_prompt}]

        # 최근 대화 히스토리 추가 (최대 4개)
        for msg in self.conversation_history[-4:]:
            messages.append(msg)

        messages.append({"role": "user", "content": query})
        return messages

    def _build_curriculum_prompt(
        self,
        student_profile: Dict,
        subjects: List[str],
        duration_weeks: int,
        rag_context: Optional[Dict]
    ) -> str:
        """커리큘럼 생성 프롬프트 구성"""
        prompt = f"""다음 학생을 위한 {duration_weeks}주 학습 커리큘럼을 생성해주세요.

## 학생 프로필
{json.dumps(student_profile, ensure_ascii=False, indent=2)}

## 대상 과목
{', '.join(subjects)}

## 기간
{duration_weeks}주

"""
        if rag_context:
            prompt += f"""## 참고 가능한 강사/강좌 정보
{json.dumps(rag_context, ensure_ascii=False, indent=2)[:3000]}

"""

        prompt += """## 출력 형식 (JSON)
```json
{
    "curriculum": {
        "title": "커리큘럼 제목",
        "duration_weeks": 숫자,
        "subjects": [
            {
                "name": "과목명",
                "weekly_hours": 숫자,
                "recommended_lecturers": ["강사1", "강사2"],
                "recommended_courses": ["강좌1", "강좌2"],
                "weekly_plan": [
                    {
                        "week": 1,
                        "topics": ["주제1", "주제2"],
                        "goals": ["목표1"]
                    }
                ]
            }
        ],
        "daily_routine": {
            "weekday": {"study_hours": 숫자, "schedule": "설명"},
            "weekend": {"study_hours": 숫자, "schedule": "설명"}
        },
        "key_milestones": ["마일스톤1", "마일스톤2"],
        "personalization_notes": "학생 특성에 맞춘 조언"
    }
}
```

위 형식에 맞게 JSON만 출력해주세요."""

        return prompt

    def _extract_curriculum_json(self, response: str) -> Dict[str, Any]:
        """커리큘럼 JSON 추출"""
        # JSON 블록 찾기
        if "```json" in response:
            start = response.find("```json") + 7
            end = response.find("```", start)
            json_str = response[start:end].strip()
        elif "```" in response:
            start = response.find("```") + 3
            end = response.find("```", start)
            json_str = response[start:end].strip()
        else:
            # { } 찾기
            start = response.find("{")
            end = response.rfind("}") + 1
            json_str = response[start:end] if start >= 0 else "{}"

        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            return {"error": "JSON 파싱 실패", "raw": response[:500]}

    def _get_max_tokens(self, level: ComplexityLevel) -> int:
        """복잡도에 따른 최대 토큰 수"""
        if level == ComplexityLevel.SIMPLE:
            return 500
        elif level == ComplexityLevel.MEDIUM:
            return 2000
        else:
            return 4000

    async def _call_llm(
        self,
        messages: List[Dict[str, str]],
        model: str,
        max_tokens: int = 2000,
        temperature: float = 0.7
    ) -> tuple[str, int, float]:
        """LLM API 호출"""
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY not set")

        timeout = httpx.Timeout(
            connect=10.0,
            read=120.0,
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
                    "model": model,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature
                }
            )

            if response.status_code != 200:
                raise Exception(f"API error: {response.status_code}")

            data = response.json()
            content = data["choices"][0]["message"]["content"]

            # 토큰 및 비용 계산
            usage = data.get("usage", {})
            total_tokens = usage.get("total_tokens", 0)
            # 대략적인 비용 계산 (모델별로 다름)
            cost = total_tokens * 0.00001  # 대략적인 추정

            return content, total_tokens, cost

    def clear_session(self):
        """세션 초기화"""
        self.session_context = {}
        self.conversation_history = []

    def get_session_stats(self) -> Dict[str, Any]:
        """세션 통계"""
        return {
            "conversation_length": len(self.conversation_history),
            "last_level": self.session_context.get("last_level"),
            "has_rag_handler": self.rag_handler is not None,
            "has_memory_lane": self.memory_lane is not None
        }
