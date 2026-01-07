"""
기업마당 API 크롤러
"""
import requests
import logging
from datetime import datetime

# API 키
BIZINFO_API_KEY = "f5a2L4"


class BizinfoCrawler:
    """기업마당 API 크롤러"""

    API_URL = "https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do"

    def __init__(self, api_key: str = BIZINFO_API_KEY):
        self.api_key = api_key
        self.logger = logging.getLogger(__name__)

    def crawl(self, count: int = 500) -> list:
        """지원사업 목록 조회"""
        try:
            params = {
                "crtfcKey": self.api_key,
                "dataType": "json",
                "searchCnt": count
            }

            self.logger.info(f"기업마당 API 호출 중... (최대 {count}건)")
            response = requests.get(self.API_URL, params=params, timeout=30)
            response.raise_for_status()

            data = response.json()

            # 에러 체크
            if "reqErr" in data:
                self.logger.error(f"API 오류: {data.get('reqErr')}")
                return []

            items = []
            raw_items = data.get("jsonArray", [])

            for item in raw_items:
                parsed = self._parse_item(item)
                if parsed:
                    items.append(parsed)

            self.logger.info(f"기업마당 API: {len(items)}건 조회 완료")
            return items

        except requests.exceptions.RequestException as e:
            self.logger.error(f"API 요청 실패: {e}")
            return []
        except Exception as e:
            self.logger.error(f"API 처리 오류: {e}")
            return []

    def _parse_item(self, item: dict) -> dict:
        """API 응답 항목 파싱"""
        try:
            title = item.get("pblancNm", "")
            if not title:
                return None

            # 마감일 확인
            end_date = item.get("reqstEndDe", "")
            status = self._get_status(end_date)

            # 마감된 공고는 제외
            if status == "마감":
                return None

            # 필드 추출
            parsed = {
                "title": title,
                "agency": item.get("jrsdInsttNm", ""),
                "date": item.get("creatPnttm", ""),
                "end_date": end_date,
                "detail_url": item.get("pblancUrl", ""),
                "summary": item.get("bsnsSumryCn", ""),
                "category": item.get("pldirSportRealmLclasCodeNm", ""),
                "subcategory": item.get("pldirSportRealmMlsfcCodeNm", ""),
                "hashtags": item.get("hashtags", ""),
                "target": item.get("trgetNm", ""),
                "executor": item.get("excInsttNm", ""),
                "crawled_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "status": status,
                "source": "기업마당"
            }

            # 관련도 계산
            parsed["relevance"] = self._calculate_relevance(parsed)

            return parsed
        except Exception as e:
            self.logger.error(f"항목 파싱 실패: {e}")
            return None

    def _calculate_relevance(self, item: dict) -> int:
        """관련도 계산"""
        title = item.get("title", "").lower()
        summary = item.get("summary", "").lower()
        category = item.get("category", "").lower()
        subcategory = item.get("subcategory", "").lower()
        hashtags = item.get("hashtags", "").lower()

        # 대분류 제외 (금융)
        if "금융" in category:
            return 0

        # 소분류 제외
        exclude_subcategories = ["융자", "출자", "투자", "대출", "보증"]
        for sub in exclude_subcategories:
            if sub in subcategory:
                return 0

        # 텍스트 기반 필터링
        all_text = f"{title} {summary} {hashtags}"

        # 제외 키워드
        exclude_keywords = [
            "융자", "대출", "전시회", "박람회", "채용", "인턴", "교육생",
            "참여기업", "수요기업", "입주기업", "수혜기업",
            "농업", "축산", "수산", "어업", "임업", "귀농", "귀촌",
            "의료", "바이오", "제약", "헬스케어",
            "에너지", "신재생", "탄소중립",
            "반도체", "배터리", "자동차", "조선",
            "건설", "건축", "토목", "부동산"
        ]
        for kw in exclude_keywords:
            if kw in all_text:
                return 0

        # 수행기관/디자인 키워드
        provider_keywords = ["바우처", "수행기관", "전문기관", "참여기관", "지정기관", "공급기업"]
        service_keywords = ["디자인", "브랜드", "브랜딩", "패키지", "ui", "ux", "시각", "ci", "bi"]

        has_provider = any(kw in all_text for kw in provider_keywords)
        has_service = any(kw in all_text for kw in service_keywords)

        if not has_provider and not has_service:
            return 0

        # 점수 계산
        score = 0
        if has_provider:
            score += 5
        for kw in service_keywords:
            if kw in all_text:
                score += 3

        return min(score, 10)

    def _get_status(self, end_date: str) -> str:
        """마감일 기준 상태 반환"""
        if not end_date:
            return "확인필요"

        try:
            if len(end_date) == 8:
                end = datetime.strptime(end_date, "%Y%m%d")
            else:
                end = datetime.strptime(end_date[:10], "%Y-%m-%d")

            today = datetime.now()
            if end < today:
                return "마감"
            elif (end - today).days <= 7:
                return "마감임박"
            else:
                return "접수중"
        except:
            return "확인필요"
