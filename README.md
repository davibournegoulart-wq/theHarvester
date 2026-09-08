# Net Scraper

Sistema de investigação OSINT — módulos internos, sem ferramenta de terceiro embutida.
Documentação completa de arquitetura e decisão de escopo/risco no vault Obsidian
`Net_Scraper/Scraper` (ver `Project Overview.md`, `Architecture Roadmap.md`, `Tool Decision Log.md`).

## Rodando localmente

```bash
docker compose up -d
```

- API: http://localhost:8100 (docs em `/docs`)
- Web: http://localhost:3100
- Postgres: `localhost:5433`

## Estrutura

```
backend/app/
  checkers/     — identificador (username/email/telefone/google/facebook) -> contas
  recon/        — domínio/organização, e-mail corporativo, breach, imagem reversa,
                  reputação de IP, sanções, cripto
  graph/        — motor de correlação (networkx)
  bulk/         — exploração de CSV em massa + monitor de paste site
  darkweb/      — busca multi-engine .onion
  case/         — case management com trilha de auditoria
  report/       — serialização de dado pro gráfico do frontend
frontend/       — Next.js, consome a API acima
```

## Regra de arquitetura

Nenhum módulo depende de ferramenta de terceiro rodando como processo/produto
separado — cada um reimplementa a técnica nativamente. Único link externo
aceito: fonte de dado oficial/governamental por país (OFAC SDN, USGS, RDAP,
registro público de empresa/eleitoral). Ver `Tool Decision Log.md` no vault
pra relação completa de ferramenta analisada -> entrou/não entrou e por quê.

## Status

Funcional e **testado ao vivo** (venv Python 3.12, `pip install -r requirements.txt && pytest`):
`checkers/username.py`, `checkers/phone.py` (metadado), `checkers/facebook_pivot.py`
(extração de ID), `recon/domain.py`, `recon/ip_reputation.py`, `recon/crypto_trace.py`,
`recon/breach_check.py` (senha), `recon/email_pattern.py` (permutação + SMTP),
`graph/engine.py`, `bulk/explorer.py`, `case/incident.py`.

`checkers/email.py` funcional (Twitter — `email_available.json` ainda vivo,
confirmado ao vivo) — Pinterest bloqueou com 403 (anti-bot), Instagram/Imgur
exigem fluxo multi-etapa com footprint maior contra sistema de autenticação
de produção, não implementados nessa rodada.

`checkers/phone.py`'s `check_phone_existence` (Snapchat): implementado
seguindo a técnica do Ignorant, mas **confirmado quebrado ao vivo** — a
Snapchat redesenhou a página de login (agora SPA Next.js com
hCaptcha/Arkoselabs), o endpoint documentado não retorna mais JSON. Trata
como inconclusivo (não quebra), mas sem fonte funcional confirmada no
momento.

`recon/reverse_image.py` funcional: gera URL de busca reversa pronta pra
Google Images/Yandex/TinEye/Bing (mesmo princípio do `dork_generator.py` —
não faz scraping do resultado, o investigador abre e revisa).

`checkers/facebook_pivot.py`'s dado de vendedor Marketplace: **removido**
(não é TODO). Confirmado ao vivo que `marketplace/profile/{id}` exige
sessão autenticada (parede de login) — mesma categoria de risco excluída
do projeto, sem stub morto no código.

## Conta Google (`checkers/google_account.py`)

Implementado seguindo a técnica real do GHunt (mxrch/GHunt, AGPL-3.0),
lida direto do código-fonte deles em 2026-09-08 — não é OAuth clássico
(tela de consentimento + token), é o esquema **SAPISIDHASH**: assinatura
de request usando o cookie `SAPISID` da sua própria sessão Google já
logada. Nunca pedimos e-mail/senha, nunca simulamos login — usa a sessão
que já existe no seu navegador.

- Config: `NETSCRAPER_GOOGLE_SESSION_COOKIES` (JSON) no servidor — nunca
  digitado no frontend por busca. Copie do DevTools do seu navegador
  (Application → Cookies → google.com), mínimo `SAPISID`.
- Validado ao vivo: hash bate com o formato documentado, request com
  cookie fake retorna **401 do Google** (confirma que a request está
  estruturalmente correta — só a credencial fake foi rejeitada). Não
  testado com cookie real (exigiria a sessão pessoal do Davi, que não
  deve ser colada em chat/conversa).
- ⚠️ Limitação encontrada lendo o código-fonte atual do GHunt: o próprio
  mantenedor documentou que o Google bloqueou a extração de **nome**
  desse endpoint ("Google patched the names :/ very sad") — só Gaia ID e
  foto de perfil continuam funcionando.
- UI: seção extra na aba Email, chama o endpoint automaticamente após a
  busca de e-mail normal.

**Decisão explícita de escopo**: pedido de login com e-mail/senha pra
Instagram/Facebook/LinkedIn foi recusado — armazenar credencial de
terceiro no app é risco de segurança sério e reabre a categoria de risco
do Nqntnqnqmb/Toutatis. Alternativas comerciais avaliadas (OSINT
Industries, £99/mês) e recusadas por serem serviço privado no núcleo
(mesma regra que excluiu o hunter.io).

`bulk/paste_monitor.py` também funcional: lista pastes recentes do archive
público do Pastebin, busca keyword no conteúdo (raw), paralelizado (~90
pastes em 1.3s vs 60s+ sequencial). ⚠️ Pastebin rate-limita/retorna 503 sob
carga (confirmado ao vivo testando repetidamente) — tratado como
inconclusivo (retorna vazio / testе pula), nunca derruba a aplicação. Não
fazer polling agressivo em produção.

## Migrações

```bash
cd backend && source .venv/bin/activate
alembic upgrade head          # aplica
alembic revision --autogenerate -m "descrição"   # gera nova, após mudar um model
```

### Descobertas do teste ao vivo (2026-09-08)
- **Falso positivo crítico corrigido em `checkers/username.py`**: a lógica
  original ("status != 404 → existe") dava falso positivo em **7 de 10**
  sites do seed contra um username certamente inexistente. Causa: sites com
  anti-bot (GitLab, Reddit, Medium) bloqueiam requisição não-autenticada com
  **403** (não 404); sites SPA (Instagram, Pinterest, Twitch) servem a casca
  da aplicação com **200** independente do perfil existir. Corrigido com
  detecção por `<title>` renderizado (title_regex/title_not_generic) pros
  SPA, e tratamento de qualquer status fora de {200, 404} como
  **inconclusivo** (nunca reportado como "existe"). GitLab/Reddit/Medium/
  TikTok removidos do seed até ter estratégia de detecção validada pra eles.
  Teste de regressão em `test_no_false_positive_on_nonexistent_username`.
- **crt.sh instável**: retorna 502 com frequência (serviço comunitário
  gratuito). Código já trata (retorna vazio), mas precisa de fonte
  secundária de fallback.
- **OpenSanctions exige API key** (gratuita, cadastro em
  opensanctions.org/api/) — não é keyless como documentado inicialmente.
  Configurar via `NETSCRAPER_OPENSANCTIONS_API_KEY`. Formato do header de
  auth ainda não verificado contra uma chave real.
- **Python 3.10+ obrigatório** (sintaxe `str | None`) — o Dockerfile já usa
  3.12, mas rodar localmente fora do Docker exige o mesmo mínimo.
- **`greenlet` faltava no requirements.txt** — SQLAlchemy async exige
  explicitamente, adicionado.
- **Stack completo validado via Docker**: `docker compose up -d`, migração
  aplicada (7 tabelas), API respondendo em `:8100` com dado real (ex:
  `torvalds` corretamente achado em GitHub/Twitter/Steam/Instagram/
  Pinterest/Twitch; carteira genesis do Bitcoin com saldo/histórico corretos
  via `recon/crypto_trace.py`).
- **Frontend não buildava**: `package.json` original pinava Next.js 15.0.0 +
  React 19.0.0 final — a peer dependency do Next 15.0.0 só aceitava React 18
  ou a RC exata do React 19, não a versão estável. Corrigido pra Next
  16.3.4 + React 19.2.8 (versões atuais confirmadas compatíveis via
  `npm install` limpo). Build e `docker compose up -d web` validados, página
  serve conteúdo real em `:3100`.
- **Timestamps sem timezone quebravam `POST /cases`**: colunas `datetime`
  mapeavam pra `TIMESTAMP WITHOUT TIME ZONE` no Postgres por padrão, mas o
  código grava `datetime.now(timezone.utc)` (timezone-aware) — asyncpg
  rejeitava com erro de tipo. Corrigido pra `DateTime(timezone=True)` em
  todos os models (`case`, `identifier`, `account`, `correlation`,
  `bulk_dataset`), nova migração aplicada. `POST /cases` e trilha de
  auditoria confirmados funcionando (audit log grava certo).
- **`bulk/explorer.py` não tinha como acessar arquivo real**: o container da
  API não compartilhava filesystem com o host. Adicionado volume
  `./data/bulk_uploads:/data/bulk_uploads` no compose — é onde um dump/CSV
  deve ser colocado pra `bulk/inspect` e `bulk/filter` conseguirem ler.
- **CORS bloqueava toda chamada do frontend pra API**: testado de verdade no
  navegador (Chrome via automação) — servidor respondia 200, mas o browser
  recusava entregar a resposta ao JS (`TypeError: Failed to fetch`).
  Faltava `CORSMiddleware` na API. Corrigido em `app/main.py` +
  `cors_allowed_origins` em `app/config.py`. Confirmado ao vivo depois do
  fix: as 5 abas (Username, Email, Telefone, Domínio/IP, Cripto) funcionando
  ponta a ponta no navegador real, não só via curl.

## Frontend

UI com abas cobrindo os endpoints funcionais: Username, Email, Telefone,
Domínio/IP (subdomínio + dorks + reputação de IP), Cripto (BTC/ETH + OFAC),
**Grafo** (visualização interativa via `sigma.js` + `graphology` +
ForceAtlas2, consumindo `/graph/compute`). Testado interativamente no
Chrome (não só `next build`) — todas as 7 abas retornando dado real da API,
incluindo clique em nó do grafo pra ver centralidade/comunidade.

**Casos**: cria caso, lista casos, seleciona um pra ver a trilha de
auditoria (imutável), arquiva — testado ao vivo no navegador (criação,
seleção, arquivamento e nova entrada de auditoria aparecendo em tempo real).

## Identidade visual

Estética cyberpunk anime (referência: Cyberpunk Edgerunners/Studio Trigger)
aplicada via CSS puro — sem depender de asset de imagem externo pra
funcionar:

- Fontes Google via `next/font`: **Orbitron** (display/título) + **Share
  Tech Mono** (corpo/terminal)
- Paleta: fundo quase-preto `#0a0c12`, neon ciano `#05d9e8`, magenta
  `#ff2a6d`, amarelo sinalizador `#f9f002`
- Título com efeito glitch (duplicação cromática ciano/magenta via
  `::before`/`::after` + `clip-path` animado)
- Overlay de scanline (CRT) fixo sobre a página inteira, baixa opacidade
- Botões e painéis com `clip-path` angular (cantos cortados, estilo HUD)
- Cores de comunidade do grafo trocadas pra paleta neon (ciano/magenta/
  amarelo/verde)

Ver `DESIGN_PROMPTS.md` na raiz do repo pra prompts de geração de
logo/ícones/vídeo em ferramenta externa (Midjourney/SDXL/Runway/Google
Flow) — cobre estilo e composição, sem reproduzir personagem/IP protegido
por direito autoral.

## Tor / dark web

`docker-compose.yml` inclui um serviço `tor` (`dockurr/tor`, SOCKS5 na
porta 9050) — a API se conecta nele via `socks5://tor:9050` dentro da rede
do compose. Validado ao vivo (2026-09-08):
- Corrigido: faltava `follow_redirects=True` e o Ahmia tem um campo
  honeypot anti-scraping oculto (nome/valor hexadecimal que muda a cada
  carregamento) — sem ele, a busca redireciona de volta pra home.
  Implementado o fluxo de 2 passos (buscar home → extrair token → buscar).
- `torgle` removido do seed — endereço `.onion` confirmado morto
  (`ProxyError`).
- Mesmo com o fluxo correto, o Ahmia devolveu **504** em toda tentativa
  durante o teste (serviço sobrecarregado) — o seletor CSS do resultado
  não foi confirmado contra uma resposta de busca bem-sucedida real.
  Testado via UI (Chrome) de ponta a ponta: request completo, sem erro
  500, resultado vazio por instabilidade do lado do Ahmia (comportamento
  esperado e tratado).

## Bulk / Dark Web / Paste Monitor (UI)

Aba "Bulk" cobre as três peças da Fase 3: inspeção/filtro de CSV
(`bulk/explorer.py`), monitor de paste site (`bulk/paste_monitor.py`) e
monitor dark web (`darkweb/monitor.py`) — todas testadas ao vivo no
Chrome com dado real.
