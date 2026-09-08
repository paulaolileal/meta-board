# meta-board MCP server (local)

Servidor MCP local que expõe tools para manipular boards do meta-board (criar/mover/atualizar/
arquivar cards, listar boards/fields/pendentes) a agentes fora do navegador — Claude Desktop,
Claude Code, scripts. Roda via **stdio**, spawnado sob demanda pelo cliente MCP: não é publicado,
não fica hospedado, não precisa de deploy.

Reaproveita a mesma camada de acesso ao Google Sheets do app (`GoogleSheetProvider`), trocando só a
autenticação: em vez do login interativo (PKCE) que o app usa no navegador, este servidor autentica
como uma **Service Account do Google**, sem usuário humano no loop.

## Setup (uma vez)

### 1. Criar a Service Account no Google Cloud

1. Acesse o [Google Cloud Console](https://console.cloud.google.com) e crie/reaproveite um projeto.
2. **APIs & Services → Library** → busque **Google Sheets API** → **Enable**.
3. **APIs & Services → Credentials → Create Credentials → Service Account**. Não precisa conceder
   nenhuma role de IAM — o acesso vem do compartilhamento da planilha, não de permissões de projeto.
4. Na service account criada → aba **Keys → Add Key → Create new key → JSON**. Isso baixa um
   arquivo `.json`. **Salve-o fora deste repositório**, ex.: `C:\Users\<você>\.secrets\meta-board-mcp-sa.json`.
5. Copie o e-mail da service account (formato `nome@<project-id>.iam.gserviceaccount.com`,
   visível na página ou no campo `client_email` do JSON).

### 2. Compartilhar a planilha

Abra a planilha "MetaBoard" no Google Sheets → **Compartilhar** → cole o e-mail da service account
→ permissão **Editor**.

### 3. Configurar as variáveis de ambiente

```bash
cd mcp-server
cp .env.example .env
```

Preencha `mcp-server/.env`:

```
SPREADSHEET_ID=<id da planilha, da URL entre /d/ e /edit>
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=C:\Users\<você>\.secrets\meta-board-mcp-sa.json
```

### 4. Instalar dependências

```bash
cd mcp-server
npm install
```

## Testar isoladamente (antes de conectar num cliente MCP)

```bash
npm run typecheck   # confere resolução de módulos e tipos
npm run inspect      # abre o MCP Inspector conectado ao servidor via stdio
```

No Inspector, confira a aba "Tools" e chame cada uma manualmente para validar contra a planilha
real (ou uma cópia de teste).

## Conectar no Claude Code

O repo já tem um `.mcp.json` na raiz apontando para este servidor. Basta abrir o Claude Code a
partir da raiz do repositório e rodar `/mcp` para confirmar que `meta-board` aparece conectado.

## Conectar no Claude Desktop (alternativa)

Edite `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "meta-board": {
      "command": "npx",
      "args": ["tsx", "C:\\caminho\\completo\\para\\meta-board\\mcp-server\\src\\index.ts"]
    }
  }
}
```

## Escopo atual (MVP)

Cobre leitura/CRUD de cards e da fila de pendentes. **Não** cobre criar/apagar boards ou fields —
essas operações estruturais continuam só pela UI do app, por serem raras e arriscadas sem
supervisão visual.

## Troubleshooting

- **"Missing required env var"**: `.env` não foi preenchido ou não está em `mcp-server/.env`.
- **Erro de autenticação/403 do Sheets API**: confira se a planilha foi compartilhada com o e-mail
  exato da service account como Editor, e se `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` aponta para um
  arquivo válido e legível.
- **Tools não aparecem no `/mcp` do Claude Code**: confirme que `.mcp.json` está na raiz do repo e
  que o Claude Code foi aberto a partir dela.
