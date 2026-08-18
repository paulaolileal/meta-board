---
title: Extração de cards com IA — duas fases e confiança por campo
tags: [ai, extraction, web-search, confidence, useAiCardExtraction]
date: 2026-08-18
---

# Extração de cards com IA — duas fases e confiança por campo

Base de conhecimento sobre `src/modules/board/useAiCardExtraction.ts`, usado tanto pelo fluxo
manual (`AiCardModal.tsx`) quanto pelo fluxo automático da fila de pendentes
(`useBatchPendingProcessor.ts`, ver [extension-scraping.md](extension-scraping.md)).

## Duas fases, dois modelos diferentes

1. **`extractFromText(text)`** — extração pura via `chatComplete` (sem acesso à web). Só usa o
   que está explicitamente no texto/dados raspados. Retorna, por campo: `values`, `sources`
   (sempre `"extracted"` nesta fase), `reasons` (citação do texto) e `confidences` (0-100).
2. **`enrichMissingFields(results, videoTranscript?)`** — completude via `chatCompleteWithWebSearch`
   (com a tool `web_search_preview`). Roda depois da fase 1, opcionalmente com transcrição de
   vídeo como contexto extra.

Ambas retornam `ExtractionResult[]`; o fluxo manual mostra as duas etapas como passos separados
(botão "Extrair campos" → botão "buscar" por card), o fluxo automático encadeia as duas sem
intervenção do usuário.

## Confiança por campo e proteção contra sobrescrita

Cada campo extraído na fase 1 carrega um `confidences[fieldId]` (0-100) — o próprio modelo reporta
o quão certo está daquele valor, baseado só no texto-fonte. Campo sem confiança explícita na
resposta do modelo recebe `100` por padrão (nunca dispara busca por omissão do modelo).

`LOW_CONFIDENCE_THRESHOLD = 50` em `useAiCardExtraction.ts` decide o que é elegível para a fase 2:

- Campo **ausente** (nunca extraído) → elegível, buscado do zero.
- Campo **extraído com confiança < 50** → elegível, tratado como "tentativo": a fase 2 tenta
  confirmar ou corrigir via busca; se não achar nada confiável, o valor tentativo original é
  mantido como está.
- Campo **extraído com confiança ≥ 50** → **nunca** entra no prompt de busca, portanto nunca é
  sobrescrito. Essa é a garantia principal: a fase 2 não tem como alterar um campo de alta
  confiança, porque ele nunca é sequer mencionado nas instruções enviadas ao modelo de busca.

Campos encontrados pela busca recebem `sources[fieldId] = "searched"` e `confidences[fieldId] = 100`
(o prompt de busca já exige "HIGH CONFIDENCE" para incluir qualquer valor).

## Instrução do campo vira "hint" no prompt

Quando um `FieldDef` tem `instruction` preenchida (ver [sheets-schema.md](sheets-schema.md)),
tanto `buildSystemPrompt()` quanto `buildSearchInstructions()` anexam
`— hint: <instruction>` à linha do campo, ajudando o modelo a entender o que exatamente deve
ir naquele campo (útil sobretudo em campos ambíguos, tipo "Observações"). Campo sem instrução
não ganha nada a mais na linha — comportamento idêntico ao anterior.

## Onde mexer

- Mudar o limiar de confiança → `LOW_CONFIDENCE_THRESHOLD` em `useAiCardExtraction.ts`.
- Mudar como o modelo reporta confiança (regra 8 do prompt) → `buildSystemPrompt()`.
- Mudar o que é mostrado ao modelo de busca (campos confirmados vs. tentativos vs. ausentes) →
  `buildSearchInstructions()`.
- Mudar quando o fluxo automático roda a fase 2 → `useBatchPendingProcessor.ts` (chama
  `enrichMissingFields` logo após `extractFromText`, sem transcrição de vídeo).
