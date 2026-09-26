/**
 * Parola politikasi (uygulama katmani). Supabase Auth'taki ayarla AYNI olmali
 * (en az 10 karakter + kucuk harf + buyuk harf + rakam) - ama Auth ayari
 * degismese bile burasi bagimsiz olarak zayif parolayi reddeder.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_HINT = `en az ${PASSWORD_MIN_LENGTH} karakter; büyük harf, küçük harf ve rakam içermeli`;

/** Gecerliyse null, degilse kullaniciya gosterilecek Turkce hata metni. */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Şifre en az ${PASSWORD_MIN_LENGTH} karakter olmalıdır.`;
  if (password.length > 128) return "Şifre en fazla 128 karakter olabilir.";
  if (!/[a-zçğıöşü]/.test(password)) return "Şifre en az bir küçük harf içermelidir.";
  if (!/[A-ZÇĞİÖŞÜ]/.test(password)) return "Şifre en az bir büyük harf içermelidir.";
  if (!/[0-9]/.test(password)) return "Şifre en az bir rakam içermelidir.";
  return null;
}
