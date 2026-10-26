-- =====================================================================
-- Tham gia lộ trình học (learning path) và trạng thái từng mục trong lộ trình
-- Jira: SCRUM-61 (S2-OT-01) — lộ trình Storage/LessonTemplate/<PathFolder>/LearningPath.json
--
--   * Ánh xạ schema JSON của nhóm nội dung:
--       LearningPathRecord.schema.json   -> learning_path_records
--       LearningPathProgress.schema.json -> learning_path_progress
--   * learning_path_id = "id" trong LearningPath.json (không phải tên folder),
--     path_item_id = "itemId" của bài ("lesson-...") hoặc nhánh ("branch-...").
--     Lộ trình nằm ở file JSON -> không có FK, backend kiểm tra trước khi ghi.
--   * Một user có thể tham gia cùng lộ trình nhiều lần (học lại / bản mới), nhưng
--     chỉ 1 lần đang học (status = 'in_progress') tại một thời điểm.
--   * Điểm quiz, mục nội dung đã học, XP vẫn ở user_lesson_progress / user_quiz_attempts
--     (20261021120000_learning_progress.sql); bảng ở đây chỉ lưu tiến trình theo lộ trình.
--   * Frontend chỉ được đọc dữ liệu của mình; chỉ backend C# (role postgres) ghi.
--
-- Chạy sau 20261021120000_learning_progress.sql, trong SQL Editor hoặc `supabase db push`.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. learning_path_records — mỗi lần user tham gia một phiên bản lộ trình
-- ---------------------------------------------------------------------
create table public.learning_path_records (
  id                     uuid         primary key default gen_random_uuid(),
  user_id                uuid         not null references public.profiles (id) on delete cascade,
  learning_path_id       varchar(100) not null,
  learning_path_version  integer      not null,
  status                 varchar(12)  not null default 'in_progress',
  started_at             timestamptz  not null default now(),
  last_activity_at       timestamptz  not null default now(),
  completed_at           timestamptz,

  constraint ck_path_record_path_id  check (learning_path_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint ck_path_record_version  check (learning_path_version >= 1),
  constraint ck_path_record_status   check (status in ('in_progress', 'completed', 'abandoned')),
  constraint ck_path_record_completed check (
    (status = 'completed') = (completed_at is not null)
  ),
  constraint ck_path_record_timestamps check (
    last_activity_at >= started_at
    and (completed_at is null or completed_at >= started_at)
  )
);

-- Mỗi user chỉ có 1 lần đang học cho mỗi lộ trình.
create unique index uq_path_record_active
  on public.learning_path_records (user_id, learning_path_id)
  where status = 'in_progress';

-- "Tiếp tục học": lộ trình gần nhất của user.
create index idx_path_record_recent on public.learning_path_records (user_id, last_activity_at desc);

-- ---------------------------------------------------------------------
-- 2. learning_path_progress — trạng thái từng bài / nhánh trong một lần tham gia
-- ---------------------------------------------------------------------
create table public.learning_path_progress (
  id            uuid         primary key default gen_random_uuid(),
  record_id     uuid         not null references public.learning_path_records (id) on delete cascade,
  path_item_id  varchar(120) not null,
  status        varchar(12)  not null default 'locked',
  started_at    timestamptz,
  completed_at  timestamptz,

  constraint uq_path_progress_item   unique (record_id, path_item_id),
  constraint ck_path_progress_item   check (path_item_id ~ '^(lesson|branch)-[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint ck_path_progress_status check (status in ('locked', 'available', 'in_progress', 'completed')),
  constraint ck_path_progress_started check (
    (status in ('in_progress', 'completed')) = (started_at is not null)
  ),
  constraint ck_path_progress_completed check (
    (status = 'completed') = (completed_at is not null)
  ),
  constraint ck_path_progress_timestamps check (completed_at is null or completed_at >= started_at)
);

-- ---------------------------------------------------------------------
-- 3. RLS — frontend chỉ đọc dữ liệu của mình, backend ghi
-- ---------------------------------------------------------------------
alter table public.learning_path_records  enable row level security;
alter table public.learning_path_progress enable row level security;

revoke all on public.learning_path_records, public.learning_path_progress
  from anon, authenticated;

grant select on public.learning_path_records, public.learning_path_progress
  to authenticated;

create policy "path_records: read own" on public.learning_path_records
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "path_progress: read own" on public.learning_path_progress
  for select to authenticated
  using (exists (
    select 1 from public.learning_path_records r
    where r.id = record_id and r.user_id = (select auth.uid())
  ));

commit;
