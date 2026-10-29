import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const sig = (v: string) => createHmac("sha256", process.env.AUTH_SECRET!).update(v).digest("base64url");
export function setSession(userId: string) {
  cookies().set("vf_session", `${userId}.${sig(userId)}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 14 });
}
export function getUserId(): string | null {
  const v = cookies().get("vf_session")?.value; if (!v) return null;
  const [id, s] = v.split(".");
  return id && s && s.length === sig(id).length && timingSafeEqual(Buffer.from(s), Buffer.from(sig(id))) ? id : null;
}
export function hashPassword(pw: string) { const salt = randomBytes(16); return `${salt.toString("base64")}.${scryptSync(pw, salt, 64).toString("base64")}`; }
export function checkPassword(pw: string, stored: string) {
  const [s, h] = stored.split("."); const a = scryptSync(pw, Buffer.from(s, "base64"), 64), b = Buffer.from(h, "base64");
  return a.length === b.length && timingSafeEqual(a, b);
}
