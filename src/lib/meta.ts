// Instagram API (Graph) oficial. Nenhuma simulação: toda chamada vai à Meta.
const base = () => `https://graph.facebook.com/${process.env.META_GRAPH_VERSION ?? "v21.0"}`;

export class MetaError extends Error {
  constructor(public code: number | undefined, public subcode: number | undefined, msg: string, public status: number) { super(msg); }
  /** 190 = token inválido/expirado; 4/17/32/613 = limites; 10/200-299 = permissão. */
  get kind(): "AUTH" | "RATE" | "PERMISSION" | "TRANSIENT" | "PERMANENT" {
    if (this.code === 190 || this.code === 102) return "AUTH";
    if ([4, 17, 32, 613].includes(this.code ?? -1)) return "RATE";
    if (this.code === 10 || (this.code ?? 0) >= 200 && (this.code ?? 0) < 300) return "PERMISSION";
    if (this.status >= 500 || this.code === 1 || this.code === 2) return "TRANSIENT";
    return "PERMANENT";
  }
}

async function call<T>(path: string, token: string, init: { method?: "GET" | "POST"; params?: Record<string, string> } = {}): Promise<T> {
  const url = new URL(`${base()}/${path}`);
  const params = { ...init.params, access_token: token };
  let body: URLSearchParams | undefined;
  if (init.method === "POST") body = new URLSearchParams(params);
  else for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { method: init.method ?? "GET", body, signal: AbortSignal.timeout(30_000) });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    throw new MetaError(e.code, e.error_subcode, e.message ?? `HTTP ${res.status}`, res.status);
  }
  return json as T;
}

export type Format = "REEL" | "FEED_IMAGE" | "CAROUSEL" | "STORY";
export interface MediaInput { url: string; isVideo: boolean }

export async function getPublishingLimit(igId: string, token: string) {
  const r = await call<{ data: { quota_usage: number; config: { quota_total: number } }[] }>(
    `${igId}/content_publishing_limit`, token, { params: { fields: "quota_usage,config" } });
  return { used: r.data[0]?.quota_usage ?? 0, total: r.data[0]?.config.quota_total ?? 100 };
}

export async function createContainer(igId: string, token: string, f: Format, media: MediaInput[], caption: string, coverUrl?: string): Promise<string> {
  if (f === "CAROUSEL") {
    const kids: string[] = [];
    for (const m of media) {
      const p: Record<string, string> = { is_carousel_item: "true", ...(m.isVideo ? { media_type: "VIDEO", video_url: m.url } : { image_url: m.url }) };
      kids.push((await call<{ id: string }>(`${igId}/media`, token, { method: "POST", params: p })).id);
    }
    for (const id of kids) await waitUntilReady(id, token);
    return (await call<{ id: string }>(`${igId}/media`, token, { method: "POST", params: { media_type: "CAROUSEL", children: kids.join(","), caption } })).id;
  }
  const m = media[0];
  const p: Record<string, string> = { caption };
  if (f === "REEL") Object.assign(p, { media_type: "REELS", video_url: m.url, ...(coverUrl ? { cover_url: coverUrl } : {}) });
  else if (f === "STORY") Object.assign(p, { media_type: "STORIES", ...(m.isVideo ? { video_url: m.url } : { image_url: m.url }) }), delete p.caption;
  else Object.assign(p, { image_url: m.url });
  return (await call<{ id: string }>(`${igId}/media`, token, { method: "POST", params: p })).id;
}

export async function waitUntilReady(containerId: string, token: string, timeoutMs = 10 * 60_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const r = await call<{ status_code: string }>(containerId, token, { params: { fields: "status_code" } });
    if (r.status_code === "FINISHED") return;
    if (r.status_code === "ERROR" || r.status_code === "EXPIRED") throw new MetaError(undefined, undefined, `Processamento falhou: ${r.status_code}`, 400);
    await new Promise((r) => setTimeout(r, 5_000));
  }
  throw new MetaError(1, undefined, "Tempo esgotado no processamento da mídia", 504);
}

export async function publishContainer(igId: string, token: string, creationId: string) {
  return call<{ id: string }>(`${igId}/media_publish`, token, { method: "POST", params: { creation_id: creationId } });
}
export async function getPermalink(mediaId: string, token: string) {
  return (await call<{ permalink?: string }>(mediaId, token, { params: { fields: "permalink" } })).permalink;
}
