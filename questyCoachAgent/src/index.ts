/**
 * QuestyCoachAgent
 * 자기진화형 AI 학습 코치 시스템
 *
 * ACE Framework V5.2 기반 + Supervisor Pattern
 * - Memory Lane: 12 Memory Types + 6-Factor Re-Ranking
 * - Multi-Agent: Supervisor, Admission, Planner, Coach, Analyst
 * - SM-2 Spaced Repetition
 * - Burnout Monitoring
 * - Daily Quest System
 */

// Orchestrator exports (NEW - Supervisor Pattern)
export { Supervisor } from './core/orchestrator/index.js';

// Legacy Director (backward compatibility)
export { Director } from './core/director/index.js';

// Router exports
export { IntentClassifier } from './core/router/index.js';

// Agent exports
export {
  BaseAgent,
  CoachAgent,
  PlannerAgent,
  AnalystAgent,
  AdmissionAgent,
} from './core/agents/index.js';

// Memory Lane exports
export {
  MemoryLane,
  LearningMemoryCatcher,
  MemoryRetriever,
  SpacedRepetitionManager,
  BurnoutMonitor,
  MemoryContextInjector,
} from './memory/index.js';

// LLM Client exports
export {
  LLMClient,
  getLLMClient,
  MODEL_CONFIGS,
} from './llm/index.js';

// Quest System exports
export {
  QuestGenerator,
  QuestTracker,
  ScheduleDelayHandler,
} from './quest/index.js';

// Student Registry exports
export {
  StudentRegistry,
} from './registry/index.js';

// Type exports
export type {
  // Memory types
  LearningMemory,
  MemoryType,
  Subject,
  Emotion,
  TopicMastery,
  QueryIntent,
  ReRankingWeights,
  RetrievedMemory,
  BurnoutIndicator,
  MemoryContext,
  MemoryExtractionRequest,

  // Agent types
  AgentRole,
  IntentCategory,
  RouteDecision,
  StudentProfile,
  LearningStyle,
  StudyPlan,
  StudySession,
  AgentRequest,
  AgentResponse,
  AgentAction,
  DirectorContext,
  ModelId,
  ModelConfig,
  IAgent,

  // Quest types
  DailyQuest,
  TodayQuests,
  QuestType,
  QuestStatus,
  QuestDifficulty,
  QuestSummary,
  QuestProgressUpdate,
  QuestCompletionResult,
  Badge,
  QuestGenerationRequest,
  QuestFilter,
  QuestStats,

} from './types/index.js';

// LLM types (from llm module)
export type {
  LLMMessage,
  LLMResponse,
  LLMClientConfig,
} from './llm/index.js';

export type { SupervisorConfig } from './core/orchestrator/index.js';
export type { StudentRegistryConfig } from './registry/index.js';
export type { QuestGeneratorConfig } from './quest/index.js';
export type {
  DelayAnalysis,
  ExpiredQuest,
  RescheduleSuggestion,
  DelayNotification,
} from './quest/index.js';
