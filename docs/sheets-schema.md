---
title: Schema da planilha Google Sheets e self-healing de estrutura
tags: [google-sheets, schema, migration, self-healing, provider]
date: 2026-08-18
---

# Schema da planilha Google Sheets e self-healing de estrutura

Base de conhecimento sobre como o app persiste dados na planilha do usuário
(`src/shared/providers/GoogleSheetProvider.ts`) e como planilhas antigas são migradas
automaticamente quando o schema evolui. Ver também [ai-card-extraction.md](ai-card-extraction.md)
e [extension-scraping.md](extension-scraping.md) para outras partes do domínio.

## Abas reservadas

A planilha tem 4 abas fixas, cross-board (não é uma aba por board):

| Aba | Papel | Constante de header |
|---|---|---|
| `_boards` | 1 linha = 1 board | `BOARDS_HEADERS` |
| `_fields` | 1 linha = 1 definição de campo (`FieldDef`), filtrada por `board_id` | `FIELDS_HEADERS` |
| `_cards` | 1 linha = 1 card, filtrada por `board_id` | `CARDS_FIXED_HEADERS` |
| `_pending` | fila de itens pendentes de importação | `PENDING_HEADERS` |

Os valores de campos definidos pelo usuário **não** viram colunas próprias na aba `_cards`:
são serializados como um único JSON na coluna `values` (`cardToRow`/`rowToCardRecord`). Só o
*schema* dos campos (label, tipo, opções, instrução etc.) mora em `_fields` — os *valores*
ficam soltos no JSON de cada card. Isso significa que adicionar um metadado por campo (ex.:
`instruction`) só exige mexer em `_fields`, nunca em `_cards`.

## Convenção de nomes de coluna

`toCamel()` converte `snake_case` da planilha para `camelCase` do domínio, preservando
prefixo `_` (colunas de sistema, ex. `_auto_created` → `_autoCreated`). Tudo que não começa
com `_` e não é `board_id` é tratado como campo de usuário.

## Invariante: colunas só são acrescentadas no final

As constantes `*_HEADERS` (`BOARDS_HEADERS`, `FIELDS_HEADERS`, `CARDS_FIXED_HEADERS`,
`PENDING_HEADERS`) são a fonte da verdade da ordem física das colunas. **Uma coluna nova só
pode ser adicionada ao final da constante correspondente, nunca inserida no meio.** Duas
funções dependem disso:
- `fieldDefToRow`/`boardConfigToRow`/etc. escrevem a linha na ordem da constante.
- `ensureHeaderColumns` (self-healing, ver abaixo) só sabe *anexar* colunas ao final da
  planilha real — se a ordem da constante divergisse da ordem já gravada em planilhas
  antigas, os dados existentes ficariam desalinhados por coluna.

## Self-healing de estrutura

Planilhas de usuários existentes não ganham colunas novas automaticamente só porque o código
mudou — é preciso migrar a aba explicitamente. O helper genérico para isso:

```ts
// GoogleSheetProvider.ts
private async ensureHeaderColumns(
  sheetName: string,
  headers: string[],
  expected: string[],
): Promise<string[]>
```

Compara o header já lido (`headers`) com o esperado (`expected`, ex. `FIELDS_HEADERS`) e
anexa as colunas faltantes ao final via `setValues`. Retorna o header atualizado. Não faz
nenhuma chamada de API quando nada está faltando.

**Onde chamar**: no ponto que já roda em todo carregamento normal, não só em setup/criação —
por exemplo `loadFields()`, que roda sempre que um board existente é aberto. Isso é diferente
de `initializeSpreadsheet()`, que só roda no onboarding inicial e na criação de um board novo
(`SpreadsheetSetupPage.tsx`, `CreateBoardModal.tsx`) — **não** cobre usuários que só abrem
boards já existentes. Métodos de escrita (`saveField`, `createField` etc.) também devem migrar
o header antes de calcular o range de escrita — ver "armadilha" abaixo.

Padrão mais antigo e específico, mantido por compatibilidade: `ensurePendingTab()` cria a aba
`_pending` inteira sob demanda (lazy, com flag em memória) para planilhas que nunca rodaram
`initializeSpreadsheet()` com essa aba.

### Armadilha: range de escrita calculado antes de migrar

Métodos como `saveField`/`saveBoard` calculam o range de escrita (`A{row}:{col}{row}`) a
partir do `headers.length` **lido da planilha**. Se esse header ainda não foi migrado (não
tem a coluna nova) mas o payload a ser escrito (`fieldDefToRow(field)`, gerado a partir da
constante `*_HEADERS`, já atualizada) tem mais colunas, o range fica curto e `setValues`
descarta silenciosamente os últimos valores. Sempre chamar `ensureHeaderColumns` **antes** de
calcular o range de escrita, e usar `Math.max(headers.length, newRow.length)` como proteção
extra.

## Migrações existentes até agora

- `_boards` ganhou a coluna `color` (migração pontual, hoje ainda hardcoded dentro de
  `initializeSpreadsheet()` e replicada como fallback em `saveBoard()`).
- `_cards` ganhou a coluna `_auto_created` (mesmo padrão).
- `_fields` ganhou a coluna `instruction` (texto de ajuda por campo) — primeira migração a
  usar o helper genérico `ensureHeaderColumns`, chamado em `loadFields`/`saveField`/`createField`.

Se aparecer uma quarta migração, vale a pena revisitar os dois blocos hardcoded de `color`/
`_auto_created` em `initializeSpreadsheet()` e trocá-los por `ensureHeaderColumns` também, para
não manter dois padrões de migração em paralelo.
