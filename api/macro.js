// Vercel Serverless Function — 한국은행 ECOS 금리·환율
// 환경변수 ECOS_API_KEY 필요 (https://ecos.bok.or.kr 에서 무료 발급).
// 미설정 시 { configured:false } 반환 → 화면은 수동 입력 모드로 동작.
// 통계표·항목 코드는 ECOS '통계코드 검색'으로 재확인 가능하며, ECOS_SERIES(JSON)로 덮어쓸 수 있다.

const DEFAULT_SERIES = [
  { id: 'base',  label: '한국은행 기준금리', unit: '%',   stat: '722Y001', item: '0101000' },
  { id: 'ktb3',  label: '국고채 3년',       unit: '%',   stat: '817Y002', item: '010200000' },
  { id: 'ktb10', label: '국고채 10년',      unit: '%',   stat: '817Y002', item: '010210000' },
  { id: 'cd91',  label: 'CD 91일',          unit: '%',   stat: '817Y002', item: '010502000' },
  { id: 'usd',   label: '원/달러',          unit: '원',  stat: '731Y001', item: '0000001' }
];

function ymd(d) {
  return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}

async function fetchSeries(key, s) {
  const end = new Date();
  const start = new Date(end.getTime() - 45 * 864e5);
  const url = `https://ecos.bok.or.kr/api/StatisticSearch/${encodeURIComponent(key)}/json/kr/1/100/${s.stat}/D/${ymd(start)}/${ymd(end)}/${s.item}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const rows = j && j.StatisticSearch && j.StatisticSearch.row;
    if (!rows || !rows.length) {
      const msg = j && j.RESULT ? j.RESULT.MESSAGE : 'no rows';
      throw new Error(msg);
    }
    const pts = rows.map(r => ({ t: r.TIME, v: parseFloat(r.DATA_VALUE) })).filter(p => isFinite(p.v));
    const last = pts[pts.length - 1];
    const prev = pts.length > 1 ? pts[pts.length - 2] : null;
    return { id: s.id, label: s.label, unit: s.unit, value: last.v, asOf: last.t, prev: prev ? prev.v : null, series: pts.slice(-30) };
  } finally {
    clearTimeout(t);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const key = process.env.ECOS_API_KEY;
  if (!key) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(JSON.stringify({ configured: false }));
  }
  let series = DEFAULT_SERIES;
  if (process.env.ECOS_SERIES) {
    try { series = JSON.parse(process.env.ECOS_SERIES); } catch (_) { /* keep default */ }
  }
  const settled = await Promise.allSettled(series.map(s => fetchSeries(key, s)));
  const data = [], errors = [];
  settled.forEach((r, i) => r.status === 'fulfilled' ? data.push(r.value) : errors.push({ id: series[i].id, error: String(r.reason && r.reason.message || r.reason) }));
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=21600');
  res.status(200).send(JSON.stringify({ configured: true, source: '한국은행 ECOS', updatedAt: new Date().toISOString(), data, errors }));
};
