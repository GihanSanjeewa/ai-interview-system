import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Briefcase,
  CreditCard,
  FileText,
  History as HistoryIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/cv", label: "My CV", icon: FileText },
  { to: "/app/interview", label: "Mock Interview", icon: Mic, accent: true },
  { to: "/app/history", label: "Interview History", icon: HistoryIcon },
  { to: "/app/reports", label: "Feedback Reports", icon: Sparkles },
  { to: "/app/jobs", label: "Job Matches", icon: Briefcase },
  { to: "/app/profile", label: "Profile Settings", icon: Settings },
  { to: "/app/subscription", label: "Subscription", icon: CreditCard },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="bg-app text-default min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="border-token bg-surface fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r lg:flex">
        <SidebarContent onNav={() => setOpen(false)} onLogout={handleLogout} user={user} />
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="bg-surface border-token fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r lg:hidden"
            >
              <SidebarContent
                onNav={() => setOpen(false)}
                onLogout={handleLogout}
                user={user}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="lg:pl-72">
        <header className="glass-strong sticky top-0 z-30 flex h-16 items-center gap-4 border-b px-4 lg:px-8">
          <button
            onClick={() => setOpen(true)}
            className="border-token hover:bg-surface-2 rounded-xl border p-2 lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          <div className="bg-surface-2 border-token text-muted hidden h-10 flex-1 items-center gap-2 rounded-xl border px-3.5 sm:flex lg:max-w-md">
            <Search className="size-4" />
            <input
              placeholder="Search interviews, reports, settings…"
              className="placeholder:text-subtle h-full flex-1 bg-transparent text-sm outline-none"
            />
            <kbd className="border-token bg-surface text-subtle hidden rounded-md border px-1.5 py-0.5 text-[10px] font-medium lg:inline">
              ⌘K
            </kbd>
          </div>
          <div className="flex flex-1 sm:hidden" />

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button className="border-token bg-surface hover:bg-surface-2 relative flex size-10 items-center justify-center rounded-xl border transition">
              <Bell className="size-4.5" />
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-400 ring-2 ring-[var(--surface)]" />
            </button>
            <Link
              to="/app/profile"
              className="ml-1 flex items-center gap-2.5"
              aria-label="Profile"
            >
              <Avatar name={user?.name || "User"} src={user?.avatar} />
              <div className="hidden lg:block">
                <p className="text-default text-sm font-semibold leading-tight">
                  {user?.name || "User"}
                </p>
                <p className="text-subtle text-[11px]">{user?.email}</p>
              </div>
            </Link>
          </div>
        </header>

        <main className="px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ onNav, onLogout, user }) {
  return (
    <>
      <div className="flex h-16 items-center justify-between border-b border-token px-5">
        <Link to="/app/dashboard">
          <Logo />
        </Link>
        <button
          onClick={onNav}
          className="border-token hover:bg-surface-2 rounded-lg border p-1.5 lg:hidden"
        >
          <X className="size-4" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNav}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                isActive
                  ? "bg-brand-500/12 text-brand-400"
                  : "text-muted hover:bg-surface-2 hover:text-default"
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="side-active"
                    className="from-brand-500 to-accent-500 absolute left-0 top-1/2 -ml-1 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b"
                  />
                )}
                <item.icon className="size-4.5" />
                <span className="flex-1">{item.label}</span>
                {item.accent && (
                  <Badge variant="brand" size="sm">
                    Live
                  </Badge>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-token p-3">
        <div className="from-brand-500/10 to-accent-500/10 border-brand-500/20 mb-3 rounded-2xl border bg-gradient-to-br p-4">
          <p className="text-default text-sm font-semibold">Upgrade to Pro</p>
          <p className="text-muted mt-1 text-xs">
            Unlimited interviews, deep analytics & premium AI personas.
          </p>
          <Link
            to="/app/subscription"
            className="from-brand-500 to-brand-700 mt-3 inline-flex h-9 items-center rounded-xl bg-gradient-to-br px-3 text-xs font-semibold text-white"
          >
            View plans →
          </Link>
        </div>
        <button
          onClick={onLogout}
          className="text-muted hover:bg-surface-2 hover:text-default flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
        >
          <LogOut className="size-4.5" />
          Logout
        </button>
      </div>
    </>
  );
}
