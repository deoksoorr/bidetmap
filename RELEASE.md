# 비데맵 출시·심사 체크리스트 (Phase 8)

## 0. 현재까지 완료 (라이브 검증됨)
- DB 스키마·RLS·RPC·트리거·시드·Storage 정책·pg_cron: Supabase에 적용·검증 완료.
- 앱/관리자: `tsc` 0 + `vite build` 성공, dev 서버 부팅 확인.
- 보안: 배치 함수 `stale_downgrade` 클라이언트 실행 차단(42501) 확인.

## 1. 앱인토스 미니앱 패키징
> 로컬 dev용 `app/`은 웹 검증용 Vite 스탠드인. **실제 제출본은 앱인토스 공식 스캐폴드로 감싼다.**
- [ ] `npx create-ait-app@latest`로 미니앱 생성(WebView + React, **SDK 2.x**).
- [ ] `app/src/`(pages·components·lib)를 스캐폴드로 이식, `@apps-in-toss/web-framework` import 그대로 사용.
- [ ] 앱인토스 콘솔에 미니앱 등록, `appLogin` 약관 동의 화면 구성.
- [ ] 2026-03-23 이후 업로드는 SDK 2.x 필수 — 버전 확인.

## 2. Edge Function 배포 (service_role는 서버 전용)
```
supabase functions deploy toss-auth
supabase functions deploy moderate-photo
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... MODERATION_API_URL=... MODERATION_API_KEY=...
```
- [ ] `toss-auth`: appLogin `authorizationCode` 검증(토스 API, mTLS) 로직 채우기 → Supabase 세션 발급. **service_role는 Supabase Secrets에만**, 프론트/`VITE_` 금지.
- [ ] `moderate-photo`: `MODERATION_API_URL` 미설정 시 통과(관리자 수동검수), 설정 시 얼굴/개인정보/NSFW 판별.
- [ ] 앱 로그인 플로우: `Onboarding.login` → `authorizationCode` → `toss-auth` invoke → `supabase.auth.setSession`.

## 3. 환경변수 매핑
| 위치 | 키 | 성격 |
|---|---|---|
| app/admin `.env` (`VITE_`) | SUPABASE_URL, ANON_KEY, KAKAO_JS_KEY | 공개 |
| Supabase Function Secrets | SERVICE_ROLE_KEY, MODERATION_* | **비밀** |
- [ ] 프론트 번들에 service_role 미포함 확인(`grep -r service_role app/ admin/` → 0건).

## 4. 카카오맵
- [ ] 카카오 개발자센터 → 플랫폼(Web)에 도메인 등록: dev `http://localhost:5173`, 운영 도메인.
- [ ] JS 키 사용량/쿼터 확인.

## 5. 관리자 웹 배포 (미니앱과 분리)
- [ ] `admin/` 정적 호스팅(Vercel/Netlify 등) + 접근 제한(사내/IP/베이직인증).
- [ ] 관리자 계정 생성: Supabase Auth에 유저 추가 → **정확한 UUID를 auth.users에서 복사 확인** 후 실행(오입력 시 타인에게 관리자 부여 위험)
```sql
-- UUID 확인: select id, email from auth.users where email = '운영자이메일';
insert into profiles (id, role, nickname)
  select id, 'admin', '운영자' from auth.users where email = '운영자이메일'
  on conflict (id) do update set role='admin';
insert into user_reliability_scores (user_id)
  select id from auth.users where email = '운영자이메일' on conflict do nothing;
```

## 6. 데이터·정책
- [ ] 더미 데이터 제거: `delete from buildings where name in ('서울시청 공중화장실','강남역 지하상가','스타벅스 광화문점','롯데백화점 본점');` (restrooms/photos는 cascade).
- [ ] 개인정보처리방침·위치기반서비스 이용약관 게시, 앱 내 위치권한 고지.
- [ ] 사진 개인정보 안내(사람·신체·거울·개인정보 금지) 노출 확인(등록 U6).
- [ ] 사유시설(호텔/모텔/일반건물) 이용조건 필수 입력 동작 확인.

## 7. 심사 전 최종 E2E
- [ ] 지도: 현재위치·주변검색·필터·클러스터.
- [ ] 등록: 위치검색→건물→화장실 다건→사진→검수 대기 진입.
- [ ] 신뢰도: 도움됐어요/최근확인/신고, 부정신고 3건 자동숨김.
- [ ] 사진: 업로드→자동검열 status→관리자 검수/삭제.
- [ ] 저장: 즐겨찾기/최근본/공유/길찾기.
- [ ] 관리자: 검수 큐·신고 승인반려·사용자 제한·수정/숨김/삭제·로그·설정.
- [ ] 오래된 장소 강등: cron 등록 확인(`select * from cron.job;`).

## 8. 제출
- [ ] 앱인토스 콘솔 심사 제출, 스토어 정보·아이콘·스크린샷.
