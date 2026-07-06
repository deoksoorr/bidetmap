# GitHub 공개 저장소 보안 점검 결과

- **점검일**: 2026-07-06
- **대상**: 비데맵(BidetMap) — `bidet-map/`, `app/`, `admin/`, `supabase/`
- **결론**: ✅ **공개 가능.** 소스에 하드코딩된 비밀값 없음. 실제 키는 gitignore 대상 `.env`에만 존재. 클라이언트 빌드/`.ait`에 `service_role` 미포함 확인. 아직 git 저장소가 아니라 과거 커밋 유출 위험도 없음.

## 점검 항목 및 결과

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 소스에 하드코딩된 secret | ✅ 없음 | 전 소스 grep(`sb_secret_` / `service_role` / JWT / 키값 / `BEGIN PRIVATE KEY`) → 소스 0건, 전부 env 참조 |
| `service_role`가 클라이언트 번들/`.ait`에 포함? | ✅ 미포함 | `bidet-map/dist`, `app/dist`, `admin/dist`, `bidet-map.ait`에서 `sb_secret_`/`service_role` 0건 |
| Kakao JS 키 / Supabase anon 키 | ⚠️ 클라이언트 키(번들 포함은 정상) | `.env`의 `VITE_`로만 주입, 소스 하드코딩 없음. 도메인 제한·RLS로 보호. `.env`는 커밋 제외 |
| 실제 `.env` 파일 | ✅ gitignore | `admin/.env`, `app/.env`, `bidet-map/.env` → `.env`, `.env.*` 패턴으로 제외 |
| `.env.example` | ✅ 값 비어있음 | 실제 키 없이 변수명만 |
| mTLS 인증서 / 개인키 / API 토큰 | ✅ 없음 | `*.pem`/`*.key`/`*.crt`/`*.p12`/`id_rsa` 검색 0건 (패턴은 방어적으로 gitignore 추가) |
| `node_modules` / `dist` / `.granite` / `*.ait` | ✅ gitignore | 의존성·빌드 산출물 제외 |
| `supabase/.temp/` (CLI 상태) | ✅ gitignore | `linked-project.json`(project ref·org id — 비밀 아님)이나 로컬 상태라 제외 |
| `.claude/` 로컬 설정 | ✅ gitignore | 에디터/에이전트 로컬 설정 전체 제외 |
| 로그 / OS 임시파일 | ✅ gitignore | `*.log`, `.DS_Store`, `Thumbs.db` |
| 토스 로그인 clientId | ✅ 저장소에 없음 | 콘솔에서 설정, 코드/저장소에 미포함(grep 0건) |
| 개인 이메일(PII) | ✅ 제거 완료 | `supabase/admin_bootstrap.sql`에 개인 Gmail 5곳 발견 → `admin@example.com` 플레이스홀더로 치환 |

## 서버 전용 비밀값 (저장소에 없음, Supabase Secrets로만 설정)

- `SUPABASE_SERVICE_ROLE_KEY`, `TOSS_CLIENT_ID`, `TOSS_CLIENT_SECRET`, `TOSS_API_BASE`, `MODERATION_API_URL`, `MODERATION_API_KEY`
- Edge Function(`supabase/functions/*`)은 전부 `Deno.env.get(...)`로 런타임 주입값만 사용 — 하드코딩 없음.

## 이번에 반영한 변경

- `.gitignore` 보강: `*.ait`, `.granite/`, `.env.*`(+ `!.env.example`), `supabase/.temp/`, `.claude/`, 인증서/키 패턴, 추가 로그·OS 파일.
- `.env.example` 정비: 프론트 변수 / 서버 전용 비밀값(Supabase Secrets) 구분 명확화.
- `supabase/admin_bootstrap.sql`: 하드코딩된 개인 이메일 → `admin@example.com` 플레이스홀더 + 교체 안내로 변경.
- `README.md`, 본 체크리스트 신규 작성.

## 공개 전 최종 확인 (사용자 승인 후 실행)

이 프로젝트는 아직 git 저장소가 아닙니다. 최초 커밋 전에 아래로 스테이징 내용을 반드시 확인하세요.

```bash
git init
git add .
git status            # ← .env / node_modules / dist / *.ait 가 목록에 없어야 정상
git commit -m "chore: initial public release of BidetMap"
# git remote add origin <repo-url>
# git branch -M main
# git push -u origin main
```

- `git status`에 `admin/.env`, `app/.env`, `bidet-map/.env`, `bidet-map.ait`가 보이면 **커밋 중단** 후 `.gitignore` 재확인.
- (권장) 공개 후에도 Kakao JS 키의 **도메인 제한**과 Supabase **RLS**가 최종 방어선이므로 활성 상태인지 재확인.
