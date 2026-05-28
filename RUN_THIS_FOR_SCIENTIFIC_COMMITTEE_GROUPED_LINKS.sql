-- RUN_THIS_FOR_SCIENTIFIC_COMMITTEE_GROUPED_LINKS.sql
-- هذا الملف يضيف حقول تنظيم القنوات العلمية في جدول روابط اللجان.
-- بعد تشغيله تستطيع من admin.html إضافة رابط للجنة العلمية المركزية بهذا الشكل:
-- الكلية / التخصص / المستوى / رابط القناة
-- وسيظهر في الموقع مجمعًا حسب الكلية ثم التخصص ثم المستوى.

alter table public.committee_links
add column if not exists college text;

alter table public.committee_links
add column if not exists specialization text;

alter table public.committee_links
add column if not exists level text;

-- تعبئة مبدئية من الوصف القديم إذا كان مكتوبًا بهذا الشكل:
-- الكلية: الحاسبات | التخصص: أمن سيبراني | المستوى: الثاني
update public.committee_links
set
  college = coalesce(
    college,
    nullif(trim(substring(description from 'الكلية\s*:\s*([^|]+)')), '')
  ),
  specialization = coalesce(
    specialization,
    nullif(trim(substring(description from 'التخصص\s*:\s*([^|]+)')), '')
  ),
  level = coalesce(
    level,
    nullif(trim(substring(description from 'المستوى\s*:\s*([^|]+)')), '')
  )
where description is not null;

-- تحسين الوصف ليكون موحدًا إذا كانت الحقول موجودة والوصف فارغ
update public.committee_links
set description = concat_ws(' | ',
  case when college is not null and college <> '' then 'الكلية: ' || college end,
  case when specialization is not null and specialization <> '' then 'التخصص: ' || specialization end,
  case when level is not null and level <> '' then 'المستوى: ' || level end
)
where (description is null or description = '')
  and (college is not null or specialization is not null or level is not null);

-- فهارس مساعدة للترتيب والبحث
create index if not exists committee_links_college_idx on public.committee_links(college);
create index if not exists committee_links_specialization_idx on public.committee_links(specialization);
create index if not exists committee_links_level_idx on public.committee_links(level);

-- تحديث كاش Supabase/PostgREST
select pg_notify('pgrst', 'reload schema');
