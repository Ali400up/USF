-- RUN_THIS_TO_MOVE_ALL_LEVEL_CHANNELS_TO_GENERAL_SECTION.sql
-- يجعل أي قناة مكتوبة كتخصص "جميع المستويات" تظهر في قسم خاص بالقنوات العامة
-- بدل أن تظهر كتخصص مستقل في القائمة.

alter table public.committee_links
add column if not exists specialization text;

alter table public.committee_links
add column if not exists level text;

alter table public.committee_links
add column if not exists specialization_icon text;

update public.committee_links
set
  level = case
    when level is null or level = '' then 'جميع المستويات'
    else level
  end,
  specialization = case
    when specialization ~* 'جميع\s*المستويات|كل\s*المستويات|لكل\s*المستويات' then 'قنوات عامة'
    when specialization is null or specialization = '' then 'قنوات عامة'
    else specialization
  end,
  specialization_icon = coalesce(nullif(specialization_icon, ''), 'fa-solid fa-layer-group')
where
  specialization ~* 'جميع\s*المستويات|كل\s*المستويات|لكل\s*المستويات'
  or level ~* 'جميع\s*المستويات|كل\s*المستويات|لكل\s*المستويات';

select pg_notify('pgrst', 'reload schema');
