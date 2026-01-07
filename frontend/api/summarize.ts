import Anthropic from '@anthropic-ai/sdk';

export const config = {
  runtime: 'edge',
};

// HTML 태그 제거
function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

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
    const { url, title, agency } = await req.json();

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. URL 내용 크롤링
    let content = '';
    try {
      const pageResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (pageResponse.ok) {
        const html = await pageResponse.text();
        content = extractTextFromHtml(html);
      }
    } catch (fetchError) {
      console.error('URL fetch error:', fetchError);
    }

    // 내용이 없으면 제목만으로 요약
    if (!content || content.length < 100) {
      content = `제목: ${title}\n기관: ${agency}`;
    }

    // 2. Claude API 호출
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `다음 공고를 구조화된 형식으로 요약해주세요. 이모지를 사용하여 가독성을 높여주세요.

## 요약 형식
📢 [공고 제목 요약]
🏢 기관: [기관명]

📋 주요 내용
- [핵심 내용 3-5개]

🎯 지원 대상
- [대상 정보]

💰 지원 내용/규모
- [금액, 혜택 등]

⏰ 일정
- 접수기간: [기간]
- 마감일: [날짜]

📞 문의: [연락처]

정보가 없는 항목은 생략하세요.

## 공고 정보
제목: ${title}
기관: ${agency || '미상'}
내용:
${content.slice(0, 8000)}`,
        },
      ],
    });

    const summary = message.content[0].type === 'text' ? message.content[0].text : '';

    return new Response(JSON.stringify({ summary }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Summarize error:', error);
    return new Response(
      JSON.stringify({ error: '요약 생성에 실패했습니다.', details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
