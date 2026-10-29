# ViralFlow — Etapa 1 (núcleo de agendamento e publicação)

## Estado real
**Implementado nesta etapa:** schema PostgreSQL (Prisma), criptografia AES-256-GCM de tokens,
cliente da API oficial da Meta (container, polling de status, publish, limite diário, permalink,
refresh de token; Reels, imagem, carrossel e Story), claim atômico com `FOR UPDATE SKIP LOCKED`,
worker BullMQ, backoff progressivo, prevenção de duplicidade, estado `NEEDS_VERIFICATION`, testes unitários.

**Ainda NÃO implementado (próximas etapas):** autenticação do app, OAuth/callback da Meta,
upload S3 + validação de mídia, API routes, UI (dashboard, calendário, biblioteca, Dia de Produção),
analytics, página de diagnóstico, seed. Nada disso é simulado: simplesmente ainda não existe.

## Rodar
    cp .env.example .env   # preencha TOKEN_ENCRYPTION_KEY (openssl rand -base64 32)
    docker compose up -d
    npm install && npx prisma migrate dev --name init
    npm test
    npm run worker

## Login (ATUALIZADO): Login do Facebook para Empresas
Graph host `graph.facebook.com`; permissões `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement` (+ `instagram_manage_insights`). Cada conta do Instagram precisa estar ligada a uma Página do Facebook. Variáveis: META_APP_ID / META_APP_SECRET (Configurações → Básico).

## O que falta de você (Meta)
1. Criar app em developers.facebook.com, produto "Instagram" (API com login do Instagram).
2. Contas precisam ser **Profissionais** (Business ou Creator).
3. Permissões: `instagram_business_basic`, `instagram_business_content_publish` (escopo de métricas: a confirmar na doc oficial).
4. Em modo desenvolvimento só contas com função no app funcionam; para contas de terceiros é preciso App Review.
5. A mídia precisa estar numa URL pública (S3/MinIO público ou CDN) acessível pela Meta.

## Limitações da API
Limite de ~100 publicações/24h por conta; Stories e carrosséis têm regras próprias de formato;
não há agendamento nativo: o agendamento é do ViralFlow (worker no servidor).
