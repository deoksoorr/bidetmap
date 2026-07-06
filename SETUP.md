# 비데맵 셋업 (Phase 0)

## 1. Supabase
1. supabase.com에서 프로젝트 생성 → URL/anon/service_role 키를 `.env`에 복사.
2. Dashboard SQL Editor에서 순서대로 실행:
   `supabase/migrations/0001_init.sql` → `0002_rls_rpc.sql` → `0003_seed.sql`
3. Storage 버킷 `restroom-photos` 생성(공개 읽기).
4. (선택) CLI: `npm i -g supabase` → `supabase db push`, `supabase functions deploy toss-auth`.

## 2. 사용자 앱 (앱인토스 미니앱)
```
npx create-ait-app@latest app   # WebView + React + TypeScript, SDK 2.x 선택
cd app && npm i @supabase/supabase-js
```
- `.env`에 `VITE_SUPABASE_*`, `VITE_KAKAO_JS_KEY` 설정.
- Phase 1에서 `src/lib/{supabase,kakao,toss}.ts` 및 지도 화면 추가.

## 3. 관리자 웹
```
npm create vite@latest admin -- --template react-ts
cd admin && npm i @supabase/supabase-js
```

## 4. 검증
- SQL: `select * from category_settings;` (30행), `select nearby_buildings(37.5,127.0,1500);` (빈 결과 OK).
- 트리거: 더미 building+restroom 생성 후 `place_reports`에 broken 3건 insert → 해당 restroom `status='pending_review'` 확인.
