#!/usr/bin/env bash
# 비데맵 Supabase Edge Function 배포 스크립트
# service_role/URL/anon 키는 Supabase가 함수 런타임에 자동 주입하므로 여기서 설정하지 않습니다.
# (프론트엔드/VITE_에는 service_role를 절대 넣지 않습니다.)
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-mldiqyzmnjksqdifehzx}"
cd "$(dirname "$0")/.."   # repo root

echo "▶ 1) 로그인 (최초 1회, 브라우저 토큰)"
supabase login

echo "▶ 2) 프로젝트 링크: $REF"
supabase link --project-ref "$REF"

echo "▶ 3) Edge Function 배포"
# toss-auth는 로그인 前(세션 없음, publishable anon 키)에 호출 → 게이트웨이 JWT 검증 우회.
# 함수 자체가 토스 인가코드를 mTLS로 검증하므로 안전.
supabase functions deploy toss-auth      --project-ref "$REF" --no-verify-jwt
supabase functions deploy photo-url      --project-ref "$REF"
supabase functions deploy moderate-photo --project-ref "$REF"
# 서비스 이용약관 공개 페이지(토스 로그인 동의화면 링크) — 인증 없이 접근해야 하므로 --no-verify-jwt
supabase functions deploy terms          --project-ref "$REF" --no-verify-jwt

echo "▶ 4) 서버 전용 시크릿 설정"
echo "    ※ SUPABASE_* (URL/ANON/SERVICE_ROLE)는 자동 주입 — 설정 금지/불가"
supabase secrets set --project-ref "$REF" \
  TOSS_API_BASE="https://apps-in-toss-api.toss.im"
# 토스 로그인 서버-서버 API는 mTLS 필수. 콘솔에서 발급한 인증서/키 파일을 base64로 인코딩해 별도 설정
# (값을 이 스크립트에 커밋하지 마세요 — cert/key는 비밀):
#   supabase secrets set --project-ref "$REF" \
#     TOSS_CERT="$(base64 < /path/to/cert.pem | tr -d '\n')" \
#     TOSS_KEY="$(base64 < /path/to/key.pem  | tr -d '\n')"
# (참고) generate-token은 {authorizationCode, referrer} + mTLS만 요구 → client_id/secret 불필요.
# (선택) 이미지 자동 검열 연동 시:
# supabase secrets set --project-ref "$REF" \
#   MODERATION_API_URL="https://..." MODERATION_API_KEY="__FILL_ME__"

echo "✅ 배포 완료. 함수 목록:"
supabase functions list --project-ref "$REF"
