-- RUN_THIS_TO_KEEP_ALL_LEVEL_CHANNELS_INSIDE_COLLEGE.sql
-- يجعل روابط "جميع المستويات" تظهر داخل قسم الكلية التابعة لها
-- بدل ظهورها كتخصص مستقل أو قسم منفصل.

alter table public.committee_links
add column if not exists college text;

alter table public.committee_links
add column if not exists specialization text;

alter table public.committee_links
add column if not exists level text;

alter table public.committee_links
add column if not exists specialization_icon text;

update public.committee_links
set
  level = 'جميع المستويات',
  specialization = coalesce(nullif(college, ''), specialization, 'عام'),
  specialization_icon = coalesce(nullif(specialization_icon, ''), 'fa-solid fa-building-columns')
where
  specialization ~* 'جميع\s*المستويات|كل\s*المستويات|لكل\s*المستويات'
  or level ~* 'جميع\s*المستويات|كل\s*المستويات|لكل\s*المستويات';

-- تحديث الوصف بعد النقل
update public.committee_links
set description = concat_ws(' | ',
  case when college is not null and college <> '' then 'الكلية: ' || college end,
  case when specialization is not null and specialization <> '' then 'التخصص: ' || specialization end,
  case when level is not null and level <> '' then 'المستوى: ' || level end
)
where
  level = 'جميع المستويات'
  and (college is not null or specialization is not null);

select pg_notify('pgrst', 'reload schema');
