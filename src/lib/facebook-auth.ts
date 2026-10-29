// Login do Facebook para Empresas + Instagram API (graph.facebook.com).
const V = () => process.env.META_GRAPH_VERSION ?? "v21.0";
export const SCOPES = ["instagram_basic", "instagram_content_publish", "pages_show_list", "pages_read_engagement", "instagram_manage_insights"];

export const authorizeUrl = (state: string) => {
  const q: Record<string, string> = { client_id: process.env.META_APP_ID!, redirect_uri: process.env.META_REDIRECT_URI!, state, response_type: "code" };
  if (process.env.META_LOGIN_CONFIG_ID) { q.config_id = process.env.META_LOGIN_CONFIG_ID; q.override_default_response_type = "true"; }
  else q.scope = SCOPES.join(",");
  return `https://www.facebook.com/${V()}/dialog/oauth?` + new URLSearchParams(q);
};
async function g(path: string, params: Record<string, string>) {
  const res = await fetch(`https://graph.facebook.com/${V()}/${path}?` + new URLSearchParams(params), { signal: AbortSignal.timeout(30_000) });
  const x: any = await res.json().catch(() => ({}));
  if (!res.ok || x.error) throw new Error(x.error?.message ?? `HTTP ${res.status}`);
  return x;
}
/** código -> token de usuário curto -> longo (~60 dias). O segredo fica só no servidor. */
export async function exchangeCode(code: string) {
  const short = await g("oauth/access_token", { client_id: process.env.META_APP_ID!, client_secret: process.env.META_APP_SECRET!, redirect_uri: process.env.META_REDIRECT_URI!, code });
  const long = await g("oauth/access_token", { grant_type: "fb_exchange_token", client_id: process.env.META_APP_ID!, client_secret: process.env.META_APP_SECRET!, fb_exchange_token: short.access_token });
  return long.access_token as string;
}
export interface IgCandidate { igUserId: string; username: string; avatarUrl?: string; pageId: string; pageName: string; pageToken: string }
/** Páginas autorizadas que têm conta profissional do Instagram ligada. Token de Página (de token longo) não expira. */
export async function listInstagramAccounts(userToken: string): Promise<IgCandidate[]> {
  const r = await g("me/accounts", { access_token: userToken, limit: "100", fields: "id,name,access_token,instagram_business_account{id,username,profile_picture_url}" });
  return (r.data ?? []).filter((p: any) => p.instagram_business_account).map((p: any) => ({
    igUserId: String(p.instagram_business_account.id), username: p.instagram_business_account.username,
    avatarUrl: p.instagram_business_account.profile_picture_url, pageId: p.id, pageName: p.name, pageToken: p.access_token }));
}
