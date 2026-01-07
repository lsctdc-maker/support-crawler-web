import { useState, useEffect, useCallback } from 'react';
import { noticeApi, crawlApi } from '../services/api';
import { Notice, CrawlLog } from '../lib/supabase';

// 로컬스토리지 키
const EXCLUDED_URLS_KEY = 'excluded_notice_urls';

// 로컬스토리지에서 제외 목록 로드
const loadExcludedUrls = (): Set<string> => {
  try {
    const saved = localStorage.getItem(EXCLUDED_URLS_KEY);
    if (saved) {
      return new Set(JSON.parse(saved));
    }
  } catch (e) {
    console.error('제외 목록 로드 실패:', e);
  }
  return new Set();
};

// 로컬스토리지에 제외 목록 저장
const saveExcludedUrls = (urls: Set<string>) => {
  try {
    localStorage.setItem(EXCLUDED_URLS_KEY, JSON.stringify([...urls]));
  } catch (e) {
    console.error('제외 목록 저장 실패:', e);
  }
};

// 관련도 점수 가져오기 (AI 점수 우선)
const getRelevanceScore = (notice: Notice): number => {
  if (notice.llm_score !== null && notice.llm_score !== undefined) {
    return notice.llm_score;
  }
  return notice.relevance || 0;
};

// HTML 태그 제거
const stripHtml = (html: string): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

export default function Notices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [excludedUrls, setExcludedUrls] = useState<Set<string>>(loadExcludedUrls);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [hideExcluded, setHideExcluded] = useState(true);
  const [hideLowRelevance, setHideLowRelevance] = useState(true); // 낮은 관련도 숨기기
  const [scoreFilter, setScoreFilter] = useState<'all' | 'high' | 'mid7' | 'mid' | 'low'>('mid7'); // 점수 필터 (기본: 7점 이상)
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('relevance');
  const [lastCrawl, setLastCrawl] = useState<CrawlLog | null>(null);

  // AI 요약 관련 상태
  const [summaryNotice, setSummaryNotice] = useState<Notice | null>(null);
  const [summaryContent, setSummaryContent] = useState<string>('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      // 점수 필터에 따른 최소 관련도 설정
      let minRelevance = 0;
      let maxRelevance = 10;
      if (hideLowRelevance) {
        if (scoreFilter === 'high') {
          minRelevance = 8;
        } else if (scoreFilter === 'mid7') {
          minRelevance = 7;  // 7점 이상
        } else if (scoreFilter === 'mid') {
          minRelevance = 5;
          maxRelevance = 6;
        } else if (scoreFilter === 'low') {
          minRelevance = 0;
          maxRelevance = 4;
        }
      }

      const data = await noticeApi.getList({
        source: source || undefined,
        search: search || undefined,
        page,
        size: 50,
        minRelevance,
        maxRelevance: maxRelevance < 10 ? maxRelevance : undefined,
        sortBy,
      });
      setNotices(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error('공고 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [source, search, page, hideLowRelevance, scoreFilter, sortBy]);

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
    fetchLastCrawl();
  }, [fetchNotices, fetchLastCrawl]);

  // 제외 목록 변경시 로컬스토리지에 저장
  useEffect(() => {
    saveExcludedUrls(excludedUrls);
  }, [excludedUrls]);

  const handleExclude = (notice: Notice) => {
    setExcludedUrls(prev => new Set([...prev, notice.url]));
  };

  const handleRestore = (notice: Notice) => {
    setExcludedUrls(prev => {
      const newSet = new Set(prev);
      newSet.delete(notice.url);
      return newSet;
    });
  };

  const isExcluded = (url: string) => excludedUrls.has(url);

  // AI 요약 생성
  const handleSummarize = async (notice: Notice) => {
    setSummaryNotice(notice);
    setSummaryContent('');
    setSummaryLoading(true);

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noticeId: notice.id, url: notice.url, title: notice.title, agency: notice.agency }),
      });

      if (!response.ok) throw new Error('요약 생성 실패');

      const data = await response.json();
      setSummaryContent(data.summary);
    } catch (err) {
      console.error('요약 생성 실패:', err);
      setSummaryContent('요약을 생성할 수 없습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSummaryLoading(false);
    }
  };

  const closeSummaryModal = () => {
    setSummaryNotice(null);
    setSummaryContent('');
  };

  // 필터링된 공고 목록
  const displayNotices = notices.filter(n => {
    if (hideExcluded && isExcluded(n.url)) return false;
    return true;
  });

  const totalPages = Math.ceil(total / 50);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // 관련도에 따른 배경색
  const getScoreBgColor = (score: number) => {
    if (score >= 8) return 'bg-green-100 text-green-800';
    if (score >= 6) return 'bg-blue-100 text-blue-800';
    if (score >= 4) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-600';
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
          </div>
        </div>
      </header>

      {/* 필터 */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* 소스 필터 */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">소스:</span>
              <select
                value={source}
                onChange={(e) => { setSource(e.target.value); setPage(1); }}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="">전체</option>
                <option value="bizinfo">기업마당</option>
                <option value="agency">기관별</option>
                <option value="g2b">나라장터</option>
              </select>
            </div>

            {/* 정렬 */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">정렬:</span>
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as 'relevance' | 'date'); setPage(1); }}
                className="border rounded px-3 py-2 text-sm"
              >
                <option value="relevance">관련도순</option>
                <option value="date">최신순</option>
              </select>
            </div>

            {/* 점수 필터 */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">점수:</span>
              <select
                value={scoreFilter}
                onChange={(e) => { setScoreFilter(e.target.value as 'all' | 'high' | 'mid7' | 'mid' | 'low'); setPage(1); }}
                className="border rounded px-3 py-2 text-sm"
                disabled={!hideLowRelevance}
              >
                <option value="all">전체</option>
                <option value="high">8점 이상 (추천)</option>
                <option value="mid7">7점 이상</option>
                <option value="mid">5~6점</option>
                <option value="low">4점 이하</option>
              </select>
            </div>

            {/* 검색 */}
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="제목 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
                className="border rounded px-3 py-2 text-sm flex-1"
              />
              <button
                onClick={() => setPage(1)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
              >
                검색
              </button>
            </div>
          </div>

          {/* 체크박스 필터 */}
          <div className="flex flex-wrap gap-6 mt-3 pt-3 border-t">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={hideLowRelevance}
                onChange={(e) => { setHideLowRelevance(e.target.checked); setPage(1); }}
                className="w-4 h-4"
              />
              낮은 관련도 숨기기
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={hideExcluded}
                onChange={(e) => setHideExcluded(e.target.checked)}
                className="w-4 h-4"
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
                : '필터 조건에 맞는 공고가 없습니다. 필터를 조정해보세요.'}
            </div>
          ) : (
            <div className="divide-y">
              {displayNotices.map((notice) => {
                const score = getRelevanceScore(notice);
                const hasAiScore = notice.llm_score !== null && notice.llm_score !== undefined;

                return (
                  <div
                    key={notice.id}
                    className={`p-4 hover:bg-gray-50 ${isExcluded(notice.url) ? 'bg-gray-100 opacity-60' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        {/* 제목 + 점수 */}
                        <div className="flex items-start gap-3">
                          <span className={`px-2 py-1 rounded text-sm font-bold ${getScoreBgColor(score)}`}>
                            {hasAiScore ? `AI ${score}` : score}점
                          </span>
                          <a
                            href={notice.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline font-medium flex-1"
                          >
                            {notice.title}
                          </a>
                        </div>

                        {/* 메타 정보 */}
                        <div className="text-sm text-gray-500 mt-2 ml-12 flex flex-wrap gap-2">
                          <span>{notice.agency}</span>
                          <span>•</span>
                          <span>{notice.date}</span>
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                            {notice.source}
                          </span>
                          {isExcluded(notice.url) && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                              관심없음
                            </span>
                          )}
                        </div>

                        {/* 8점 이상: 추천 공고 한줄 요약 (강조) */}
                        {score >= 8 && notice.llm_reason && (
                          <p className="text-sm text-green-700 mt-2 ml-12 bg-green-50 border border-green-200 p-2 rounded font-medium">
                            ⭐ 추천: {notice.llm_reason}
                          </p>
                        )}

                        {/* 8점 미만: 일반 AI 판단 이유 */}
                        {score < 8 && notice.llm_reason && (
                          <p className="text-sm text-purple-600 mt-2 ml-12 bg-purple-50 p-2 rounded">
                            AI: {notice.llm_reason}
                          </p>
                        )}

                        {/* 요약 (HTML 태그 제거) */}
                        {notice.summary && (
                          <p className="text-sm text-gray-600 mt-2 ml-12 bg-gray-50 p-2 rounded line-clamp-3">
                            {stripHtml(notice.summary)}
                          </p>
                        )}
                      </div>

                      {/* 액션 버튼 */}
                      <div className="ml-4 flex flex-col gap-1">
                        {/* AI 요약 버튼 */}
                        <button
                          onClick={() => handleSummarize(notice)}
                          className="text-purple-500 hover:text-purple-700 text-xs px-2 py-1 border border-purple-300 rounded hover:bg-purple-50"
                          title="AI 요약 보기"
                        >
                          AI 요약
                        </button>
                        {isExcluded(notice.url) ? (
                          <button
                            onClick={() => handleRestore(notice)}
                            className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 border border-blue-300 rounded"
                            title="관심없음 해제"
                          >
                            복원
                          </button>
                        ) : (
                          <button
                            onClick={() => handleExclude(notice)}
                            className="text-gray-400 hover:text-red-500 text-xs px-2 py-1"
                            title="관심없음"
                          >
                            제외
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
          총 {total}건 표시 {excludedUrls.size > 0 && `(${excludedUrls.size}건 관심없음)`}
        </div>
      </div>

      {/* AI 요약 모달 */}
      {summaryNotice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* 모달 헤더 */}
            <div className="p-4 border-b flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg text-gray-800">{summaryNotice.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{summaryNotice.agency}</p>
              </div>
              <button
                onClick={closeSummaryModal}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {summaryLoading ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mb-4"></div>
                  <p className="text-gray-500">AI가 공고를 분석하고 있습니다...</p>
                  <p className="text-xs text-gray-400 mt-1">잠시만 기다려주세요</p>
                </div>
              ) : (
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {summaryContent}
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="p-4 border-t flex justify-between items-center bg-gray-50">
              <a
                href={summaryNotice.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                원문 보기
              </a>
              <button
                onClick={closeSummaryModal}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
