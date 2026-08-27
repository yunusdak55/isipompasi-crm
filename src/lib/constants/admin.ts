import type { IntegrationProvider, IntegrationStatus } from "@/lib/types/domain";

export const INTEGRATION_PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  whatsapp: "WhatsApp",
  meta_ads: "Meta Ads",
  telegram: "Telegram",
  google_analytics: "Google Analytics",
  search_console: "Search Console",
};

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  disconnected: "Bağlı Değil",
  pending: "Bekliyor",
  connected: "Bağlı",
  error: "Hata",
};

export const INTEGRATION_STATUS_TONE: Record<IntegrationStatus, "ink" | "warning" | "success" | "danger"> = {
  disconnected: "ink",
  pending: "warning",
  connected: "success",
  error: "danger",
};
