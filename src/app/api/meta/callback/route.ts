import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { encryptToken } from "@/lib/crypto";
import { exchangeCode, listInstagramAccounts, SCOPES } from "@/lib/facebook-auth";

export async function GET(req: Request) {
  const url = new URL(req.url), back = (m: string) => NextResponse.redirect(new URL(`/contas?msg=${encodeURIComponent(m)}`, url));
  const userId = getUserId(); if (!userId) return NextResponse.redirect(new URL("/login", url));
  const cookie = req.headers.get("cookie")?.match(/vf_oauth=([^;]+)/)?.[1];
  if (!cookie || cookie !== url.searchParams.get("state")) return back("Falha de segurança (state inválido). Tente novamente.");
  if (url.searchParams.get("error")) return back("Autorização negada ou cancelada.");
  const code = url.searchParams.get("code"); if (!code) return back("Resposta sem código de autorização.");
  const slot = Number(cookie.split(".")[1]);
  try {
    const cands = await listInstagramAccounts(await exchangeCode(code));
    if (!cands.length) return back("Nenhuma conta profissional do Instagram encontrada nas Páginas autorizadas. Vincule a conta a uma Página do Facebook e autorize essa Página.");
    const used = new Set((await db.socialAccount.findMany({ where: { userId, NOT: { slot } }, select: { igUserId: true } })).map((a) => a.igUserId));
    const c = cands.find((x) => !used.has(x.igUserId));
    if (!c) return back("Todas as contas autorizadas já estão em outros slots. Autorize uma Página diferente.");
    const data = { slot, igUserId: c.igUserId, username: c.username, avatarUrl: c.avatarUrl, accountType: "PROFISSIONAL", scopes: SCOPES,
      status: "CONNECTED", ineligibleReason: null, tokenCipher: encryptToken(c.pageToken), tokenExpiresAt: null };
    await db.socialAccount.deleteMany({ where: { userId, OR: [{ slot }, { igUserId: c.igUserId }] } });
    await db.socialAccount.create({ data: { userId, ...data } });
    const res = back(`@${c.username} vinculada à Conta ${slot} (Página: ${c.pageName}).`); res.cookies.delete("vf_oauth"); return res;
  } catch (e: any) { return back(`Erro ao vincular: ${String(e.message).slice(0, 160)}`); }
}
