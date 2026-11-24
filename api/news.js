// Vercel Serverless Function — 상업용 부동산 뉴스 취합 (Google News RSS, 의존성 없음)
// GET /api/news            → 전 카테고리
// GET /api/news?cat=office → 단일 카테고리
// 15분 엣지 캐시. 실패한 카테고리는 errors 배열에 기록하고 나머지는 정상 반환.

const QUERIES = {
  office: '오피스 매각 OR 오피스빌딩 매입 OR 우선협상대상자 오피스',
  logis:  '물류센터 매각 OR 물류센터 매입 OR 물류센터 공실',
  retail: '호텔 매각 OR 리테일 자산 매각 OR 상업시설 매입',
  reits:  '리츠 상장 OR 리츠 유상증자 OR 부동산펀드 설정',
  rates:  '국고채 금리 OR 기준금리 OR 리파이낸싱 부동산',
  peers:  '알스퀘어 OR CBRE코리아 OR 쿠시먼앤드웨이크필드 OR 젠스타메이트 OR 세빌스코리아 OR JLL코리아'
};

const WINDOW = 'when:7d';
const PER_CAT = 25;

function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, '&')
    .trim();
}

function pick(block, tag) {
  const m = block.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>'));
  return m ? decode(m[1]) : '';
}

function parse(xml, cat) {
  const out = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) && out.length < PER_CAT) {
    const b = m[1];
    let title = pick(b, 'title');
    const source = pick(b, 'source');
    // Google News 제목 형식: "기사 제목 - 언론사"
    if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
    const link = pick(b, 'link');
    const date = pick(b, 'pubDate');
    if (!title || !link) continue;
    out.push({ cat, title, source, link, date: date ? new Date(date).toISOString() : null });
  }
  return out;
}

async function fetchCat(cat) {
  const q = encodeURIComponent(QUERIES[cat] + ' ' + WINDOW);
  const url = `https://news.google.com/rss/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RS-Workbench/1.0)' }
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return parse(await r.text(), cat);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async (req, res) => {
  const want = req.query && req.query.cat;
  const cats = want && QUERIES[want] ? [want] : Object.keys(QUERIES);

  const settled = await Promise.allSettled(cats.map(fetchCat));
  const seen = new Set();
  const items = [];
  const errors = [];

  settled.forEach((s, i) => {
    if (s.status !== 'fulfilled') { errors.push({ cat: cats[i], error: String(s.reason && s.reason.message || s.reason) }); return; }
    for (const it of s.value) {
      const key = it.title.replace(/\s+/g, '').slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(it);
    }
  });

  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
  res.status(200).send(JSON.stringify({ updatedAt: new Date().toISOString(), count: items.length, items, errors }));
};
