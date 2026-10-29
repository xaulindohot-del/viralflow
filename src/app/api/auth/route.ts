import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkPassword, hashPassword, setSession } from "@/lib/session";

const body = z.object({ action: z.enum(["register", "login"]), email: z.string().email(), password: z.string().min(10) });
export async function POST(req: Request) {
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Dados inválidos (senha mínima: 10 caracteres)" }, { status: 400 });
  const { action, email, password } = p.data;
  if (action === "register") {
    if ((await db.user.count()) > 0) return NextResponse.json({ error: "Cadastro fechado: já existe um proprietário." }, { status: 403 });
    const u = await db.user.create({ data: { email, passwordHash: hashPassword(password) } });
    setSession(u.id); return NextResponse.json({ ok: true });
  }
  const u = await db.user.findUnique({ where: { email } });
  if (!u || !checkPassword(password, u.passwordHash)) return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
  setSession(u.id); return NextResponse.json({ ok: true });
}
