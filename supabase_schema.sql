-- Supabase 테이블 스키마
-- Supabase Dashboard > SQL Editor에서 실행

-- 1. notices 테이블 (공고)
CREATE TABLE notices (
    id BIGSERIAL PRIMARY KEY,
    url TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    agency TEXT,
    date TEXT,
    end_date TEXT,
    category TEXT,
    subcategory TEXT,
    relevance INTEGER DEFAULT 0,
    source TEXT,
    summary TEXT,  -- LLM 요약
    llm_score INTEGER,  -- LLM 관련도 점수
    llm_reason TEXT,  -- LLM 판단 이유
    crawled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. excluded_notices 테이블 (사용자별 제외 목록)
CREATE TABLE excluded_notices (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    notice_url TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, notice_url)
);

-- 3. crawl_logs 테이블 (크롤링 기록)
CREATE TABLE crawl_logs (
    id BIGSERIAL PRIMARY KEY,
    source TEXT NOT NULL,
    total_count INTEGER DEFAULT 0,
    new_count INTEGER DEFAULT 0,
    crawled_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 인덱스 생성
CREATE INDEX idx_notices_source ON notices(source);
CREATE INDEX idx_notices_created_at ON notices(created_at DESC);
CREATE INDEX idx_notices_relevance ON notices(relevance DESC);
CREATE INDEX idx_excluded_user ON excluded_notices(user_id);
CREATE INDEX idx_excluded_url ON excluded_notices(notice_url);

-- 5. Row Level Security (RLS) 설정

-- notices: 모든 인증된 사용자가 읽기 가능, 서비스 롤만 쓰기 가능
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notices_read_policy" ON notices
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "notices_insert_policy" ON notices
    FOR INSERT TO service_role
    WITH CHECK (true);

CREATE POLICY "notices_update_policy" ON notices
    FOR UPDATE TO service_role
    USING (true);

-- excluded_notices: 자신의 데이터만 접근 가능
ALTER TABLE excluded_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "excluded_select_own" ON excluded_notices
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "excluded_insert_own" ON excluded_notices
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "excluded_delete_own" ON excluded_notices
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- crawl_logs: 모든 인증된 사용자가 읽기 가능
ALTER TABLE crawl_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crawl_logs_read_policy" ON crawl_logs
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "crawl_logs_insert_policy" ON crawl_logs
    FOR INSERT TO service_role
    WITH CHECK (true);

-- 6. 익명 사용자도 notices 읽기 허용 (선택사항)
-- CREATE POLICY "notices_anon_read" ON notices
--     FOR SELECT TO anon
--     USING (true);
