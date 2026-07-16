# MetaBoard Capture (extensão Chrome)

Extrai o conteúdo da página aberta e envia direto para o MetaBoard (`board.lealtek.com`), sem
copiar/colar manual. Funciona em qualquer site:

- **Instagram (post/reel)**: extração estruturada — legenda, comentários fixados/do autor,
  menções, links e URL do vídeo (`scrapeInstagramPost()` em `scraper.js`).
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
`board.lealtek.com`. Para desenvolvimento local, `localhost:5173` (Vite) e `localhost:3000`
(`vercel dev`) também estão liberados em `manifest.json`.

## Limitações conhecidas

- O DOM do Instagram muda sem aviso e não há API pública para isso — os seletores em `scraper.js`
  são best-effort e podem quebrar quando o Instagram alterar sua marcação.
- A extração de comentários fixados depende de o Instagram exibir um indicador textual de "fixado"
  ou de reconhecer o autor do post pelo link do perfil na lista de comentários.
- O campo `extra` é um dump bruto de `document.body.innerText` (truncado em 20.000 caracteres),
  sempre incluído no payload como catch-all. Em sites fora do Instagram é a única fonte de
  conteúdo — inclui ruído de UI (menu, rodapé, etc.) porque não há parsing específico por site;
  a qualidade da extração final depende inteiramente da IA conseguir separar o conteúdo relevante
  desse texto.
- Extensões Chrome só funcionam no Chrome desktop — por isso o link de instalação fica escondido
  no menu quando o app é acessado pelo celular (`src/components/UserAccountMenu.tsx`).
