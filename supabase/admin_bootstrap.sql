-- 비데맵 관리자 계정 부트스트랩
-- ⚠️ 아래 'admin@example.com' 을 본인 관리자 계정 이메일로 모두 교체한 뒤 실행하세요.
--
-- [사전 1회] Supabase 대시보드 → Authentication → Users → "Add user"
--   · Email: (본인 관리자 이메일)
--   · Password: (원하는 비밀번호)
--   · "Auto Confirm User" 체크
-- 그 다음, SQL Editor에서 아래를 실행하세요. (SQL Editor는 postgres 권한이라
--  0011의 role 컬럼 UPDATE 회수/RLS의 영향을 받지 않습니다.)

-- 1) 관리자 권한 부여 (role='admin')
insert into profiles (id, role, nickname)
  select id, 'admin', '운영자'
  from auth.users
  where email = 'admin@example.com'
  on conflict (id) do update set role = 'admin';

-- 2) 신뢰도 레코드 생성(없으면)
insert into user_reliability_scores (user_id)
  select id from auth.users
  where email = 'admin@example.com'
  on conflict (user_id) do nothing;

-- 3) 확인 (role = admin 이면 성공)
select u.email, p.role, p.nickname
from profiles p
join auth.users u on u.id = p.id
where u.email = 'admin@example.com';
