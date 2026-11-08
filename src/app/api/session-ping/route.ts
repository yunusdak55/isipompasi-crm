import { NextResponse } from "next/server";
import { getSessionSecondsLeft } from "@/lib/auth/session";

/**
 * Arka plan oturum yenilemesi (bkz. components/layout/session-keeper.tsx).
 * Asil isi proxy yapar: jeton dolmak uzereyse bu istekte yeniler ve yeni
 * cerezleri yanita yazar. Burasi yalnizca yeni jetonun kalan suresini dondurur
 * ki istemci bir sonraki yenilemeyi zamanlayabilsin. Veritabanina gitmez.
 */
export async function GET() {
  const expiresIn = await getSessionSecondsLeft();
  const headers = { "Cache-Control": "private, no-store" };
  if (expiresIn === null) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  return NextResponse.json({ expiresIn }, { headers });
}
