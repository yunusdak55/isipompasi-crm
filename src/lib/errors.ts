/**
 * Veritabani hatasini kullaniciya gosterilecek guvenli/Turkce metne cevirir.
 * Ham `error.message` (tablo/kolon/kisit adlari, SQL ayrintilari) ISTEMCIYE
 * SIZDIRILMAZ - ayrinti sunucu logunda (console.error) kalir.
 */
export function friendlyDbError(err: { code?: string; message?: string } | null | undefined): string {
  switch (err?.code) {
    case "42501":
      return "Bu işlem için yetkiniz yok.";
    case "23505":
      return "Bu kayıt zaten mevcut.";
    case "23503":
      return "İlişkili bir kayıt bulunamadı ya da bu kayıt başka kayıtlarca kullanılıyor.";
    case "23514":
      return "Girilen bilgiler geçerli değil.";
    case "23502":
      return "Zorunlu bir alan boş bırakılmış.";
    case "22001":
      return "Girilen metin çok uzun.";
    case "22P02":
    case "22007":
    case "22003":
      return "Geçersiz bir değer girildi.";
    case "PGRST116":
      return "Kayıt bulunamadı ya da erişim yetkiniz yok.";
    default:
      return "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.";
  }
}

/** Serbest metin girislerinde ust sinir (asiri buyuk govde/depolama kotuye kullanimina karsi). */
export const TEXT_LIMITS = {
  name: 200,
  short: 300,
  note: 5000,
} as const;
