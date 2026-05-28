-- RUN_THIS_FOR_SCIENTIFIC_SPECIALTY_TABS.sql
-- يضيف حقل أيقونة التخصص حتى تظهر التخصصات في الأعلى بأيقونات مناسبة.

alter table public.committee_links
add column if not exists college text;

alter table public.committee_links
add column if not exists specialization text;

alter table public.committee_links
add column if not exists specialization_icon text;

alter table public.committee_links
add column if not exists level text;

update public.committee_links
set specialization_icon = coalesce(nullif(specialization_icon, ''), 'fa-solid fa-graduation-cap')
where specialization is not null;

select pg_notify('pgrst', 'reload schema');
