# Deploy na Railway (site + banco)
1. Suba esta pasta para um repositório PRIVADO no GitHub.
2. Railway → New Project → Deploy from GitHub repo → escolha o repositório.
3. No projeto: + New → Database → PostgreSQL.
4. No serviço do site → Variables:
   DATABASE_URL = ${{Postgres.DATABASE_URL}}
   AUTH_SECRET, TOKEN_ENCRYPTION_KEY = valores gerados (openssl rand -base64 32)
   META_APP_ID, META_APP_SECRET = Meta → Configurações → Básico
   META_REDIRECT_URI = https://SEU-DOMINIO/api/meta/callback
   META_GRAPH_VERSION = v21.0
5. Settings → Networking → Generate Domain. Use esse endereço em META_REDIRECT_URI e no painel da Meta.
Obs.: o worker (Redis + armazenamento) entra quando formos agendar posts.
