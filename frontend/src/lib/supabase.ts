import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL과 Key가 설정되지 않았습니다. .env 파일을 확인해주세요.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 타입 정의
export interface Notice {
  id: number;
  url: string;
  title: string;
  agency: string | null;
  date: string | null;
  end_date: string | null;
  category: string | null;
  subcategory: string | null;
  relevance: number;
  source: string | null;
  summary: string | null;
  llm_score: number | null;
  llm_reason: string | null;
  crawled_at: string | null;
  created_at: string;
}

export interface ExcludedNotice {
  id: number;
  user_id: string;
  notice_url: string;
  reason: string | null;
  created_at: string;
}

export interface CrawlLog {
  id: number;
  source: string;
  total_count: number;
  new_count: number;
  crawled_at: string;
}
