-- الكوبونات: جداول + صلاحيات + حماية من التلاعب
-- يعتمد على: public.is_admin() و public.is_banned(text) من ملفات سابقة

create table if not exists public.coupons (
  id            uuid primary key default gen_random_uuid(),
  store_name    text not null check (char_length(store_name) between 2 and 60),
  category      text not null default 'other' check (category in ('food','cafe','hotel','fun','shop','other')),
  city          text not null check (char_length(city) between 2 and 40),
  value         numeric check (value is null or (value > 0 and value <= 100000)),
  unit          text not null default 'pct' check (unit in ('pct','sar','gift','bogo','other')),
  title         text not null check (char_length(title) between 5 and 140),
  code          text check (code is null or char_length(code) between 2 and 40),
  source_url    text check (source_url is null or (char_length(source_url) <= 300 and source_url ~* '^https?://')),
  expires_at    date,
  kind          text not null default 'user' check (kind in ('official','user')),
  status        text not null default 'pending' check (status in ('pending','approved','rejected','hidden')),
  featured      boolean not null default false,
  worked        integer not null default 0,
  failed        integer not null default 0,
  copies        integer not null default 0,
  gb_user_id    text check (gb_user_id is null or char_length(gb_user_id) <= 64),
  author_name   text check (author_name is null or char_length(author_name) <= 30),
  device_id     text check (device_id is null or char_length(device_id) <= 64),
  moderation_note text,
  moderated_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists coupons_pub_idx on public.coupons (status, expires_at, created_at desc);
create index if not exists coupons_user_idx on public.coupons (gb_user_id);

create table if not exists public.coupon_votes (
  id          bigint generated always as identity primary key,
  coupon_id   uuid not null references public.coupons(id) on delete cascade,
  device_id   text not null check (char_length(device_id) between 6 and 64),
  gb_user_id  text check (gb_user_id is null or char_length(gb_user_id) <= 64),
  worked      boolean not null,
  created_at  timestamptz not null default now(),
  unique (coupon_id, device_id)
);

create table if not exists public.coupon_reports (
  id          bigint generated always as identity primary key,
  coupon_id   uuid not null references public.coupons(id) on delete cascade,
  kind        text not null check (kind in ('owner','votes','other')),
  reason      text check (reason is null or char_length(reason) <= 300),
  contact     text check (contact is null or char_length(contact) <= 120),
  gb_user_id  text check (gb_user_id is null or char_length(gb_user_id) <= 64),
  device_id   text check (device_id is null or char_length(device_id) <= 64),
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists coupon_reports_open_idx on public.coupon_reports (handled, created_at desc);

alter table public.coupons        enable row level security;
alter table public.coupon_votes   enable row level security;
alter table public.coupon_reports enable row level security;

revoke all on public.coupons, public.coupon_votes, public.coupon_reports from anon, authenticated;
-- الزائر يشوف أعمدة العرض فقط (بدون رقم الحساب أو الجهاز أو ملاحظة المراجع)
grant select (id, store_name, category, city, value, unit, title, code, source_url, expires_at, kind, status, featured, worked, failed, copies, author_name, created_at) on public.coupons to anon;
grant insert on public.coupons to anon;
grant select, insert on public.coupons to authenticated;
grant insert on public.coupon_votes, public.coupon_reports to anon, authenticated;
grant update, delete on public.coupons to authenticated;
grant select, update (handled) on public.coupon_reports to authenticated;
grant select on public.coupon_votes to authenticated;

-- القراءة العامة: المنشور وغير المنتهي فقط
drop policy if exists "c_read_public" on public.coupons;
create policy "c_read_public" on public.coupons for select to anon, authenticated
  using (status = 'approved' and (expires_at is null or expires_at >= (now() at time zone 'Asia/Riyadh')::date));

-- إضافة المستخدم: كوبون "شاركه مستخدم" فقط، معلّق، بحساب، بمصدر، وغير محظور
drop policy if exists "c_insert_user" on public.coupons;
create policy "c_insert_user" on public.coupons for insert to anon, authenticated
  with check (kind = 'user' and status = 'pending' and featured = false
              and worked = 0 and failed = 0 and copies = 0
              and gb_user_id is not null and not public.is_banned(gb_user_id)
              and source_url is not null
              and moderation_note is null and moderated_at is null
              and created_at > now() - interval '5 minutes' and created_at < now() + interval '5 minutes');

-- المدير: كل شي
drop policy if exists "c_admin_read" on public.coupons;
drop policy if exists "c_admin_insert" on public.coupons;
drop policy if exists "c_admin_update" on public.coupons;
drop policy if exists "c_admin_delete" on public.coupons;
create policy "c_admin_read"   on public.coupons for select to authenticated using (public.is_admin());
create policy "c_admin_insert" on public.coupons for insert to authenticated with check (public.is_admin());
create policy "c_admin_update" on public.coupons for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "c_admin_delete" on public.coupons for delete to authenticated using (public.is_admin());

-- التصويت: صوت واحد لكل جهاز على كوبون منشور
drop policy if exists "cv_insert" on public.coupon_votes;
create policy "cv_insert" on public.coupon_votes for insert to anon, authenticated
  with check (exists (select 1 from public.coupons c where c.id = coupon_id and c.status = 'approved'));
drop policy if exists "cv_admin_read" on public.coupon_votes;
create policy "cv_admin_read" on public.coupon_votes for select to authenticated using (public.is_admin());

-- البلاغات: "أنا صاحب المتجر" يحتاج حساب ووسيلة تواصل
drop policy if exists "cr_insert" on public.coupon_reports;
create policy "cr_insert" on public.coupon_reports for insert to anon, authenticated
  with check (handled = false and kind in ('owner','other')
              and (kind <> 'owner' or (gb_user_id is not null and contact is not null)));
drop policy if exists "cr_admin_read" on public.coupon_reports;
drop policy if exists "cr_admin_update" on public.coupon_reports;
create policy "cr_admin_read"   on public.coupon_reports for select to authenticated using (public.is_admin());
create policy "cr_admin_update" on public.coupon_reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- عداد الأصوات + إخفاء تلقائي: 3 "ما اشتغل" أو أكثر وأكثر من "اشتغل"
create or replace function public.coupon_vote_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  update public.coupons
     set worked = worked + (case when new.worked then 1 else 0 end),
         failed = failed + (case when new.worked then 0 else 1 end)
   where id = new.coupon_id and status = 'approved'
   returning * into c;
  if found and c.failed >= 3 and c.failed > c.worked then
    update public.coupons set status = 'hidden',
           moderation_note = 'hidden: انخفى تلقائياً بعد ' || c.failed || ' تصويت «ما اشتغل» مقابل ' || c.worked || ' «اشتغل»'
     where id = c.id;
    insert into public.coupon_reports (coupon_id, kind, reason) values (c.id, 'votes', 'انخفى تلقائياً بسبب تصويت المستخدمين');
  end if;
  return new;
end $$;
drop trigger if exists coupon_votes_after on public.coupon_votes;
create trigger coupon_votes_after after insert on public.coupon_votes
  for each row execute function public.coupon_vote_after();

-- "أنا صاحب المتجر": يخفي الكوبون فوراً لين يراجعه المدير
create or replace function public.coupon_report_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'owner' then
    update public.coupons set status = 'hidden',
           moderation_note = 'hidden: طلب إزالة من شخص يقول إنه صاحب المتجر'
     where id = new.coupon_id and status = 'approved';
  end if;
  return new;
end $$;
drop trigger if exists coupon_reports_after on public.coupon_reports;
create trigger coupon_reports_after after insert on public.coupon_reports
  for each row execute function public.coupon_report_after();

-- حد الإضافة: 5 كوبونات في اليوم لكل حساب
create or replace function public.coupon_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'user' and (select count(*) from public.coupons
       where gb_user_id = new.gb_user_id and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'rate limit';
  end if;
  return new;
end $$;
drop trigger if exists coupons_rate_limit on public.coupons;
create trigger coupons_rate_limit before insert on public.coupons
  for each row execute function public.coupon_rate_limit();

-- عداد "نسخ الكود"
create or replace function public.coupon_copied(cid uuid) returns void
language sql security definer set search_path = public as $$
  update public.coupons set copies = copies + 1 where id = cid and status = 'approved'
$$;
revoke all on function public.coupon_copied(uuid) from public;
grant execute on function public.coupon_copied(uuid) to anon, authenticated;

select 'ok' as result;
