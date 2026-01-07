"""
나라장터 API 크롤러
"""
import requests
import logging
import time
from datetime import datetime, timedelta

# API 키
G2B_API_KEY = "cd1ef8e6f8a0c7de0bcbfd8cd98951abfaabc02ba05a869ed7ea5cc0ab50ccb9"


class G2BCrawler:
    """나라장터 API 크롤러 (입찰공고)"""

    API_URL = "https://apis.data.go.kr/1230000/ao/PubDataOpnStdService/getDataSetOpnStdBidPblancInfo"

    def __init__(self, api_key: str = G2B_API_KEY):
        self.api_key = api_key
        self.logger = logging.getLogger(__name__)

    def crawl(self, days: int = 30) -> list:
        """최근 N일간 용역 입찰공고 조회 - 여러 페이지 스캔"""
        try:
            today = datetime.now()
            start_date = (today - timedelta(days=days)).strftime("%Y%m%d0000")
            end_date = today.strftime("%Y%m%d2359")

            self.logger.info(f"나라장터 API 호출 중... (최근 {days}일)")

            all_parsed_items = []
            # 용역 공고는 뒤쪽 페이지에 많으므로 앞/뒤 모두 조회
            pages_to_scan = list(range(1, 6)) + list(range(50, 61))

            for page in pages_to_scan:
                params = {
                    "serviceKey": self.api_key,
                    "numOfRows": 500,
                    "pageNo": page,
                    "bidNtceBgnDt": start_date,
                    "bidNtceEndDt": end_date,
                    "type": "json"
                }

                response = requests.get(self.API_URL, params=params, timeout=60)
                response.raise_for_status()

                data = response.json()

                # 응답 구조 확인
                body = data.get("response", {}).get("body", {})
                items = body.get("items", [])

                if not items:
                    break

                if isinstance(items, dict):
                    items = [items.get("item", items)]
                elif not isinstance(items, list):
                    items = [items]

                # 페이지별 용역 필터링
                page_service_count = 0
                for item in items:
                    if isinstance(item, dict):
                        parsed = self._parse_item(item)
                        if parsed:
                            all_parsed_items.append(parsed)
                            page_service_count += 1

                self.logger.info(f"  페이지 {page}: 용역 {page_service_count}건")

                # 충분히 수집했으면 중단
                if len(all_parsed_items) >= 100:
                    break

                time.sleep(0.3)

            self.logger.info(f"나라장터 API: 총 {len(all_parsed_items)}건 용역 조회 완료")
            return all_parsed_items

        except requests.exceptions.RequestException as e:
            self.logger.error(f"나라장터 API 요청 실패: {e}")
            return []
        except Exception as e:
            self.logger.error(f"나라장터 API 처리 오류: {e}")
            return []

    def _parse_item(self, item: dict) -> dict:
        """API 응답 항목 파싱"""
        try:
            title = item.get("bidNtceNm", "")
            if not title:
                return None

            # 용역 카테고리만 필터링
            bsns_div = item.get("bsnsDivNm", "")
            if bsns_div and "용역" not in bsns_div:
                return None

            # 마감일 파싱
            end_date = item.get("bidClseDate", "")
            end_time = item.get("bidClseTm", "")
            end_date_str = f"{end_date}{end_time}" if end_date and end_time else end_date
            status = self._get_status(end_date_str)

            if status == "마감":
                return None

            # 관련도 계산
            relevance = self._calculate_relevance(title, item.get("ntceInsttNm", ""))
            if relevance == 0:
                return None

            # 공고일시 조합
            ntce_date = item.get("bidNtceDate", "")
            ntce_bgn = item.get("bidNtceBgn", "")
            ntce_datetime = f"{ntce_date} {ntce_bgn}" if ntce_date else ""

            return {
                "title": title,
                "agency": item.get("ntceInsttNm", ""),
                "date": ntce_datetime,
                "end_date": end_date_str,
                "detail_url": item.get("bidNtceUrl", ""),
                "budget": item.get("presmptPrce", ""),
                "category": "용역",
                "subcategory": item.get("bidNtceNm", "")[:20] if item.get("bidNtceNm") else "",
                "relevance": relevance,
                "crawled_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "status": status,
                "source": "나라장터"
            }
        except Exception as e:
            self.logger.error(f"나라장터 항목 파싱 실패: {e}")
            return None

    def _calculate_relevance(self, title: str, agency: str) -> int:
        """관련도 계산"""
        text = (title + " " + agency).lower()

        # 제외 키워드
        exclude_keywords = [
            "건설", "토목", "건축", "시설", "공사", "보수", "유지보수",
            "청소", "경비", "보안", "급식", "식자재", "의료", "약품",
            "차량", "운송", "배송", "폐기물", "소각", "감리", "측량",
            "전기", "통신", "설비", "소방", "안전진단"
        ]
        for kw in exclude_keywords:
            if kw in text:
                return 0

        # 핵심 키워드
        high_keywords = [
            "디자인", "브랜드", "브랜딩", "ci", "bi", "로고", "아이덴티티",
            "홈페이지", "웹사이트", "웹", "카탈로그", "리플렛", "브로슈어",
            "패키지", "포장", "편집", "인쇄", "출판"
        ]
        mid_keywords = [
            "홍보", "마케팅", "광고", "콘텐츠", "영상", "제작", "캠페인",
            "sns", "소셜", "미디어", "촬영", "사진", "이미지", "그래픽",
            "일러스트", "캐릭터", "슬로건", "네이밍", "카피"
        ]
        low_keywords = ["컨설팅", "기획", "전략", "리뉴얼", "개편", "구축"]

        score = 0
        for kw in high_keywords:
            if kw in text:
                score += 4
        for kw in mid_keywords:
            if kw in text:
                score += 2
        for kw in low_keywords:
            if kw in text:
                score += 1

        return min(score, 10) if score >= 1 else 0

    def _get_status(self, end_date_str: str) -> str:
        """마감일 기준 상태 반환"""
        if not end_date_str:
            return "확인필요"

        try:
            if len(end_date_str) >= 12:
                end = datetime.strptime(end_date_str[:12], "%Y%m%d%H%M")
            elif len(end_date_str) >= 8:
                end = datetime.strptime(end_date_str[:8], "%Y%m%d")
            else:
                return "확인필요"

            today = datetime.now()
            if end < today:
                return "마감"
            elif (end - today).days <= 3:
                return "마감임박"
            else:
                return "접수중"
        except:
            return "확인필요"
