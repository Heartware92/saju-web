-- 050: 문의 첨부 사진
--   inquiries.attachments : 비공개 스토리지 객체 경로 배열(jsonb).
--   버킷 inquiry-attachments(비공개): 인증 유저가 본인 uid 폴더에 업로드.
--   어드민은 service_role로 서명 URL을 생성해 열람한다(RLS 우회).

alter table public.inquiries
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- 비공개 버킷 (멱등)
insert into storage.buckets (id, name, public)
values ('inquiry-attachments', 'inquiry-attachments', false)
on conflict (id) do nothing;

-- 업로드: 인증 유저가 본인 uid 폴더(name 첫 세그먼트)에만 INSERT
drop policy if exists "inquiry_attach_insert_own" on storage.objects;
create policy "inquiry_attach_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'inquiry-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 본인 첨부 조회(미리보기 폴백용). 어드민은 service_role로 우회하므로 별도 불필요.
drop policy if exists "inquiry_attach_select_own" on storage.objects;
create policy "inquiry_attach_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'inquiry-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
