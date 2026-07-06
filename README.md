# 비데맵 (BidetMap)

> 비데가 설치된 화장실 위치를 지도로 찾고 공유하는 **앱인토스(Apps in Toss) 미니앱**

사용자 주변의 화장실 비데 정보를 확인하고, 현재 위치 기반으로 가까운 비데 화장실을 빠르게 찾을 수 있는 생활 편의 서비스입니다. 지도 기반으로 가까운 장소를 탐색하고 필요한 정보를 간편하게 확인할 수 있어요.

## 개발 기간

- **2026년 7월 6일 — 하루.** 기획부터 개발, 빌드, 배포, 앱인토스 배포 검토 신청까지 당일에 완료했습니다.

## 사용 기술

- **Apps in Toss** — 토스 미니앱 플랫폼 (`@apps-in-toss/web-framework`, Granite 런타임, `.ait` 번들)
- **React + TypeScript + Vite**
- **Kakao Map JavaScript SDK** — 지도, 마커, 클러스터링
- **Supabase** — PostgreSQL + PostGIS(반경 검색), RLS, RPC, Storage, Edge Functions(Deno)
- **TDS (Toss Design System)** — `@toss/tds-mobile-ait`
- **react-router-dom** — WebView 대응 MemoryRouter

## 프로젝트 구조

| 폴더 | 설명 |
| --- | --- |
| `bidet-map/` | 앱인토스 미니앱 — 실제 빌드/배포 대상(`.ait`). `app/src`를 이식한 패키지 |
| `app/` | 사용자 앱 개발 소스 (Vite 개발·샌드박스) |
| `admin/` | 관리자 웹 (React) — 장소·화장실·사진·신고 검수/관리 |
| `supabase/` | DB 마이그레이션, RLS/RPC, Edge Functions(`toss-auth`, `photo-url`, `moderate-photo`, `terms`) |

## 주요 기능

- 현재 위치 기반 **주변 비데 화장실 지도 탐색** (PostGIS 반경 검색, "이 지역 검색")
- 비데 화장실 위치 **등록 · 사진 업로드 · 공유**
- 건물 내 **여러 화장실(층/구역) 구조** 지원
- 상세 정보 · **필터** · 신고, **즐겨찾기 · 최근 본 장소**
- **사진 검수 파이프라인**, 신뢰도 점수, 오래된 정보 자동 다운그레이드
- **관리자 웹**에서 검수·관리
- **토스 로그인(OAuth)** — 구경은 로그인 없이, 등록·제보 등 쓰기 액션에서만 컨텍스추얼 로그인

## 역할 분담

**사용자가 직접 담당한 부분**
- 서비스 기획, 핵심 아이디어, UX 흐름, 화면 레이아웃 방향
- 앱인토스 배포 검토 제출

**Claude Code를 활용한 부분**
- 기능 구현 및 코드 작성/정리
- 빌드/배포 보조 (`.ait` 빌드, Supabase Edge Function 배포)
- 검토용 문서(출시노트·기능 정보·약관) 정리

## 환경변수 설정

`.env.example`을 복사해 각 프로젝트에 `.env`를 만들고 값을 채웁니다. (실제 `.env`는 커밋되지 않습니다.)

```bash
cp .env.example app/.env
cp .env.example bidet-map/.env
cp .env.example admin/.env
```

| 변수 | 사용처 | 비고 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | app / bidet-map / admin | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | app / bidet-map / admin | anon(publishable) 키 — 클라이언트용 |
| `VITE_KAKAO_JS_KEY` | app / bidet-map | 카카오 JS 키(도메인 제한 권장) |

> **서버 전용 비밀값**(`SUPABASE_SERVICE_ROLE_KEY`, `TOSS_CLIENT_ID/SECRET`, `MODERATION_*`)은 프론트/`.env`/`VITE_`에 **절대 넣지 않고** Supabase Function Secrets(`supabase secrets set ...`)로만 설정합니다.

## 로컬 실행

```bash
# 사용자 앱 (개발)
cd app && npm install && npm run dev

# 앱인토스 미니앱  (Node >= 24 권장, .ait 빌드 시 필수)
cd bidet-map && npm install && npm run dev

# 관리자 웹
cd admin && npm install && npm run dev
```

> Kakao Map은 카카오 개발자센터 → 플랫폼 → **Web 사이트 도메인**에 테스트 로컬 주소 등록이 필요합니다.

## 빌드 / 배포

```bash
# 앱인토스 번들 (→ bidet-map.ait, Node 24 필요)
cd bidet-map && npm run build

# Supabase Edge Functions
cd supabase && bash deploy.sh
```

`.ait` 번들은 앱인토스 콘솔에 업로드해 배포 검토를 신청합니다.

## 배포 관련 주의사항

- `.ait`는 **빌드 산출물** — 저장소에 커밋하지 않습니다(`.gitignore`). 공유가 필요하면 GitHub Release 첨부를 권장합니다.
- `SUPABASE_SERVICE_ROLE_KEY`는 **서버(Edge Function) 전용** — 프론트/`VITE_`/번들에 절대 포함 금지.
- Kakao JS 키 · Supabase anon 키는 클라이언트 키(도메인 제한 · RLS로 보호)라 번들에 포함되지만, `.env` 자체는 커밋하지 않습니다.
- 토스 로그인 clientId는 앱인토스 콘솔에 설정하며 코드/저장소에는 없습니다.

## 보안상 저장소에 포함하지 않은 파일

- `.env`, `.env.*` (실제 키 — `.env.example`만 포함)
- `node_modules/`, `dist/`, `.granite/`, `*.ait` (의존성·빌드 산출물)
- `supabase/.temp/` (Supabase CLI 로컬 상태)
- `.claude/` (에디터/에이전트 로컬 설정)
- 인증서/개인키(`*.pem`, `*.key` 등), 로그, OS 임시 파일

전체 보안 점검 결과는 [docs/github-release-checklist.md](docs/github-release-checklist.md)를 참고하세요.

---

<sub>Built with Claude Code.</sub>
