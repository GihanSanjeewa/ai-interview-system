import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const links = [
  { to: "/#features", label: "Features" },
  { to: "/#categories", label: "Categories" },
  { to: "/#how", label: "How it works" },
  { to: "/#pricing", label: "Pricing" },
  { to: "/#faq", label: "FAQ" },
];

export default function MarketingLayout() {
  const { pathname, hash } = useLocation();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    if (hash) {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [pathname, hash]);

  return (
    <div className="bg-app text-default min-h-screen">
      <motion.header
        initial={false}
        animate={{
          paddingTop: scrolled ? 8 : 16,
          paddingBottom: scrolled ? 8 : 16,
        }}
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled
            ? "glass-strong border-b border-token"
            : "bg-transparent"
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 lg:px-8">
          <Link to="/">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <a
                key={l.to}
                href={l.to}
                className="text-muted hover:text-default rounded-xl px-4 py-2 text-sm font-medium transition"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <ThemeToggle />
            {user ? (
              <Button
                onClick={() => (window.location.href = "/app/dashboard")}
                rightIcon={ArrowRight}
              >
                Open dashboard
              </Button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-default hover:bg-surface-2 inline-flex h-10 items-center rounded-2xl px-4 text-sm font-semibold transition"
                >
                  Login
                </Link>
                <Link to="/register">
                  <Button rightIcon={ArrowRight}>Get started</Button>
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <button
              onClick={() => setOpen((o) => !o)}
              className="border-token bg-surface flex size-10 items-center justify-center rounded-xl border"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong mx-4 mt-3 rounded-2xl border p-4 lg:hidden"
          >
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <a
                  key={l.to}
                  href={l.to}
                  className="text-muted hover:bg-surface-2 rounded-xl px-3 py-2.5 text-sm font-medium"
                >
                  {l.label}
                </a>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link to="/login">
                <Button variant="secondary" className="w-full">
                  Login
                </Button>
              </Link>
              <Link to="/register">
                <Button className="w-full">Get started</Button>
              </Link>
            </div>
          </motion.div>
        )}
      </motion.header>

      <main className="pt-16">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-token mt-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 lg:grid-cols-5 lg:px-8">
        <div className="lg:col-span-2">
          <Logo />
          <p className="text-muted mt-4 max-w-sm text-sm">
            Inverview AI is a realistic mock-interview platform that helps
            candidates land roles in tech, leadership and beyond.
          </p>
          <div className="mt-5 flex items-center gap-3">
            {[
              {
                name: "Twitter",
                path: "M22 5.92a8.2 8.2 0 01-2.36.65 4.1 4.1 0 001.8-2.27 8.2 8.2 0 01-2.6 1A4.1 4.1 0 0011.8 9.3a11.65 11.65 0 01-8.45-4.3 4.1 4.1 0 001.27 5.48 4.07 4.07 0 01-1.86-.52v.05a4.1 4.1 0 003.29 4.03 4.1 4.1 0 01-1.86.07 4.1 4.1 0 003.83 2.85 8.23 8.23 0 01-6.07 1.7A11.62 11.62 0 008.29 20c7.55 0 11.68-6.26 11.68-11.69v-.53A8.34 8.34 0 0022 5.92z",
              },
              {
                name: "LinkedIn",
                path: "M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM8.5 18h-3V9.5h3V18zM7 8.3a1.7 1.7 0 110-3.4 1.7 1.7 0 010 3.4zM18.5 18h-3v-4.3c0-1-.3-1.7-1.3-1.7s-1.5.7-1.5 1.7V18h-3V9.5h3v1.2c.5-.8 1.4-1.4 2.6-1.4 1.9 0 3.2 1.2 3.2 3.7V18z",
              },
              {
                name: "GitHub",
                path: "M12 .3a12 12 0 00-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.3-.1-.3-.6-1.6.1-3.3 0 0 1-.3 3.3 1.3a11.4 11.4 0 016 0c2.3-1.6 3.3-1.3 3.3-1.3.7 1.7.2 3 .1 3.3.8.9 1.3 2 1.3 3.3 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0012 .3z",
              },
            ].map((I) => (
              <a
                key={I.name}
                href="#"
                aria-label={I.name}
                className="border-token bg-surface hover:bg-surface-2 flex size-10 items-center justify-center rounded-xl border transition"
              >
                <svg viewBox="0 0 24 24" className="size-4 fill-current">
                  <path d={I.path} />
                </svg>
              </a>
            ))}
          </div>
        </div>
        {[
          {
            title: "Product",
            items: ["Features", "Pricing", "Roadmap", "Changelog"],
          },
          {
            title: "Company",
            items: ["About", "Careers", "Contact", "Press kit"],
          },
          {
            title: "Resources",
            items: ["Blog", "Guides", "Support", "Status"],
          },
        ].map((col) => (
          <div key={col.title}>
            <p className="text-default text-sm font-semibold">{col.title}</p>
            <ul className="mt-4 space-y-2.5">
              {col.items.map((i) => (
                <li key={i}>
                  <a
                    href="#"
                    className="text-muted hover:text-default text-sm transition"
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
        <div className="text-subtle mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs sm:flex-row lg:px-8">
          <span>© {new Date().getFullYear()} Inverview AI. All rights reserved.</span>
          <div className="flex items-center gap-5">
            <a href="#" className="hover:text-default transition">
              Privacy
            </a>
            <a href="#" className="hover:text-default transition">
              Terms
            </a>
            <a href="#" className="hover:text-default transition">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
