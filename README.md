# korea-data-mcp

**전국 138개 도시 버스 정류소 + 30년 기상 평년값 + 전국 관광정보.** 설치 없는 원격 MCP 서버입니다.

`npx` 도, API 키 발급도 필요 없습니다 — URL 하나만 등록하면 됩니다.

## 다른 한국 MCP 서버와 뭐가 다른가

한국 관련 MCP 서버는 이미 여럿 있습니다. 대부분 **도시 하나**(서울·부산)나 **분야 하나**(숙박·주식·부동산·세금)를 다룹니다.
이 서버는 **전국 단위**이고, 특히 아래 둘은 지금 다른 데서 찾기 어렵습니다.

- **전국 버스 정류소** — 138개 도시, 좌표 포함
- **기상 평년값 1991~2020** — 30년 통계. (예보가 아닙니다. 예보를 주는 서버는 따로 있습니다)

관광정보는 서울 전용·숙박 전용 서버들이 이미 있습니다. 이 서버의 강점은 **전국·전 카테고리**라는 점입니다.

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
