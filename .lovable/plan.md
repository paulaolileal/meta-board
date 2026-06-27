# MetaBoard — Plano de Implementação

Aplicação tipo Trello/Notion/Airtable que usa uma planilha Google Sheets como backend. Sem servidor próprio. Funciona offline em modo mock.

## Escopo desta primeira entrega

Construir o MVP funcional e visualmente premium em **modo mock** (sem precisar de credenciais Google), com a arquitetura pronta para plugar o `GoogleSheetProvider` depois. Isso garante que você consegue rodar e ver tudo imediatamente — a integração real com Google Sheets fica em uma segunda etapa, depois que você adicionar `VITE_GOOGLE_CLIENT_ID` e `VITE_GOOGLE_SHEET_ID`.

Motivos:
- A stack do projeto é TanStack Start (não Vite/React Router puro). Vou adaptar mantendo a mesma arquitetura modular pedida.
- OAuth Google + escrita em Sheets exige configuração externa sua (Google Cloud Console) — sem isso a parte "real" não roda de qualquer jeito.

## Arquitetura

```text
src/
  modules/
    project/       domain | application | infra | ui
    fields/        FieldRendererFactory + renderers
    cards/         entidades, hooks, store
    board/         Kanban, DnD, filtros
    settings/      tema, preferências
    auth/          stub Google + modo mock
  shared/
    providers/     ISheetProvider, MockSheetProvider, GoogleSheetProvider (stub)
    cache/         L1 Zustand + L2 IndexedDB + SWR
    components/    UI compartilhada
    hooks/
    utils/
  app/             rotas e shell
```

Padrões: Repository (`ISheetProvider`), Factory (`FieldRendererFactory`), Strategy (renderers por tipo), Adapter (mock↔google), DI via contexto React.

## Funcionalidades do MVP

- Home: logo, "Entrar em modo mock", placeholder de "Conectar Google"
- Board Kanban com colunas por `groupBy` (status)
- Drag and drop entre colunas e reorder (dnd-kit)
- Card fechado: capa, título, chips, data, progresso de checklist
- Card aberto (drawer lateral): todos os campos, edição inline, animações
- Sidebar: projeto, busca, filtros, configurações
- Tema claro/escuro/automático com tokens semânticos
- Skeleton loading, empty states, toasts, undo
- Persistência via MockSheetProvider + IndexedDB (L2) + Zustand (L1)
- Optimistic updates, debounce de escrita (2s), revalidate (30s)

## Schema da planilha (modelado em código no mock)

- `_project`: id, name, icon, groupBy, orderBy, cardClosedLayout, cardOpenLayout, theme
- `_fields`: id, label, type, required, default, visible, editable, options, width, order
- `_cards`: `_id`, `_sort`, `_archived`, `_createdAt`, `_updatedAt` + campos do schema

Tipos suportados nos renderers: text, longtext, number, bool, date, datetime, url, image, chip, select, multiselect, checklist, color, icon.

## Stack

Mantenho a stack do template (TanStack Start + Router + Query, Tailwind v4, shadcn). Adiciono: zustand, zod, react-hook-form, framer-motion, @dnd-kit/core, @dnd-kit/sortable, date-fns, idb (IndexedDB wrapper).

## Fora deste primeiro PR

- `GoogleSheetProvider` real (deixo a interface e um stub que lança "configure VITE_GOOGLE_CLIENT_ID")
- Login Google real (botão visível mas desabilitado sem env)
- Virtualização de listas (>1000 cards) — deixo hook pronto, ativo depois
- Tipos futuros: relation, formula, json, progress

Depois que rodar e você validar o visual/UX, faço a integração Google Sheets em um segundo passo.
