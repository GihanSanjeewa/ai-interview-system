import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const colors = {
  success: "text-emerald-400",
  error: "text-rose-400",
  info: "text-brand-400",
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = crypto.randomUUID();
      const t = { id, duration: 4000, type: "info", ...toast };
      setToasts((arr) => [...arr, t]);
      if (t.duration > 0) {
        setTimeout(() => dismiss(id), t.duration);
      }
      return id;
    },
    [dismiss]
  );

  const api = {
    push,
    dismiss,
    success: (title, description, opts = {}) =>
      push({ type: "success", title, description, ...opts }),
    error: (title, description, opts = {}) =>
      push({ type: "error", title, description, ...opts }),
    info: (title, description, opts = {}) =>
      push({ type: "info", title, description, ...opts }),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-full max-w-sm flex-col gap-3">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = icons[t.type] || Info;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 24, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className="glass-strong pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-2xl shadow-black/10"
              >
                <Icon className={`${colors[t.type]} mt-0.5 size-5 shrink-0`} />
                <div className="flex-1">
                  <p className="text-default text-sm font-semibold">
                    {t.title}
                  </p>
                  {t.description && (
                    <p className="text-muted mt-0.5 text-xs">
                      {t.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  className="text-subtle hover:text-default transition"
                >
                  <X className="size-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
