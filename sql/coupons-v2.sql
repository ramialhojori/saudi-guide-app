-- الكوبونات v2: تفاصيل نوع الكوبون + "كوبوناتي المرسلة"

-- أنواع خصم إضافية
alter table public.coupons drop constraint if exists coupons_unit_check;
alter table public.coupons add constraint coupons_unit_check
  check (unit in ('pct','sar','gift','bogo','free_delivery','fixed_price','cashback','other'));

-- تفاصيل العرض
alter table public.coupons add column if not exists channel      text not null default 'any'
  check (channel in ('any','store','online','app','delivery'));
alter table public.coupons add column if not exists min_order    numeric check (min_order is null or (min_order >= 0 and min_order <= 100000));
alter table public.coupons add column if not exists max_discount numeric check (max_discount is null or (max_discount > 0 and max_discount <= 100000));
alter table public.coupons add column if not exists new_only     boolean not null default false;
alter table public.coupons add column if not exists terms        text check (terms is null or char_length(terms) <= 300);
alter table public.coupons add column if not exists use_url      text check (use_url is null or (char_length(use_url) <= 300 and use_url ~* '^https?://'));
alter table public.coupons add column if not exists starts_at    date;
alter table public.coupons add column if not exists delivery_app text check (delivery_app is null or char_length(delivery_app) <= 40);

-- الزائر يقرأ الأعمدة الجديدة
grant select (channel, min_order, max_discount, new_only, terms, use_url, starts_at, delivery_app) on public.coupons to anon;

-- القراءة العامة: يحترم تاريخ البداية بعد
drop policy if exists "c_read_public" on public.coupons;
create policy "c_read_public" on public.coupons for select to anon, authenticated
  using (status = 'approved'
         and (expires_at is null or expires_at >= (now() at time zone 'Asia/Riyadh')::date)
         and (starts_at  is null or starts_at  <= (now() at time zone 'Asia/Riyadh')::date));

-- كوبوناتي المرسلة: لازم رقم الحساب ورقم الجهاز مع بعض
create or replace function public.my_coupons(uid text, dev text)
returns table (id uuid, store_name text, title text, code text, status text, reason text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.store_name, c.title, c.code,
         c.status,
         case when c.status = 'rejected' then nullif(regexp_replace(coalesce(c.moderation_note,''), '^(reject|review|approve|hidden):\s*', ''), '') end,
         c.created_at
    from public.coupons c
   where c.kind = 'user' and c.gb_user_id = uid and c.device_id = dev
     and coalesce(uid,'') <> '' and coalesce(dev,'') <> ''
   order by c.created_at desc
   limit 30
$$;
revoke all on function public.my_coupons(text, text) from public;
grant execute on function public.my_coupons(text, text) to anon, authenticated;

select 'ok' as result;
