"""
기관별 Selenium 크롤러
"""
import logging
import time
import re
from datetime import datetime, timedelta

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException


class AgencyCrawler:
    """Selenium 기반 기관별 크롤러"""

    # 크롤링 대상 기관 목록 (전체)
    AGENCIES = {
        # === 1순위: 핵심 기관 ===
        "kidp": {
            "name": "한국디자인진흥원",
            "url": "https://www.kidp.or.kr/?menuno=1202",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(4)",
        },
        "kiat": {
            "name": "한국산업기술진흥원",
            "url": "https://www.kiat.or.kr/front/board/boardContentsListPage.do?board_id=90",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(5)",
        },
        "kocca": {
            "name": "한국콘텐츠진흥원",
            "url": "https://www.kocca.kr/kocca/bbs/list/B0000204.do?categorys=2&subcate=50&cateCode=0&menuNo=204897",
            "list_selector": "table tbody tr",
            "title_selector": "td.subject a, td a",
            "date_selector": "td:nth-child(5)",
        },
        "gbsa": {
            "name": "경기도경제과학진흥원",
            "url": "https://egbiz.or.kr/user/bbs/BD_selectBbsList.do?q_bbsSn=1004",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(5)",
            "wait_time": 6,
        },
        "kotra": {
            "name": "KOTRA 수출바우처",
            "url": "https://www.exportvoucher.com/portal/bizinfo/support_01",
            "list_selector": "table tbody tr, .list-table tbody tr",
            "title_selector": "td a, .title a",
            "date_selector": "td:nth-child(4), .date",
        },
        "sba": {
            "name": "서울경제진흥원",
            "url": "http://211.45.214.168/Pages/BusinessApply/Posting.aspx",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(4)",
        },
        # === 2순위: 테크노파크 ===
        "seoultp": {
            "name": "서울테크노파크",
            "url": "https://www.seoultp.or.kr/user/nd19746.do",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(4)",
        },
        "itp": {
            "name": "인천테크노파크",
            "url": "https://www.itp.or.kr/intro.asp?tmid=13&st=1",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(4)",
        },
        "gtp": {
            "name": "경기테크노파크",
            "url": "https://pms.gtp.or.kr/web/business/webBusinessList.do",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(5)",
        },
        "gwtp": {
            "name": "강원테크노파크",
            "url": "https://www.gwtp.or.kr/gwtp/bbsNew_list.php?code=sub01b&keyvalue=sub01",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(4)",
        },
        "ctp": {
            "name": "충남테크노파크",
            "url": "https://www.ctp.or.kr/business/data.do",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(4)",
        },
        "djtp": {
            "name": "대전테크노파크",
            "url": "https://www.djtp.or.kr/board.es?mid=a20102000000&bid=0102",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(4)",
        },
        "sjtp": {
            "name": "세종테크노파크",
            "url": "https://www.sjtp.or.kr/bbs/board.php?bo_table=business01",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(4)",
        },
        "jbtp": {
            "name": "전북테크노파크",
            "url": "https://www.jbtp.or.kr/board/list.jbtp?boardId=BBS_0000006&menuCd=DOM_000000102001000000&contentsSid=9&cpath=",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(4)",
        },
        "jntp": {
            "name": "전남테크노파크",
            "url": "https://www.jntp.or.kr/base/board/list?boardManagementNo=11&menuLevel=2&menuNo=44",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(4)",
        },
        "gjtp": {
            "name": "광주테크노파크",
            "url": "https://www.gjtp.or.kr/home/business.cs",
            "list_selector": "table tbody tr, ul.list li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date",
        },
        "gbtp": {
            "name": "경북테크노파크",
            "url": "https://www.gbtp.or.kr/user/board.do?bbsId=BBSMSTR_000000000023",
            "list_selector": "table tbody tr",
            "title_selector": "td:nth-child(3) a",
            "date_selector": "td:nth-child(4)",
        },
        "btp": {
            "name": "부산테크노파크",
            "url": "https://www.btp.or.kr/kor/CMS/Board/Board.do?mCode=MN013",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(4)",
        },
        "utp": {
            "name": "울산테크노파크",
            "url": "https://www.utp.or.kr/board/board.php?bo_table=sub0203_02",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(4)",
        },
        "jejutp": {
            "name": "제주테크노파크",
            "url": "https://www.jejutp.or.kr/board/business",
            "list_selector": "table tbody tr, ul li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date",
        },
        "dgtp": {
            "name": "대구테크노파크",
            "url": "https://dgtp.or.kr/bbs/BoardControll.do?bbsId=BBSMSTR_000000000003",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(4)",
        },
        "cbtp": {
            "name": "충북테크노파크",
            "url": "https://www.cbtp.or.kr/index.php?control=bbs&board_id=saup_notice&lm_uid=387",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(4)",
            "wait_time": 6,
        },
        "gntp": {
            "name": "경남테크노파크",
            "url": "https://www.gntp.or.kr/biz/apply",
            "list_selector": "table tbody tr, ul li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date",
        },
        # === 3순위: 디자인센터 ===
        "motir": {
            "name": "산업통상자원부",
            "url": "https://www.motir.go.kr/kor/article/ATCL2826a2625",
            "list_selector": "table tbody tr",
            "title_selector": "td:nth-child(2) a",
            "date_selector": "td:nth-child(4)",
        },
        "gidp": {
            "name": "경기디자인센터",
            "url": "https://www.gidp.kr/gidp/notice/notification",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(4)",
        },
        "gdc": {
            "name": "광주디자인센터",
            "url": "https://www.gdc.or.kr/board.do?S=S01&M=0403000000&b_code=0004",
            "list_selector": "table tbody tr",
            "title_selector": "td:nth-child(2) a",
            "date_selector": "td:nth-child(4)",
        },
        "dgdp": {
            "name": "대구경북디자인센터",
            "url": "https://www.dgdp.or.kr/notice/public",
            "list_selector": "table.table tbody tr",
            "title_selector": "td p, td a",
            "date_selector": "td:nth-child(6)",
        },
        "didp": {
            "name": "대전디자인센터",
            "url": "https://www.didp.or.kr/notification_notice",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(5)",
        },
        "dcb": {
            "name": "부산디자인센터",
            "url": "https://www.dcb.or.kr/01_news/?mcode=0401010000",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(7)",
        },
        "sdf_notice": {
            "name": "서울디자인재단(공지)",
            "url": "https://seouldesign.or.kr/?menuno=17&cateno=131",
            "list_selector": "tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(5)",
        },
        "sdf_bid": {
            "name": "서울디자인재단(입찰)",
            "url": "https://seouldesign.or.kr/?menuno=18&cateno=132",
            "list_selector": "tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(5)",
        },
        "designdb": {
            "name": "디자인DB",
            "url": "https://dkworks.designdb.com/web/board/noticeList.do",
            "list_selector": "table tbody tr",
            "title_selector": "td a",
            "date_selector": "td:nth-child(5)",
        },
        # === 4순위: 지방중소벤처기업청 ===
        "mss_seoul": {
            "name": "서울지방중소벤처기업청",
            "url": "https://www.mss.go.kr/site/seoul/ex/bbs/List.do?cbIdx=146",
            "list_selector": "table tbody tr",
            "title_selector": "td.title a, td a",
            "date_selector": "td:nth-child(4)",
        },
        "mss_busan": {
            "name": "부산지방중소벤처기업청",
            "url": "https://www.mss.go.kr/site/busan/ex/bbs/List.do?cbIdx=256",
            "list_selector": "table tbody tr",
            "title_selector": "td.title a, td a",
            "date_selector": "td:nth-child(4)",
        },
        "mss_daegu": {
            "name": "대구경북지방중소벤처기업청",
            "url": "https://www.mss.go.kr/site/daegu/ex/bbs/List.do?cbIdx=253",
            "list_selector": "table tbody tr",
            "title_selector": "td.title a, td a",
            "date_selector": "td:nth-child(4)",
        },
        "mss_incheon": {
            "name": "인천지방중소벤처기업청",
            "url": "https://www.mss.go.kr/site/incheon/ex/bbs/List.do?cbIdx=246",
            "list_selector": "table tbody tr",
            "title_selector": "td.title a, td a",
            "date_selector": "td:nth-child(4)",
        },
        "mss_gwangju": {
            "name": "광주전남지방중소벤처기업청",
            "url": "https://www.mss.go.kr/site/gwangju/ex/bbs/List.do?cbIdx=251",
            "list_selector": "table tbody tr",
            "title_selector": "td.title a, td a",
            "date_selector": "td:nth-child(4)",
        },
        "mss_daejeon": {
            "name": "대전세종충남지방중소벤처기업청",
            "url": "https://www.mss.go.kr/site/daejeon/ex/bbs/List.do?cbIdx=248",
            "list_selector": "table tbody tr",
            "title_selector": "td.title a, td a",
            "date_selector": "td:nth-child(4)",
        },
        "mss_gyeonggi": {
            "name": "경기지방중소벤처기업청",
            "url": "https://www.mss.go.kr/site/gyeonggi/ex/bbs/List.do?cbIdx=247",
            "list_selector": "table tbody tr",
            "title_selector": "td.title a, td a",
            "date_selector": "td:nth-child(4)",
        },
        "mss_gangwon": {
            "name": "강원지방중소벤처기업청",
            "url": "https://www.mss.go.kr/site/gangwon/ex/bbs/List.do?cbIdx=252",
            "list_selector": "table tbody tr",
            "title_selector": "td.title a, td a",
            "date_selector": "td:nth-child(4)",
        },
        "mss_chungbuk": {
            "name": "충북지방중소벤처기업청",
            "url": "https://www.mss.go.kr/site/chungbuk/ex/bbs/List.do?cbIdx=249",
            "list_selector": "table tbody tr",
            "title_selector": "td.title a, td a",
            "date_selector": "td:nth-child(4)",
        },
        "mss_jeonbuk": {
            "name": "전북지방중소벤처기업청",
            "url": "https://www.mss.go.kr/site/jeonbuk/ex/bbs/List.do?cbIdx=250",
            "list_selector": "table tbody tr",
            "title_selector": "td.title a, td a",
            "date_selector": "td:nth-child(4)",
        },
        "mss_gyeongnam": {
            "name": "경남지방중소벤처기업청",
            "url": "https://www.mss.go.kr/site/gyeongnam/ex/bbs/List.do?cbIdx=255",
            "list_selector": "table tbody tr",
            "title_selector": "td.title a, td a",
            "date_selector": "td:nth-child(4)",
        },
        "mss_ulsan": {
            "name": "울산지방중소벤처기업청",
            "url": "https://www.mss.go.kr/site/ulsan/ex/bbs/List.do?cbIdx=254",
            "list_selector": "table tbody tr",
            "title_selector": "td.title a, td a",
            "date_selector": "td:nth-child(4)",
        },
        # === 5순위: 창조경제혁신센터 ===
        "ccei_seoul": {
            "name": "서울창조경제혁신센터",
            "url": "https://ccei.creativekorea.or.kr/seoul/custom/notice_list.do",
            "list_selector": "table tbody tr, ul.board-list li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date, span.date",
        },
        "ccei_busan": {
            "name": "부산창조경제혁신센터",
            "url": "https://ccei.creativekorea.or.kr/busan/custom/notice_list.do",
            "list_selector": "table tbody tr, ul.board-list li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date, span.date",
        },
        "ccei_daegu": {
            "name": "대구창조경제혁신센터",
            "url": "https://ccei.creativekorea.or.kr/daegu/custom/notice_list.do",
            "list_selector": "table tbody tr, ul.board-list li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date, span.date",
        },
        "ccei_incheon": {
            "name": "인천창조경제혁신센터",
            "url": "https://ccei.creativekorea.or.kr/incheon/custom/notice_list.do",
            "list_selector": "table tbody tr, ul.board-list li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date, span.date",
        },
        "ccei_gwangju": {
            "name": "광주창조경제혁신센터",
            "url": "https://ccei.creativekorea.or.kr/gwangju/custom/notice_list.do",
            "list_selector": "table tbody tr, ul.board-list li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date, span.date",
        },
        "ccei_daejeon": {
            "name": "대전창조경제혁신센터",
            "url": "https://ccei.creativekorea.or.kr/daejeon/custom/notice_list.do",
            "list_selector": "table tbody tr, ul.board-list li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date, span.date",
        },
        "ccei_ulsan": {
            "name": "울산창조경제혁신센터",
            "url": "https://ccei.creativekorea.or.kr/ulsan/custom/notice_list.do",
            "list_selector": "table tbody tr, ul.board-list li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date, span.date",
        },
        "ccei_sejong": {
            "name": "세종창조경제혁신센터",
            "url": "https://ccei.creativekorea.or.kr/sejong/custom/notice_list.do",
            "list_selector": "table tbody tr, ul.board-list li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date, span.date",
        },
        "ccei_gyeonggi": {
            "name": "경기창조경제혁신센터",
            "url": "https://ccei.creativekorea.or.kr/gyeonggi/custom/notice_list.do",
            "list_selector": "table tbody tr, ul.board-list li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date, span.date",
        },
        "ccei_gangwon": {
            "name": "강원창조경제혁신센터",
            "url": "https://ccei.creativekorea.or.kr/gangwon/custom/notice_list.do",
            "list_selector": "table tbody tr, ul.board-list li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date, span.date",
        },
        "ccei_chungbuk": {
            "name": "충북창조경제혁신센터",
            "url": "https://ccei.creativekorea.or.kr/chungbuk/custom/notice_list.do",
            "list_selector": "table tbody tr, ul.board-list li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date, span.date",
        },
        "ccei_chungnam": {
            "name": "충남창조경제혁신센터",
            "url": "https://ccei.creativekorea.or.kr/chungnam/custom/notice_list.do",
            "list_selector": "table tbody tr, ul.board-list li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date, span.date",
        },
        "ccei_jeonbuk": {
            "name": "전북창조경제혁신센터",
            "url": "https://ccei.creativekorea.or.kr/jeonbuk/custom/notice_list.do",
            "list_selector": "table tbody tr, ul.board-list li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date, span.date",
        },
        "ccei_jeonnam": {
            "name": "전남창조경제혁신센터",
            "url": "https://ccei.creativekorea.or.kr/jeonnam/custom/notice_list.do",
            "list_selector": "table tbody tr, ul.board-list li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date, span.date",
        },
        "ccei_gyeongbuk": {
            "name": "경북창조경제혁신센터",
            "url": "https://ccei.creativekorea.or.kr/gyeongbuk/custom/notice_list.do",
            "list_selector": "table tbody tr, ul.board-list li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date, span.date",
        },
        "ccei_gyeongnam": {
            "name": "경남창조경제혁신센터",
            "url": "https://ccei.creativekorea.or.kr/gyeongnam/custom/notice_list.do",
            "list_selector": "table tbody tr, ul.board-list li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date, span.date",
        },
        "ccei_jeju": {
            "name": "제주창조경제혁신센터",
            "url": "https://ccei.creativekorea.or.kr/jeju/custom/notice_list.do",
            "list_selector": "table tbody tr, ul.board-list li",
            "title_selector": "td a, a",
            "date_selector": "td:nth-child(4), .date, span.date",
        },
    }

    # 모집공고 필수 키워드
    REQUIRED_KEYWORDS = [
        "모집", "공모", "공고", "참여", "신청", "지원사업", "지원 사업",
        "수행기관", "전문기관", "바우처", "사업자", "기업 모집"
    ]

    # 제외 키워드
    EXCLUDE_KEYWORDS = [
        "결과 발표", "선정 결과", "선정결과", "합격자", "최종 선정",
        "취소", "연기", "변경 안내", "휴무", "채용", "직원 모집",
        "교육 안내", "세미나", "설명회", "워크숍",
        "마감", "접수마감", "신청마감", "모집마감",
        "종료", "모집종료", "접수종료",
        "완료", "선정완료", "모집완료",
        "기간연장", "기간 연장", "재공고"
    ]

    # 관련 분야 키워드
    FIELD_KEYWORDS = [
        "디자인", "브랜드", "브랜딩", "ci", "bi", "로고",
        "홈페이지", "웹사이트", "카탈로그", "리플렛", "브로슈어",
        "홍보", "마케팅", "광고", "콘텐츠", "영상", "제작",
        "패키지", "포장", "그래픽", "시각", "ux", "ui"
    ]

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.driver = None

    def _setup_driver(self):
        """Chrome 드라이버 설정"""
        try:
            options = Options()
            options.add_argument("--headless")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-gpu")
            options.add_argument("--window-size=1920,1080")
            options.add_argument("--log-level=3")
            options.add_argument("--ignore-certificate-errors")
            options.add_argument("--ignore-ssl-errors=yes")
            options.add_experimental_option('excludeSwitches', ['enable-logging'])

            self.driver = webdriver.Chrome(options=options)
            self.driver.set_page_load_timeout(30)
            return True
        except WebDriverException as e:
            self.logger.error(f"Chrome 드라이버 초기화 실패: {e}")
            return False

    def _close_driver(self):
        """드라이버 종료"""
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass
            self.driver = None

    def _parse_date(self, date_str: str):
        """다양한 날짜 형식 파싱"""
        if not date_str:
            return None

        patterns = [
            "%Y-%m-%d",
            "%Y.%m.%d",
            "%Y/%m/%d",
        ]

        clean_date = date_str.strip()[:10]

        for pattern in patterns:
            try:
                return datetime.strptime(clean_date, pattern)
            except:
                continue

        nums = re.sub(r'[^\d]', '', date_str)
        if len(nums) >= 8:
            try:
                return datetime.strptime(nums[:8], "%Y%m%d")
            except:
                pass

        return None

    def _is_recent(self, date_str: str, days: int = 60) -> bool:
        """최근 N일 이내 공고인지 확인"""
        parsed = self._parse_date(date_str)
        if not parsed:
            return True

        cutoff = datetime.now() - timedelta(days=days)
        return parsed >= cutoff

    def crawl_all(self) -> list:
        """모든 기관 크롤링"""
        all_items = []

        if not self._setup_driver():
            self.logger.error("Chrome 드라이버 실패 - 기관별 수집 건너뜀")
            return []

        try:
            for agency_key, agency_info in self.AGENCIES.items():
                self.logger.info(f"  {agency_info['name']} 수집 중...")

                try:
                    items = self._crawl_agency(agency_key, agency_info)
                    all_items.extend(items)
                    self.logger.info(f"    → {len(items)}건 수집")
                except Exception as e:
                    self.logger.error(f"{agency_info['name']} 크롤링 실패: {e}")

                time.sleep(1)

        finally:
            self._close_driver()

        return all_items

    def _crawl_agency(self, agency_key: str, agency_info: dict) -> list:
        """단일 기관 크롤링"""
        items = []

        self.driver.get(agency_info["url"])
        wait_time = agency_info.get("wait_time", 3)
        time.sleep(wait_time)

        try:
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, agency_info["list_selector"]))
            )
        except TimeoutException:
            self.logger.warning(f"{agency_info['name']}: 목록 로딩 타임아웃")
            return []

        rows = self.driver.find_elements(By.CSS_SELECTOR, agency_info["list_selector"])

        for row in rows[:20]:
            try:
                item = self._parse_row(row, agency_info)
                if item:
                    items.append(item)
            except Exception:
                continue

        return items

    def _parse_row(self, row, agency_info: dict) -> dict:
        """행 파싱 - 모집공고만 필터링"""
        try:
            title_elem = row.find_element(By.CSS_SELECTOR, agency_info["title_selector"])
            title = title_elem.text.strip()

            if not title or len(title) < 5:
                return None

            title_lower = title.lower()

            # 제외 키워드 체크
            for kw in self.EXCLUDE_KEYWORDS:
                if kw in title_lower:
                    return None

            # 필수 키워드 체크
            has_required = any(kw in title_lower for kw in self.REQUIRED_KEYWORDS)
            if not has_required:
                return None

            # 분야 키워드 점수
            field_score = sum(1 for kw in self.FIELD_KEYWORDS if kw in title_lower)

            # URL 추출
            href = title_elem.get_attribute("href") or ""
            if href.startswith("javascript"):
                onclick = title_elem.get_attribute("onclick") or ""
                match = re.search(r"['\"](\d+)['\"]", onclick)
                if match:
                    post_id = match.group(1)
                    base_url = agency_info["url"].split("?")[0]
                    href = f"{base_url}?mode=view&idx={post_id}"
                else:
                    href = agency_info["url"]

            # 날짜 추출
            date = ""
            try:
                date_elem = row.find_element(By.CSS_SELECTOR, agency_info["date_selector"])
                date = date_elem.text.strip()
            except:
                pass

            # 날짜 기반 필터링
            if not self._is_recent(date, days=60):
                return None

            relevance = min(5 + field_score * 2, 10)

            return {
                "title": title,
                "agency": agency_info["name"],
                "date": date,
                "end_date": "",
                "detail_url": href,
                "category": "지원사업",
                "subcategory": "",
                "relevance": relevance,
                "crawled_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "status": "확인필요",
                "source": "기관별"
            }

        except Exception:
            return None
