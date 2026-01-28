import { supabase, Notice, CrawlLog } from '../lib/supabase';

// 공고 API
export const noticeApi = {
  getList: async (params: {
    source?: string;
    search?: string;
    page?: number;
    size?: number;
    minRelevance?: number;
    maxRelevance?: number;
    sortBy?: 'relevance' | 'date';
  }) => {
    const { source, search, page = 1, size = 20, minRelevance = 0, maxRelevance, sortBy = 'relevance' } = params;
    const offset = (page - 1) * size;

    let query = supabase
      .from('notices')
      .select('*', { count: 'exact' });

    // 1. 필터 먼저 적용
    // 소스 필터
    if (source) {
      const sourceMap: Record<string, string> = {
        bizinfo: '기업마당',
        agency: '기관별',
        g2b: '나라장터',
      };
      query = query.eq('source', sourceMap[source] || source);
    }

    // 검색
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    // AI 점수 없어도 조회 (llm_score NULL 허용)

    // 관련도 필터 (llm_score만 사용)
    if (minRelevance > 0 && maxRelevance !== undefined) {
      // 범위 필터 (예: 5~6점)
      query = query.gte('relevance', minRelevance).lte('relevance', maxRelevance);
    } else if (minRelevance > 0) {
      // 최소 관련도만 필터 (예: 7점 이상)
      query = query.gte('relevance', minRelevance);
    } else if (maxRelevance !== undefined) {
      // 최대 관련도만 필터 (예: 4점 이하)
      query = query.lte('relevance', maxRelevance);
    }

    // 2. 정렬
    if (sortBy === 'relevance') {
      query = query
        .order('relevance', { ascending: false })
        .order('llm_score', { ascending: false, nullsFirst: false })
        .order('crawled_at', { ascending: false })
        .order('created_at', { ascending: false });
    } else {
      query = query
        .order('crawled_at', { ascending: false })
        .order('created_at', { ascending: false });
    }

    // 3. 페이지네이션 마지막에 적용
    query = query.range(offset, offset + size - 1);

    const { data, count, error } = await query;

    if (error) throw error;

    return {
      items: data as Notice[],
      total: count || 0,
    };
  },

  getDetail: async (id: number) => {
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Notice;
  },

  // 점수별 통계 조회 (AI 점수만)
  getScoreStats: async () => {
    const { data, error } = await supabase
      .from('notices')
      .select('llm_score')
      .not('llm_score', 'is', null);

    if (error) throw error;

    // 점수별 건수 집계 (llm_score만)
    const stats: Record<number, number> = {};
    for (let i = 0; i <= 10; i++) {
      stats[i] = 0;
    }

    data?.forEach((item: { llm_score: number | null }) => {
      const score = item.llm_score ?? 0;
      if (score >= 0 && score <= 10) {
        stats[score]++;
      }
    });

    return stats;
  },
};

// 크롤링 로그 API
export const crawlApi = {
  getLogs: async (limit: number = 20) => {
    const { data, error } = await supabase
      .from('crawl_logs')
      .select('*')
      .order('crawled_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data as CrawlLog[];
  },
};

export default supabase;
