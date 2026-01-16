# Curriculum RAG Agent - 진입점
# ACE Framework V5.2 with Memory Lane Architecture

import asyncio
import os
import sys
import json
import argparse
from dotenv import load_dotenv

from core import CurriculumRAGAgent
from handlers import QuestManager, RAGHandler
from config import get_config


# 환경 변수 로드
load_dotenv()


async def main():
    """메인 진입점"""
    print("=" * 60)
    print("🎓 Curriculum RAG Agent - ACE Framework V5.2")
    print("=" * 60)

    # 설정 확인
    config = get_config()
    print(f"\n📋 Configuration:")
    print(f"  - Teacher Model: {config.models.teacher}")
    print(f"  - Student Medium: {config.models.student_medium}")
    print(f"  - Student Fast: {config.models.student_fast}")
    print(f"  - Pinecone Index: {config.rag.pinecone.index_name}")

    # 에이전트 초기화
    agent = CurriculumRAGAgent()
    status = agent.get_status()

    print(f"\n🔧 Agent Status:")
    print(f"  - RAG Handler: {'✅' if status.get('rag_available') else '❌'}")
    print(f"  - Memory Lane: {'✅' if status.get('memory_available') else '❌'}")
    print(f"  - OpenRouter: {'✅' if status.get('openrouter_available') else '❌'}")

    # 대화형 모드
    print("\n" + "=" * 60)
    print("💬 Interactive Mode (type 'exit' to quit)")
    print("=" * 60)

    while True:
        try:
            user_input = input("\n👤 You: ").strip()

            if not user_input:
                continue

            if user_input.lower() in ["exit", "quit", "q"]:
                print("\n👋 Goodbye!")
                break

            # 커리큘럼 생성 명령
            if user_input.startswith("/curriculum"):
                await handle_curriculum_command(agent, user_input)
                continue

            # 상태 확인 명령
            if user_input == "/status":
                print_status(agent)
                continue

            # 도움말
            if user_input == "/help":
                print_help()
                continue

            # 일반 대화
            response = await agent.run(user_input)
            print(f"\n🤖 Agent: {response.content}")

            if response.metadata:
                print(f"   📊 Complexity: {response.metadata.get('complexity', 'unknown')}")
                print(f"   🧠 Model: {response.metadata.get('model_used', 'unknown')}")

        except KeyboardInterrupt:
            print("\n\n👋 Interrupted. Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")


async def handle_curriculum_command(agent: CurriculumRAGAgent, command: str):
    """커리큘럼 생성 명령 처리"""
    print("\n📝 Curriculum Generation Mode")

    # 간단한 프로필 입력
    print("\n학생 프로필을 입력하세요:")

    level = input("  수준 (초급/중급/고급): ").strip() or "중급"
    target = input("  목표 등급 (예: 1등급): ").strip() or "2등급"
    subjects_input = input("  과목 (쉼표로 구분, 예: 국어,수학,영어): ").strip() or "국어,수학,영어"
    hours = input("  일일 학습 시간 (기본 10, 최대 14): ").strip() or "10"
    weeks = input("  학습 기간 주 (기본 12): ").strip() or "12"

    subjects = [s.strip() for s in subjects_input.split(",")]

    student_profile = {
        "level": level,
        "targetScore": target,
        "dailyStudyHours": int(hours),
        "learningStyle": "청각적"  # 기본값
    }

    print("\n⏳ 커리큘럼 생성 중...")

    result = await agent.generate_curriculum(
        student_profile=student_profile,
        subjects=subjects,
        duration_weeks=int(weeks)
    )

    # 결과 출력
    curriculum = result.get("curriculum", {})
    recommendations = result.get("recommendations", {})

    print("\n" + "=" * 60)
    print(f"📚 {curriculum.get('title', 'Generated Curriculum')}")
    print("=" * 60)

    # 과목별 계획
    print("\n📋 과목별 계획:")
    for subj in curriculum.get("subjects", []):
        weak_mark = "⚠️" if subj.get("is_weak_subject") else ""
        print(f"\n  [{subj['name']}] {weak_mark}")
        print(f"    주당 시간: {subj['weekly_hours']}시간")
        print(f"    추천 강사: {', '.join(subj.get('recommended_lecturers', []))}")
        print(f"    집중 영역: {', '.join(subj.get('focus_areas', []))}")

    # 일일 루틴
    daily = curriculum.get("daily_routine", {})
    if daily:
        print("\n📅 일일 루틴:")
        weekday = daily.get("weekday", {})
        weekend = daily.get("weekend", {})
        print(f"  평일: {weekday.get('schedule', 'N/A')}")
        print(f"  주말: {weekend.get('schedule', 'N/A')}")

    # 마일스톤
    milestones = curriculum.get("key_milestones", [])
    if milestones:
        print("\n🎯 마일스톤:")
        for m in milestones:
            print(f"  - {m}")

    # 개인화 노트
    notes = curriculum.get("personalization_notes", "")
    if notes:
        print(f"\n💡 개인화 팁: {notes}")

    # 추천 강사
    lecturers = recommendations.get("lecturers", [])
    if lecturers:
        print("\n👨‍🏫 추천 강사:")
        for l in lecturers[:3]:
            print(f"  - {l.get('name', 'N/A')} ({l.get('subject', 'N/A')})")

    print("\n" + "=" * 60)


def print_status(agent: CurriculumRAGAgent):
    """상태 출력"""
    status = agent.get_status()
    memory_stats = status.get("memory_stats", {})

    print("\n📊 Agent Status:")
    print(f"  RAG: {'✅' if status.get('rag_available') else '❌'}")
    print(f"  Memory: {'✅' if status.get('memory_available') else '❌'}")
    print(f"  OpenRouter: {'✅' if status.get('openrouter_available') else '❌'}")
    print(f"\n🧠 Memory Stats:")
    print(f"  Total Memories: {memory_stats.get('total_memories', 0)}")
    print(f"  Storage Type: {memory_stats.get('storage_type', 'unknown')}")


def print_help():
    """도움말 출력"""
    print("""
📖 Available Commands:
  /curriculum  - Generate a personalized curriculum
  /status      - Show agent status
  /help        - Show this help message
  exit         - Exit the agent

💡 Tips:
  - Ask about lecturer recommendations
  - Request study strategies for specific subjects
  - Get exam preparation advice
    """)


# ===== CLI 인터페이스 (백엔드 호출용) =====

async def cli_search_courses(params: dict) -> dict:
    """강좌 검색 CLI 핸들러"""
    rag_handler = RAGHandler()

    query = params.get("query", "")
    subject = params.get("subject")
    limit = params.get("limit", 20)

    # RAG 검색 수행
    if subject:
        courses = await rag_handler.search_courses(
            subject=subject,
            lecturer=params.get("lecturer"),
            level=params.get("level")
        )
    else:
        # 일반 쿼리 검색
        results = await rag_handler.search(query=query)
        courses = results.get("courses", [])

    # 결과 제한
    courses = courses[:limit]

    return {
        "success": True,
        "courses": courses,
        "count": len(courses)
    }


def calculate_daily_usage_from_existing_plans(existing_plans: list) -> dict:
    """
    기존 플랜에서 일별 시간 사용량 계산

    Args:
        existing_plans: 프론트엔드에서 전달된 기존 플랜 정보
            [{ id, materialName, dailyQuests: [{ date, estimatedMinutes, completed, unitTitle }] }]

    Returns:
        일별 사용 시간 딕셔너리 {"2025-01-20": 120, "2025-01-21": 90, ...}
    """
    daily_usage = {}

    for plan in existing_plans:
        daily_quests = plan.get("dailyQuests", [])
        for quest in daily_quests:
            date = quest.get("date")
            # 완료되지 않은 퀘스트만 계산 (완료된 것은 이미 끝난 것이므로 제외)
            if date and not quest.get("completed", False):
                minutes = quest.get("estimatedMinutes", 0)
                if date not in daily_usage:
                    daily_usage[date] = 0
                daily_usage[date] += minutes

    return daily_usage


async def cli_generate_quests(params: dict) -> dict:
    """퀘스트 생성 CLI 핸들러

    PlannerAgent 학습 전략 통합:
    - 80% 법칙: 가용 시간의 80%만 계획 (버퍼 확보)
    - 5일 단위 운영법: 월~금 5일 안에 일주일 분량
    - 자동 필터링: 선택된 강좌가 있는 과목만 시간 배분에 포함

    스마트 스케줄링 (기존 플랜 고려):
    - 기존 플랜의 일별 시간 사용량 계산
    - 남은 가용 시간 내에서만 새 퀘스트 배치
    """
    rag_handler = RAGHandler()
    quest_manager = QuestManager()

    course_ids = params.get("course_ids", [])
    target_date = params.get("target_date")
    daily_study_hours = params.get("daily_study_hours", 10)  # 기본 10시간
    subject_ratio = params.get("subject_ratio", {
        "국어": 20,
        "영어": 25,
        "수학": 35,
        "한국사": 5,
        "탐구": 15
    })

    # 새로운 옵션들
    subject_hours = params.get("subject_hours")  # 과목별 시간 (시간 단위)
    options = params.get("options", {})  # 커리큘럼 옵션
    include_ot = options.get("include_ot", False)
    review_settings = options.get("review_settings", {
        "enabled": True,
        "same_day_review": True,
        "review_duration": 15
    })
    custom_schedule = options.get("custom_schedule", [])

    # 학습 전략 옵션 (PlannerAgent 전략 통합)
    learning_strategies = params.get("learning_strategies", {
        "apply_buffer": True,      # 80% 법칙: 가용 시간의 80%만 계획
        "five_day_cycle": False    # 5일 단위 운영법
    })

    # 기존 플랜 정보 (스마트 스케줄링용)
    existing_plans = params.get("existing_plans", [])
    daily_existing_usage = calculate_daily_usage_from_existing_plans(existing_plans)

    # 1. 선택된 강좌 정보 조회
    course_contents = []
    for course_id in course_ids:
        # RAG에서 검색 (실제로는 ID로 직접 조회해야 하지만, 여기서는 전체 검색 후 필터)
        results = await rag_handler.search(query=course_id)
        matching_courses = [c for c in results.get("courses", []) if c.get("id") == course_id]
        if matching_courses:
            course_contents.append(matching_courses[0])

    # course_ids가 있지만 과정을 찾지 못한 경우 - 과정 내용 직접 전달받은 경우
    if not course_contents and params.get("course_contents"):
        course_contents = params.get("course_contents", [])

    if not course_contents:
        return {
            "success": False,
            "error": "선택된 강좌를 찾을 수 없습니다."
        }

    # 2. 자동 필터링: 선택된 강좌의 과목만 추출
    available_subjects = set()
    for course in course_contents:
        subject = course.get("subject")
        if subject:
            available_subjects.add(subject)

    # subject_hours가 있으면 선택된 강좌의 과목으로만 필터링
    skipped_subjects = []
    filtered_subject_hours = None
    if subject_hours:
        filtered_subject_hours = {}
        for subject, hours in subject_hours.items():
            if hours is not None and hours > 0:
                if subject in available_subjects:
                    filtered_subject_hours[subject] = hours
                else:
                    # 강좌가 없는 과목의 시간은 무시하고 경고 기록
                    skipped_subjects.append({
                        "subject": subject,
                        "hours": hours,
                        "reason": "해당 과목의 강좌가 선택되지 않음"
                    })

        # 필터링 후 남은 과목이 없으면 에러
        if not filtered_subject_hours:
            return {
                "success": False,
                "error": "선택된 강좌의 과목과 입력된 과목별 시간이 일치하지 않습니다. 강좌를 선택하거나 과목별 시간을 확인해주세요.",
                "skippedSubjects": skipped_subjects
            }

        subject_hours = filtered_subject_hours

    # subject_ratio도 필터링 (강좌 없는 과목 제외)
    if available_subjects:
        filtered_ratio = {k: v for k, v in subject_ratio.items() if k in available_subjects}
        if filtered_ratio:
            subject_ratio = filtered_ratio

    # 3. 퀘스트 생성 (PlannerAgent 학습 전략 적용 + 스마트 스케줄링)
    try:
        quests = quest_manager.generate_quests_from_curriculum(
            course_contents=course_contents,
            target_date=target_date,
            daily_study_hours=daily_study_hours,
            subject_ratio=subject_ratio,
            subject_hours=subject_hours,
            include_ot=include_ot,
            review_settings=review_settings,
            custom_schedule=custom_schedule,
            learning_strategies=learning_strategies,
            daily_existing_usage=daily_existing_usage  # 기존 플랜 시간 사용량 전달
        )

        # 3. 결과 직렬화
        quest_dicts = [q.to_dict() for q in quests]

        # Quest 객체의 필드를 CurriculumQuest 인터페이스에 맞게 변환
        formatted_quests = []
        for q in quest_dicts:
            metadata = q.get("metadata", {})
            quest_data = {
                "id": q["id"],
                "title": q["title"],
                "description": q["description"],
                "questType": q["quest_type"],
                "subject": q["subject"],
                "courseId": q["course_id"],
                "courseName": metadata.get("course_name", ""),
                "lecturer": q.get("lecturer", ""),
                "chapter": q["chapter"],
                "section": q["section"],
                "scheduledDate": q["scheduled_date"],
                "estimatedMinutes": q["estimated_minutes"],
                "originalDuration": metadata.get("original_duration"),  # 원본 강의 시간
                "status": q["status"],
                "priority": "high" if q["priority"] == 3 else "medium" if q["priority"] == 2 else "low",
                "studyTips": metadata.get("study_tips", {})  # 학습 팁
            }

            # 문제풀이 퀘스트 추가 필드
            if q["quest_type"] == "practice":
                quest_data["editable"] = metadata.get("editable", True)
                quest_data["relatedLectures"] = metadata.get("related_lectures", [])
                quest_data["practiceNote"] = metadata.get("practice_note")

            formatted_quests.append(quest_data)

        # 요약 정보 계산
        stats = quest_manager.get_completion_stats()
        dates = set(q["scheduledDate"] for q in formatted_quests)
        total_minutes = sum(q["estimatedMinutes"] for q in formatted_quests)

        # 과목별 분포
        subject_dist = {}
        for q in formatted_quests:
            subj = q["subject"]
            subject_dist[subj] = subject_dist.get(subj, 0) + 1

        # 퀘스트 타입별 시간 합계
        type_minutes = {"lecture": 0, "review": 0, "practice": 0}
        for q in formatted_quests:
            qtype = q["questType"]
            if qtype in type_minutes:
                type_minutes[qtype] += q["estimatedMinutes"]

        # 과목별 상세 시간 분포
        subject_time_breakdown = {}
        for q in formatted_quests:
            subj = q["subject"]
            qtype = q["questType"]
            if subj not in subject_time_breakdown:
                subject_time_breakdown[subj] = {"lecture": 0, "review": 0, "practice": 0, "total": 0}
            if qtype in subject_time_breakdown[subj]:
                subject_time_breakdown[subj][qtype] += q["estimatedMinutes"]
            subject_time_breakdown[subj]["total"] += q["estimatedMinutes"]

        return {
            "success": True,
            "quests": formatted_quests,
            "summary": {
                "totalQuests": len(formatted_quests),
                "totalDays": len(dates),
                "averageMinutesPerDay": round(total_minutes / len(dates)) if dates else 0,
                "subjectDistribution": subject_dist,
                # 퀘스트 타입별 시간
                "timeByType": {
                    "lectureMinutes": type_minutes["lecture"],
                    "reviewMinutes": type_minutes["review"],
                    "practiceMinutes": type_minutes["practice"],
                    "totalMinutes": total_minutes
                },
                # 과목별 시간 상세
                "subjectTimeBreakdown": subject_time_breakdown,
                # 학습 전략 적용 정보
                "learningStrategies": {
                    "bufferApplied": learning_strategies.get("apply_buffer", True),
                    "bufferRatio": quest_manager.BUFFER_RATIO if learning_strategies.get("apply_buffer", True) else 1.0
                },
                # 자동 필터링으로 제외된 과목 (경고)
                "skippedSubjects": skipped_subjects if skipped_subjects else None
            }
        }

    except ValueError as e:
        return {
            "success": False,
            "error": str(e)
        }


async def cli_reschedule_quests(params: dict) -> dict:
    """퀘스트 재조정 CLI 핸들러"""
    from handlers import ScheduleOptimizer, RescheduleStrategy

    quest_manager = QuestManager()

    # 기존 퀘스트 로드 (실제로는 DB에서 로드해야 함)
    quest_ids = params.get("quest_ids", [])
    target_date = params.get("target_date")
    daily_study_hours = params.get("daily_study_hours", 10)  # 기본 10시간
    strategy_str = params.get("strategy", "smart")
    # 다른 플랜 정보 (스마트 스케줄링 - 다른 플랜과의 충돌 방지)
    existing_plans = params.get("existing_plans", [])

    # 전략 매핑
    strategy_map = {
        "smart": RescheduleStrategy.SMART,
        "spread": RescheduleStrategy.SPREAD,
        "priority": RescheduleStrategy.PRIORITY_FIRST,
        "front_load": RescheduleStrategy.FRONT_LOAD,
        "back_load": RescheduleStrategy.BACK_LOAD
    }
    strategy = strategy_map.get(strategy_str, RescheduleStrategy.SMART)

    optimizer = ScheduleOptimizer(quest_manager)

    result = optimizer.reschedule_overdue(
        target_date=target_date,
        daily_study_hours=daily_study_hours,
        strategy=strategy,
        existing_plans=existing_plans  # 다른 플랜 정보 전달
    )

    return {
        "success": result.success,
        "message": result.message,
        "rescheduledCount": len(result.rescheduled_quests),
        "rescheduledQuests": [q.to_dict() for q in result.rescheduled_quests],
        "newSchedule": result.new_schedule
    }


def parse_cli_args():
    """CLI 인자 파싱"""
    parser = argparse.ArgumentParser(description="Curriculum RAG Agent CLI")
    parser.add_argument(
        "--action",
        type=str,
        choices=["search_courses", "generate_quests", "reschedule_quests", "interactive"],
        default="interactive",
        help="실행할 액션"
    )
    parser.add_argument(
        "--params",
        type=str,
        default="{}",
        help="JSON 형식의 파라미터"
    )
    return parser.parse_args()


async def run_cli():
    """CLI 실행"""
    args = parse_cli_args()

    if args.action == "interactive":
        await main()
        return

    # JSON 파라미터 파싱
    try:
        params = json.loads(args.params)
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON params: {e}"}))
        sys.exit(1)

    # 액션 실행
    result = {}
    if args.action == "search_courses":
        result = await cli_search_courses(params)
    elif args.action == "generate_quests":
        result = await cli_generate_quests(params)
    elif args.action == "reschedule_quests":
        result = await cli_reschedule_quests(params)

    # JSON 출력
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(run_cli())
