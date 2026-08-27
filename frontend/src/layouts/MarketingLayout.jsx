import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Menu, Sparkles, X } from "lucide-react";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const links = [
  { to: "/#features", label: "Features" },
  { to: "/#categories", label: "Interview Tracks" },
  { to: "/#preview", label: "Live Simulation" },
  { to: "/#how", label: "How It Works" },
  { to: "/#faq", label: "FAQ" },
];

export default function MarketingLayout() {
  const { pathname, hash } = useLocation();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    if (hash) {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [pathname, hash]);

  return (
    <div className="bg-app text-default min-h-screen relative selection:bg-brand-500 selection:text-white">
      {/* Top sticky navbar */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300 px-4 lg:px-8 py-3",
          scrolled ? "glass-strong border-b border-token shadow-lg shadow-black/5 py-2.5" : "bg-transparent"
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/" className="flex items-center">
            <Logo size="md" />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-1 rounded-full border border-token/60 bg-surface/50 p-1.5 backdrop-blur-md lg:flex">
            {links.map((l) => (
              <a
                key={l.to}
                href={l.to}
                className="text-muted hover:text-default hover:bg-surface-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition-all"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden items-center gap-2.5 lg:flex">
            <ThemeToggle />
            {user ? (
              <Link to="/app/dashboard">
                <Button size="sm" rightIcon={ArrowRight}>
                  Open Studio
                </Button>
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-muted hover:text-default hover:bg-surface-2 inline-flex h-9 items-center rounded-xl px-4 text-xs font-semibold transition"
                >
                  Sign In
                </Link>
                <Link to="/register">
                  <Button size="sm" rightIcon={ArrowRight}>
                    Start Free Mock
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen((o) => !o)}
              className="border-token bg-surface hover:bg-surface-2 flex size-10 items-center justify-center rounded-xl border transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="glass-strong mx-auto mt-3 max-w-lg rounded-3xl border border-token p-5 shadow-2xl lg:hidden"
            >
              <div className="flex flex-col gap-1.5">
                {links.map((l) => (
                  <a
                    key={l.to}
                    href={l.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-muted hover:bg-surface-2 hover:text-default rounded-xl px-4 py-3 text-sm font-semibold transition"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-token pt-4">
                {user ? (
                  <Link to="/app/dashboard" className="col-span-2">
                    <Button className="w-full" rightIcon={ArrowRight}>
                      Open Studio
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link to="/login">
                      <Button variant="secondary" className="w-full">
                        Sign In
                      </Button>
                    </Link>
                    <Link to="/register">
                      <Button className="w-full">Get Started</Button>
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="pt-20">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-token bg-surface/40 mt-32">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 lg:grid-cols-5 lg:px-8">
        <div className="lg:col-span-2">
          <Logo size="lg" />
          <p className="text-muted mt-4 max-w-sm text-sm leading-relaxed">
            The next-generation AI interview simulator. Practice multi-modal
            technical and behavioral mock interviews with instant speech telemetry
            and personalized coaching.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-subtle">
              Multi-modal AI Engine 4.7 Active
            </span>
          </div>
        </div>

        {[
          {
            title: "Interview Tracks",
            items: [
              "Software Engineering",
              "React & Frontend",
              "Node.js & Backend",
              "System Design",
              "HR & Behavioral",
              "Leadership",
            ],
          },
          {
            title: "Capabilities",
            items: [
              "Multi-modal AI Aria",
              "Speech & Prosody Telemetry",
              "CV Skill Parser",
              "6-Metric Performance Report",
              "Automated Job Matching",
            ],
          },
          {
            title: "Resources",
            items: ["Interview Prep Guides", "STAR Method Masterclass", "Tech Career Roadmap", "Privacy & Security"],
          },
        ].map((col) => (
          <div key={col.title}>
            <p className="text-default text-xs font-bold uppercase tracking-wider">{col.title}</p>
            <ul className="mt-4 space-y-2.5">
              {col.items.map((i) => (
                <li key={i}>
                  <a
                    href="#features"
                    className="text-muted hover:text-brand-400 text-sm transition-colors"
                  >
                    {i}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-token">
        <div className="text-subtle mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs sm:flex-row lg:px-8">
          <span>© {new Date().getFullYear()} Inverview AI. Free & open candidate coaching.</span>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-default transition">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-default transition">
              Terms of Service
            </a>
            <a href="#" className="hover:text-default transition">
              Security Notice
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
