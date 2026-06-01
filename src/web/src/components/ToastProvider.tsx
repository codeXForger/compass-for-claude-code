import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastType = "success" | "error";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = (idRef.current += 1);
      setToasts((t) => [...t, { id, type, message }]);
      // errors linger a little longer so they can be read
      const ttl = type === "error" ? 6000 : 2800;
      setTimeout(() => remove(id), ttl);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push("success", m),
      error: (m) => push("error", m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-5 top-5 z-50 flex w-80 max-w-[calc(100vw-2.5rem)] flex-col gap-2">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const ok = toast.type === "success";
  return (
    <div
      role="status"
      onClick={onClose}
      className={`pointer-events-auto cursor-pointer animate-page-in rounded-md border p-3 shadow-lg backdrop-blur-sm ${
        ok
          ? "border-sage/40 bg-sage/10"
          : "border-brick/40 bg-brick/10"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`dot mt-1.5 ${ok ? "bg-sage" : "bg-brick"}`} />
        <div className="min-w-0 flex-1">
          <div
            className={`text-[11px] font-medium uppercase tracking-caps ${
              ok ? "text-sage" : "text-brick"
            }`}
          >
            {ok ? "Success" : "Error"}
          </div>
          <div className="mt-0.5 break-words text-[12.5px] text-ink">
            {toast.message}
          </div>
        </div>
      </div>
    </div>
  );
}
