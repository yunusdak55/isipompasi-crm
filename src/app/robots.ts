import type { MetadataRoute } from "next";

/** Ozel yonetim paneli: hicbir tarayici/arama motoru botu indekslemesin. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
