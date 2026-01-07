import { useState, useEffect, useCallback } from 'react';
import { noticeApi, excludeApi, crawlApi } from '../services/api';
import { Notice, CrawlLog } from '../lib/supabase';

interface NoticesProps {
  onLogout: () => void;
}

export default function Notices({ onLogout }: NoticesProps) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [excludedUrls, setExcludedUrls] = useState<Set<string>>(new Set());
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [hideExcluded, setHideExcluded] = useState(true);
  const [lastCrawl, setLastCrawl] = useState<CrawlLog | null>(null);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await noticeApi.getList({
        source: source || undefined,
        search: search || undefined,
        page,
        size: 20,
      });
      setNotices(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error('공고 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [source, search, page]);

  const fetchExcludedUrls = useCallback(async () => {
    try {
      const urls = await excludeApi.getExcludedUrls();
      setExcludedUrls(urls);
    } catch (err) {
      console.error('제외 목록 조회 실패:', err);
    }
  }, []);

  const fetchLastCrawl = useCallback(async () => {
    try {
      const logs = await crawlApi.getLogs(1);
      if (logs.length > 0) {
        setLastCrawl(logs[0]);
      }
    } catch (err) {
      console.error('수집 로그 조회 실패:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
    fetchExcludedUrls();
    fetchLastCrawl();
  }, [fetchNotices, fetchExcludedUrls, fetchLastCrawl]);

  const handleExclude = async (notice: Notice) => {
    try {
      await excludeApi.add(notice.url, '관심없음');
      setExcludedUrls(prev => new Set([...prev, notice.url]));
    } catch (err) {
      console.error('제외 실패:', err);
    }
  };

  const handleRestore = async (notice: Notice) => {
    try {
      await excludeApi.removeByUrl(notice.url);
      setExcludedUrls(prev => {
        const newSet = new Set(prev);
        newSet.delete(notice.url);
        return newSet;
      });
    } catch (err) {
      console.error('복원 실패:', err);
    }
  };

  const isExcluded = (url: string) => excludedUrls.has(url);

  const displayNotices = hideExcluded
    ? notices.filter(n => !isExcluded(n.url))
    : notices;

  const totalPages = Math.ceil(total / 20);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('ko-KR', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">지원사업 공고 수집기</h1>
          <div className="flex gap-4 items-center">
            {lastCrawl && (
              <span className="text-sm text-gray-500">
                마지막 수집: {formatDate(lastCrawl.crawled_at)}
              </span>
            )}
            <button
              onClick={onLogout}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* 필터 */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap gap-4 items-center">
            <select
              value={source}
              onChange={(e) => { setSource(e.target.value); setPage(1); }}
              className="border rounded px-3 py-2"
            >
              <option value="">전체 소스</option>
              <option value="bizinfo">기업마당</option>
              <option value="agency">기관별</option>
              <option value="g2b">나라장터</option>
            </select>
            <input
              type="text"
              placeholder="제목 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
              className="border rounded px-3 py-2 flex-1 min-w-[200px]"
            />
            <button
              onClick={() => setPage(1)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              검색
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hideExcluded}
                onChange={(e) => setHideExcluded(e.target.checked)}
              />
              관심없음 숨기기
            </label>
          </div>
        </div>

        {/* 안내 메시지 */}
        {total === 0 && !loading && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800">
              <strong>데이터 수집 필요:</strong> 로컬 PC에서 크롤러(gui_app.py)를 실행하여 공고를 수집해주세요.
            </p>
          </div>
        )}

        {/* 공고 목록 */}
        <div className="bg-white rounded-lg shadow">
          {loading ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : displayNotices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {total === 0
                ? '공고가 없습니다.'
                : hideExcluded
                ? '모든 공고가 관심없음 처리되었습니다. 체크박스를 해제하여 확인하세요.'
                : '필터에 맞는 공고가 없습니다.'}
            </div>
          ) : (
            <div className="divide-y">
              {displayNotices.map((notice) => (
                <div
                  key={notice.id}
                  className={`p-4 hover:bg-gray-50 ${isExcluded(notice.url) ? 'bg-gray-100 opacity-60' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <a
                        href={notice.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {notice.title}
                      </a>
                      <div className="text-sm text-gray-500 mt-1 flex flex-wrap gap-2">
                        <span>{notice.agency}</span>
                        <span>{notice.date}</span>
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                          {notice.source}
                        </span>
                        {notice.llm_score !== null ? (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                            AI {notice.llm_score}점
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                            관련도 {notice.relevance}
                          </span>
                        )}
                        {isExcluded(notice.url) && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                            관심없음
                          </span>
                        )}
                      </div>
                      {notice.summary && (
                        <p className="text-sm text-gray-600 mt-2 bg-gray-50 p-2 rounded">
                          {notice.summary}
                        </p>
                      )}
                    </div>
                    <div className="ml-4">
                      {isExcluded(notice.url) ? (
                        <button
                          onClick={() => handleRestore(notice)}
                          className="text-blue-500 hover:text-blue-700 text-sm px-2 py-1 border border-blue-300 rounded"
                          title="관심없음 해제"
                        >
                          복원
                        </button>
                      ) : (
                        <button
                          onClick={() => handleExclude(notice)}
                          className="text-gray-400 hover:text-red-500 text-sm"
                          title="관심없음"
                        >
                          X
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 페이징 */}
          {totalPages > 1 && (
            <div className="p-4 border-t flex justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                이전
              </button>
              <span className="px-3 py-1">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                다음
              </button>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500 mt-2">
          총 {total}건 {hideExcluded && excludedUrls.size > 0 && `(${excludedUrls.size}건 숨김)`}
        </div>
      </div>
    </div>
  );
}
