import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";

export async function POST(req: Request) {
  const userId = getUserId(); if (!userId) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const slot = Number(new URL(req.url).searchParams.get("slot"));
  await db.socialAccount.deleteMany({ where: { userId, slot } }); // remove token e dados da conta; as outras não são afetadas
  return NextResponse.redirect(new URL("/contas?msg=Conta desconectada.", req.url), 303);
}
