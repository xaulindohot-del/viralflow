import { db } from "../lib/db";
import { decryptToken } from "../lib/crypto";
import * as meta from "../lib/meta";
import { backoffMs, MAX_ATTEMPTS } from "../lib/time";

type Api = typeof meta;
const mediaUrl = (key: string) => `${process.env.S3_PUBLIC_BASE_URL}/${key}`;

/**
 * Executa UM alvo já reivindicado (state=PROCESSING). Idempotência:
 *  - containerId é gravado antes de publicar e reutilizado em retentativas;
 *  - se media_publish tiver resultado desconhecido (timeout/rede), vai para
 *    NEEDS_VERIFICATION e NUNCA é repetido automaticamente.
 */
export async function runTarget(targetId: string, api: Api = meta) {
  const t = await db.publishTarget.findUniqueOrThrow({
    where: { id: targetId }, include: { account: true, content: true } });
  if (t.state !== "PROCESSING") return; // outro worker/estado final: não faz nada
  const log = (step: string, ok: boolean, e?: any) =>
    db.publishAttempt.create({ data: { targetId, step, ok, finishedAt: new Date(), errorCode: e?.code?.toString(), errorMessage: e?.message?.slice(0, 500) } });

  if (t.account.status !== "CONNECTED") return fail(t.id, "NEEDS_MANUAL", `Conta ${t.account.status}: reautorize.`, t.account.userId);
  const token = decryptToken(t.account.tokenCipher);
  const igId = t.account.igUserId;
  let publishCalled = false;
  try {
    if (!t.externalId) {
      const lim = await api.getPublishingLimit(igId, token);
      if (lim.used >= lim.total) throw new api.MetaError(4, undefined, "Limite diário de publicações atingido", 429);

      let containerId = t.containerId;
      if (!containerId) {
        const assets = await db.mediaAsset.findMany({ where: { id: { in: t.content.mediaIds } } });
        const ordered = t.content.mediaIds.map((id) => assets.find((a) => a.id === id)!);
        const cover = t.content.coverMediaId ? await db.mediaAsset.findUnique({ where: { id: t.content.coverMediaId } }) : null;
        containerId = await api.createContainer(igId, token, t.content.format,
          ordered.map((a) => ({ url: mediaUrl(a.storageKey), isVideo: a.kind === "VIDEO" })),
          t.captionOverride ?? t.content.caption, cover ? mediaUrl(cover.storageKey) : undefined);
        await db.publishTarget.update({ where: { id: t.id }, data: { containerId } });
        await log("create_container", true);
      }
      await api.waitUntilReady(containerId, token);
      await log("container_ready", true);

      await db.publishTarget.update({ where: { id: t.id }, data: { state: "PUBLISHING" } });
      publishCalled = true;
      const pub = await api.publishContainer(igId, token, containerId);
      const permalink = await api.getPermalink(pub.id, token).catch(() => undefined);
      await db.publishTarget.update({ where: { id: t.id }, data: { state: "PUBLISHED", externalId: pub.id, permalink, lastError: null } });
      await log("published", true);
      await notify(t.account.userId, "PUBLISHED", `Publicado em @${t.account.username}${permalink ? ": " + permalink : ""}`);
    }
  } catch (e: any) {
    await log(publishCalled ? "publish" : "prepare", false, e);
    const kind = e instanceof api.MetaError ? e.kind : "TRANSIENT";
    // Resultado desconhecido da publicação: exigir verificação humana, nunca repetir.
    if (publishCalled && kind === "TRANSIENT") return fail(t.id, "NEEDS_VERIFICATION", "Resultado da publicação incerto; confira o perfil antes de repetir.", t.account.userId);
    if (kind === "AUTH") {
      await db.socialAccount.update({ where: { id: t.accountId }, data: { status: "EXPIRED" } });
      return fail(t.id, "NEEDS_MANUAL", "Autorização expirada ou inválida.", t.account.userId);
    }
    if (kind === "PERMISSION" || kind === "PERMANENT") return fail(t.id, "FAILED", e.message, t.account.userId);
    const attempts = t.attemptCount + 1;
    if (attempts >= MAX_ATTEMPTS) return fail(t.id, "FAILED", `Esgotou tentativas: ${e.message}`, t.account.userId);
    await db.publishTarget.update({ where: { id: t.id }, data: {
      state: "SCHEDULED", attemptCount: attempts, lastError: e.message,
      nextRetryAtUtc: new Date(Date.now() + backoffMs(attempts)), lockedAt: null } });
  }
}

async function fail(id: string, state: "FAILED" | "NEEDS_MANUAL" | "NEEDS_VERIFICATION", msg: string, userId: string) {
  await db.publishTarget.update({ where: { id }, data: { state, lastError: msg, lockedAt: null } });
  await notify(userId, state, msg);
}
const notify = (userId: string, kind: string, message: string) => db.notification.create({ data: { userId, kind, message } });

/**
 * Reivindica alvos vencidos de forma atômica (SKIP LOCKED): dois workers ou um
 * reinício nunca pegam o mesmo item. Itens PROCESSING travados >15min voltam à fila,
 * exceto os que já passaram de PUBLISHING (esses vão para verificação).
 */
export async function claimDue(limit = 20): Promise<string[]> {
  await db.$executeRaw`UPDATE "PublishTarget" SET state='NEEDS_VERIFICATION', "lastError"='Worker caiu durante a publicação', "lockedAt"=NULL
    WHERE state='PUBLISHING' AND "lockedAt" < now() - interval '15 minutes'`;
  await db.$executeRaw`UPDATE "PublishTarget" SET state='SCHEDULED', "lockedAt"=NULL
    WHERE state='PROCESSING' AND "lockedAt" < now() - interval '15 minutes'`;
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE "PublishTarget" SET state='PROCESSING', "lockedAt"=now()
    WHERE id IN (
      SELECT id FROM "PublishTarget"
      WHERE state='SCHEDULED' AND "scheduledAtUtc" <= now() + interval '2 minutes'
        AND ("nextRetryAtUtc" IS NULL OR "nextRetryAtUtc" <= now())
      ORDER BY "scheduledAtUtc" LIMIT ${limit} FOR UPDATE SKIP LOCKED)
    RETURNING id`;
  return rows.map((r) => r.id);
}

/** Retentativa manual: só libera se NÃO houver externalId (nada publicado). */
export async function retryAfterVerification(targetId: string, confirmedNotPublished: boolean) {
  const t = await db.publishTarget.findUniqueOrThrow({ where: { id: targetId } });
  if (t.externalId || t.state === "PUBLISHED") throw new Error("Já publicado; não repetir.");
  if (!confirmedNotPublished) throw new Error("Confirme que a publicação não existe no perfil.");
  await db.publishTarget.update({ where: { id: targetId }, data: { state: "SCHEDULED", containerId: null, nextRetryAtUtc: null } });
}
