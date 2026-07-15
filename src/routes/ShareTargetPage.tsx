import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  SHARE_IMPORT_STORAGE_KEY,
  SHARE_IMPORT_READY_EVENT,
  type ShareImportPayload,
} from "@/modules/board/shareImport";

/** Web Share Target action route (method: GET). Must stay outside the auth
 * guards — persisting the payload has to happen before any redirect, or the
 * query params captured from the Android share sheet would be lost. */
export function ShareTargetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const payload: ShareImportPayload = {
      title: searchParams.get("title") ?? undefined,
      text: searchParams.get("text") ?? undefined,
      url: searchParams.get("url") ?? undefined,
    };
    sessionStorage.setItem(SHARE_IMPORT_STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event(SHARE_IMPORT_READY_EVENT));
    navigate("/", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
