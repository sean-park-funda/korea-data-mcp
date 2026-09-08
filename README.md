# korea-data-mcp

**한국 공공데이터를 AI 에이전트가 바로 쓰는 원격 MCP 서버.** 설치가 없습니다.

한국관광공사 관광정보(국문·**영문**), 국토교통부 버스 정류소, 기상청 평년값을
Model Context Protocol 로 노출합니다. `npx` 도, API 키 발급도 필요 없습니다 — URL 하나만 등록하면 됩니다.

## 연결

```json
{
  "mcpServers": {
    "korea-data": { "url": "https://korea-data-mcp.picks-site.workers.dev/mcp" }
  }
}
```

Streamable HTTP 방식입니다.

공식 MCP 레지스트리에도 등재돼 있습니다 — `io.github.sean-park-funda/korea-data-mcp`

## 도구

| 도구 | 하는 일 |
|---|---|
| `korea_tour_search` | 관광지·음식점·숙박·축제 검색 (한국관광공사 국문) |
| `korea_tour_search_en` | 같은 데이터의 **공식 영문판** — 외국인 대상 에이전트용 |
| `korea_area_codes` | 지역·시군구 코드 |
| `korea_bus_stops` | 시내버스 정류소 검색 (좌표 포함, 전국 138개 도시) |
| `korea_bus_cities` | 버스 정보 제공 도시 목록 |
| `korea_weather_normals` | 기상 평년값 1991~2020 (월평균·최고·최저 기온) |

```
"경주 불국사 근처 볼거리 찾아줘"        → korea_tour_search
"Find beaches near Busan in English"  → korea_tour_search_en
"부산 해운대 버스 정류소 알려줘"        → korea_bus_stops
"서울 10월은 보통 몇 도야?"            → korea_weather_normals
```

## 직접 호스팅하기

`worker.js` 하나가 전부입니다. 의존성이 없습니다.

1. [공공데이터포털](https://www.data.go.kr)에서 **한국관광공사 국문/영문 관광정보**와
   **국토교통부 버스정류소정보** 활용신청 → 서비스키 발급
2. [기상청 API허브](https://apihub.kma.go.kr)에서 인증키 발급
3. Cloudflare Workers 에 배포하고 시크릿 3개를 설정:
   `DATA_GO_KR_KEY`(디코딩본) · `KMA_APIHUB_KEY` · `ITS_API_KEY`(선택)

> ⚠️ `DATA_GO_KR_KEY` 는 **디코딩본**을 쓰세요. 포털이 주는 Encoding 본(`%` 포함)을 다시 urlencode 하면
> 이중 인코딩이 되어 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR` 가 납니다.

## 알려진 한계

- **실시간 교통(ITS)은 빠져 있습니다.** 국가교통정보센터는 `openapi.its.go.kr:9443` 을 쓰는데
  **Cloudflare Workers 는 비표준 아웃바운드 포트를 막습니다**(522). 추가하려면 443 을 듣는 중계가 필요합니다.
- 조회 전용입니다. 데이터를 저장하지 않습니다.
- 상위 정부 API 의 일일 호출 한도를 공유합니다.

## 출처

한국관광공사 · 국토교통부 TAGO · 기상청 API허브. 모두 각 기관의 공개 API 입니다.
이 서버는 데이터를 재가공하지 않고 그대로 전달합니다.

## 만든 사람

**박성준 님의 AI 비서**가 만들고 운영합니다.

## 라이선스

MIT
