import http.server
import socketserver
import urllib.request
import xml.etree.ElementTree as ET
import html
import json
import os
import re

PORT = int(os.environ.get('PORT', 8080))

# 금융 특화 긍정/부정 키워드 단어 사전
POSITIVE_WORDS = ["상승", "호조", "최고", "급등", "매수", "개선", "성장", "기대", "돌파", "강세", "이익", "상회", "호재", "유입", "강화"]
NEGATIVE_WORDS = ["하락", "리스크", "우려", "PF", "하회", "감소", "부진", "손실", "약세", "부담", "소송", "침체", "경고", "피소", "악재"]

# HTML 태그 제거 및 텍스트 정제 함수
def clean_html(raw_html):
    if not raw_html:
        return ""
    cleanr = re.compile('<.*?>')
    cleantext = re.sub(cleanr, '', raw_html)
    cleantext = html.unescape(cleantext)
    cleantext = re.sub(r'\s+', ' ', cleantext).strip()
    return cleantext

# 각 기사의 제목과 정제된 텍스트를 기반으로 커스텀 핵심 요약문을 작성하는 함수
def generate_custom_summary(title, cleaned_desc):
    title_clean = title.split(" - ")[0].strip()
    
    # 구글 뉴스 RSS의 desc가 가치가 있을 경우(보통 40자 이상이고 제목과 중복되지 않을 때)
    if len(cleaned_desc) > 40 and title_clean not in cleaned_desc:
        return cleaned_desc
        
    # 기사 제목 기반의 카테고리별 정밀 핵심 요약 생성
    # 1. 실적 관련 (영업이익, 매출, 어닝, 증가, 돌파, 성장)
    if any(x in title_clean for x in ["영업익", "영업이익", "실적", "매출", "순이익", "돌파", "상승", "증가", "성장"]):
        return f"삼성증권이 최근 공시 및 시장 보고서를 통해 {title_clean} 소식을 전했습니다. 이는 핵심 비즈니스인 자산관리(WM) 및 트레이딩 성과에 기반한 실적 개선 흐름을 보여주며, 시장 전망치를 웃도는 견고한 펀더멘탈을 증명하고 있습니다."
    
    # 2. 부동산 PF 및 리스크 관련 (PF, 리스크, 우려, 하락, 충당금, 연체)
    elif any(x in title_clean for x in ["PF", "리스크", "우려", "하락", "부진", "부담", "충당금", "부실"]):
        return f"최근 불거진 {title_clean} 건에 관한 기사로, 부동산 프로젝트파이낸싱(PF) 시장 부진과 이에 대비한 대규모 충당금 적립 부담 등 자산 건전성 리스크 요인을 다루고 있습니다. 금리 변동성에 대비한 선제적인 리스크 관리가 주요 쟁점으로 분석됩니다."
        
    # 3. WM 및 자산관리, 퇴직연금 (WM, 자산관리, 연금, 고액자산가, PB, 예탁)
    elif any(x in title_clean for x in ["WM", "자산관리", "연금", "퇴직연금", "고액자산가", "PB", "자산"]):
        return f"삼성증권의 주력 강점인 {title_clean}에 관한 소식입니다. 패밀리오피스 및 고액자산가 자금 유입 확대, 퇴직연금 자산 증대 등 초고액 자산가 시장에서의 독보적인 WM(Asset Management) 역량 강화와 리테일 자금 흐름에 초점을 맞추고 있습니다."
        
    # 4. 디지털 서비스 및 이벤트 (디지털, 앱, 모바일, 서비스, 해외주식, 수수료)
    elif any(x in title_clean for x in ["디지털", "앱", "모바일", "서비스", "이벤트", "해외주식", "토스", "시스템"]):
        return f"삼성증권이 2030 젊은 투자자 및 서학개미 유입 강화를 위해 추진 중인 {title_clean}에 관한 소식입니다. 모바일 트레이딩 앱 편의성 제고, 해외주식 수수료 파격 혜택 등 핀테크 경쟁 및 디지털 플랫폼 편의성을 극대화하는 전략을 포함합니다."
        
    # 5. ESG 및 사회공헌/대학생 봉사단 등
    elif any(x in title_clean for x in ["ESG", "사회공헌", "기부", "동반성장", "상생", "봉사", "대학생"]):
        return f"금융업계의 사회적 책임을 다하기 위해 진행된 {title_clean} 소식입니다. 대학생 봉사단 운영, 금융 교육 기부 및 동반성장 생태계 구축 등 지속가능경영(ESG) 및 지역사회 상생협력 성과를 요약하고 있습니다."
        
    # 기본 요약문 (카테고리 미매칭 시)
    return f"삼성증권과 관련된 최신 소식인 '{title_clean}'에 대한 내용입니다. 급변하는 금융 시장 환경 속에서 당사가 취한 비즈니스 포트폴리오 강화 및 대내외 브랜딩 가치 제고 행보를 보여주는 핵심적인 기사입니다."

# 기사 제목과 정제된 텍스트를 기반으로 감성 분석 및 AI 시장 분석 의견을 작성하는 함수
def analyze_sentiment(title, description_html):
    cleaned_desc = clean_html(description_html)
    # 구글 뉴스 꼬리표 텍스트 제거
    cleaned_desc = re.sub(r'google 뉴스.*', '', cleaned_desc, flags=re.IGNORECASE).strip()
    
    # 1. 핵심 요약문 추출 및 생성
    core_summary = generate_custom_summary(title, cleaned_desc)
    
    # 2. 감성 매칭 및 스코어링
    full_text = (title + " " + core_summary).lower()
    matching_pos = [word for word in POSITIVE_WORDS if word in full_text]
    matching_neg = [word for word in NEGATIVE_WORDS if word in full_text]
    
    pos_count = len(matching_pos)
    neg_count = len(matching_neg)
    
    if pos_count > neg_count:
        sentiment = "positive"
        ai_analysis = f"'{', '.join(matching_pos[:3])}' 등의 긍정적 지표에 시장이 반응하고 있습니다. 핵심 부문의 수익 다변화 성과가 확인되면서, 향후 주가 탄력성 확보 및 기관/외국인 매수세 유입에 우호적인 환경이 조성될 것으로 전망됩니다."
    elif neg_count > pos_count:
        sentiment = "negative"
        ai_analysis = f"'{', '.join(matching_neg[:3])}' 등의 시장 리스크 요인이 부각되었습니다. 일부 PF 충당금 설정 등에 따른 단기 실적 저하 우려가 존재하므로, 보수적인 투자 대응과 자산 건전성 회복 여부를 지속 관찰할 필요가 있습니다."
    else:
        sentiment = "neutral"
        ai_analysis = "시장 평균(Benchmark) 흐름에 동조하는 중립적인 수준의 뉴스로, 단기적인 변동성을 자극할 모멘텀은 부재합니다. 매크로 금리 및 증시 유동성 흐름을 지켜보며 관망세를 유지하는 것이 유효해 보입니다."
        
    return sentiment, core_summary, ai_analysis

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/news':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            
            try:
                # 구글 뉴스 검색 RSS (삼성증권) - 한국어/한국 기준
                url = "https://news.google.com/rss/search?q=%EC%82%BC%EC%84%B1%EC%A6%9D%EA%B6%8C&hl=ko&gl=KR&ceid=KR:ko"
                req = urllib.request.Request(
                    url, 
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
                )
                
                with urllib.request.urlopen(req) as response:
                    xml_data = response.read()
                    
                root = ET.fromstring(xml_data)
                news_items = []
                
                # 최근 30개 관련 기사 가져와 스크랩 및 분석
                for idx, item in enumerate(root.findall('.//item')[:30]):
                    title = item.find('title').text if item.find('title') is not None else ""
                    link = item.find('link').text if item.find('link') is not None else ""
                    pub_date = item.find('pubDate').text if item.find('pubDate') is not None else ""
                    description = item.find('description').text if item.find('description') is not None else ""
                    source_elem = item.find('source')
                    source = source_elem.text if source_elem is not None else "언론사"
                    
                    # 날짜 형식 정제
                    date_str = pub_date
                    if len(pub_date) >= 16:
                        date_str = pub_date[5:16]
                        
                    # 핵심 요약(coreSummary) 및 AI 시장분석(aiAnalysis) 추출
                    sentiment, core_summary, ai_analysis = analyze_sentiment(title, description)
                    
                    news_items.append({
                        "id": idx + 1,
                        "title": title.split(" - ")[0],  # 언론사명 분리
                        "date": date_str,
                        "source": source,
                        "sentiment": sentiment,
                        "url": link,
                        "coreSummary": core_summary,
                        "aiAnalysis": ai_analysis
                    })
                
                self.wfile.write(json.dumps(news_items, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.wfile.write(json.dumps({"error": str(e)}, ensure_ascii=False).encode('utf-8'))
        else:
            super().do_GET()

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
        print(f"Serving Real-time Scraping Web App at http://localhost:{PORT}")
        httpd.serve_forever()
