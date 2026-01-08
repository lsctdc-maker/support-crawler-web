import { useState, useEffect, useCallback } from 'react';
import { noticeApi, crawlApi } from '../services/api';
import { Notice, CrawlLog, supabase } from '../lib/supabase';

// 로컬스토리지 키
const EXCLUDED_URLS_KEY = 'excluded_notice_urls';
const BOOKMARKED_URLS_KEY = 'bookmarked_notice_urls';
const LAST_VISIT_KEY = 'last_visit_time';
const DARK_MODE_KEY = 'dark_mode';

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

// 북마크 목록 로드/저장
const loadBookmarkedUrls = (): Set<string> => {
  try {
    const saved = localStorage.getItem(BOOKMARKED_URLS_KEY);
    if (saved) return new Set(JSON.parse(saved));
  } catch (e) {
    console.error('북마크 목록 로드 실패:', e);
  }
  return new Set();
};

const saveBookmarkedUrls = (urls: Set<string>) => {
  try {
    localStorage.setItem(BOOKMARKED_URLS_KEY, JSON.stringify([...urls]));
  } catch (e) {
    console.error('북마크 목록 저장 실패:', e);
  }
};

// 마지막 방문 시간 로드/저장
const loadLastVisit = (): string | null => {
  try {
    return localStorage.getItem(LAST_VISIT_KEY);
  } catch {
    return null;
  }
};

const saveLastVisit = () => {
  try {
    localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
  } catch (e) {
    console.error('방문 시간 저장 실패:', e);
  }
};

// 다크모드 로드/저장
const loadDarkMode = (): boolean => {
  try {
    return localStorage.getItem(DARK_MODE_KEY) === 'true';
  } catch {
    return false;
  }
};

const saveDarkMode = (isDark: boolean) => {
  try {
    localStorage.setItem(DARK_MODE_KEY, String(isDark));
  } catch (e) {
    console.error('다크모드 저장 실패:', e);
  }
};

// D-day 계산 (마감일까지 남은 일수)
const calculateDday = (endDateStr: string | null): number | null => {
  if (!endDateStr) return null;
  try {
    // 다양한 날짜 형식 파싱 시도
    const cleaned = endDateStr.replace(/\./g, '-').replace(/[년월]/g, '-').replace(/일/g, '').trim();
    const endDate = new Date(cleaned);
    if (isNaN(endDate.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch {
    return null;
  }
};

// D-day 표시 텍스트
const getDdayText = (dday: number | null): string | null => {
  if (dday === null) return null;
  if (dday < 0) return '마감';
  if (dday === 0) return 'D-Day';
  return `D-${dday}`;
};

// D-day 배경색
const getDdayColor = (dday: number | null): string => {
  if (dday === null) return '';
  if (dday < 0) return 'bg-gray-400 text-white';
  if (dday <= 3) return 'bg-red-500 text-white';
  if (dday <= 7) return 'bg-orange-500 text-white';
  return 'bg-blue-500 text-white';
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
  const [bookmarkedUrls, setBookmarkedUrls] = useState<Set<string>>(loadBookmarkedUrls);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [hideExcluded, setHideExcluded] = useState(true);
  const [hideLowRelevance, setHideLowRelevance] = useState(true); // 낮은 관련도 숨기기
  const [scoreFilter, setScoreFilter] = useState<'all' | '10' | '9' | '8' | '7' | '6' | '5' | '4'>('8'); // 점수 필터 (기본: 8점)
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('relevance');
  const [lastCrawl, setLastCrawl] = useState<CrawlLog | null>(null);

  // AI 요약 토글 상태 (확장된 공고 ID들)
  const [expandedNoticeIds, setExpandedNoticeIds] = useState<Set<number>>(new Set());

  // 점수별 통계
  const [scoreStats, setScoreStats] = useState<Record<number, number>>({});

  // 새 기능: 북마크, 다크모드, 마감 임박 필터, 새 공고
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [darkMode, setDarkMode] = useState(loadDarkMode);
  const [deadlineFilter, setDeadlineFilter] = useState<'all' | 'd7' | 'd3'>('all');
  const [lastVisitTime] = useState<string | null>(() => loadLastVisit());
  const [showNoAiSummaryOnly, setShowNoAiSummaryOnly] = useState(false);
  const [evaluatingIds, setEvaluatingIds] = useState<Set<number>>(new Set());

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      // 점수 필터에 따른 관련도 설정 (1점 단위)
      let minRelevance = 0;
      let maxRelevance = 10;
      if (hideLowRelevance && scoreFilter !== 'all') {
        const score = parseInt(scoreFilter);
        if (scoreFilter === '4') {
          // 4점 이하
          minRelevance = 0;
          maxRelevance = 4;
        } else {
          // 특정 점수만
          minRelevance = score;
          maxRelevance = score;
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

  // 점수별 통계 조회
  const fetchScoreStats = useCallback(async () => {
    try {
      const stats = await noticeApi.getScoreStats();
      setScoreStats(stats);
    } catch (err) {
      console.error('점수 통계 조회 실패:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
    fetchLastCrawl();
    fetchScoreStats();
  }, [fetchNotices, fetchLastCrawl, fetchScoreStats]);

  // 제외 목록 변경시 로컬스토리지에 저장
  useEffect(() => {
    saveExcludedUrls(excludedUrls);
  }, [excludedUrls]);

  // 북마크 목록 변경시 로컬스토리지에 저장
  useEffect(() => {
    saveBookmarkedUrls(bookmarkedUrls);
  }, [bookmarkedUrls]);

  // 다크모드 변경시 저장 및 적용
  useEffect(() => {
    saveDarkMode(darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // 페이지 로드 시 마지막 방문 시간 저장 (다음 방문 때 사용)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveLastVisit();
    }, 5000); // 5초 후 저장 (바로 저장하면 NEW 뱃지가 안 보임)
    return () => clearTimeout(timer);
  }, []);

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

  // 북마크 핸들러
  const handleBookmark = (notice: Notice) => {
    setBookmarkedUrls(prev => new Set([...prev, notice.url]));
  };

  const handleUnbookmark = (notice: Notice) => {
    setBookmarkedUrls(prev => {
      const newSet = new Set(prev);
      newSet.delete(notice.url);
      return newSet;
    });
  };

  const isBookmarked = (url: string) => bookmarkedUrls.has(url);

  // 새 공고 여부 확인
  const isNewNotice = (notice: Notice): boolean => {
    if (!lastVisitTime || !notice.crawled_at) return false;
    try {
      const crawledAt = new Date(notice.crawled_at);
      const lastVisit = new Date(lastVisitTime);
      return crawledAt > lastVisit;
    } catch {
      return false;
    }
  };

  // AI 요약 토글
  const handleToggleSummary = (noticeId: number) => {
    setExpandedNoticeIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noticeId)) {
        newSet.delete(noticeId);
      } else {
        newSet.add(noticeId);
      }
      return newSet;
    });
  };

  // AI 평가 실행
  const handleEvaluate = async (notice: Notice) => {
    setEvaluatingIds(prev => new Set(prev).add(notice.id));
    try {
      const result = await noticeApi.evaluate({
        id: notice.id,
        title: notice.title,
        agency: notice.agency || undefined,
        summary: notice.summary || undefined,
      });
      // Supabase 업데이트
      await supabase
        .from('notices')
        .update({ llm_score: result.score, llm_reason: result.reason })
        .eq('id', notice.id);
      // UI 갱신
      fetchNotices();
    } catch (error) {
      console.error('AI 평가 실패:', error);
      alert('AI 평가에 실패했습니다.');
    } finally {
      setEvaluatingIds(prev => {
        const next = new Set(prev);
        next.delete(notice.id);
        return next;
      });
    }
  };

  // 필터링된 공고 목록
  const displayNotices = notices.filter(n => {
    if (hideExcluded && isExcluded(n.url)) return false;
    if (showBookmarksOnly && !isBookmarked(n.url)) return false;

    // AI 요약 없는 것만 보기
    if (showNoAiSummaryOnly && n.llm_reason) return false;

    // 마감 임박 필터
    if (deadlineFilter !== 'all') {
      const dday = calculateDday(n.end_date);
      if (dday === null) return false;
      if (deadlineFilter === 'd3' && dday > 3) return false;
      if (deadlineFilter === 'd7' && dday > 7) return false;
      if (dday < 0) return false; // 이미 마감된 것은 제외
    }

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
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
      {/* 헤더 */}
      <header className={`${darkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>지원사업 공고 수집기</h1>
          <div className="flex gap-4 items-center">
            {lastCrawl && (
              <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                마지막 수집: {formatDate(lastCrawl.crawled_at)}
              </span>
            )}
            {/* 다크모드 토글 */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-200 text-gray-600'} hover:opacity-80`}
              title={darkMode ? '라이트 모드' : '다크 모드'}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      {/* 필터 */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow p-4 mb-4`}>
          <div className="flex flex-wrap gap-3 items-center">
            {/* 소스 필터 */}
            <div className="flex items-center gap-1">
              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>소스:</span>
              <select
                value={source}
                onChange={(e) => { setSource(e.target.value); setPage(1); }}
                className={`border rounded px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
              >
                <option value="">전체</option>
                <option value="bizinfo">기업마당</option>
                <option value="agency">기관별</option>
                <option value="g2b">나라장터</option>
              </select>
            </div>

            {/* 정렬 */}
            <div className="flex items-center gap-1">
              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>정렬:</span>
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value as 'relevance' | 'date'); setPage(1); }}
                className={`border rounded px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
              >
                <option value="relevance">관련도순</option>
                <option value="date">최신순</option>
              </select>
            </div>

            {/* 점수 필터 */}
            <div className="flex items-center gap-1">
              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>점수:</span>
              <select
                value={scoreFilter}
                onChange={(e) => { setScoreFilter(e.target.value as 'all' | '10' | '9' | '8' | '7' | '6' | '5' | '4'); setPage(1); }}
                className={`border rounded px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
                disabled={!hideLowRelevance}
              >
                <option value="all">전체</option>
                <option value="10">10점</option>
                <option value="9">9점</option>
                <option value="8">8점</option>
                <option value="7">7점</option>
                <option value="6">6점</option>
                <option value="5">5점</option>
                <option value="4">4점 이하</option>
              </select>
            </div>

            {/* 마감 임박 필터 */}
            <div className="flex items-center gap-1">
              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>마감:</span>
              <select
                value={deadlineFilter}
                onChange={(e) => { setDeadlineFilter(e.target.value as 'all' | 'd7' | 'd3'); setPage(1); }}
                className={`border rounded px-3 py-2 text-sm ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : ''}`}
              >
                <option value="all">전체</option>
                <option value="d7">D-7 이내</option>
                <option value="d3">D-3 이내</option>
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
                className={`border rounded px-3 py-2 text-sm flex-1 ${darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : ''}`}
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
          <div className={`flex flex-wrap gap-6 mt-3 pt-3 border-t ${darkMode ? 'border-gray-700' : ''}`}>
            <label className={`flex items-center gap-2 text-sm cursor-pointer ${darkMode ? 'text-gray-300' : ''}`}>
              <input
                type="checkbox"
                checked={hideLowRelevance}
                onChange={(e) => { setHideLowRelevance(e.target.checked); setPage(1); }}
                className="w-4 h-4"
              />
              낮은 관련도 숨기기
            </label>
            <label className={`flex items-center gap-2 text-sm cursor-pointer ${darkMode ? 'text-gray-300' : ''}`}>
              <input
                type="checkbox"
                checked={hideExcluded}
                onChange={(e) => setHideExcluded(e.target.checked)}
                className="w-4 h-4"
              />
              관심없음 숨기기
            </label>
            <label className={`flex items-center gap-2 text-sm cursor-pointer ${darkMode ? 'text-gray-300' : ''}`}>
              <input
                type="checkbox"
                checked={showBookmarksOnly}
                onChange={(e) => { setShowBookmarksOnly(e.target.checked); setPage(1); }}
                className="w-4 h-4"
              />
              북마크만 보기 {bookmarkedUrls.size > 0 && `(${bookmarkedUrls.size})`}
            </label>
            <label className={`flex items-center gap-2 text-sm cursor-pointer ${darkMode ? 'text-gray-300' : ''}`}>
              <input
                type="checkbox"
                checked={showNoAiSummaryOnly}
                onChange={(e) => { setShowNoAiSummaryOnly(e.target.checked); setPage(1); }}
                className="w-4 h-4"
              />
              AI 요약 없는 것만
            </label>
          </div>

          {/* 점수별 통계 */}
          {Object.keys(scoreStats).length > 0 && (
            <div className={`flex flex-wrap gap-2 mt-3 pt-3 border-t ${darkMode ? 'border-gray-700' : ''}`}>
              <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mr-2`}>점수별:</span>
              {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(score => {
                const count = scoreStats[score] || 0;
                if (count === 0) return null;
                return (
                  <button
                    key={score}
                    onClick={() => {
                      if (score <= 4) {
                        setScoreFilter('4');
                      } else {
                        setScoreFilter(String(score) as '10' | '9' | '8' | '7' | '6' | '5');
                      }
                      setHideLowRelevance(true);
                      setPage(1);
                    }}
                    className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                      (scoreFilter === String(score) || (score <= 4 && scoreFilter === '4'))
                        ? 'bg-blue-600 text-white'
                        : score >= 8
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : score >= 6
                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {score}점: {count}건
                  </button>
                );
              })}
            </div>
          )}
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
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow`}>
          {loading ? (
            <div className={`p-8 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>로딩 중...</div>
          ) : displayNotices.length === 0 ? (
            <div className={`p-8 text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {total === 0
                ? '공고가 없습니다.'
                : '필터 조건에 맞는 공고가 없습니다. 필터를 조정해보세요.'}
            </div>
          ) : (
            <div className={`divide-y ${darkMode ? 'divide-gray-700' : ''}`}>
              {displayNotices.map((notice) => {
                const score = notice.llm_score ?? 0;
                const dday = calculateDday(notice.end_date);
                const ddayText = getDdayText(dday);
                const isNew = isNewNotice(notice);

                return (
                  <div
                    key={notice.id}
                    className={`p-4 ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'} ${isExcluded(notice.url) ? (darkMode ? 'bg-gray-900 opacity-60' : 'bg-gray-100 opacity-60') : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        {/* 제목 + 점수 + D-day + NEW */}
                        <div className="flex items-start gap-2 flex-wrap">
                          <span className={`px-2 py-1 rounded text-sm font-bold ${getScoreBgColor(score)}`}>
                            AI {score}점
                          </span>
                          {ddayText && (
                            <span className={`px-2 py-1 rounded text-xs font-bold ${getDdayColor(dday)}`}>
                              {ddayText}
                            </span>
                          )}
                          {isNew && (
                            <span className="px-2 py-1 rounded text-xs font-bold bg-pink-500 text-white animate-pulse">
                              NEW
                            </span>
                          )}
                          {isBookmarked(notice.url) && (
                            <span className="text-yellow-500 text-sm">⭐</span>
                          )}
                          <a
                            href={notice.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${darkMode ? 'text-blue-400' : 'text-blue-600'} hover:underline font-medium flex-1`}
                          >
                            {notice.title}
                          </a>
                        </div>

                        {/* 메타 정보 */}
                        <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} mt-2 ml-12 flex flex-wrap gap-2`}>
                          <span>{notice.agency}</span>
                          <span>•</span>
                          <span>{notice.date}</span>
                          {notice.end_date && (
                            <>
                              <span>•</span>
                              <span className={dday !== null && dday <= 7 && dday >= 0 ? 'text-red-500 font-medium' : ''}>
                                마감: {notice.end_date}
                              </span>
                            </>
                          )}
                          <span className={`px-2 py-0.5 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded text-xs`}>
                            {notice.source}
                          </span>
                          {isExcluded(notice.url) && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                              관심없음
                            </span>
                          )}
                        </div>

                        {/* AI 요약 (llm_reason) - 기본 2줄, 버튼으로 확장 */}
                        {notice.llm_reason && (
                          <p className={`text-sm mt-2 ml-12 p-2 rounded ${expandedNoticeIds.has(notice.id) ? '' : 'line-clamp-2'} ${darkMode ? 'text-green-400 bg-green-900/30 border border-green-800' : 'text-green-700 bg-green-50 border border-green-200'}`}>
                            AI: {notice.llm_reason}
                          </p>
                        )}

                        {/* 요약 (HTML 태그 제거) */}
                        {notice.summary && (
                          <p className={`text-sm mt-2 ml-12 p-2 rounded line-clamp-3 ${darkMode ? 'text-gray-400 bg-gray-700' : 'text-gray-600 bg-gray-50'}`}>
                            {stripHtml(notice.summary)}
                          </p>
                        )}
                      </div>

                      {/* 액션 버튼 */}
                      <div className="ml-4 flex flex-col gap-1">
                        {/* 북마크 버튼 */}
                        {isBookmarked(notice.url) ? (
                          <button
                            onClick={() => handleUnbookmark(notice)}
                            className="text-yellow-500 hover:text-yellow-600 text-xs px-2 py-1 border border-yellow-400 rounded hover:bg-yellow-50"
                            title="북마크 해제"
                          >
                            ⭐ 저장됨
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBookmark(notice)}
                            className={`text-xs px-2 py-1 border rounded ${darkMode ? 'text-gray-400 border-gray-600 hover:text-yellow-400 hover:border-yellow-400' : 'text-gray-400 border-gray-300 hover:text-yellow-500 hover:border-yellow-400'}`}
                            title="북마크"
                          >
                            ☆ 저장
                          </button>
                        )}
                        {/* AI 요약/평가 버튼 */}
                        {notice.llm_reason ? (
                          <button
                            onClick={() => handleToggleSummary(notice.id)}
                            className={`text-xs px-2 py-1 border rounded ${darkMode ? 'text-purple-400 border-purple-600 hover:bg-purple-900/30' : 'text-purple-500 border-purple-300 hover:text-purple-700 hover:bg-purple-50'}`}
                            title="AI 요약 보기"
                          >
                            {expandedNoticeIds.has(notice.id) ? '접기' : 'AI 요약'}
                          </button>
                        ) : evaluatingIds.has(notice.id) ? (
                          <span className={`text-xs px-2 py-1 rounded animate-pulse ${darkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-600'}`}>
                            평가 중...
                          </span>
                        ) : (
                          <button
                            onClick={() => handleEvaluate(notice)}
                            className={`text-xs px-2 py-1 border rounded ${darkMode ? 'text-green-400 border-green-600 hover:bg-green-900/30' : 'text-green-600 border-green-300 hover:text-green-700 hover:bg-green-50'}`}
                            title="AI 평가 실행"
                          >
                            AI 평가
                          </button>
                        )}
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
                            className={`text-xs px-2 py-1 ${darkMode ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
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
            <div className={`p-4 border-t flex justify-center gap-2 ${darkMode ? 'border-gray-700' : ''}`}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`px-3 py-1 border rounded disabled:opacity-50 ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : ''}`}
              >
                이전
              </button>
              <span className={`px-3 py-1 ${darkMode ? 'text-gray-300' : ''}`}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={`px-3 py-1 border rounded disabled:opacity-50 ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : ''}`}
              >
                다음
              </button>
            </div>
          )}
        </div>

        <div className={`text-sm mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          총 {total}건 표시 {excludedUrls.size > 0 && `(${excludedUrls.size}건 관심없음)`} {bookmarkedUrls.size > 0 && `(${bookmarkedUrls.size}건 북마크)`}
        </div>
      </div>

    </div>
  );
}
