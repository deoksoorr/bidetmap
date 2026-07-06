# 비데맵 배포 가이드

프로젝트 ref: `mldiqyzmnjksqdifehzx` · 리전/URL: `https://mldiqyzmnjksqdifehzx.supabase.co`

## 0. 키/시크릿 분리 원칙 (중요)
| 키 | 어디에 | 비고 |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_KAKAO_JS_KEY` | 프론트(app/admin `.env`) | 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | **설정 안 함** | Edge Function에 **자동 주입**. 프론트/VITE_ 절대 금지 |
| `TOSS_CLIENT_ID/SECRET`, `MODERATION_*` | **Supabase Function Secrets** | 서버 전용 |

---

## 1. DB 스키마 (완료)
- Supabase SQL Editor에서 `supabase/apply_all.sql`(0001~0013, 더미 제외) 실행 — **적용 완료됨**.
- 개발 더미가 필요하면 `supabase/migrations/0004_seed_dummy.sql` 별도 실행.
- 운영 전 더미 제거: `RELEASE.md §6` 참고.

## 2. Edge Function 배포
```bash
npm i -g supabase          # CLI 설치(최초)
bash supabase/deploy.sh     # 로그인→링크→함수 배포→시크릿
```
배포 대상: `toss-auth`, `photo-url`, `moderate-photo`.
- **`toss-auth`**: 배포 전 `verifyTossAuthorizationCode()`의 토스 토큰 교환 엔드포인트/응답 필드를 토스 공식 문서에 맞춰 확정하세요. `TOSS_*` 시크릿 미설정 시 로그인은 **fail-closed(거부)** — 로컬 개발만 `TOSS_AUTH_DEV=1`로 우회 가능.
- **`moderate-photo`**: `MODERATION_API_URL` 미설정 시 업로드 사진은 자동 공개되지 않고 `pending`(관리자 검수 대기)로 유지됩니다.
- **`photo-url`**: 비공개 버킷의 `visible` 사진에 대해서만 서명 URL을 발급합니다.

> Edge Function은 기본 `verify_jwt=true`로 anon 키(=유효 JWT)를 허용하므로 `functions.invoke` 호출이 그대로 통과합니다. 별도 설정 불필요.

## 3. Storage
- 버킷 `restroom-photos`는 0012에서 **비공개**로 전환됨(5MB·이미지 MIME 제한).
- 사진 표시는 위 Edge Function 배포 후 동작(배포 전에는 사진만 안 보이고 나머지는 정상).

## 4. 카카오맵
- 카카오 개발자센터 → 앱 → 플랫폼(Web)에 도메인 등록: dev `http://localhost:5173`, 운영 도메인.
- JS 키는 프론트 전용(현재 `.env`에 설정됨). 도메인 제한을 반드시 걸어 오용 방지.

## 5. 프론트엔드
- **사용자 앱(app/)**: 심사 제출본은 `npx create-ait-app`(WebView, SDK 2.x)로 스캐폴드 후 `app/src/` 이식 → 앱인토스 콘솔 업로드. (로컬 확인은 `cd app && npm run dev`)
- **관리자(admin/)**: 정적 호스팅(Vercel/Netlify 등) + 접근 제한. 관리자 계정은 `RELEASE.md §5` SQL로 부여.

## 6. 배포 후 스모크 테스트
1. 로그인: 토스 로그인 → `toss-auth` → 세션 → 지도 진입, 등록/신고 성공(RLS 통과).
2. 사진: 업로드 → `pending` → 관리자 검수 승인 → 앱 상세에 서명 URL로 표시.
3. 신뢰도: 서로 다른 3계정 고장신고 → 자동 `pending_review` 숨김.
4. 배치: `select cron.job;`에 `bidet-stale-downgrade`·`bidet-prune-recent-views` 등록 확인.
5. 권한: 일반 계정으로 `update profiles set role='admin'` 시도 → 권한 오류(0011 컬럼 회수).
