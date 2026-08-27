import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Briefcase,
  CheckCircle2,
  FileText,
  Flame,
  History as HistoryIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  Search,
  Settings,
  Sparkles,
  UserCheck,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/cv", label: "CV Analysis", icon: FileText },
  { to: "/app/interview", label: "Mock Studio", icon: Mic, accent: true },
  { to: "/app/history", label: "Interview History", icon: HistoryIcon },
  { to: "/app/reports", label: "Feedback Reports", icon: Sparkles },
  { to: "/app/jobs", label: "Matched Roles", icon: Briefcase },
  { to: "/app/profile", label: "Settings", icon: Settings },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="bg-app text-default min-h-screen selection:bg-brand-500 selection:text-white">
      {/* Desktop Sidebar */}
      <aside className="border-token bg-surface/90 backdrop-blur-xl fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r lg:flex">
        <SidebarContent onNav={() => setMobileOpen(false)} onLogout={handleLogout} user={user} />
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
              className="bg-surface border-token fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r shadow-2xl lg:hidden"
            >
              <SidebarContent
                onNav={() => setMobileOpen(false)}
                onLogout={handleLogout}
                user={user}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="lg:pl-72 flex flex-col min-h-screen">
        {/* Top Sticky Header */}
        <header className="glass-strong sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-token px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="border-token hover:bg-surface-2 rounded-xl border p-2 text-muted hover:text-default transition lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>

            {/* Quick Search Bar */}
            <div className="bg-surface-2/80 border-token text-muted hidden h-10 w-80 items-center gap-2.5 rounded-xl border px-3.5 sm:flex">
              <Search className="size-4 text-subtle" />
              <input
                placeholder="Search tracks, reports, jobs…"
                className="placeholder:text-subtle text-default h-full flex-1 bg-transparent text-xs font-medium outline-none"
              />
              <kbd className="border-token bg-surface text-subtle rounded-md border px-1.5 py-0.5 text-[10px] font-bold">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Right Header Icons */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Link to="/app/interview" className="hidden sm:block">
              <Button size="sm" leftIcon={Mic} className="shadow-md">
                Launch Mock
              </Button>
            </Link>

            <ThemeToggle />

            <button
              className="border-token bg-surface hover:bg-surface-2 relative flex size-10 items-center justify-center rounded-xl border text-muted hover:text-default transition"
              aria-label="Notifications"
            >
              <Bell className="size-4.5" />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-brand-400 ring-2 ring-surface" />
            </button>

            <div className="h-6 w-px bg-token/60 mx-1 hidden sm:block" />

            <Link
              to="/app/profile"
              className="flex items-center gap-2.5 rounded-xl p-1 hover:bg-surface-2 transition"
              aria-label="Profile Settings"
            >
              <Avatar name={user?.fullName || user?.name || "Candidate"} src={user?.avatar} size="sm" />
              <div className="hidden xl:block text-left">
                <p className="text-default text-xs font-bold leading-tight truncate max-w-[120px]">
                  {user?.fullName || user?.name || "Candidate"}
                </p>
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active Loop
                </span>
              </div>
            </Link>
          </div>
        </header>

        {/* Page Outlet */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ onNav, onLogout, user }) {
  return (
    <>
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-token px-5">
        <Link to="/app/dashboard" onClick={onNav}>
          <Logo size="md" />
        </Link>
        <button
          onClick={onNav}
          className="border-token hover:bg-surface-2 rounded-lg border p-1.5 text-muted hover:text-default lg:hidden"
          aria-label="Close menu"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-3.5">
        <span className="text-[10px] uppercase font-bold tracking-widest text-subtle px-3 py-1">
          Candidate Studio
        </span>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNav}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200",
                isActive
                  ? "bg-brand-500/15 text-brand-400 shadow-sm border border-brand-500/30"
                  : "text-muted hover:bg-surface-2 hover:text-default"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("size-4.5 shrink-0 transition-colors", isActive ? "text-brand-400" : "text-subtle group-hover:text-default")} />
                <span className="flex-1">{item.label}</span>
                {item.accent && (
                  <Badge variant="brand" size="xs" dot pulse>
                    Live
                  </Badge>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Sidebar Widget (Studio Status & Readiness) - Replaces Billing/Upgrade Banner */}
      <div className="border-t border-token p-3.5 space-y-3">
        <div className="glass-card rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-500/10 via-brand-500/5 to-accent-500/10 p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-brand-300 flex items-center gap-1.5">
              <Zap className="size-3.5 text-amber-400" />
              Practice Loop
            </span>
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-default font-display text-sm font-bold mt-2">
            AI Interview Engine 4.7
          </p>
          <p className="text-muted text-[11px] mt-0.5 leading-snug">
            Adaptive multi-round interviewer with real-time speech telemetry.
          </p>
          <Link
            to="/app/interview"
            onClick={onNav}
            className="mt-3.5 inline-flex h-8 w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand-500 to-accent-500 text-xs font-bold text-white shadow-md shadow-brand-500/20 hover:brightness-110 transition"
          >
            Start New Session →
          </Link>
        </div>

        {/* Logout Button */}
        <button
          onClick={onLogout}
          className="text-muted hover:bg-rose-500/10 hover:text-rose-400 flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-semibold transition"
        >
          <LogOut className="size-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </>
  );
}
