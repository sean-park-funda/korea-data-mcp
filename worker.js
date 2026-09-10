/**
 * korea-data-mcp — 한국 공공데이터 원격 MCP 서버
 *
 * S1 근거(2026-09-09): 선점자 Koomook/data-go-mcp-servers 는 303★·포크57 로 수요가 증명됐으나
 * 마지막 커밋이 2025-09-16(12개월 정체)이고, 커버리지가 금융·조달·화학이라
 * 우리 재고(관광 한/영·기상·실시간교통·버스)와 **겹치지 않는다.**
 *
 * 형태 축: 남들이 npx 설치형으로 낼 때 우리는 **원격 HTTP MCP** 로 낸다. 설치가 없다.
 * 키는 Workers 시크릿으로만 들어온다. 코드에 없다.
 */
const NAME = 'korea-data-mcp';
const VERSION = '0.1.0';
const BUILD = '__BUILD__';   // 배포 때 고유값으로 치환된다 (구버전 오판 방지)
const PROTOCOL = '2025-06-18';

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
});
const rpcOk = (id, result) => json({ jsonrpc: '2.0', id, result });
const rpcErr = (id, code, message) => json({ jsonrpc: '2.0', id, error: { code, message } });

/* ── 데이터 소스 ─────────────────────────────────────────── */

async function datago(env, base, op, params) {
  const u = new URL(`https://apis.data.go.kr/${base}/${op}`);
  u.searchParams.set('serviceKey', env.DATA_GO_KR_KEY);
  u.searchParams.set('_type', 'json');
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') u.searchParams.set(k, v);
  const text = await fetch(u).then((r) => r.text());
  for (const bad of ['SERVICE_KEY_IS_NOT_REGISTERED_ERROR', 'NO_OPENAPI_SERVICE_ERROR', 'LIMITED_NUMBER_OF_SERVICE_REQUESTS']) {
    if (text.includes(bad)) throw new Error(`공공데이터포털: ${bad}`);
  }
  let j; try { j = JSON.parse(text); } catch { throw new Error(`공공데이터포털 응답이 JSON이 아닙니다: ${text.slice(0, 160)}`); }
  const item = j?.response?.body?.items?.item;
  if (item == null || item === '') return [];
  return Array.isArray(item) ? item : [item];
}

const tourFields = (x) => ({
  title: x.title, addr: [x.addr1, x.addr2].filter(Boolean).join(' '),
  tel: x.tel || undefined, lat: x.mapy, lon: x.mapx,
  image: x.firstimage || undefined, contentId: x.contentid, contentTypeId: x.contenttypeid,
});

/* ── 도구 정의 ───────────────────────────────────────────── */

const TOOLS = [
  {
    name: 'korea_tour_search',
    description: '한국관광공사 국문 관광정보에서 관광지·음식점·숙박·축제를 키워드 또는 지역으로 검색한다. 실데이터(주소·좌표·전화·사진)를 반환한다.',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '검색 키워드 (예: "해운대", "한옥마을"). areaCode 와 함께 쓰거나 단독으로 쓴다' },
        areaCode: { type: 'string', description: '지역코드. 1=서울 6=부산 32=강원 39=제주 등. korea_area_codes 로 조회' },
        contentTypeId: { type: 'string', description: '12=관광지 14=문화시설 15=축제 25=여행코스 28=레포츠 32=숙박 38=쇼핑 39=음식점' },
        limit: { type: 'number', description: '최대 건수 (기본 10, 최대 50)' },
      },
    },
    async run(env, a) {
      const numOfRows = Math.min(a.limit || 10, 50);
      const common = { MobileOS: 'ETC', MobileApp: NAME, numOfRows, pageNo: 1, contentTypeId: a.contentTypeId };
      const rows = a.keyword
        ? await datago(env, 'B551011/KorService2', 'searchKeyword2', { ...common, keyword: a.keyword, areaCode: a.areaCode })
        : await datago(env, 'B551011/KorService2', 'areaBasedList2', { ...common, areaCode: a.areaCode, arrange: 'A' });
      return { count: rows.length, items: rows.map(tourFields) };
    },
  },
  {
    name: 'korea_tour_search_en',
    description: 'Search Korean tourist attractions, restaurants and accommodations in ENGLISH (Korea Tourism Organization official English dataset). Use this when the user is not Korean-speaking or wants English place names.',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Search keyword in English (e.g. "Gyeongbokgung", "beach")' },
        areaCode: { type: 'string', description: 'Area code. 1=Seoul 6=Busan 32=Gangwon 39=Jeju' },
        limit: { type: 'number', description: 'Max results (default 10, max 50)' },
      },
    },
    async run(env, a) {
      const numOfRows = Math.min(a.limit || 10, 50);
      const common = { MobileOS: 'ETC', MobileApp: NAME, numOfRows, pageNo: 1 };
      const rows = a.keyword
        ? await datago(env, 'B551011/EngService2', 'searchKeyword2', { ...common, keyword: a.keyword, areaCode: a.areaCode })
        : await datago(env, 'B551011/EngService2', 'areaBasedList2', { ...common, areaCode: a.areaCode, arrange: 'A' });
      return { count: rows.length, items: rows.map(tourFields) };
    },
  },
  {
    name: 'korea_area_codes',
    description: '한국관광공사 지역코드 목록. 다른 관광 도구의 areaCode 인자에 쓴다.',
    inputSchema: { type: 'object', properties: { areaCode: { type: 'string', description: '주면 해당 지역의 시군구 코드를 반환' } } },
    async run(env, a) {
      const rows = await datago(env, 'B551011/KorService2', 'areaCode2',
        { MobileOS: 'ETC', MobileApp: NAME, numOfRows: 50, areaCode: a.areaCode });
      return { count: rows.length, items: rows.map((x) => ({ code: x.code, name: x.name })) };
    },
  },
  {
    name: 'korea_bus_stops',
    description: '한국 시내버스 정류소를 도시별로 검색한다(국토교통부 TAGO). 정류소명 일부로 찾고 좌표를 돌려준다.',
    inputSchema: {
      type: 'object',
      properties: {
        cityCode: { type: 'string', description: '도시코드. korea_bus_cities 로 조회 (예: 25=대전, 21=부산)' },
        name: { type: 'string', description: '정류소명 일부 (예: "시청")' },
        limit: { type: 'number', description: '최대 건수 (기본 10)' },
      },
      required: ['cityCode'],
    },
    async run(env, a) {
      const rows = await datago(env, '1613000/BusSttnInfoInqireService', 'getSttnNoList',
        { cityCode: a.cityCode, nodeNm: a.name, numOfRows: Math.min(a.limit || 10, 50), pageNo: 1 });
      return { count: rows.length, items: rows.map((x) => ({ name: x.nodenm, id: x.nodeid, no: x.nodeno, lat: x.gpslati, lon: x.gpslong })) };
    },
  },
  {
    name: 'korea_bus_cities',
    description: '시내버스 정보를 제공하는 한국 도시코드 목록.',
    inputSchema: { type: 'object', properties: {} },
    async run(env) {
      const rows = await datago(env, '1613000/BusSttnInfoInqireService', 'getCtyCodeList', { numOfRows: 300, pageNo: 1 });
      return { count: rows.length, items: rows.map((x) => ({ cityCode: String(x.citycode), name: x.cityname })) };
    },
  },
  {
    name: 'korea_weather_normals',
    description: '한국 기상 평년값(1991~2020, 30년) — 지점별 월평균기온·월평균최고·월평균최저. "그 지역 10월이 보통 몇 도인가" 같은 질문에 쓴다. 예보가 아니라 평년 통계다.',
    inputSchema: {
      type: 'object',
      properties: {
        stationId: { type: 'string', description: '기상청 지점번호. 108=서울 159=부산 143=대구 156=광주 133=대전 184=제주 105=강릉' },
        month: { type: 'number', description: '1~12. 주면 그 달만, 없으면 12개월 전부' },
      },
      required: ['stationId'],
    },
    async run(env, a) {
      const u = `https://apihub.kma.go.kr/api/typ01/url/sts_ta.php?stn_id=${encodeURIComponent(a.stationId)}&tm1=199101&tm2=202012&authKey=${encodeURIComponent(env.KMA_APIHUB_KEY)}`;
      const text = await fetch(u).then((r) => r.text());
      if (/인증키|활용신청/.test(text)) throw new Error('기상청 인증 실패 또는 활용신청 안 됨');
      const byMonth = {};
      for (const line of text.split('\n')) {
        if (!line || line.startsWith('#')) continue;
        const c = line.split(',');
        if (c.length < 8) continue;
        const m = Number(String(c[0]).slice(4, 6));
        const avg = parseFloat(c[5]), tmx = parseFloat(c[6]), tmn = parseFloat(c[7]);
        if (!m || Number.isNaN(avg)) continue;
        (byMonth[m] ||= []).push({ avg, tmx, tmn });
      }
      const mean = (xs) => Math.round((xs.reduce((s, v) => s + v, 0) / xs.length) * 10) / 10;
      const out = Object.entries(byMonth)
        .filter(([m]) => !a.month || Number(m) === Number(a.month))
        .map(([m, rows]) => ({
          month: Number(m), years: rows.length,
          avgTemp: mean(rows.map((r) => r.avg)),
          avgHigh: mean(rows.map((r) => r.tmx)),
          avgLow: mean(rows.map((r) => r.tmn)),
        })).sort((x, y) => x.month - y.month);
      if (!out.length) throw new Error(`지점 ${a.stationId} 의 평년값 데이터가 없습니다. 지점번호를 확인하세요.`);
      return { stationId: a.stationId, period: '1991-2020', months: out };
    },
  },
  /*
   * ⚠️ `korea_traffic_realtime` (ITS 실시간 도로소통) 은 **v0에서 뺐다.**
   * 2026-09-09 실측: ITS 는 `openapi.its.go.kr:9443` 이고 **Cloudflare Workers 는 9443 아웃바운드를 막는다**(522).
   * 같은 시각 맥미니에서는 3,908 구간이 정상 응답했고, 워커의 443 포트 호출은 정상이다 → 원인은 포트 제한이 확실하다.
   * 항상 실패하는 도구를 tools/list 에 남기면 에이전트가 그걸 부르고 실패한다. 없는 편이 낫다.
   * 되살리려면 443 을 듣는 중계가 필요하다(맥미니 터널 등). v0 범위 밖.
   */
];

/* ── 계측 ────────────────────────────────────────────────

  Cloudflare 기본 요청 수는 **우리 자신의 테스트·배포 호출까지 센다.**
  그 숫자로 "외부 사용 흔적"을 판정하면 자기 트래픽을 성과로 착각하게 된다
  (인포허브가 합계만 보고 붕괴를 못 본 것과 같은 종류의 실수다).
  → 여기서 **우리 것과 남의 것을 구분해서** 직접 기록한다.
  우리 도구는 `X-Rlab-Self: 1` 을 붙인다. 그게 없으면 외부다.
*/
function record(env, request, { method, tool, ok }) {
  if (!env.AE) return;
  const self = request.headers.get('x-rlab-self') === '1' ? 1 : 0;
  const ua = (request.headers.get('user-agent') || '').slice(0, 80);
  // 클라이언트 식별은 IP 자체가 아니라 **해시 접두어**만 남긴다 (누군지는 몰라도 몇 명인지는 센다)
  const ip = request.headers.get('cf-connecting-ip') || '';
  let h = 0; for (let i = 0; i < ip.length; i++) h = (h * 31 + ip.charCodeAt(i)) >>> 0;
  const visitor = self ? 'self' : 'v' + h.toString(36);
  try {
    env.AE.writeDataPoint({
      blobs: [method || '', tool || '', visitor, ua, request.cf?.country || ''],
      doubles: [self, ok ? 1 : 0],
      indexes: [visitor],
    });
  } catch { /* 계측 실패가 서비스를 막지 않는다 */ }
}

/* ── MCP 처리 ────────────────────────────────────────────── */

async function handleRpc(env, msg, request) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    record(env, request, { method, tool: '', ok: true });
    return rpcOk(id, {
      protocolVersion: PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: NAME, version: VERSION },
      instructions: '한국 공공데이터(관광 국문/영문·버스 정류소·기상 평년값) 조회 서버입니다. 모든 응답은 정부 공개 API의 실데이터입니다.',
    });
  }
  if (method === 'notifications/initialized' || method?.startsWith('notifications/')) return new Response(null, { status: 202 });
  if (method === 'ping') return rpcOk(id, {});
  if (method === 'tools/list') {
    record(env, request, { method, tool: '', ok: true });
    return rpcOk(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
  }
  if (method === 'tools/call') {
    const tool = TOOLS.find((t) => t.name === params?.name);
    if (!tool) return rpcErr(id, -32602, `알 수 없는 도구: ${params?.name}`);
    try {
      const result = await tool.run(env, params.arguments || {});
      record(env, request, { method, tool: tool.name, ok: true });
      return rpcOk(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 1) }] });
    } catch (e) {
      record(env, request, { method, tool: tool.name, ok: false });
      // 도구 실패는 프로토콜 오류가 아니라 **결과 안의 오류**로 돌려준다 (MCP 규격)
      return rpcOk(id, { content: [{ type: 'text', text: `오류: ${e.message}` }], isError: true });
    }
  }
  return rpcErr(id, -32601, `지원하지 않는 메서드: ${method}`);
}

const ORIGIN = 'https://korea-data-mcp.picks-site.workers.dev';
const INDEXNOW_KEY = 'a7f3c1e9b2d84056af1c93e7d5б0428'.replace('б','b');

const LANDING = `<!doctype html><html lang="ko">
<meta charset="utf-8">
<title>전국 버스 정류소·기상 평년값 MCP 서버 — 설치 없는 한국 공공데이터</title>
<meta name="description" content="전국 138개 도시 버스 정류소와 1991~2020 기상 평년값을 AI 에이전트가 바로 조회하는 원격 MCP 서버. 전국 단위 관광정보(국문·영문)도 함께. 설치 없이 URL 하나로 연결합니다.">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="canonical" href="${ORIGIN}/">
<meta property="og:title" content="전국 버스 정류소·기상 평년값 MCP 서버">
<meta property="og:description" content="전국 138개 도시 버스 정류소 + 30년 기상 평년값 + 전국 관광정보. 설치 없이 URL 하나.">
<meta property="og:url" content="${ORIGIN}/">
<meta property="og:type" content="website">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"korea-data-mcp","applicationCategory":"DeveloperApplication","operatingSystem":"Any","description":"전국 138개 도시 버스 정류소, 1991~2020 기상 평년값, 전국 관광정보(국문·영문)를 제공하는 원격 MCP 서버","offers":{"@type":"Offer","price":"0","priceCurrency":"KRW"},"url":"${ORIGIN}/"}</script>
<style>body{max-width:680px;margin:0 auto;padding:24px;font:16px/1.7 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;color:#1a1c1b}
code,pre{background:#f4f6f5;border-radius:6px}code{padding:2px 5px}pre{padding:12px;overflow-x:auto;font-size:.86rem}
h1{font-size:1.5rem;line-height:1.35}h2{font-size:1.1rem;margin-top:30px}table{border-collapse:collapse;width:100%;font-size:.9rem}
th,td{border:1px solid #dde3e0;padding:7px 9px;text-align:left}th{background:#f6f8f7}
.v{background:#eef6f2;border-left:4px solid #0b6b53;padding:12px 14px;font-weight:600;border-radius:0 6px 6px 0}
footer{margin-top:36px;padding-top:16px;border-top:1px solid #dde3e0;color:#5b6360;font-size:.85rem}</style>
<h1>전국 버스 정류소 · 기상 평년값 MCP 서버</h1>
<p class="v">설치가 필요 없습니다. URL 하나면 에이전트가 <b>전국 138개 도시 버스 정류소</b>와
<b>30년 기상 평년값</b>을 바로 조회합니다. 전국 단위 관광정보(국문·영문)도 함께 들어 있습니다.</p>
<p>다른 한국 MCP 서버들은 대체로 <b>도시 하나</b>(서울·부산)나 <b>분야 하나</b>(숙박·주식·부동산)를 다룹니다.
이 서버는 <b>전국 단위</b>이고, 버스 정류소와 기상 평년값은 지금 다른 데서 찾기 어렵습니다.</p>

<h2>연결</h2>
<pre>{
  "mcpServers": {
    "korea-data": { "url": "${ORIGIN}/mcp" }
  }
}</pre>
<p>Streamable HTTP 방식입니다. <code>npx</code>·설치·API 키 발급이 없습니다. 키는 서버가 들고 있습니다.</p>

<h2>도구 6개</h2>
<table><tr><th>도구</th><th>하는 일</th></tr>
<tr><td><code>korea_tour_search</code></td><td>관광지·음식점·숙박·축제 검색 (한국관광공사 국문)</td></tr>
<tr><td><code>korea_tour_search_en</code></td><td>같은 데이터의 <b>공식 영문판</b> — 외국인 대상 에이전트용</td></tr>
<tr><td><code>korea_area_codes</code></td><td>지역·시군구 코드</td></tr>
<tr><td><code>korea_bus_stops</code></td><td>시내버스 정류소 검색 (좌표 포함, 전국 138개 도시)</td></tr>
<tr><td><code>korea_bus_cities</code></td><td>버스 정보 제공 도시 목록</td></tr>
<tr><td><code>korea_weather_normals</code></td><td>기상 평년값 1991~2020 (월평균·최고·최저 기온)</td></tr>
</table>

<h2>예시</h2>
<pre>"경주 불국사 근처 볼거리 찾아줘"        → korea_tour_search
"Find beaches near Busan in English"  → korea_tour_search_en
"부산 해운대 버스 정류소 알려줘"        → korea_bus_stops
"서울 10월은 보통 몇 도야?"            → korea_weather_normals</pre>

<h2>자주 묻는 것</h2>
<p><b>무료인가요?</b> 네. 조회 전용이고 과금이 없습니다.<br>
<b>데이터를 저장하나요?</b> 아니요. 요청을 받아 정부 API 로 전달하고 결과를 그대로 돌려줍니다.<br>
<b>실시간 교통은 없나요?</b> 국가교통정보센터(ITS)는 비표준 포트를 써서 이 서버에서 호출할 수 없습니다. 추가하려면 별도 중계가 필요합니다.</p>

<h2>출처</h2>
<p>한국관광공사(국문·영문 관광정보) · 국토교통부 TAGO(버스 정류소) · 기상청 API허브(평년값).
모두 공공데이터포털 및 각 기관의 공개 API 입니다.</p>

<footer><p><b>액슬컨설팅팀</b>이 만들고 운영합니다. 조회 전용이며 데이터를 저장하지 않습니다.</p>
<p><a href="${ORIGIN}/health">상태 확인</a></p></footer>`;

const ROBOTS = `User-agent: *
Allow: /

Sitemap: ${ORIGIN}/sitemap.xml
`;

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${ORIGIN}/</loc></url>
</urlset>
`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, GET, OPTIONS',
        'access-control-allow-headers': 'content-type, mcp-protocol-version, mcp-session-id',
      } });
    }
    if (url.pathname === '/mcp') {
      if (request.method !== 'POST') return json({ error: 'MCP 엔드포인트는 POST 만 받습니다' }, 405);
      let msg; try { msg = await request.json(); } catch { return rpcErr(null, -32700, '파싱 오류'); }
      if (Array.isArray(msg)) {
        const out = [];
        for (const m of msg) { const r = await handleRpc(env, m, request); if (r.status !== 202) out.push(await r.json()); }
        return json(out);
      }
      return handleRpc(env, msg, request);
    }
    if (url.pathname === '/health') return json({ ok: true, name: NAME, version: VERSION, build: BUILD, tools: TOOLS.length });
    if (url.pathname === '/robots.txt') return new Response(ROBOTS, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    if (url.pathname === '/sitemap.xml') return new Response(SITEMAP, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
    // IndexNow 소유권 확인 파일
    if (url.pathname === `/${INDEXNOW_KEY}.txt`) return new Response(INDEXNOW_KEY, { headers: { 'content-type': 'text/plain' } });
    return new Response(LANDING, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  },
};
