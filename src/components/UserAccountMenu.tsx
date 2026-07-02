import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { googleAuthService } from "@/shared/providers/providerFactory";
import { useAuthStore } from "@/store/authStore";
import { useSpreadsheetStore } from "@/store/spreadsheetStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserAccountMenu() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, clearUser } = useAuthStore();
  const { clearSpreadsheetId } = useSpreadsheetStore();

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function handleChangeSpreadsheet() {
    clearSpreadsheetId(user!.email);
    queryClient.clear();
    navigate("/setup");
  }

  function handleSignOut() {
    googleAuthService.signOut();
    clearUser();
    toast.success("Desconectado do Google");
    navigate("/", { replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="shrink-0 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Menu da conta"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.picture} alt={user.name} referrerPolicy="no-referrer" />
            <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleChangeSpreadsheet} className="cursor-pointer">
          <ArrowLeftRight />
          Trocar planilha
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-danger focus:text-danger focus:bg-danger/10"
        >
          <LogOut />
          Desconectar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
