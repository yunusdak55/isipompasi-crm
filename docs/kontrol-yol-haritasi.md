# Kontrol yol haritası (2026-11-08)

Bu, canlıya çıkmadan önce sistemi baştan sona kontrol etmek için kendime yazdığım talimat.

## Sistem kime, nasıl hizmet veriyor

- **İklimlen ajansı (admin):** firmaları, kullanıcıları, aday firmaları (prospects), denetim kaydını ve entegrasyonları yönetir (`/admin/*`).
- **Firma sahibi (owner):** kendi firmasının WhatsApp'tan gelen taleplerini, takiplerini, keşiflerini, tekliflerini, satışlarını ve raporlarını görür; ekibini ve ayarları yönetir.
- **Satış personeli (sales):** kendine atanan talepleri arar, takip tarihi koyar, keşif/teklif/satış kaydeder.
- **Otomatik giriş (n8n WhatsApp ajanı):** yeni talepleri Supabase'e yazar (`docs/whatsapp-agent-contract.md`).

Ekranlar şunlar:
- giriş;
- Bugün paneli;
- talepler (liste, pano, takvim, keşifler, takipler, gecikenler, yeniler, detay, düzenleme);
- satışlar, raporlar, ayarlar, ajan;
- admin.

Günlük kullanım masaüstünde ve telefonda.

## Kontrol listesi

### 1. Görsel
- [ ] Giriş: sahne, ısı pompası, dal, logo, kart. Masaüstünde ve telefonda taşma ya da üst üste binme yok.
- [ ] Panel: gece mavisi tonlar, cam kartlar, kenar menü fotoğrafı, Bugün kartı. Yazılar okunur (kontrast).
- [ ] Diğer sayfalar yeni renklerle bozulmuyor; eski koyu renk kalıntısı yok.
- [ ] Görseller hafif: webp/jpg boyutları, gereksiz büyük dosya yok.

### 2. Animasyon ve efekt
- [ ] Yalnızca transform ve opacity animasyonları; tek ritim.
- [ ] Döngüler sekme gizliyken duruyor. "Hareketi azalt" açıkken döngü yok. Yavaş cihazda kendiliğinden hafif moda geçiliyor.
- [ ] Pervane hep aynı hızlı tempoda dönüyor; giriş animasyonu sonradan durmuyor.
- [ ] Kullanıcıya efekt seçimi gösterilmiyor (Otomatik/Tam/Hafif kaldırıldı); düzey otomatik.

### 3. Kod
- [ ] lint, typecheck, `security:check`, `npm audit`.
- [ ] Giriş eylemi: güvenlik kontrolleri, yönlendirme hedefi (`next`) yalnızca site içi bir yol olmalı.
- [ ] proxy ve CSP: `/dev-onizleme` canlıda kapalı (404).
- [ ] İstemci kodunda bellek sızıntısı, temizlenmeyen dinleyici ya da zamanlayıcı yok.
- [ ] Derleme `next build --webpack` ile geçiyor.

### 4. Canlıya çıkış
- [ ] Yalnızca bu işin dosyaları commit'lenir; `.github/workflows` ve ekran görüntüleri dışarıda kalır.
- [ ] Önce dal push'lanır, sonra `main`'e birleştirilir ve push'lanır (Hostinger buradan derler).
- [ ] Canlıda giriş ekranı açılır; kullanıcı kendi hesabıyla girip paneli kontrol eder.
