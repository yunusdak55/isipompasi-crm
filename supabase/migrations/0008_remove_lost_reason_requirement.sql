-- Kayip nedeni ozelligi UI'dan tamamen kaldirildi (kullanici karari: "kayip
-- nedenlerini kaldir gerek yok"). Bu constraint status='lost' oldugunda
-- lost_reason_id'yi zorunlu kiliyordu - artik uygulama bu alani hic
-- doldurmuyor, dolayisiyla constraint her "Kayip" tasimasinda hataya neden
-- olur. lost_reason_id / lost_reason_detail kolonlari ve lost_reasons
-- tablosu veri kaybi olmasin diye silinmiyor, sadece zorunluluk kaldiriliyor.
alter table public.leads drop constraint if exists leads_lost_reason_required;
