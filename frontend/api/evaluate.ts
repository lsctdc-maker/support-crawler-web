import Anthropic from '@anthropic-ai/sdk';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  // CORS 헤더
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // OPTIONS 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { id, title, agency, summary } = await req.json();

    if (!id || !title) {
      return new Response(JSON.stringify({ error: 'id and title are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Claude API 호출
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const prompt = `다음 공고가 "디자인 에이전시"가 참여할 수 있는 용역인지 평가해주세요.

## 평가 기준
- 디자인 관련: CI/BI, 브랜드, 로고, 패키지, 편집, 웹사이트, UI/UX
- 홍보/마케팅: 홍보물, 콘텐츠, 영상, 사진, 광고
- 제외 대상: 건설, 토목, 의료, 농업, 채용, 교육, 융자

## 공고 정보
- 제목: ${title}
- 기관: ${agency || '미상'}
- 요약: ${summary?.slice(0, 200) || '없음'}

## 응답 형식 (JSON만 출력)
{"score": 0-10, "reason": "2-3문장으로 디자인 에이전시가 참여 가능한지, 어떤 서비스(CI/BI, 브랜드, 웹사이트 등)를 제공할 수 있는지 설명"}

점수 기준:
- 8-10: 디자인 에이전시가 직접 수행 가능 (CI/BI, 브랜드, 웹사이트 등)
- 5-7: 관련 가능성 있음
- 1-4: 약간의 연관성
- 0: 전혀 관련 없음`;

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // JSON 파싱 (Claude가 마크다운 코드블록으로 감싸는 경우 처리)
    let result: { score: number; reason: string };
    try {
      // 코드블록 제거
      const jsonStr = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      result = JSON.parse(jsonStr);
    } catch {
      // JSON 파싱 실패 시 정규식으로 추출
      const scoreMatch = responseText.match(/"score"\s*:\s*(\d+)/);
      const reasonMatch = responseText.match(/"reason"\s*:\s*"([^"]+)"/);
      result = {
        score: scoreMatch ? parseInt(scoreMatch[1], 10) : 0,
        reason: reasonMatch ? reasonMatch[1] : responseText.slice(0, 200),
      };
    }

    return new Response(JSON.stringify({ id, score: result.score, reason: result.reason }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Evaluate error:', error);
    return new Response(
      JSON.stringify({ error: 'AI 평가에 실패했습니다.', details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
