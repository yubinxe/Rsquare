(() => {
'use strict';

/* ───────── utils ───────── */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const el = (tag, attrs = {}, html) => {
  const n = document.createElement(tag);
  for (const k in attrs) {
    if (k === 'class') n.className = attrs[k];
    else n.setAttribute(k, attrs[k]);
  }
  if (html != null) n.innerHTML = html;
  return n;
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('rs.' + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem('rs.' + k, JSON.stringify(v)); } catch (_) { /* private mode */ } }
};
const nf = (v, d = 0) => isFinite(v) ? v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const pct = (v, d = 2) => isFinite(v) ? (v * 100).toFixed(d) + '%' : '—';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const setText = (sel, t) => { const n = $(sel); if (n) n.textContent = t; };

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200);
}

const cw = id => { const n = document.getElementById(id); const w = n ? n.clientWidth : 0; return w > 0 ? Math.round(w) : 640; };
const redraw = [];
let rzT; addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => redraw.forEach(f => f()), 150); });

const kstParts = (d = new Date()) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hour12: false }).formatToParts(d);
  const o = {}; p.forEach(x => o[x.type] = x.value);
  if (o.hour === '24') o.hour = '00';
  return o;
};
const todayKey = () => { const o = kstParts(); return `${o.year}-${o.month}-${o.day}`; };
const WD = { Mon: '월', Tue: '화', Wed: '수', Thu: '목', Fri: '금', Sat: '토', Sun: '일' };

function countTo(node, to, fmt, ms = 650) {
  if (!node) return;
  if (!isFinite(to)) { node.textContent = '—'; node._v = NaN; return; }
  const from = isFinite(node._v) ? node._v : to;
  node._v = to;
  if (reduced || from === to) { node.textContent = fmt(to); return; }
  const t0 = performance.now();
  cancelAnimationFrame(node._raf);
  const step = now => {
    const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    node.textContent = fmt(from + (to - from) * e);
    if (k < 1) node._raf = requestAnimationFrame(step);
  };
  node._raf = requestAnimationFrame(step);
}

/* ───────── theme ───────── */
(function theme() {
  const modes = ['auto', 'light', 'dark'], label = { auto: '자동', light: '라이트', dark: '다크' };
  let m = store.get('theme', 'auto');
  const apply = () => {
    if (m === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', m);
    setText('#themeLabel', label[m]);
  };
  apply();
  $('#themeBtn').addEventListener('click', () => { m = modes[(modes.indexOf(m) + 1) % 3]; store.set('theme', m); apply(); });
})();

/* ───────── clock ───────── */
(function clock() {
  const tick = () => {
    const o = kstParts();
    setText('#clock', `${o.hour}:${o.minute}`);
    const mins = +o.hour * 60 + +o.minute;
    const open = !['Sat', 'Sun'].includes(o.weekday) && mins >= 540 && mins < 930;
    $('#krxDot').className = 'dot ' + (open ? 'ok' : '');
    setText('#krxLabel', open ? 'KRX 장중' : 'KRX 장마감');
  };
  tick(); setInterval(tick, 15000);
  const o = kstParts();
  setText('#briefTitle', `${+o.month}월 ${+o.day}일 ${WD[o.weekday]}요일, 오늘의 숫자`);
})();

/* ───────── nav spy · progress · reveal ───────── */
(function spy() {
  const links = $$('#nav a');
  const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(a => a.classList.remove('on'));
    const a = map.get(e.target.id);
    if (a) { a.classList.add('on'); a.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }), { rootMargin: '-30% 0px -65% 0px' });
  $$('main > section').forEach(s => io.observe(s));
  const top = $('#top');
  const prog = () => { const h = document.documentElement; top.style.setProperty('--prog', (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight) * 100) + '%'); };
  addEventListener('scroll', prog, { passive: true }); prog();
  const rv = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); rv.unobserve(e.target); } }), { threshold: .12 });
  $$('.reveal').forEach(n => rv.observe(n));
})();

/* ═════════ MACRO (hero + market) ═════════ */
const MACRO = [
  { id: 'base',  label: '기준금리',   unit: '%', d: 2 },
  { id: 'ktb3',  label: '국고채 3년',  unit: '%', d: 3 },
  { id: 'ktb10', label: '국고채 10년', unit: '%', d: 3 },
  { id: 'cd91',  label: 'CD 91일',    unit: '%', d: 2 },
  { id: 'usd',   label: '원/달러',     unit: '원', d: 1 }
];
const macroState = { live: false, vals: {}, asOf: '' };

function spark(series) {
  if (!series || series.length < 2) return '';
  const v = series.map(p => p.v), mn = Math.min(...v), mx = Math.max(...v), r = mx - mn || 1;
  const W = 100, H = 26;
  const pts = v.map((y, i) => `${(i / (v.length - 1) * W).toFixed(1)},${(H - 3 - (y - mn) / r * (H - 6)).toFixed(1)}`).join(' ');
  const up = v[v.length - 1] >= v[0];
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(${up ? '--up' : '--dn'})" stroke-width="1.4" vector-effect="non-scaling-stroke"/></svg>`;
}

function renderHeroKpi() {
  $$('#heroKpi dd').forEach(dd => {
    const m = MACRO.find(x => x.id === dd.dataset.k), v = macroState.vals[dd.dataset.k];
    if (!isFinite(v)) { dd.textContent = '—'; return; }
    dd.innerHTML = `<span></span><small>${m.unit}</small>`;
    countTo($('span', dd), v, x => nf(x, m.d), 900);
  });
  setText('#heroSrc', macroState.live ? `한국은행 ECOS · ${macroState.asOf} 기준` : '금리는 시장 섹션에서 직접 입력 가능');
}

function renderMacro(data) {
  const box = $('#macroTiles'); box.innerHTML = '';
  const manual = store.get('macro', {});
  MACRO.forEach(m => {
    const live = data && data.find(x => x.id === m.id);
    const t = el('div', { class: 'tile' });
    if (live) {
      macroState.vals[m.id] = live.value;
      const diff = live.prev != null ? live.value - live.prev : null;
      let dtxt = '보합', cls = '';
      if (diff) {
        cls = diff > 0 ? 'up' : 'dn';
        dtxt = m.unit === '%' ? `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff * 100).toFixed(1)}bp` : `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)}원`;
      }
      const asof = live.asOf ? `${live.asOf.slice(4, 6)}.${live.asOf.slice(6, 8)}` : '';
      t.innerHTML = `<span class="tile__l">${m.label}</span><b class="tile__v num"><span data-v></span><small>${m.unit}</small></b><span class="tile__d ${cls}">${dtxt} · ${asof}</span>${spark(live.series)}`;
      box.appendChild(t);
      countTo($('[data-v]', t), live.value, v => nf(v, m.d), 900);
    } else {
      const v = manual[m.id];
      if (isFinite(v)) macroState.vals[m.id] = v;
      t.innerHTML = `<label><span class="tile__l">${m.label} (${m.unit})</span><input class="num" type="number" step="0.001" inputmode="decimal" data-id="${m.id}" value="${isFinite(v) ? v : ''}" placeholder="입력"></label><span class="tile__d">수동 입력</span>`;
      box.appendChild(t);
    }
  });
  $$('input[data-id]', box).forEach(i => i.addEventListener('input', () => {
    const cur = store.get('macro', {}), v = parseFloat(i.value);
    if (isFinite(v)) { cur[i.dataset.id] = v; macroState.vals[i.dataset.id] = v; } else { delete cur[i.dataset.id]; delete macroState.vals[i.dataset.id]; }
    store.set('macro', cur); renderHeroKpi();
    if (i.dataset.id === 'ktb10') syncKtb();
  }));
  renderHeroKpi(); syncKtb();
}

function syncKtb() {
  const k = macroState.vals.ktb10;
  if (isFinite(k) && (macroState.live || !store.get('spKtb'))) $('#spKtb').value = k;
  const ck = $('#capForm [name=ktb]');
  if (isFinite(k) && !ck.value) ck.value = k;
  updateSpread(); if (window.__calcCap) window.__calcCap();
}

async function loadMacro() {
  const meta = $('#macroMeta');
  try {
    const r = await fetch('/api/macro', { cache: 'no-store' });
    if (!r.ok) throw 0;
    const j = await r.json();
    if (j.configured && j.data && j.data.length) {
      macroState.live = true;
      const k10 = j.data.find(x => x.id === 'ktb10') || j.data[0];
      macroState.asOf = k10.asOf ? `${k10.asOf.slice(0, 4)}.${k10.asOf.slice(4, 6)}.${k10.asOf.slice(6, 8)}` : '';
      renderMacro(j.data);
      meta.textContent = `한국은행 ECOS · 일별 최근치${j.errors && j.errors.length ? ` · ${j.errors.length}개 계열 실패` : ''}`;
      return;
    }
    meta.textContent = '수동 입력 · ECOS_API_KEY 설정 시 자동 갱신';
  } catch (_) { meta.textContent = '수동 입력 · 서버 함수 미연결'; }
  renderMacro(null);
}

function updateSpread() {
  const cap = parseFloat($('#spCap').value), k = parseFloat($('#spKtb').value);
  const out = $('#spOut'), bar = $('#spBar');
  if (isFinite(cap) && isFinite(k)) {
    const s = cap - k;
    countTo(out, s, v => (v >= 0 ? '+' : '') + v.toFixed(2));
    bar.style.width = Math.max(0, Math.min(1, s / 3)) * 100 + '%';
    bar.style.background = s < 1 ? 'var(--amber)' : 'var(--red)';
    setText('#spBp', `= ${Math.round(s * 100)}bp · 캡 ${cap.toFixed(2)}% − 국고채 10년 ${k.toFixed(3)}%`);
  } else { out.textContent = '—'; out._v = NaN; bar.style.width = '0'; setText('#spBp', '캡레이트와 국고채 10년을 모두 입력하면 계산된다.'); }
}
(function spreadInit() {
  const c = store.get('spCap'), k = store.get('spKtb');
  if (c != null) $('#spCap').value = c;
  if (k != null) $('#spKtb').value = k;
  $('#spCap').addEventListener('input', e => { store.set('spCap', e.target.value); updateSpread(); });
  $('#spKtb').addEventListener('input', e => { store.set('spKtb', e.target.value); updateSpread(); });
  updateSpread();
})();

(function tips() {
  const T = RS.tips; let i = Math.floor(Date.now() / 864e5) % T.length;
  const show = () => {
    const c = $('.coach'); c.classList.remove('swap'); void c.offsetWidth; c.classList.add('swap');
    setText('#tipHead', T[i][0]); setText('#tipBody', T[i][1]);
    setText('#tipIdx', String(i + 1).padStart(2, '0') + ' / ' + T.length);
  };
  show(); $('#tipNext').addEventListener('click', () => { i = (i + 1) % T.length; show(); });
})();

(function routine() {
  const R = [
    ['08:00', '딜 뉴스에서 시그널 3건 클립'],
    ['08:20', '국고채 10년 전일 대비 확인, 스프레드 갱신'],
    ['08:40', '클립 3줄 요약을 팀 채널에 공유'],
    ['09:00', '팀 미팅 — 진행 딜 상태·오늘 마감 확인'],
    ['14:00', '진행 딜 자료 업데이트 (렌트롤·RFI)'],
    ['17:30', '내일 할 일 3개 · 오늘 배운 용어 1개 기록']
  ];
  const key = 'routine.' + todayKey(), done = new Set(store.get(key, [])), ul = $('#routine');
  const cnt = () => setText('#routineCount', `${done.size}/${R.length}`);
  R.forEach((r, i) => {
    const li = el('li', {}, `<label><input type="checkbox" ${done.has(i) ? 'checked' : ''}><span class="t">${r[0]}</span><span>${r[1]}</span></label>`);
    $('input', li).addEventListener('change', e => { e.target.checked ? done.add(i) : done.delete(i); store.set(key, [...done]); cnt(); });
    ul.appendChild(li);
  });
  cnt();
})();

/* ═════════ NEWS ═════════ */
const news = { all: [], items: [], rsq: [], cat: 'all', q: '', sigFirst: false, ok: false };
let clips = store.get('clips', []);

function score(title) {
  const tags = []; let w = 0;
  RS.signals.forEach(s => { if (s.re.test(title)) { tags.push(s.tag); w += s.w; } });
  return { tags, w };
}
function ago(iso) {
  if (!iso) return '';
  const m = (Date.now() - new Date(iso).getTime()) / 6e4;
  if (m < 60) return Math.max(1, Math.round(m)) + '분 전';
  if (m < 1440) return Math.round(m / 60) + '시간 전';
  return Math.round(m / 1440) + '일 전';
}
const ymd = iso => iso ? iso.slice(5, 10).replace('-', '.') : '';
const catLabel = k => (RS.newsCats.find(c => c.key === k) || {}).label || k;
const bySig = (a, b) => b._s.w - a._s.w || (b.date || '').localeCompare(a.date || '');

function renderNewsTabs() {
  const box = $('#newsTabs'); box.innerHTML = '';
  RS.newsCats.forEach(c => {
    const n = c.key === 'all' ? news.items.length : news.items.filter(x => x.cat === c.key).length;
    const b = el('button', { role: 'tab', 'aria-selected': String(news.cat === c.key), type: 'button' }, `${c.label}${news.ok ? `<span class="c">${n}</span>` : ''}`);
    b.addEventListener('click', () => { news.cat = c.key; renderNewsTabs(); renderNews(); });
    box.appendChild(b);
  });
}

function renderNews() {
  if (!news.ok) return;
  let L = news.items;
  if (news.cat !== 'all') L = L.filter(x => x.cat === news.cat);
  if (news.q) { const q = news.q.toLowerCase(); L = L.filter(x => (x.title + ' ' + x.source).toLowerCase().includes(q)); }
  if (news.sigFirst) L = [...L].sort(bySig);
  const ul = $('#newsList'); ul.innerHTML = '';
  setText('#newsMeta', `${L.length}건 · 최근 7일 · Google 뉴스 검색 결과`);
  if (!L.length) { ul.innerHTML = '<li class="note" style="padding:24px 0">조건에 맞는 기사가 없다.</li>'; return; }
  const clipped = new Set(clips.map(c => c.link));
  L.slice(0, 60).forEach((n, i) => {
    const li = el('li', { class: 'newsitem' });
    li.style.animationDelay = Math.min(i, 12) * 25 + 'ms';
    const tags = n._s.tags.map(t => `<span class="tag ${n._s.w >= 3 ? 'tag--hot' : 'tag--sig'}">${esc(t)}</span>`).join('');
    li.innerHTML = `<div><a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a>
      <div class="row"><span>${esc(n.source || '')}</span><span class="num">${ago(n.date)}</span><span class="tag">${esc(catLabel(n.cat))}</span>${tags}</div></div>
      <button class="clipbtn" type="button" aria-pressed="${clipped.has(n.link)}" aria-label="클립">${clipped.has(n.link) ? '✓' : '+'}</button>`;
    $('.clipbtn', li).addEventListener('click', e => toggleClip(n, e.currentTarget));
    ul.appendChild(li);
  });
}

function toggleClip(n, btn) {
  const i = clips.findIndex(c => c.link === n.link);
  if (i >= 0) clips.splice(i, 1);
  else clips.unshift({ title: n.title, link: n.link, source: n.source, date: n.date, note: '매도인: \n매수인: \n가격·평당가: ' });
  store.set('clips', clips);
  if (btn) { const on = i < 0; btn.setAttribute('aria-pressed', on); btn.textContent = on ? '✓' : '+'; }
  renderClips(); if (i < 0) toast('클립 메모에 담았다');
}

function renderClips() {
  const ul = $('#clipList'); ul.innerHTML = '';
  setText('#clipCount', clips.length);
  if (!clips.length) { ul.innerHTML = '<li class="empty">기사 옆 + 를 눌러 담는다.</li>'; return; }
  clips.forEach((c, i) => {
    const li = el('li', {}, `<p>${esc(c.title)}</p><textarea rows="3" aria-label="요약 메모">${esc(c.note || '')}</textarea><button class="x" type="button">삭제</button>`);
    $('textarea', li).addEventListener('input', e => { clips[i].note = e.target.value; store.set('clips', clips); });
    $('.x', li).addEventListener('click', () => { clips.splice(i, 1); store.set('clips', clips); renderClips(); renderNews(); });
    ul.appendChild(li);
  });
}

async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); toast('클립보드에 복사했다'); }
  catch (_) {
    const ta = el('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('클립보드에 복사했다'); } catch (e) { toast('복사 실패 — 직접 선택해 복사'); }
    ta.remove();
  }
}
$('#clipCopy').addEventListener('click', () => {
  if (!clips.length) return toast('담긴 클립이 없다');
  copyText(`[딜 클립 ${todayKey()}]\n\n` + clips.map((c, i) =>
    `${i + 1}. ${c.title}${c.source ? ` (${c.source})` : ''}\n${(c.note || '').split('\n').filter(Boolean).map(l => '   - ' + l).join('\n')}\n   ${c.link}`).join('\n\n'));
});
$('#clipClear').addEventListener('click', () => { if (!clips.length || !confirm('클립 메모를 모두 비울까?')) return; clips = []; store.set('clips', clips); renderClips(); renderNews(); });
$('#newsQ').addEventListener('input', e => { news.q = e.target.value.trim(); renderNews(); });
$('#newsSort').addEventListener('click', e => { news.sigFirst = !news.sigFirst; e.currentTarget.setAttribute('aria-pressed', news.sigFirst); renderNews(); });

function renderBriefSignals() {
  const ol = $('#briefSignals');
  if (!news.ok) { ol.innerHTML = '<li class="empty">실시간 피드 미연결 — 딜 뉴스의 검색 바로가기를 사용한다.</li>'; return; }
  const top = news.items.filter(x => x._s.w >= 2).sort(bySig).slice(0, 5);
  ol.innerHTML = top.length ? '' : '<li class="empty">오늘은 뚜렷한 딜 시그널이 없다.</li>';
  top.forEach(n => ol.appendChild(el('li', {}, `<a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a><span class="sg">${esc(n.source || '')} · ${ago(n.date)}</span>`)));
}

function renderTicker() {
  const top = [...news.items].sort(bySig).slice(0, 14);
  if (top.length < 4) return;
  const html = top.map(n => `<a href="${esc(n.link)}" target="_blank" rel="noopener"><b>${esc(n._s.tags[0] || catLabel(n.cat))}</b>${esc(n.title)}</a>`).join('');
  $('#tickerRow').innerHTML = html + html;
  $('#ticker').hidden = false;
}

function newsFallback() {
  setText('#newsMeta', '실시간 피드 미연결');
  $('#newsFallback').hidden = false;
  const box = $('#newsLinks'); box.innerHTML = '';
  RS.newsCats.filter(c => c.key !== 'all').forEach(c => {
    const q = RS.newsQueries[c.key];
    box.insertAdjacentHTML('beforeend',
      `<a href="https://news.google.com/search?q=${encodeURIComponent(q + ' when:7d')}&hl=ko&gl=KR&ceid=KR:ko" target="_blank" rel="noopener">${c.label} · Google</a>` +
      `<a href="https://search.naver.com/search.naver?where=news&sort=1&query=${encodeURIComponent(q.replace(/ OR /g, ' | '))}" target="_blank" rel="noopener">${c.label} · 네이버</a>`);
  });
}

async function loadNews() {
  $('#newsList').innerHTML = '<li class="skel"></li>'.repeat(6);
  renderNewsTabs();
  try {
    const r = await fetch('/api/news', { cache: 'no-store' });
    if (!r.ok) throw 0;
    const j = await r.json();
    if (!j.items || !j.items.length) throw 0;
    news.all = j.items.map(x => ({ ...x, _s: score(x.title) }));
    news.items = news.all.filter(x => x.cat !== 'rsq');
    news.rsq = news.all.filter(x => x.cat === 'rsq');
    news.ok = true;
  } catch (_) {
    news.ok = false; $('#newsList').innerHTML = ''; newsFallback();
  }
  renderNewsTabs(); renderNews(); renderBriefSignals(); renderTicker(); renderPins(); rsqInit();
}

/* ═════════ SEOUL MAP ═════════ */
let activeDistrict = 'CBD';
function districtNews(d) { return news.items.filter(n => d.re.test(n.title)).sort(bySig); }
function renderPins() {
  const g = $('#mapPins'); g.innerHTML = '';
  RS.districts.forEach(d => {
    const cnt = news.ok ? districtNews(d).length : null;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    p.setAttribute('class', 'pin' + (d.k === activeDistrict ? ' on' : ''));
    p.setAttribute('tabindex', '0'); p.setAttribute('role', 'button');
    p.setAttribute('aria-label', `${d.k} ${d.n}`);
    const L = d.lab === 'l', lx = L ? d.x - 16 : d.x + 16, ly = L ? d.y - 22 : d.y, an = L ? 'end' : 'start';
    const bx = L ? lx - 40 - (String(cnt).length * 7 + 12) - 6 : lx + 42;
    p.innerHTML = `<circle class="pin__pulse" cx="${d.x}" cy="${d.y}" r="12"/><circle class="pin__dot" cx="${d.x}" cy="${d.y}" r="7"/>
      <text class="pin__k" x="${lx}" y="${ly - 2}" text-anchor="${an}">${d.k}</text><text class="pin__n" x="${lx}" y="${ly + 13}" text-anchor="${an}">${d.n}</text>` +
      (cnt != null ? `<rect class="pin__badge" x="${bx}" y="${ly - 15}" width="${String(cnt).length * 7 + 12}" height="17" rx="2"/><text class="pin__cnt" x="${bx + 6}" y="${ly - 3}">${cnt}</text>` : '');
    const act = () => { activeDistrict = d.k; renderPins(); renderMapCard(); };
    p.addEventListener('click', act); p.addEventListener('mouseenter', act);
    p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
    g.appendChild(p);
  });
  renderMapCard();
}
function renderMapCard() {
  const d = RS.districts.find(x => x.k === activeDistrict);
  const L = news.ok ? districtNews(d).slice(0, 3) : [];
  $('#mapCard').innerHTML = `<h4><b>${d.k}</b>${d.n}</h4><p class="area">${d.area}</p><p>${d.d}</p>` +
    (news.ok ? (L.length ? `<ul>${L.map(n => `<li><a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a></li>`).join('')}</ul>` : '<p class="meta">최근 7일 권역 언급 기사 없음</p>') : '');
}
renderPins();

/* ═════════ RSQUARE NEWS ═════════ */
const rsq = { topic: 'all', view: store.get('rsqView', 'story'), press: '' };
const norm = t => t.replace(/\[[^\]]*\]|\([^)]*\)|[“”"'‘’…·,.!?\-–—|]/g, ' ').replace(/\s+/g, ' ').trim();
const grams = t => { const s = norm(t).replace(/\s/g, ''), g = new Set(); for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2)); return g; };
const sim = (a, b) => { let inter = 0; a.forEach(x => { if (b.has(x)) inter++; }); return inter / Math.max(1, Math.min(a.size, b.size)); };

function cluster(L) {
  const C = [];
  [...L].sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(n => {
    const g = grams(n.title);
    const c = C.find(c => c.gs.some(x => sim(x, g) >= 0.5));
    if (c) { c.items.push(n); c.gs.push(g); } else C.push({ gs: [g], items: [n] });
  });
  C.forEach(c => { c.items.sort((a, b) => (b.date || '').localeCompare(a.date || '')); c.lead = c.items[c.items.length - 1]; c.latest = c.items[0].date; });
  return C.sort((a, b) => b.items.length - a.items.length || (b.latest || '').localeCompare(a.latest || ''));
}

let rsqReady = false;
function rsqInit() {
  if (!rsqReady) {
    rsqReady = true;
    $$('#rsqView button').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.v === rsq.view));
      b.addEventListener('click', () => {
        rsq.view = b.dataset.v; store.set('rsqView', rsq.view);
        $$('#rsqView button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderRsq();
      });
    });
  }
  renderRsq();
}

function rsqFiltered() {
  const t = RS.rsqTopics.find(x => x.key === rsq.topic);
  return news.rsq.filter(n => (!t.re || t.re.test(n.title)) && (!rsq.press || n.source === rsq.press));
}

function renderRsq() {
  const empty = $('#rsqEmpty'), list = $('#rsqList');
  if (!news.ok) {
    list.innerHTML = ''; $('#rsqStats').innerHTML = ''; $('#pressList').innerHTML = ''; $('#rsqTopics').innerHTML = '';
    empty.hidden = false;
    empty.innerHTML = `실시간 피드 미연결. <a class="link" href="https://news.google.com/search?q=${encodeURIComponent(RS.newsQueries.rsq + ' when:30d')}&hl=ko&gl=KR&ceid=KR:ko" target="_blank" rel="noopener">Google 뉴스에서 알스퀘어 검색 →</a>`;
    return;
  }
  empty.hidden = true;
  // topics
  const tb = $('#rsqTopics'); tb.innerHTML = '';
  RS.rsqTopics.forEach(t => {
    const n = news.rsq.filter(x => !t.re || t.re.test(x.title)).length;
    const b = el('button', { type: 'button', role: 'tab', 'aria-selected': String(rsq.topic === t.key) }, `${t.label}<span class="c">${n}</span>`);
    b.addEventListener('click', () => { rsq.topic = t.key; rsq.press = ''; renderRsq(); });
    tb.appendChild(b);
  });
  // press list (topic 적용, press 필터 전)
  const t = RS.rsqTopics.find(x => x.key === rsq.topic);
  const base = news.rsq.filter(n => !t.re || t.re.test(n.title));
  const counts = {}; base.forEach(n => { const s = n.source || '기타'; counts[s] = (counts[s] || 0) + 1; });
  const P = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));
  const max = P.length ? P[0][1] : 1;
  setText('#pressCount', P.length);
  const pl = $('#pressList'); pl.innerHTML = '';
  [['', base.length], ...P].forEach(([name, c]) => {
    const li = el('li');
    const b = el('button', { type: 'button', 'aria-pressed': String(rsq.press === name) },
      `<span>${name ? esc(name) : '전체 매체'}</span><span class="num">${c}</span>${name ? `<span class="bar"><i style="width:${c / max * 100}%"></i></span>` : ''}`);
    b.addEventListener('click', () => { rsq.press = rsq.press === name ? '' : name; renderRsq(); });
    li.appendChild(b); pl.appendChild(li);
  });

  const L = rsqFiltered();
  const C = cluster(L);
  const days = L.length ? Math.max(1, Math.round((Date.now() - Math.min(...L.map(n => new Date(n.date || Date.now()).getTime()))) / 864e5)) : 0;
  $('#rsqStats').innerHTML = `
    <div><span>보도 건수</span><b class="r">${L.length}</b></div>
    <div><span>소식(묶음)</span><b>${C.length}</b></div>
    <div><span>보도 매체</span><b>${new Set(L.map(n => n.source)).size}</b></div>
    <div><span>최다 보도 소식</span><b>${C[0] ? C[0].items.length + '개 매체' : '—'}</b></div>`;

  list.innerHTML = '';
  if (!L.length) { list.innerHTML = '<p class="note" style="padding:24px 0">해당 조건의 보도가 없다.</p>'; return; }

  if (rsq.view === 'press') {
    const G = {}; L.forEach(n => { (G[n.source || '기타'] = G[n.source || '기타'] || []).push(n); });
    Object.entries(G).sort((a, b) => b[1].length - a[1].length).forEach(([src, items]) => {
      const d = el('div', { class: 'pgroup' });
      d.innerHTML = `<h4>${esc(src)} <span class="num">${items.length}건</span></h4><ul>${items.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(n =>
        `<li><a href="${esc(n.link)}" target="_blank" rel="noopener">${esc(n.title)}</a><span class="num">${ymd(n.date)}</span></li>`).join('')}</ul>`;
      list.appendChild(d);
    });
  } else {
    C.forEach((c, i) => {
      const lead = c.items[0], k = c.items.length;
      const topic = RS.rsqTopics.find(t => t.re && t.re.test(lead.title));
      const d = el('article', { class: 'story' });
      d.style.animationDelay = Math.min(i, 10) * 30 + 'ms';
      d.innerHTML = `<div class="story__h"><span class="story__n ${k === 1 ? 'one' : ''}">${k}개 매체</span>
        <div><a class="t" href="${esc(lead.link)}" target="_blank" rel="noopener">${esc(lead.title)}</a>
        <div class="row"><span>${esc(lead.source || '')}</span><span class="num">${ymd(lead.date)} · ${ago(lead.date)}</span>${topic ? `<span class="tag">${esc(topic.label)}</span>` : ''}</div>
        ${k > 1 ? `<div class="story__press">${c.items.map(n => `<a href="${esc(n.link)}" target="_blank" rel="noopener" title="${esc(n.title)}">${esc(n.source || '기타')}</a>`).join('')}</div>` : ''}</div></div>`;
      list.appendChild(d);
    });
  }
}

/* ═════════ UNDERWRITING ═════════ */
(function uwTabs() {
  const tabs = $$('#uwTabs button');
  tabs.forEach(b => b.addEventListener('click', () => {
    tabs.forEach(x => x.setAttribute('aria-selected', String(x === b)));
    $$('.uw').forEach(p => p.hidden = p.dataset.panel !== b.dataset.tab);
    redraw.forEach(f => f());
  }));
})();

const formVals = f => Object.fromEntries($$('input,select', f).map(i => [i.name, parseFloat(i.value)]));
const rangeFill = f => $$('input[type=range]', f).forEach(r => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'));
const heatBg = k => `color-mix(in srgb, var(--red) ${Math.round(6 + k * 72)}%, transparent)`;

function irr(cfs) {
  const npv = r => cfs.reduce((s, c, t) => s + c / Math.pow(1 + r, t), 0);
  let lo = -0.99, hi = 1.5, flo = npv(lo);
  if (flo * npv(hi) > 0) return NaN;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, f = npv(mid);
    if (Math.abs(f) < 1e-9) return mid;
    if (f * flo < 0) hi = mid; else { lo = mid; flo = f; }
  }
  return (lo + hi) / 2;
}

function model(p) {
  const price = p.price, cost = price * p.cost / 100, loan = price * p.ltv / 100, eq = price + cost - loan;
  const r = p.rate / 100, g = p.g / 100, n = Math.round(p.n), exit = p.exit / 100, sc = p.sell / 100;
  const cf = [-eq], ucf = [-(price + cost)];
  for (let t = 1; t <= n; t++) {
    const yn = p.noi * Math.pow(1 + g, t - 1);
    let c = yn - loan * r, u = yn;
    if (t === n) { const sale = p.noi * Math.pow(1 + g, n) / exit * (1 - sc); c += sale - loan; u += sale; }
    cf.push(c); ucf.push(u);
  }
  return { irr: irr(cf), uirr: irr(ucf), em: cf.slice(1).reduce((a, b) => a + b, 0) / eq, coc: (p.noi - loan * r) / eq, cap: p.noi / price, dscr: loan > 0 ? p.noi / (loan * r) : Infinity, cf, eq, loan, n };
}

function cfChart(cf, n) {
  const W = cw('cfChart'), H = 220, pad = { l: 8, r: 8, t: 22, b: 26 };
  const mx = Math.max(...cf, 0), mn = Math.min(...cf, 0), span = (mx - mn) || 1;
  const y = v => pad.t + (mx - v) / span * (H - pad.t - pad.b);
  const bw = (W - pad.l - pad.r) / cf.length;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="연도별 지분 현금흐름"><line class="zero" x1="${pad.l}" x2="${W - pad.r}" y1="${y(0)}" y2="${y(0)}"/>`;
  cf.forEach((v, i) => {
    const x = pad.l + i * bw + bw * 0.22, w = bw * 0.56, y0 = y(0), y1 = y(v);
    const cls = v < 0 ? 'bar--neg' : (i === n ? 'bar--exit' : 'bar--pos');
    s += `<rect class="bar ${cls}" x="${x.toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(1, Math.abs(y1 - y0)).toFixed(1)}"/>`;
    s += `<text class="lbl" x="${(x + w / 2).toFixed(1)}" y="${((v < 0 ? y0 : y1) - 6).toFixed(1)}" text-anchor="middle">${nf(v, 0)}</text>`;
    s += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${i === 0 ? 't0' : 'Y' + i}${i === n ? ' · 매각' : ''}</text>`;
  });
  return s + '</svg>';
}

function heatGrid(box, rows, cols, fn, rowFmt, colFmt, cellFmt, me) {
  const grid = rows.map(r => cols.map(c => fn(r, c)));
  const vals = grid.flat().filter(isFinite), lo = Math.min(...vals), hi = Math.max(...vals);
  box.style.gridTemplateColumns = `minmax(64px,auto) repeat(${cols.length},minmax(0,1fr))`;
  let h = `<div class="h"></div>` + cols.map(c => `<div class="h">${colFmt(c)}</div>`).join('');
  rows.forEach((r, i) => {
    h += `<div class="h">${rowFmt(r)}</div>`;
    cols.forEach((c, j) => {
      const v = grid[i][j], k = isFinite(v) && hi > lo ? (v - lo) / (hi - lo) : 0;
      h += `<div class="${me(i, j) ? 'me' : ''}" style="background:${isFinite(v) ? heatBg(k) : 'transparent'};color:${k > .55 ? '#fff' : 'var(--ink)'}">${isFinite(v) ? cellFmt(v) : '—'}</div>`;
    });
  });
  box.innerHTML = h;
}

(function lev() {
  const f = $('#levForm');
  const calc = () => {
    rangeFill(f);
    const p = formVals(f);
    setText('#levForm [data-o=ltv]', p.ltv + '%'); setText('#levForm [data-o=rate]', p.rate.toFixed(2) + '%');
    setText('#levForm [data-o=g]', p.g.toFixed(1) + '%'); setText('#levForm [data-o=n]', p.n + '년');
    setText('#levForm [data-o=exit]', p.exit.toFixed(2) + '%');
    if (!(p.price > 0 && p.noi > 0)) return;
    const m = model(p);
    countTo($('#oIrr'), m.irr * 100, v => v.toFixed(2) + '%');
    countTo($('#oUirr'), m.uirr * 100, v => v.toFixed(2) + '%');
    countTo($('#oEm'), m.em, v => v.toFixed(2) + 'x');
    countTo($('#oCoc'), m.coc * 100, v => v.toFixed(2) + '%');
    countTo($('#oCap'), m.cap * 100, v => v.toFixed(2) + '%');
    $('#oDscr').textContent = isFinite(m.dscr) ? m.dscr.toFixed(2) + 'x' : '무차입';
    $('#oDscr').className = 'num ' + (m.dscr < 1.2 ? 'neg' : m.dscr < 1.5 ? 'warn' : 'ok');
    const pos = m.cap > p.rate / 100;
    setText('#oLever', p.ltv > 0 ? `${pos ? '정(+)의 레버리지' : '부(−)의 레버리지'} — 진입 캡레이트 ${pct(m.cap)} ${pos ? '>' : '<'} 대출금리 ${p.rate.toFixed(2)}%. 지분 ${nf(m.eq)}억 · 대출 ${nf(m.loan)}억.` : '무차입 — 지분 IRR = 무레버리지 IRR.');
    $('#cfChart').innerHTML = cfChart(m.cf, m.n);
    const exits = [-0.5, -0.25, 0, 0.25, 0.5].map(d => +(p.exit + d).toFixed(2));
    const gs = [-1, -0.5, 0, 0.5, 1].map(d => +(p.g + d).toFixed(1));
    heatGrid($('#heat'), exits, gs, (e, g) => g < 0 || e <= 0 ? NaN : model({ ...p, exit: e, g }).irr,
      e => e.toFixed(2) + '%', g => g < 0 ? '—' : g.toFixed(1) + '%', v => (v * 100).toFixed(1), (i, j) => i === 2 && j === 2);
  };
  f.addEventListener('input', calc); redraw.push(calc); calc();
})();

(function cap() {
  const f = $('#capForm');
  const curve = (noi, c) => {
    const W = cw('capChart'), H = 220, pad = { l: 48, r: 12, t: 14, b: 26 };
    const a = Math.max(2, c - 1.5), b = c + 1.5, xs = [];
    for (let x = a; x <= b + 1e-9; x += 0.05) xs.push(x);
    const vs = xs.map(x => noi / (x / 100)), mx = Math.max(...vs), mn = Math.min(...vs);
    const X = x => pad.l + (x - a) / (b - a) * (W - pad.l - pad.r);
    const Y = v => pad.t + (mx - v) / ((mx - mn) || 1) * (H - pad.t - pad.b);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="캡레이트별 가치">`;
    for (let k = 0; k <= 3; k++) { const v = mn + (mx - mn) * k / 3; s += `<line class="ax" x1="${pad.l}" x2="${W - pad.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${pad.l - 6}" y="${Y(v) + 3}" text-anchor="end">${nf(v, 0)}</text>`; }
    for (let x = Math.ceil(a * 2) / 2; x <= b; x += 0.5) s += `<text x="${X(x)}" y="${H - 6}" text-anchor="middle">${x.toFixed(1)}%</text>`;
    s += `<polyline class="curve" points="${xs.map((x, i) => `${X(x).toFixed(1)},${Y(vs[i]).toFixed(1)}`).join(' ')}"/>`;
    const cv = noi / (c / 100);
    s += `<line class="guide" x1="${X(c)}" x2="${X(c)}" y1="${pad.t}" y2="${H - pad.b}"/><circle class="pt" cx="${X(c)}" cy="${Y(cv)}" r="5"/><text class="lbl" x="${X(c) + 9}" y="${Y(cv) - 8}">${nf(cv, 0)}억</text>`;
    return s + '</svg>';
  };
  const calc = () => {
    const p = formVals(f);
    if (!(p.noi > 0 && p.cap > 0)) return;
    const v = p.noi / (p.cap / 100);
    countTo($('#cVal'), v, x => nf(x, 0) + '억');
    setText('#cPp', p.gfa > 0 ? nf(v * 1e4 / p.gfa, 0) + '만원' : '—');
    countTo($('#cImp'), p.ask > 0 ? p.noi / p.ask * 100 : NaN, x => x.toFixed(2) + '%');
    const gap = p.ask > 0 ? p.ask / v - 1 : NaN;
    $('#cGap').textContent = isFinite(gap) ? (gap >= 0 ? '+' : '') + (gap * 100).toFixed(1) + '%' : '—';
    $('#cGap').className = 'num ' + (gap > 0.03 ? 'neg' : gap < -0.03 ? 'ok' : '');
    setText('#cSp', isFinite(p.ktb) ? (p.cap - p.ktb >= 0 ? '+' : '') + (p.cap - p.ktb).toFixed(2) + '%p' : '국고채 입력');
    setText('#cBp', '±' + nf(p.noi / ((p.cap - 0.1) / 100) - v, 0) + '억');
    $('#capChart').innerHTML = curve(p.noi, p.cap);
  };
  window.__calcCap = calc;
  f.addEventListener('input', calc); redraw.push(calc); calc();
})();

(function pf() {
  const f = $('#pfForm'), D = RS.pfDefault;
  Object.keys(D).forEach(k => { const i = $(`[name=${k}]`, f); if (i) i.value = D[k]; });
  const run = (p, soldPct, priceAdj = 0) => {
    const rev = p.rev * (1 + priceAdj), fin = p.pf * p.rate / 100 * p.term * p.draw / 100;
    const cost = p.land + p.cons + p.etc + fin, sales = rev * soldPct / 100;
    return { fin, cost, sales, profit: sales - cost, pfBe: (p.pf + fin) / rev, be: cost / rev };
  };
  const gauge = (sold, pfBe, be) => {
    const W = cw('pfGauge'), H = 96, l = 8, r = 8, X = v => l + Math.max(0, Math.min(1, v)) * (W - l - r);
    const mark = (v, lab, cls, y) => `<line x1="${X(v)}" x2="${X(v)}" y1="30" y2="58" stroke="${cls}" stroke-width="2"/><text x="${X(v)}" y="${y}" text-anchor="middle" style="fill:${cls}">${lab} ${(v * 100).toFixed(1)}%</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="분양률 게이지">
      <rect x="${l}" y="38" width="${W - l - r}" height="12" fill="var(--sunk)"/>
      <rect x="${l}" y="38" width="${X(sold / 100) - l}" height="12" fill="var(--red)" class="bar"/>
      ${mark(pfBe, 'PF 상환', 'var(--ink)', 22)}${mark(be, '손익분기', 'var(--amber)', 78)}
      <text x="${l}" y="94">0%</text><text x="${W - r}" y="94" text-anchor="end">100%</text></svg>`;
  };
  const calc = () => {
    rangeFill(f);
    const p = formVals(f);
    setText('#pfForm [data-o=sold]', p.sold + '%');
    if (!(p.rev > 0)) return;
    const m = run(p, p.sold);
    countTo($('#pProfit'), m.profit, v => nf(v, 0) + '억');
    $('#pProfit').classList.toggle('neg', m.profit < 0);
    setText('#pMargin', m.sales > 0 ? (m.profit / m.sales * 100).toFixed(1) + '%' : '—');
    setText('#pCost', nf(m.cost, 0) + '억');
    setText('#pPfBe', (m.pfBe * 100).toFixed(1) + '%');
    $('#pPfBe').className = 'num ' + (p.sold / 100 < m.pfBe ? 'neg' : 'ok');
    setText('#pBe', (m.be * 100).toFixed(1) + '%');
    $('#pBe').className = 'num ' + (p.sold / 100 < m.be ? 'warn' : 'ok');
    setText('#pFin', nf(m.fin, 1) + '억');
    $('#pfGauge').innerHTML = gauge(p.sold, m.pfBe, m.be);
    const solds = [60, 70, 80, 90, 100], adj = [-0.1, -0.05, 0, 0.05, 0.1];
    const near = solds.reduce((a, s, i) => Math.abs(s - p.sold) < Math.abs(solds[a] - p.sold) ? i : a, 0);
    heatGrid($('#pfHeat'), solds, adj, (s, a) => run(p, s, a).profit, s => s + '%', a => (a > 0 ? '+' : '') + (a * 100) + '%', v => nf(v, 0), (i, j) => i === near && j === 2);
  };
  f.addEventListener('input', calc); redraw.push(calc); calc();
})();

(function noc() {
  const f = $('#nocForm');
  const bars = rows => {
    const W = cw('nocChart'), rowH = 40, H = rows.length * rowH + 8, lw = W < 480 ? 108 : 150, mx = Math.max(...rows.map(r => r[1]));
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="임대료 비교">`;
    rows.forEach((r, i) => {
      const y = i * rowH + 8, w = (W - lw - 90) * r[1] / mx;
      s += `<text x="0" y="${y + 15}" style="fill:var(--ink-2);font-family:var(--f-body);font-size:12px">${r[0]}</text><rect class="bar" x="${lw}" y="${y + 4}" width="${w.toFixed(1)}" height="14" style="fill:${r[2]}"/><text class="lbl" x="${lw + w + 8}" y="${y + 15}">${nf(r[1], 0)}</text>`;
    });
    return s + '</svg>';
  };
  const calc = () => {
    const p = formVals(f);
    if (!(p.area > 0 && p.eff > 0 && p.term > 0)) return;
    const disc = Math.min(1, Math.max(0, p.rf / p.term)), effRent = p.rent * (1 - disc), occ = effRent + p.cam, nocV = occ / (p.eff / 100);
    countTo($('#nNoc'), nocV, v => nf(v, 0) + '원');
    countTo($('#nEff'), effRent, v => nf(v, 0) + '원');
    setText('#nDisc', (disc * 100).toFixed(1) + '%');
    const yr = occ * p.area * 12;
    setText('#nYear', yr >= 1e8 ? (yr / 1e8).toFixed(2) + '억원' : nf(yr / 1e4, 0) + '만원');
    const conv = p.dep + p.mr * 100;
    setText('#nConv', conv >= 1e4 ? (conv / 1e4).toFixed(2) + '억원' : nf(conv, 0) + '만원');
    const inScope = conv <= parseFloat($('select[name=reg]', f).value);
    $('#nLaw').textContent = inScope ? '보호범위 내 — 전 조항 적용' : '범위 초과 — 대항력·갱신요구권·권리금 등 일부 조항만 적용';
    $('#nLaw').className = inScope ? 'ok' : 'warn';
    $('#nocChart').innerHTML = bars([
      ['명목 임대료', p.rent, 'var(--line-2)'],
      ['실질 임대료', effRent, 'color-mix(in srgb, var(--red) 30%, transparent)'],
      ['실질 + 관리비', occ, 'color-mix(in srgb, var(--red) 60%, transparent)'],
      ['NOC (전용평)', nocV, 'var(--red)']
    ]);
  };
  f.addEventListener('input', calc); redraw.push(calc); calc();
})();

(function area() {
  const f = $('#areaForm'), K = 400 / 121, q = n => $(`[name=${n}]`, f);
  const r = (v, d = 4) => isFinite(v) ? +v.toFixed(d) : '';
  q('m2').addEventListener('input', e => q('py').value = r(parseFloat(e.target.value) / K));
  q('py').addEventListener('input', e => q('m2').value = r(parseFloat(e.target.value) * K));
  q('ppy').addEventListener('input', e => q('pm2').value = r(parseFloat(e.target.value) / K, 2));
  q('pm2').addEventListener('input', e => q('ppy').value = r(parseFloat(e.target.value) * K, 2));
  q('py').value = r(1000 / K); q('pm2').value = r(3500 / K, 2);
})();

/* ═════════ RENT ROLL ═════════ */
(function rentroll() {
  const ta = $('#rrText'), dt = $('#rrDate');
  ta.value = store.get('rr', RS.sampleRentRoll);
  const o = kstParts(); dt.value = `${o.year}-${o.month}-${o.day}`;
  const parse = txt => {
    const rows = [], errs = [];
    txt.split(/\r?\n/).forEach((line, i) => {
      if (!line.trim()) return;
      const c = line.split(line.includes('\t') ? '\t' : ',').map(s => s.trim());
      const area = parseFloat((c[2] || '').replace(/,/g, '')), rent = parseFloat((c[3] || '').replace(/,/g, ''));
      if (!isFinite(area)) { if (i > 0) errs.push(i + 1); return; }
      const exp = c[4] ? new Date(c[4] + 'T00:00:00') : null;
      const vac = !isFinite(rent) || rent <= 0 || /공실|vacant/i.test(c[0]) || !exp || isNaN(exp);
      rows.push({ name: c[0], floor: c[1] || '', area, rent: isFinite(rent) ? rent : 0, exp: vac ? null : exp, vac });
    });
    return { rows, errs };
  };
  const chart = (prof, years) => {
    const W = cw('rrChart'), H = 200, pad = { l: 8, r: 8, t: 22, b: 26 };
    const mx = Math.max(...years.map(y => prof[y] || 0), 0.01), bw = (W - pad.l - pad.r) / years.length;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="연도별 만기 프로파일"><line class="zero" x1="${pad.l}" x2="${W - pad.r}" y1="${H - pad.b}" y2="${H - pad.b}"/>`;
    years.forEach((y, i) => {
      const v = prof[y] || 0, h = v / mx * (H - pad.t - pad.b), x = pad.l + i * bw + bw * 0.2, w = bw * 0.6;
      s += `<rect class="bar" x="${x.toFixed(1)}" y="${(H - pad.b - h).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(h, v ? 1 : 0).toFixed(1)}" style="fill:${v >= 0.3 ? 'var(--red)' : 'var(--ink)'}"/>`;
      if (v) s += `<text class="lbl" x="${(x + w / 2).toFixed(1)}" y="${(H - pad.b - h - 6).toFixed(1)}" text-anchor="middle">${(v * 100).toFixed(0)}%</text>`;
      s += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${y}</text>`;
    });
    return s + '</svg>';
  };
  const run = () => {
    store.set('rr', ta.value);
    const { rows, errs } = parse(ta.value);
    setText('#rrErr', errs.length ? `${errs.join(', ')}행: 면적을 숫자로 읽지 못해 제외했다.` : '');
    const base = new Date(dt.value + 'T00:00:00');
    if (!rows.length || isNaN(base)) return;
    const leased = rows.filter(r => !r.vac), yrs = r => Math.max(0, (r.exp - base) / (365.25 * 864e5));
    const totA = rows.reduce((s, r) => s + r.area, 0), lA = leased.reduce((s, r) => s + r.area, 0), totR = leased.reduce((s, r) => s + r.rent, 0);
    const wale = totR ? leased.reduce((s, r) => s + yrs(r) * r.rent, 0) / totR : NaN;
    const waleA = lA ? leased.reduce((s, r) => s + yrs(r) * r.area, 0) / lA : NaN;
    const top3 = totR ? [...leased].sort((a, b) => b.rent - a.rent).slice(0, 3).reduce((s, r) => s + r.rent, 0) / totR : NaN;
    const in24 = totR ? leased.filter(r => yrs(r) <= 2).reduce((s, r) => s + r.rent, 0) / totR : NaN;
    countTo($('#rWale'), wale, v => v.toFixed(2) + '년'); countTo($('#rWaleA'), waleA, v => v.toFixed(2) + '년');
    countTo($('#rOcc'), lA / totA * 100, v => v.toFixed(1) + '%'); countTo($('#rRev'), totR * 12 / 1e4, v => v.toFixed(1) + '억');
    countTo($('#rTop'), top3 * 100, v => v.toFixed(1) + '%'); countTo($('#r24'), in24 * 100, v => v.toFixed(1) + '%');
    $('#rWale').className = 'num ' + (wale < 3 ? 'warn' : ''); $('#r24').className = 'num ' + (in24 > 0.3 ? 'neg' : ''); $('#rTop').className = 'num ' + (top3 > 0.5 ? 'warn' : '');
    const prof = {}; let maxY = base.getFullYear();
    leased.forEach(r => { const y = Math.max(r.exp.getFullYear(), base.getFullYear()); prof[y] = (prof[y] || 0) + r.rent / totR; maxY = Math.max(maxY, y); });
    const years = []; for (let y = base.getFullYear(); y <= Math.max(maxY, base.getFullYear() + 4); y++) years.push(y);
    $('#rrChart').innerHTML = chart(prof, years);
    const maxShare = Math.max(...leased.map(r => r.rent / totR), 0.0001);
    let h = '<thead><tr><th>임차인</th><th>층</th><th class="r">전용(평)</th><th class="r">월임대료(만원)</th><th class="r">평당(원)</th><th>만기</th><th class="r">잔여</th><th>임대료 비중</th></tr></thead><tbody>';
    [...rows].sort((a, b) => (a.exp || Infinity) - (b.exp || Infinity)).forEach(r => {
      const share = !r.vac && totR ? r.rent / totR : 0, y = r.vac ? null : yrs(r);
      h += `<tr class="${r.vac ? 'vac' : y <= 1 ? 'soon' : ''}"><td>${esc(r.name)}</td><td>${esc(r.floor)}</td><td class="r num">${nf(r.area, 0)}</td><td class="r num">${r.vac ? '—' : nf(r.rent, 0)}</td><td class="r num">${r.vac ? '—' : nf(r.rent * 1e4 / r.area, 0)}</td><td class="num">${r.exp ? r.exp.toISOString().slice(0, 10) : '공실'}</td><td class="r num">${y == null ? '—' : y.toFixed(1) + '년'}</td><td><span class="share"><span class="bar"><i style="width:${(share / maxShare * 100).toFixed(1)}%"></i></span><span class="num">${share ? (share * 100).toFixed(1) + '%' : '—'}</span></span></td></tr>`;
    });
    $('#rrTable').innerHTML = h + '</tbody>';
    const peak = years.reduce((a, y) => (prof[y] || 0) > (prof[a] || 0) ? y : a, years[0]), notes = [];
    notes.push(wale < 3 ? `WALE ${wale.toFixed(1)}년은 짧다. 매수인은 재임대 리스크를 출구 캡레이트나 가격 할인으로 반영한다.` : `WALE ${wale.toFixed(1)}년. 임대료·면적 기준 WALE 차이(${(wale - waleA).toFixed(1)}년)가 크면 고임대료 임차인의 만기가 결과를 끌고 있다는 뜻이다.`);
    if ((prof[peak] || 0) >= 0.3) notes.push(`${peak}년에 연 임대료의 ${(prof[peak] * 100).toFixed(0)}%가 만기다. 실사 단계에서 해당 임차인의 갱신 의사와 대체 수요부터 확인한다.`);
    if (top3 > 0.5) notes.push(`상위 3개 임차인이 ${(top3 * 100).toFixed(0)}%를 차지한다. 신용도와 사용 목적(본사·지점)을 확인한다.`);
    if (lA / totA < 0.95) notes.push(`점유율 ${(lA / totA * 100).toFixed(1)}% — 공실 해소가 밸류애드 포인트. 렌트프리를 반영한 실질임대료로 리스업을 가정한다.`);
    setText('#rrCoach', notes.join(' '));
  };
  let t; ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 250); });
  dt.addEventListener('input', run); redraw.push(run);
  $('#rrSample').addEventListener('click', () => { ta.value = RS.sampleRentRoll; run(); toast('가상 샘플을 불러왔다'); });
  run();
})();

/* ═════════ PROCESS ═════════ */
(function proc() {
  const P = RS.process, ol = $('#steps'), box = $('#stage');
  let cur = store.get('stage', 0);
  P.forEach((s, i) => {
    const li = el('li', {}, `<button type="button" role="tab"><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${s.t}</span></button>`);
    $('button', li).addEventListener('click', () => go(i)); ol.appendChild(li);
  });
  const list = a => `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const go = i => {
    cur = Math.max(0, Math.min(P.length - 1, i)); store.set('stage', cur);
    $$('button', ol).forEach((b, j) => { b.setAttribute('aria-selected', String(j === cur)); b.classList.toggle('done', j < cur); });
    const s = P[cur];
    box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
    box.innerHTML = `<div><p class="stage__k">${String(cur + 1).padStart(2, '0')} · ${s.k}</p><h3>${s.t}<span class="dur">${s.d}</span></h3>
      <p class="stage__what">${esc(s.what)}</p><div class="stage__coach"><b>사수 코멘트</b>${esc(s.coach)}</div><p class="stage__pit"><b>흔한 실수</b>${esc(s.pit)}</p>
      <div class="stage__nav"><button class="btn btn--ghost" type="button" data-d="-1" ${cur === 0 ? 'disabled' : ''}>← 이전</button><button class="btn btn--red" type="button" data-d="1" ${cur === P.length - 1 ? 'disabled' : ''}>다음 단계 →</button></div></div>
      <dl><div><dt>산출물</dt><dd>${list(s.out)}</dd></div><div><dt>신입이 맡는 일</dt><dd>${list(s.rookie)}</dd></div>
      <div><dt>시험 연결</dt><dd>${s.exam.map(x => `<div class="xrow"><span class="xb ${x[0] === '감평' ? 'xb--b' : 'xb--a'}">${x[0]}</span><span>${esc(x[1])}</span></div>`).join('')}</dd></div></dl>`;
    $$('[data-d]', box).forEach(b => b.addEventListener('click', () => go(cur + +b.dataset.d)));
  };
  ol.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { go(cur + 1); $$('button', ol)[cur].focus(); }
    if (e.key === 'ArrowLeft') { go(cur - 1); $$('button', ol)[cur].focus(); }
  });
  go(cur);
})();

/* ═════════ ONBOARDING ═════════ */
(function road() {
  const done = new Set(store.get('road', [])), box = $('#roadCols');
  const total = RS.roadmap.reduce((s, p) => s + p.items.length, 0), C = 2 * Math.PI * 52;
  const upd = () => {
    const k = done.size / total;
    $('#ringFg').style.strokeDashoffset = C * (1 - k);
    setText('#ringPct', Math.round(k * 100) + '%'); setText('#ringCnt', `${done.size} / ${total}`);
    $$('.phase', box).forEach((ph, i) => { const its = RS.roadmap[i].items; $('.phase__bar i', ph).style.width = (its.filter((_, j) => done.has(`${i}.${j}`)).length / its.length * 100) + '%'; });
  };
  RS.roadmap.forEach((p, i) => box.appendChild(el('div', { class: 'phase' }, `<p class="phase__p">${p.p}</p><h3>${p.t}</h3><div class="phase__bar"><i></i></div><ul class="checks">${p.items.map((t, j) =>
    `<li><label><input type="checkbox" data-k="${i}.${j}" ${done.has(`${i}.${j}`) ? 'checked' : ''}><span>${esc(t)}</span></label></li>`).join('')}</ul>`)));
  box.addEventListener('change', e => { const k = e.target.dataset.k; if (!k) return; e.target.checked ? done.add(k) : done.delete(k); store.set('road', [...done]); upd(); });
  upd();
})();

(function gloss() {
  const G = RS.glossary; let cat = 'all', q = '', ex = '';
  const tabs = $('#glossTabs');
  RS.glossCats.forEach(([k, l]) => {
    const n = k === 'all' ? G.length : G.filter(g => g.c === k).length;
    const b = el('button', { type: 'button', role: 'tab', 'aria-selected': String(k === cat) }, `${l}<span class="c">${n}</span>`);
    b.addEventListener('click', () => { cat = k; $$('button', tabs).forEach(x => x.setAttribute('aria-selected', String(x === b))); render(); });
    tabs.appendChild(b);
  });
  $$('#examSeg button').forEach(b => b.addEventListener('click', () => { ex = b.dataset.x; $$('#examSeg button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); render(); }));
  $('#glossQ').addEventListener('input', e => { q = e.target.value.trim(); render(); });
  const hl = s => { const e = esc(s); if (!q) return e; return e.replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark>${m}</mark>`); };
  const render = () => {
    const ql = q.toLowerCase();
    const L = G.filter(g => (cat === 'all' || g.c === cat) && (!ex || g.x.some(x => x[0] === ex)) && (!ql || [g.t, g.k, g.d, g.f, ...g.x.map(x => x[1])].join(' ').toLowerCase().includes(ql)));
    setText('#glossMeta', `${L.length}개 용어`);
    $('#glossList').innerHTML = L.map((g, i) => `<div class="term" style="animation-delay:${Math.min(i, 10) * 20}ms"><dt><b>${hl(g.t)}</b><span>${hl(g.k)}</span></dt>
      <dd>${hl(g.d)}${g.f ? `<code class="f">${esc(g.f)}</code>` : ''}${g.x.length ? `<div class="xs">${g.x.map(x => `<div class="xrow"><span class="xb ${x[0] === '감평' ? 'xb--b' : 'xb--a'}">${x[0]}</span><span>${hl(x[1])}</span></div>`).join('')}</div>` : ''}</dd></div>`).join('')
      || '<p class="note" style="padding:24px 0">일치하는 용어가 없다.</p>';
  };
  render();
})();

/* ═════════ RESOURCES ═════════ */
(function res() {
  const box = $('#srcList'); let g = '';
  RS.sources.forEach(s => {
    if (s.g !== g) { g = s.g; box.insertAdjacentHTML('beforeend', `<p class="src__g">${esc(g)}</p>`); }
    box.insertAdjacentHTML('beforeend', `<a href="${s.u}" target="_blank" rel="noopener"><b>${esc(s.n)}</b><span>${esc(s.w)}</span><i aria-hidden="true">↗</i></a>`);
  });
  $('#xlFns').innerHTML = RS.excel.fns.map(f => `<div><dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd></div>`).join('');
  $('#xlKeys').innerHTML = RS.excel.keys.map(f => `<div><dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd></div>`).join('');
  $('#xlRules').innerHTML = RS.excel.rules.map(r => `<li><b style="color:${r[1]}">${r[0]}</b><span>${esc(r[2])}</span></li>`).join('');
})();

renderClips();
loadMacro();
loadNews();
})();
