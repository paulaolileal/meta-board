---
title: Extensão Chrome — protocolo de mensagens e scraping do Instagram
tags: [extension, scraping, instagram, chrome, pending-queue]
date: 2026-08-18
---

# Extensão Chrome — protocolo de mensagens e scraping do Instagram

Base de conhecimento sobre como o app conversa com a extensão MetaBoard Capture (`extension/`) e
como o scraper do Instagram funciona. Ver também [extension/README.md](../extension/README.md)
para instruções de uso e instalação — este documento foca no "porquê" das decisões técnicas, para
quem for mexer nesse código depois.

## Dois canais, dois propósitos

A extensão tem **dois canais de comunicação com o app**, propositalmente separados:

1. **Unidirecional, extensão → app** (`chrome.storage.local` → `sessionStorage` +
   `CustomEvent("mb:ai-import-ready")`). Usado pelo popup: o usuário clica no ícone da extensão
   numa página aberta, ela faz scrape da aba ativa e o app abre o `AiCardModal` já populado. Não
   precisa de correlação porque só existe uma "resposta pendente" por vez.
2. **Bidirecional, correlacionado por `id`** (`window.postMessage` nos dois sentidos). Usado pelo
   processamento em lote da fila de pendentes: o app pede "abra esta URL, faça scrape, me devolva
   o resultado" e precisa saber qual resposta corresponde a qual pedido, porque várias chamadas
   acontecem em sequência.

Não force os dois pelo mesmo canal — o primeiro nunca precisou de correlação e adicionar isso a
ele seria complexidade sem necessidade; o segundo não pode funcionar sem ela.

### Por que `window.postMessage` e não `chrome.runtime.sendMessage` direto do app

O app React não tem acesso a `chrome.*` — só um content script tem. `bridge-content-script.js`
roda injetado no domínio do app (ver `content_scripts` em `extension/manifest.json`) e faz a ponte:
recebe `postMessage` da página, repassa para `background.js` via `chrome.runtime.sendMessage`, e
devolve a resposta pela mesma via. Três partes, cada uma só fala com a vizinha:

```
app (React)  <-- postMessage -->  bridge-content-script.js  <-- runtime.sendMessage -->  background.js
```

### Por que a extensão fica "burra" e o app orquestra o lote

`background.js` só sabe processar **uma URL por chamada** — abre aba em background, espera
carregar, injeta `scraper.js`, fecha a aba, devolve o resultado. O loop inteiro (iterar os
pendentes, delay entre eles, cancelamento, contagem de progresso) vive em
`src/modules/board/useBatchPendingProcessor.ts`, no app.

Isso é deliberado: um service worker Manifest V3 pode ser encerrado pelo Chrome a qualquer
momento sem aviso. Um loop de "abrir 60 abas" inteiro dentro do `background.js` arriscaria morrer
no meio sem nenhum progresso salvo. Mantendo cada chamada `SCRAPE_URL` curta (uma aba, um scrape,
um `chrome.tabs.remove`), esse risco fica isolado por item — se o service worker for encerrado
entre uma chamada e outra, o pior caso é o app perceber via timeout e seguir para o próximo.

### Permissão do Instagram é pedida em runtime, não declarada no manifest

Abrir abas em segundo plano exige host permission — `activeTab` só cobre a aba que o usuário tem
ativa no momento do clique na extensão, não abas criadas programaticamente depois. Em vez de
declarar `https://www.instagram.com/*` como permissão fixa do manifest (que assusta mais na tela
de instalação e é concedida mesmo para quem nunca vai usar o lote), o manifest declara em
`optional_host_permissions` e `bridge-content-script.js` chama `chrome.permissions.request()` na
hora do primeiro clique em "Processar automaticamente".

Isso só funciona porque `chrome.permissions.request()` precisa rodar dentro de uma pilha de
execução iniciada por um gesto do usuário — e o `postMessage` do clique do botão chega ao content
script ainda dentro dessa janela. Se esse pedido de permissão fosse feito depois de um salto pelo
`background.js` (outro contexto de execução), o gesto do usuário já teria se perdido e o Chrome
recusaria a permissão silenciosamente. Por isso o pedido de permissão acontece no
**content script**, antes de repassar a mensagem para o background — nunca no background.

## Scraping do Instagram: heurísticas por tipo de conteúdo

`extension/scraper.js` não tem acesso a nenhuma API oficial do Instagram — tudo é lido do DOM
renderizado, então **tudo aqui é best-effort e pode quebrar** quando o Instagram mudar sua
marcação. `detectPostType(pathname)` decide qual fluxo roda, a partir da URL:

| Path                                  | `postType` | Fluxo                                                            |
| ------------------------------------- | ---------- | ---------------------------------------------------------------- |
| `/p/...`                              | `post`     | `scrapePost()` — imagem/vídeo único ou carrossel                 |
| `/reel/...`, `/reels/...`             | `reel`     | `scrapeReel()` — vídeo único                                     |
| `/tv/...`                             | `tv`       | `scrapeTv()` — alias de `scrapeReel()` (IGTV usa o mesmo player) |
| qualquer outro (incl. `/stories/...`) | —          | cai no fallback genérico `collectPageText()`                     |

Stories ficam fora de escopo de propósito: são efêmeras e exigem estar logado para ver o
conteúdo de outra conta, o que não combina com um scrape em lote sem supervisão.

Os três fluxos dedicados chamam um núcleo comum, `scrapeInstagramCommon()`, para tudo que não
depende do tipo de mídia: legenda, autor, menções, links, comentários fixados/do autor. Essa
lógica é a parte mais sensível do arquivo e já vem comentada linha a linha em `scraper.js` — não
duplique essa explicação aqui, leia os comentários no próprio código quando for mexer nela.

### Carrossel (posts com múltiplas imagens/vídeos)

`extractCarouselMedia()` é a heurística mais nova e a mais arriscada: clica no botão "Próximo"
(`role="button"` com `aria-label` "Next"/"Próximo") repetidamente, lendo o `<img>`/`<video>`
visível depois de cada clique, até não haver mais botão "Próximo" ou até 10 slides. Riscos
conhecidos:

- Se o Instagram mudar o `aria-label` do botão (localização, redesign), a detecção para no
  primeiro slide — **degrada, não quebra**: `scrapePost()` cai de volta no comportamento de
  mídia única quando `extractCarouselMedia()` não encontra nada.
- `currentSlideMedia()` escolhe a maior `<img>` do container por área declarada
  (`naturalWidth * naturalHeight`) para descartar ícones/avatares — não há garantia de que essa
  heurística sempre acerte a imagem certa do slide.

### Por que `waitForNextPaint()` usa `setTimeout`, não `requestAnimationFrame`

Batches em lote rodam com a aba em `active: false` (background). Chrome throttla agressivamente
(ou simplesmente para de disparar) `requestAnimationFrame` em abas ocultas — um duplo-rAF, que
funcionava bem no fluxo manual do popup (aba sempre em foco), travaria ou demoraria demais no
fluxo em lote. Por isso a espera depois de expandir texto truncado ou avançar um slide do
carrossel usa um `setTimeout` fixo (~200ms), que continua disparando normalmente em background.

## Onde olhar para cada mudança futura

- Mudou o layout de um tipo de post específico → `extension/scraper.js`, dentro do
  `scrapeXxx()` correspondente.
- Mudou algo na legenda/autor/comentários, comum a todos os tipos → `scrapeInstagramCommon()`.
- Precisa de um novo tipo de mensagem entre app e extensão → estenda o protocolo em
  `extension/bridge-content-script.js` e `src/modules/board/extensionBridge.ts` juntos; os dois
  lados precisam concordar no formato da mensagem.
- Precisa mudar o comportamento do loop em lote (delay, limite de falhas, o que conta como
  sucesso) → `src/modules/board/useBatchPendingProcessor.ts`.
