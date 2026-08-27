-- Teklif reddedildiginde nedenini yazabilmek icin (spec: "reddettiyse neden
-- reddettigini yazabilecegi yer olsun, boylece musterilerin neden red
-- yedigini anlar, ona yonelik calisma yapar"). offers.status zaten vardi
-- (draft/sent/followup/accepted/rejected) ama hicbir ekran onu degistirmiyordu -
-- bu migration sadece eksik kolonu ekliyor, durum degisikligi UI/action
-- katmaninda ayrica eklendi.
alter table public.offers
  add column if not exists rejection_reason text;
