import { supabase, Notice, ExcludedNotice, CrawlLog } from '../lib/supabase';

// 공고 API
export const noticeApi = {
  getList: async (params: { source?: string; search?: string; page?: number; size?: number }) => {
    const { source, search, page = 1, size = 20 } = params;
    const offset = (page - 1) * size;

    let query = supabase
      .from('notices')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + size - 1);

    if (source) {
      const sourceMap: Record<string, string> = {
        bizinfo: '기업마당',
        agency: '기관별',
        g2b: '나라장터',
      };
      query = query.eq('source', sourceMap[source] || source);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
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

// 제외 API
export const excludeApi = {
  getList: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다');

    const { data, error } = await supabase
      .from('excluded_notices')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as ExcludedNotice[];
  },

  getExcludedUrls: async (): Promise<Set<string>> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Set();

    const { data, error } = await supabase
      .from('excluded_notices')
      .select('notice_url')
      .eq('user_id', user.id);

    if (error) throw error;
    return new Set((data || []).map(e => e.notice_url));
  },

  add: async (noticeUrl: string, reason?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다');

    const { data, error } = await supabase
      .from('excluded_notices')
      .insert({
        user_id: user.id,
        notice_url: noticeUrl,
        reason: reason || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as ExcludedNotice;
  },

  remove: async (id: number) => {
    const { error } = await supabase
      .from('excluded_notices')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { message: '제외 해제되었습니다' };
  },

  removeByUrl: async (noticeUrl: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다');

    const { error } = await supabase
      .from('excluded_notices')
      .delete()
      .eq('user_id', user.id)
      .eq('notice_url', noticeUrl);

    if (error) throw error;
    return { message: '제외 해제되었습니다' };
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

// 인증 API
export const authApi = {
  signUp: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  getUser: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },
};

export default supabase;
