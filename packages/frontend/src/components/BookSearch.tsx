import { useState } from 'react';
import { API_BASE_URL } from '../config';

// 교재 메타데이터 (수능 학습용)
interface BookMetadata {
  subject?: string;
  targetGrade?: string;
  bookType?: string;
  category?: string;
  description?: string;
}

interface Yes24Book {
  productId: string;
  title: string;
  author: string;
  publisher: string;
  previewUrl: string;
  thumbnailUrl: string;
  metadata?: BookMetadata;
}

interface BookSearchProps {
  onSelectBook: (book: Yes24Book) => void;
}

export function BookSearch({ onSelectBook }: BookSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Yes24Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/books/search?q=${encodeURIComponent(query)}`
      );
      const data = await response.json();

      if (data.success) {
        setResults(data.data);
      } else {
        setError(data.error || '검색 실패');
      }
    } catch (err) {
      console.error('[BookSearch] Error:', err);
      // @ts-ignore
      setError(`서버 연결 실패: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (book: Yes24Book) => {
    setSelectedId(book.productId);
    onSelectBook(book);
  };

  return (
    <div className="space-y-4">
      {/* 검색 입력 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="교재명으로 검색 (예: 마더텅 수능기출문제집)"
          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:bg-gray-300 transition-colors"
        >
          {loading ? '검색 중...' : '검색'}
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* 검색 결과 */}
      {results.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          <p className="text-sm text-gray-500">{results.length}개의 결과</p>
          {results.map((book) => (
            <button
              key={book.productId}
              onClick={() => handleSelect(book)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${selectedId === book.productId
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
            >
              <img
                src={book.thumbnailUrl}
                alt={book.title}
                className="w-12 h-16 object-cover rounded bg-gray-100"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/48x64?text=No+Image';
                }}
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 truncate">
                  {book.title || `상품 #${book.productId}`}
                </h4>
                {book.author && (
                  <p className="text-sm text-gray-500 truncate">{book.author}</p>
                )}
                {book.publisher && (
                  <p className="text-xs text-gray-400">{book.publisher}</p>
                )}
              </div>
              {selectedId === book.productId && (
                <span className="text-blue-500 text-xl">✓</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 검색 안내 */}
      {results.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-400 text-sm">
          <p>Yes24에서 교재를 검색해보세요</p>
          <p className="mt-1">미리보기가 있는 교재만 표시됩니다</p>
        </div>
      )}
    </div>
  );
}
