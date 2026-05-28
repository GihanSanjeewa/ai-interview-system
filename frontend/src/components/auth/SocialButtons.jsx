import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/utils";

export default function SocialButtons() {
  const toast = useToast();
  const onClick = (provider) =>
    toast.info(`${provider} sign-in`, "Connect a provider from settings.");

  const providers = [
    {
      name: "Google",
      icon: (
        <svg viewBox="0 0 24 24" className="size-4.5">
          <path fill="#EA4335" d="M12 5c1.6 0 3 .5 4.1 1.5l3-3C17.1 1.7 14.7.7 12 .7 7.4.7 3.4 3.3 1.5 7.1l3.5 2.7C5.9 7 8.7 5 12 5z" />
          <path fill="#34A853" d="M23.5 12.3c0-.8-.1-1.7-.2-2.4H12v4.7h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.5 2.7c2.1-1.9 3.9-4.8 3.9-8.6z" />
          <path fill="#FBBC05" d="M5 14.2c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2L1.5 7.5C.8 9 .3 10.6.3 12.2c0 1.7.4 3.3 1.2 4.7L5 14.2z" />
          <path fill="#4285F4" d="M12 23.5c3.2 0 5.9-1.1 7.9-2.9l-3.5-2.7c-1 .7-2.3 1.1-4.4 1.1-3.3 0-6.1-2-7-4.8L1.5 16.9C3.4 20.7 7.4 23.5 12 23.5z" />
        </svg>
      ),
    },
    {
      name: "GitHub",
      icon: (
        <svg viewBox="0 0 24 24" className="size-4.5 fill-current">
          <path d="M12 .3a12 12 0 00-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.3-.1-.3-.6-1.6.1-3.3 0 0 1-.3 3.3 1.3a11.4 11.4 0 016 0c2.3-1.6 3.3-1.3 3.3-1.3.7 1.7.2 3 .1 3.3.8.9 1.3 2 1.3 3.3 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0012 .3z" />
        </svg>
      ),
    },
    {
      name: "LinkedIn",
      icon: (
        <svg viewBox="0 0 24 24" className="size-4.5">
          <path fill="#0A66C2" d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM8.5 18h-3V9.5h3V18zM7 8.3a1.7 1.7 0 110-3.4 1.7 1.7 0 010 3.4zM18.5 18h-3v-4.3c0-1-.3-1.7-1.3-1.7s-1.5.7-1.5 1.7V18h-3V9.5h3v1.2c.5-.8 1.4-1.4 2.6-1.4 1.9 0 3.2 1.2 3.2 3.7V18z" />
        </svg>
      ),
    },
  ];

  return (
    <div className={cn("grid grid-cols-3 gap-2.5")}>
      {providers.map((p) => (
        <button
          key={p.name}
          type="button"
          onClick={() => onClick(p.name)}
          className="bg-surface-2 border-token text-default hover:bg-surface flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition"
        >
          {p.icon}
          <span className="hidden sm:inline">{p.name}</span>
        </button>
      ))}
    </div>
  );
}
