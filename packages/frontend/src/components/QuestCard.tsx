interface QuestCardProps {
  day: number;
  date: string;
  unitTitle: string;
  range: string;
  estimatedMinutes: number;
  tip?: string;
  // 상세 정보 (학습계획표에서 추출)
  topics?: string[];
  pages?: string;
  objectives?: string[];
}

export function QuestCard({
  day,
  date,
  unitTitle,
  range,
  estimatedMinutes,
  tip,
  topics,
  pages,
  objectives
}: QuestCardProps) {
  const formatDate = (dateStr: string) => {
    const [, month, dayNum] = dateStr.split('-');
    return `${parseInt(month)}/${parseInt(dayNum)}`;
  };

  // 상세 정보 여부 확인
  const hasDetails = (topics && topics.length > 0) || pages || (objectives && objectives.length > 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
          Day {day}
        </span>
        <div className="flex items-center gap-2">
          {pages && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              📄 {pages}
            </span>
          )}
          <span className="text-gray-400 text-xs">{formatDate(date)}</span>
        </div>
      </div>
      <h3 className="font-semibold text-gray-900">{unitTitle}</h3>
      <p className="text-sm text-gray-500 mt-1">{range}</p>

      {/* 학습 주제 (상세 정보) */}
      {topics && topics.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-500 mb-1">📚 학습 주제</p>
          <div className="flex flex-wrap gap-1">
            {topics.map((topic, index) => (
              <span
                key={index}
                className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 학습 목표 (상세 정보) */}
      {objectives && objectives.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-500 mb-1">🎯 학습 목표</p>
          <ul className="text-xs text-gray-600 space-y-0.5">
            {objectives.map((objective, index) => (
              <li key={index} className="flex items-start gap-1">
                <span className="text-green-500 mt-0.5">•</span>
                <span>{objective}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-gray-400">⏱ {estimatedMinutes}분</p>
        {hasDetails && (
          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
            상세 계획
          </span>
        )}
      </div>
      {tip && (
        <p className="text-xs text-purple-600 mt-2 bg-purple-50 rounded px-2 py-1">
          💡 {tip}
        </p>
      )}
    </div>
  );
}
