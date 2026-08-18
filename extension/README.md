# MetaBoard Capture (extensão Chrome)

Extrai o conteúdo da página aberta e envia direto para o MetaBoard (`board.lealtek.com`), sem
copiar/colar manual. Funciona em qualquer site:

- **Instagram (post/reel/IGTV)**: extração estruturada por tipo de conteúdo — legenda, autor,
  comentários fixados/do autor, menções, links e mídia (vídeo único, ou carrossel de
  imagens/vídeos para posts). Ver `detectPostType()`/`scrapePost()`/`scrapeReel()`/`scrapeTv()`
  em `scraper.js`.
- **Qualquer outro site** (Shopee, TikTok, artigos, etc.): não há parsing dedicado, então a
  extensão coleta todo o texto visível da página (`collectPageText()`) e deixa a IA do MetaBoard
  extrair os campos a partir desse texto bruto.

O passo a passo de instalação para o usuário final fica na própria aplicação, em `/extension`
(menu da conta → "Extensão do Chrome"). Este README é voltado a quem for manter o código.

## Instalação (modo desenvolvedor)

1. Abra `chrome://extensions`.
2. Ative "Modo desenvolvedor" (canto superior direito).
3. Clique em "Carregar sem compactação" e selecione esta pasta (`extension/`).

## Uso

1. Abra a página que quer importar (post, produto, artigo...).
2. Clique no ícone da extensão → **Enviar para o MetaBoard**.
3. A aba do MetaBoard (`https://board.lealtek.com/boards`) é aberta/focada automaticamente com o
   conteúdo já preenchido no modal de criação de card com IA.

## Domínio

O bridge (`bridge-content-script.js`) e o destino padrão em `background.js` apontam para
`board.lealtek.com`. Para desenvolvimento local, `localhost:8080` (porta configurada em
`vite.config.ts` para `npm run dev`), além de `localhost:5173` e `localhost:3000` (portas Vite
padrão/`vercel dev`, mantidas por compatibilidade), também estão liberados em `manifest.json`. Se
o dev server subir em outra porta, adicione-a aos `matches` de `content_scripts` e recarregue a
extensão — sem isso, o bridge não é injetado e a extensão parece "não instalada" para o app.

## Processamento em lote da fila de pendentes

Além do fluxo manual acima (um link por vez, iniciado pelo popup), o botão "Processar
automaticamente" na lista de pendentes do app pede à extensão que abra e faça scrape de vários
links em sequência, sem intervenção do usuário a cada um. Isso usa um canal **bidirecional**
diferente do fluxo unidirecional do popup:

1. O app (`src/modules/board/extensionBridge.ts`) manda `window.postMessage({type:
   "MB_SCRAPE_REQUEST", id, url})`, correlacionado por `id`.
2. `bridge-content-script.js` (já injetado no domínio do app) repassa via
   `chrome.runtime.sendMessage({type: "SCRAPE_URL", url})`.
3. `background.js` abre uma aba em **segundo plano** (`active: false`), espera o conteúdo carregar
   (não só o evento `load` do Chrome — o Instagram é um SPA pesado que hidrata bem depois disso),
   injeta `scraper.js`, captura o resultado e fecha a aba.
4. A resposta volta pela mesma cadeia até o app resolver a Promise correspondente ao `id`.

O loop em si (iterar os pendentes, delay entre eles, cancelamento, progresso) vive inteiramente no
app (`useBatchPendingProcessor.ts`) — a extensão só sabe "abra esta URL, faça scrape, devolva o
resultado", uma chamada de cada vez. Isso evita depender de um loop de longa duração dentro do
service worker (Manifest V3 pode encerrá-lo a qualquer momento sem aviso).

## Permissões

A extensão usa `activeTab` para o fluxo manual (funciona só na aba que o usuário tem ativa no
momento do clique). Abrir abas em segundo plano para o processamento em lote exige acesso
declarado ao domínio de destino, que `activeTab` não cobre.

Por isso o `manifest.json` declara `host_permissions: ["https://www.instagram.com/*"]` **de forma
fixa**, concedida na instalação — não em runtime. Uma primeira versão tentou pedir essa permissão
sob demanda (`chrome.permissions.request()`) a partir de `bridge-content-script.js`, no clique de
"Processar automaticamente", mas isso não funciona: `chrome.permissions` **não existe em content
scripts**, só em páginas da extensão (popup/options) e no service worker — a chamada falhava com
`Cannot read properties of undefined (reading 'contains')`. Como o scraper só tem parsing
estruturado para o Instagram (é o único domínio realmente necessário), a permissão fixa é mais
simples e não tem trade-off prático aqui. **Instalações já existentes (modo
desenvolvedor/unpacked) precisam de um reload manual em `chrome://extensions` após atualizar o
código** para que a permissão passe a existir; o Chrome não aplica mudanças de manifest a quente.

## Limitações conhecidas

- O DOM do Instagram muda sem aviso e não há API pública para isso — os seletores em `scraper.js`
  são best-effort e podem quebrar quando o Instagram alterar sua marcação. A extração de carrossel
  (`extractCarouselMedia()`) é a heurística mais nova e arriscada nesse sentido — se o botão
  "Próximo" mudar de seletor, ela degrada para o comportamento anterior (só o primeiro slide) em
  vez de falhar.
- A extração de comentários fixados depende de o Instagram exibir um indicador textual de "fixado"
  ou de reconhecer o autor do post pelo link do perfil na lista de comentários.
- O campo `extra` é um dump bruto de `document.body.innerText` (truncado em 20.000 caracteres),
  sempre incluído no payload como catch-all. Em sites fora do Instagram é a única fonte de
  conteúdo — inclui ruído de UI (menu, rodapé, etc.) porque não há parsing específico por site;
  a qualidade da extração final depende inteiramente da IA conseguir separar o conteúdo relevante
  desse texto.
- Extensões Chrome só funcionam no Chrome desktop — por isso o link de instalação fica escondido
  no menu quando o app é acessado pelo celular (`src/components/UserAccountMenu.tsx`).
- O processamento em lote roda sequencialmente com um delay aleatório entre itens, e para
  automaticamente após falhas consecutivas — as abas usam a sessão real do Instagram do usuário, e
  navegação rápida demais pode parecer abuso e arriscar um bloqueio temporário da própria conta.
