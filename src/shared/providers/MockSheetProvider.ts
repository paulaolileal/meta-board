import type { ISheetProvider } from "./ISheetProvider";
import type { BoardConfig, CardRecord, FieldDef } from "@/modules/project/domain/types";

const now = () => new Date().toISOString();

const BOARDS: BoardConfig[] = [
  {
    id: "board-dev",
    name: "Dev Tracker",
    icon: "🚀",
    description: "Rastreamento de tarefas de desenvolvimento",
    groupBy: "status",
    orderBy: "_sort",
    cardTitleField: "title",
    cardDescriptionField: "description",
    cardClosedLayout: ["coverImage", "title", "status", "priority", "dueDate", "checklist"],
    cardOpenLayout: "*",
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "board-marketing",
    name: "Marketing",
    icon: "📣",
    description: "Campanhas e conteúdo",
    groupBy: "status",
    orderBy: "_sort",
    cardTitleField: "title",
    cardDescriptionField: "description",
    cardClosedLayout: ["title", "status", "priority", "dueDate"],
    cardOpenLayout: "*",
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: "board-produto",
    name: "Produto",
    icon: "✨",
    description: "Roadmap e features",
    groupBy: "status",
    orderBy: "_sort",
    cardTitleField: "title",
    cardDescriptionField: "description",
    cardClosedLayout: ["title", "status", "priority", "dueDate"],
    cardOpenLayout: "*",
    createdAt: now(),
    updatedAt: now(),
  },
];

const BASE_FIELDS: Omit<FieldDef, "boardId">[] = [
  { id: "title", label: "Título", type: "text", required: true, visible: true, editable: true, searchable: true, displayOrder: 1 },
  { id: "description", label: "Descrição", type: "longtext", visible: true, editable: true, displayOrder: 2 },
  { id: "status", label: "Status", type: "select", visible: true, editable: true, sortable: true, options: ["Backlog", "Em progresso", "Revisão", "Concluído"], displayOrder: 3 },
  { id: "priority", label: "Prioridade", type: "chip", visible: true, editable: true, options: ["Baixa", "Média", "Alta", "Urgente"], displayOrder: 4 },
  { id: "dueDate", label: "Vencimento", type: "date", visible: true, editable: true, sortable: true, displayOrder: 5 },
  { id: "coverImage", label: "Capa", type: "image", visible: true, editable: true, displayOrder: 6 },
  { id: "tags", label: "Tags", type: "multiselect", visible: true, editable: true, options: ["design", "frontend", "backend", "infra", "docs", "bug"], displayOrder: 7 },
  { id: "checklist", label: "Checklist", type: "checklist", visible: true, editable: true, displayOrder: 8 },
  { id: "link", label: "Link", type: "url", visible: true, editable: true, displayOrder: 9 },
];

const FIELDS: FieldDef[] = BOARDS.flatMap((b) => BASE_FIELDS.map((f) => ({ ...f, boardId: b.id })));

const covers = [
  "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&q=80",
  "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80",
  "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80",
  "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=800&q=80",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
];

const DEV_TITLES = [
  "Redesign do onboarding", "Investigar bug do checkout", "Migrar para Tailwind v4",
  "Componentizar Kanban", "Configurar pipeline de deploy", "Documentar API pública",
  "Auditoria de acessibilidade", "Refatorar autenticação", "Implementar drag and drop",
  "Otimizar bundle inicial", "Adicionar suporte offline", "Revisar contratos",
];

const MARKETING_TITLES = [
  "Blog post: lançamento", "Campanha de e-mail", "Atualizar landing page",
  "Criar vídeo tutorial", "Pesquisa de satisfação", "Posts para redes sociais",
];

const PRODUTO_TITLES = [
  "Tela de configurações", "API de webhooks", "Integração com Slack",
  "App mobile MVP", "Dashboard de métricas", "Exportação de dados",
];

const statuses = ["Backlog", "Em progresso", "Revisão", "Concluído"];
const priorities = ["Baixa", "Média", "Alta", "Urgente"];
const tagsPool = ["design", "frontend", "backend", "infra", "docs", "bug"];

function buildCards(boardId: string, titles: string[]): CardRecord[] {
  return titles.map((t, i) => {
    const status = statuses[i % statuses.length];
    const priority = priorities[i % priorities.length];
    const due = new Date();
    due.setDate(due.getDate() + ((i * 3) % 21) - 7);
    const tags = tagsPool.filter((_, idx) => (i + idx) % 3 === 0);
    return {
      _id: crypto.randomUUID(),
      boardId,
      _sort: i,
      _archived: false,
      _createdAt: now(),
      _updatedAt: now(),
      title: t,
      description: "Descrição gerada automaticamente. Edite no card aberto para personalizar.",
      status,
      priority,
      dueDate: due.toISOString().slice(0, 10),
      coverImage: i % 2 === 0 ? covers[i % covers.length] : "",
      tags,
      link: "https://example.com",
      checklist: [
        { id: crypto.randomUUID(), text: "Definir escopo", done: i % 2 === 0 },
        { id: crypto.randomUUID(), text: "Implementar", done: i % 4 === 0 },
        { id: crypto.randomUUID(), text: "Revisar", done: false },
      ],
    } as CardRecord;
  });
}

const INITIAL_CARDS: CardRecord[] = [
  ...buildCards("board-dev", DEV_TITLES),
  ...buildCards("board-marketing", MARKETING_TITLES),
  ...buildCards("board-produto", PRODUTO_TITLES),
];

export class MockSheetProvider implements ISheetProvider {
  readonly mode = "mock" as const;
  private boards = [...BOARDS];
  private fields = [...FIELDS];
  private cards: CardRecord[] = [...INITIAL_CARDS];

  async loadBoards(): Promise<BoardConfig[]> {
    await this.delay();
    return this.boards.map((b) => ({ ...b }));
  }

  async loadBoard(boardId: string): Promise<BoardConfig> {
    await this.delay(50);
    const board = this.boards.find((b) => b.id === boardId);
    if (!board) throw new Error(`Board ${boardId} não encontrado`);
    return { ...board };
  }

  async loadFields(boardId: string): Promise<FieldDef[]> {
    await this.delay();
    return this.fields.filter((f) => f.boardId === boardId).map((f) => ({ ...f }));
  }

  async loadCards(boardId: string): Promise<CardRecord[]> {
    await this.delay();
    return this.cards.filter((c) => c.boardId === boardId && !c._archived).map((c) => ({ ...c }));
  }

  async saveCard(card: CardRecord): Promise<CardRecord> {
    await this.delay(80);
    const idx = this.cards.findIndex((c) => c._id === card._id);
    const updated = { ...card, _updatedAt: now() };
    if (idx >= 0) this.cards[idx] = updated;
    else this.cards.push(updated);
    return updated;
  }

  async createCard(boardId: string, partial: Partial<CardRecord>): Promise<CardRecord> {
    await this.delay(80);
    const boardCards = this.cards.filter((c) => c.boardId === boardId);
    const card: CardRecord = {
      _id: crypto.randomUUID(),
      boardId,
      _sort: boardCards.length,
      _archived: false,
      _createdAt: now(),
      _updatedAt: now(),
      title: "Novo card",
      status: statuses[0],
      priority: "Média",
      dueDate: "",
      coverImage: "",
      tags: [],
      checklist: [],
      ...partial,
    };
    this.cards.push(card);
    return card;
  }

  async deleteCard(id: string): Promise<void> {
    await this.delay(80);
    const idx = this.cards.findIndex((c) => c._id === id);
    if (idx >= 0) this.cards[idx] = { ...this.cards[idx], _archived: true };
  }

  async sync(): Promise<void> {
    // noop in mock
  }

  async createBoard(
    config: Omit<BoardConfig, "id" | "createdAt" | "updatedAt">,
    fields: FieldDef[],
  ): Promise<BoardConfig> {
    await this.delay();
    const newBoard: BoardConfig = {
      ...config,
      id: `board-${crypto.randomUUID()}`,
      createdAt: now(),
      updatedAt: now(),
    };
    this.boards.push(newBoard);
    this.fields.push(...fields.map((f) => ({ ...f, boardId: newBoard.id })));
    return newBoard;
  }

  private delay(ms = 220) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
