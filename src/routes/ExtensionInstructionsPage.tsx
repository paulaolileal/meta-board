import { Link } from "react-router-dom";
import { ChevronRight, Download, Chrome, Instagram, Copy } from "lucide-react";
import { toast } from "sonner";
import { UserAccountMenu } from "@/components/UserAccountMenu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const EXTENSIONS_URL = "chrome://extensions";

interface Step {
  title: string;
  description: string;
  copyValue?: string;
}

const STEPS: Step[] = [
  {
    title: "Baixe o arquivo da extensão",
    description: "Clique no botão acima e salve o arquivo .zip no seu computador.",
  },
  {
    title: "Extraia a pasta baixada",
    description:
      'Clique com o botão direito no arquivo baixado e escolha "Extrair tudo" (ou "Descompactar").',
  },
  {
    title: "Abra o gerenciador de extensões do Chrome",
    description:
      "O Chrome não deixa abrir essa página automaticamente — copie o link abaixo e cole na barra de endereço do navegador.",
    copyValue: EXTENSIONS_URL,
  },
  {
    title: 'Ative o "Modo desenvolvedor"',
    description: "É um botão no canto superior direito da página de extensões.",
  },
  {
    title: 'Clique em "Carregar sem compactação"',
    description: "Selecione a pasta que você extraiu no passo 2.",
  },
  {
    title: "Pronto!",
    description:
      'Abra um post ou reel no Instagram, clique no ícone do MetaBoard na barra do Chrome e depois em "Enviar para o MetaBoard".',
  },
];

export function ExtensionInstructionsPage() {
  async function handleCopy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Link copiado! Cole na barra de endereço do Chrome.");
    } catch {
      toast.error(`Não foi possível copiar. Digite manualmente: ${value}`);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col bg-background">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] rounded-full bg-primary/8 blur-[100px]" />
      </div>

      <header className="shrink-0 px-6 py-4 flex items-center gap-3 border-b border-border/50">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <img
            src="/logo-mb.png"
            alt="MetaBoard"
            className="h-7 w-7 object-contain rounded-lg shrink-0"
          />
          <nav className="flex items-center gap-1 text-sm min-w-0" aria-label="Breadcrumb">
            <Link
              to="/boards"
              className="text-muted-foreground hover:text-foreground transition whitespace-nowrap"
            >
              MetaBoard
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <span className="font-semibold truncate">Extensão</span>
          </nav>
        </div>
        <UserAccountMenu />
      </header>

      <div className="flex-1 flex flex-col items-center px-6 py-10">
        <div className="w-full max-w-xl text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Envie posts do Instagram em um clique</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Instale a extensão do MetaBoard e mande legenda, comentários fixados e vídeo de um post
            direto para o seu board — sem copiar e colar nada.
          </p>

          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Chrome className="h-3.5 w-3.5" />
              Google Chrome
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Instagram className="h-3.5 w-3.5" />
              Posts e reels
            </span>
          </div>

          <a href="/extension.zip" download className="inline-block mt-6">
            <Button size="lg" className="gap-2">
              <Download className="h-4 w-4" />
              Baixar extensão (.zip)
            </Button>
          </a>
        </div>

        <div className="w-full max-w-xl space-y-3">
          {STEPS.map((step, i) => (
            <Card key={step.title} className="p-4 flex items-start gap-4">
              <span className="shrink-0 h-7 w-7 rounded-full bg-primary/10 text-primary font-semibold text-sm flex items-center justify-center">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium text-sm">{step.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{step.description}</p>
                {step.copyValue && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 mt-2"
                    onClick={() => handleCopy(step.copyValue!)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar chrome://extensions
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
