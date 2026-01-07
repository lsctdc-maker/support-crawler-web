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

    // 정렬: 관련도 순 또는 날짜순
    if (sortBy === 'relevance') {
      // AI 점수 우선, 없으면 일반 관련도
      query = query
        .order('llm_score', { ascending: false, nullsFirst: false })
        .order('relevance', { ascending: false })
        .order('created_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    query = query.range(offset, offset + size - 1);

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

    // 관련도 범위 필터
    if (minRelevance > 0 && maxRelevance !== undefined) {
      // 범위 필터 (예: 6~7점)
      query = query.or(
        `and(llm_score.gte.${minRelevance},llm_score.lte.${maxRelevance}),and(llm_score.is.null,relevance.gte.${minRelevance},relevance.lte.${maxRelevance})`
      );
    } else if (minRelevance > 0) {
      // 최소 관련도만 필터
      query = query.or(`llm_score.gte.${minRelevance},and(llm_score.is.null,relevance.gte.${minRelevance})`);
    } else if (maxRelevance !== undefined) {
      // 최대 관련도만 필터 (5점 이하)
      query = query.or(
        `llm_score.lte.${maxRelevance},and(llm_score.is.null,relevance.lte.${maxRelevance})`
      );
    }

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
