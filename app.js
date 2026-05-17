// 실시간 뉴스 스크랩 및 주제별 그룹화 대시보드 로직

// 카테고리/주제 정의 (기사 '제목'의 핵심 단어 기반 정밀 매칭)
// 기존의 광범위한 긍정어(상승, 이익, 성장 등)는 오분류를 유발하므로 과감히 제외하고 구체적인 주제어들로 필터링합니다.
const CATEGORIES = {
    performance: {
        name: "📊 실적 및 경영 성과 소식",
        keywords: ["실적", "영업이익", "영업익", "매출", "순이익", "흑자", "적자", "어닝", "분기", "연간", "배당", "주주환원", "주총", "결산", "실적발표"]
    },
    risk: {
        name: "⚠️ 부동산 PF 및 금융 리스크",
        keywords: ["pf", "부동산", "리스크", "충당금", "건전성", "금리", "연체", "부실", "조사", "금융당국", "하락", "부담", "우려", "피소", "소송", "악재", "경고"]
    },
    wm: {
        name: "💼 자산관리(WM) 및 퇴직연금 동향",
        keywords: ["wm", "자산관리", "연금", "퇴직연금", "고액자산가", "pb", "자산", "머니무브", "패밀리오피스", "리테일", "예탁", "고액자산"]
    },
    digital: {
        name: "📱 디지털 플랫폼 및 신규 서비스/이벤트",
        keywords: ["디지털", "앱", "모바일", "이벤트", "거래", "서비스", "플랫폼", "토스", "네이버", "시스템", "오픈", "개편", "해외주식", "수수료", "주식투자", "트레이딩", "출시", "채널"]
    },
    esg_social: {
        name: "🌱 ESG 및 상생/사회공헌",
        keywords: ["esg", "친환경", "사회공헌", "기부", "동반성장", "상생", "지원", "교육", "대학생", "봉사", "yaho", "장학", "사회책임"]
    },
    hr_inside: {
        name: "🏢 인사, 채용 및 기업 내부 동향",
        keywords: ["인사", "승진", "대표", "선임", "조직개편", "취임", "사장", "채용", "합격", "신입", "인턴", "공채", "워크숍"]
    }
};

// 감성에 따른 한국어 라벨 변환
function getSentimentLabel(sentiment) {
    switch(sentiment) {
        case 'positive': return '긍정';
        case 'negative': return '부정';
        case 'neutral': return '중립';
        default: return '미분류';
    }
}

// 감성에 따른 CSS 클래스 변환
function getSentimentClass(sentiment) {
    switch(sentiment) {
        case 'positive': return 'pos';
        case 'negative': return 'neg';
        case 'neutral': return 'neu';
        default: return '';
    }
}

// 기사를 적절한 주제(카테고리)로 자동 매칭하는 함수
// 💡 중요: 템플릿(AI 분석 의견)에 포함된 공통 단어 때문에 생기는 오분류를 방지하기 위해 오직 '기사 제목(title)'만을 기준으로 정밀 판별합니다.
function categorizeArticle(news) {
    const text = news.title.toLowerCase();
    
    for (const [key, cat] of Object.entries(CATEGORIES)) {
        if (cat.keywords.some(keyword => text.includes(keyword))) {
            return key;
        }
    }
    return "other"; // 기타 소식
}

// 기사 데이터에서 빈도가 높은 키워드 상위 8개 자동 추출
function extractTopKeywords(newsData) {
    // 한국어 불필요한 단어 및 스톱워드 정의
    const stopWords = new Set([
        "삼성증권", "삼성", "증권", "기자", "등", "및", "대해", "위해", "올해", "출시", "진행", "최근", "선정", "제공", 
        "있다", "하는", "했다", "한다", "밝혔다", "이번", "통해", "경우", "따른", "기사", "분석", "내용", "💡", "것으로",
        "1분기", "2분기", "3분기", "4분기", "연간", "최근", "앞으로", "일부", "대비", "통한", "대한", "관련", "그는", "그녀는",
        "기반", "지원", "전달", "참가", "네이버", "결과", "대상", "다양한", "개최", "모습", "이후", "현재", "주요"
    ]);
    
    const wordCounts = {};
    
    newsData.forEach(news => {
        // 제목과 요약 분석 텍스트에서 특수문자를 제거하고 공백 단위로 쪼갬
        const cleanText = (news.title + " " + news.coreSummary)
            .replace(/[^\w\sㄱ-힣]/g, " ") 
            .replace(/\s+/g, " ");
            
        const words = cleanText.split(" ");
        words.forEach(word => {
            const cleanWord = word.trim().toLowerCase();
            // 2글자 이상이며 스톱워드에 포함되지 않는 금융/일반 핵심 키워드 수집
            if (cleanWord.length >= 2 && !stopWords.has(cleanWord)) {
                wordCounts[cleanWord] = (wordCounts[cleanWord] || 0) + 1;
            }
        });
    });
    
    // 빈도수로 내림차순 정렬 후 상위 8개 추출
    return Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(entry => entry[0]);
}

// 키워드 클라우드 영역 렌더링
function renderKeywordCloud(newsData) {
    const cloudContainer = document.getElementById('keywordCloud');
    if (!cloudContainer) return;
    
    const topKeywords = extractTopKeywords(newsData);
    
    cloudContainer.innerHTML = '';
    
    if (topKeywords.length === 0) {
        cloudContainer.innerHTML = '<span style="color: var(--color-text-muted);">수집된 키워드가 없습니다.</span>';
        return;
    }
    
    topKeywords.forEach(keyword => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = `#${keyword}`;
        cloudContainer.appendChild(span);
    });
}

// 수집된 뉴스를 그룹화하여 화면에 렌더링
function renderGroupedNews(newsData) {
    const container = document.getElementById('groupedNewsContainer');
    if (!container) return;

    container.innerHTML = '';

    // 1. 그룹 준비
    const grouped = {
        performance: [],
        risk: [],
        wm: [],
        digital: [],
        esg_social: [],
        hr_inside: [],
        other: []
    };

    // 2. 뉴스 분류
    newsData.forEach(news => {
        const catKey = categorizeArticle(news);
        grouped[catKey].push(news);
    });

    // 3. 그룹별 HTML 생성 (비어 있지 않은 그룹만 화면에 렌더링)
    let renderedAnyGroup = false;

    // 카테고리 순서대로 루프 돌며 렌더링
    for (const [key, list] of Object.entries(grouped)) {
        if (list.length === 0) continue; // 기사가 없으면 카테고리 생략
        
        renderedAnyGroup = true;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'news-category-group';

        // 그룹 헤더 이름 설정
        let groupName = "📂 기타 관련 소식";
        if (key !== 'other' && CATEGORIES[key]) {
            groupName = `${CATEGORIES[key].name} (${list.length}건)`;
        } else {
            groupName = `📂 일반 및 기타 소식 (${list.length}건)`;
        }

        const h3 = document.createElement('h3');
        h3.className = 'category-title';
        h3.textContent = groupName;
        groupDiv.appendChild(h3);

        // 뉴스 카드들을 감쌀 ul 생성
        const ul = document.createElement('ul');
        ul.className = 'news-list';

        list.forEach(news => {
            const li = document.createElement('li');
            li.className = 'news-item';
            
            li.innerHTML = `
                <a href="${news.url}" target="_blank" rel="noopener noreferrer" class="news-link-wrapper">
                    <div class="news-content-header">
                        <div class="news-content">
                            <h3>${news.title}</h3>
                            <div class="news-meta">
                                <span>${news.source}</span> | <span>${news.date}</span>
                            </div>
                        </div>
                        <div class="news-sentiment ${getSentimentClass(news.sentiment)}">
                            ${getSentimentLabel(news.sentiment)}
                        </div>
                    </div>
                    <div class="news-analysis-box">
                        <p class="news-summary-text"><strong>📌 기사 핵심 요약:</strong> ${news.coreSummary}</p>
                        <p class="news-analysis-text"><strong>🔍 AI 시장 분석:</strong> ${news.aiAnalysis}</p>
                    </div>
                </a>
            `;
            ul.appendChild(li);
        });

        groupDiv.appendChild(ul);
        container.appendChild(groupDiv);
    }

    if (!renderedAnyGroup) {
        container.innerHTML = '<div class="news-empty-message">분류된 기사가 없습니다.</div>';
    }
}

// 실시간 백엔드 API에서 뉴스 스크랩 데이터를 받아와 대시보드 구축
async function fetchAndRenderDashboard() {
    const container = document.getElementById('groupedNewsContainer');
    const cloudContainer = document.getElementById('keywordCloud');
    
    if (container) {
        container.innerHTML = `
            <div class="news-loading-message">
                <div>📡 실시간으로 삼성증권 최신 뉴스(30건)를 크롤링하고 인공지능 주제 분류를 진행 중입니다...</div>
            </div>
        `;
    }
    
    if (cloudContainer) {
        cloudContainer.innerHTML = '<span style="color: var(--color-text-muted);">실시간 분석 중...</span>';
    }

    try {
        const response = await fetch('/api/news');
        if (!response.ok) {
            throw new Error(`HTTP 에러 발생! 상태코드: ${response.status}`);
        }
        
        const newsData = await response.json();
        
        if (newsData.error) {
            if (container) {
                container.innerHTML = `
                    <div class="news-error-message">
                        <div>⚠️ 실시간 뉴스 크롤링 중 오류가 발생했습니다: ${newsData.error}</div>
                    </div>
                `;
            }
            return;
        }

        if (newsData.length === 0) {
            if (container) {
                container.innerHTML = `
                    <div class="news-empty-message">
                        <div>검색된 최신 삼성증권 기사가 없습니다.</div>
                    </div>
                `;
            }
            return;
        }

        // 1. 키워드 클라우드 분석 및 업데이트
        renderKeywordCloud(newsData);

        // 2. 주제별 그룹화 및 뉴스 목록 렌더링
        renderGroupedNews(newsData);

    } catch (error) {
        console.error('Fetch error:', error);
        if (container) {
            container.innerHTML = `
                <div class="news-error-message">
                    <div>⚠️ 로컬 서버와 연결할 수 없습니다. 파이썬 서버(server.py)가 구동 중인지 확인해 주세요.</div>
                </div>
            `;
        }
    }
}

// DOM 로드 시 초기화 및 데이터 로드 시작
document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderDashboard();
});
