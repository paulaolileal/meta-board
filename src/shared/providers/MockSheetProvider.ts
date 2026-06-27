import type { ISheetProvider } from "./ISheetProvider";
import type { CardRecord, FieldDef, ProjectConfig } from "@/modules/project/domain/types";

const now = () => new Date().toISOString();

const PROJECT: ProjectConfig = {
  id: "demo",
  name: "MetaBoard Demo",
  icon: "🚀",
  description: "Quadro de exemplo gerado pelo MockSheetProvider",
  version: "1.0.0",
  theme: "auto",
  groupBy: "status",
  orderBy: "_sort",
  cardTitleField: "title",
  cardDescriptionField: "description",
  cardClosedLayout: ["coverImage", "title", "status", "priority", "dueDate", "checklist"],
  cardOpenLayout: "*",
  createdAt: now(),
  updatedAt: now(),
};

const FIELDS: FieldDef[] = [
  { id: "title", label: "Título", type: "text", required: true, visible: true, editable: true, searchable: true, order: 1 },
  { id: "description", label: "Descrição", type: "longtext", visible: true, editable: true, order: 2 },
  { id: "status", label: "Status", type: "select", visible: true, editable: true, sortable: true,
    options: ["Backlog", "Em progresso", "Revisão", "Concluído"], order: 3 },
  { id: "priority", label: "Prioridade", type: "chip", visible: true, editable: true,
    options: ["Baixa", "Média", "Alta", "Urgente"], order: 4 },
  { id: "dueDate", label: "Vencimento", type: "date", visible: true, editable: true, sortable: true, order: 5 },
  { id: "coverImage", label: "Capa", type: "image", visible: true, editable: true, order: 6 },
  { id: "tags", label: "Tags", type: "multiselect", visible: true, editable: true,
    options: ["design", "frontend", "backend", "infra", "docs", "bug"], order: 7 },
  { id: "checklist", label: "Checklist", type: "checklist", visible: true, editable: true, order: 8 },
  { id: "link", label: "Link", type: "url", visible: true, editable: true, order: 9 },
];

const covers = [
  "https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&q=80",
  "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80",
  "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80",
  "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=800&q=80",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
];

const titles = [
  "Redesign do onboarding",
  "Investigar bug do checkout",
  "Migrar para Tailwind v4",
  "Componentizar Kanban",
  "Configurar pipeline de deploy",
  "Documentar API pública",
  "Auditoria de acessibilidade",
  "Refatorar autenticação",
  "Implementar drag and drop",
  "Otimizar bundle inicial",
  "Adicionar suporte offline",
  "Revisar contratos",
];

const statuses = ["Backlog", "Em progresso", "Revisão", "Concluído"];
const priorities = ["Baixa", "Média", "Alta", "Urgente"];
const tagsPool = ["design", "frontend", "backend", "infra", "docs", "bug"];

function buildCards(): CardRecord[] {
  return titles.map((t, i) => {
    const status = statuses[i % statuses.length];
    const priority = priorities[i % priorities.length];
    const due = new Date();
    due.setDate(due.getDate() + ((i * 3) % 21) - 7);
    const tags = tagsPool.filter((_, idx) => (i + idx) % 3 === 0);
    return {
      _id: crypto.randomUUID(),
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

export class MockSheetProvider implements ISheetProvider {
  readonly mode = "mock" as const;
  private project = PROJECT;
  private fields = FIELDS;
  private cards: CardRecord[] = buildCards();

  async loadProject() {
    await this.delay();
    return this.project;
  }
  async loadFields() {
    await this.delay();
    return this.fields;
  }
  async loadCards() {
    await this.delay();
    return this.cards.map((c) => ({ ...c }));
  }
  async saveCard(card: CardRecord) {
    await this.delay(80);
    const idx = this.cards.findIndex((c) => c._id === card._id);
    const updated = { ...card, _updatedAt: now() };
    if (idx >= 0) this.cards[idx] = updated;
    else this.cards.push(updated);
    return updated;
  }
  async createCard(partial: Partial<CardRecord>) {
    const card: CardRecord = {
      _id: crypto.randomUUID(),
      _sort: this.cards.length,
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
  async deleteCard(id: string) {
    this.cards = this.cards.filter((c) => c._id !== id);
  }
  async sync() {
    /* noop in mock */
  }

  private delay(ms = 220) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
