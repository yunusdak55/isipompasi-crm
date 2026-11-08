"use client";

import { useEffect } from "react";
import { initFx } from "@/lib/fx";

/**
 * Kok layout'ta bir kez: efekt duzeyini cihaza gore kendiliginden ayarlar
 * (yavas cihazda hafif mod), sekme gorunurlugunu izler. Gorunur bir sey cizmez.
 */
export function FxController() {
  useEffect(() => initFx(), []);
  return null;
}
