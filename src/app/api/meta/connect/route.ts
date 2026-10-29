import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getUserId } from "@/lib/session";
import { authorizeUrl } from "@/lib/facebook-auth";

export async function GET(req: Request) {
  if (!getUserId()) return NextResponse.redirect(new URL("/login", req.url));
  const slot = Number(new URL(req.url).searchParams.get("slot"));
  if (!Number.isInteger(slot) || slot < 1 || slot > 5) return NextResponse.json({ error: "slot inválido" }, { status: 400 });
  const nonce = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(`${nonce}.${slot}`));
  res.cookies.set("vf_oauth", `${nonce}.${slot}`, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/meta", maxAge: 600 });
  return res;
}
