import { useState } from "react";
import { motion } from "framer-motion";
import { Check, CreditCard, Download, Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: { monthly: 0, yearly: 0 },
    features: ["3 mock interviews / month", "Basic scoring", "Transcript only"],
  },
  {
    id: "pro",
    name: "Pro",
    price: { monthly: 19, yearly: 14 },
    features: ["Unlimited interviews", "6-metric reports", "PDF export", "Personalized coach"],
    highlight: true,
  },
  {
    id: "team",
    name: "Team",
    price: { monthly: 49, yearly: 39 },
    features: ["Everything in Pro", "10 seats", "Cohort dashboards"],
  },
];

const invoices = [
  { id: "INV-204821", date: "May 1, 2026", amount: "$14.00", status: "Paid" },
  { id: "INV-198331", date: "Apr 1, 2026", amount: "$14.00", status: "Paid" },
  { id: "INV-192041", date: "Mar 1, 2026", amount: "$14.00", status: "Paid" },
];

export default function Subscription() {
  const [cycle, setCycle] = useState("yearly");
  const [current] = useState("pro");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-default text-3xl font-bold sm:text-4xl">
            Subscription & billing
          </h1>
          <p className="text-muted mt-1">
            Manage your plan, billing cycle and invoices.
          </p>
        </div>
        <div className="bg-surface-2 border-token inline-flex rounded-2xl border p-1">
          {[
            { v: "monthly", l: "Monthly" },
            { v: "yearly", l: "Yearly · -26%" },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => setCycle(o.v)}
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-semibold transition",
                cycle === o.v
                  ? "bg-surface text-default border border-token shadow-sm"
                  : "text-muted"
              )}
            >
              {o.l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={cn(
              "relative overflow-hidden rounded-3xl border p-6",
              p.highlight
                ? "from-brand-600/30 to-accent-500/10 border-brand-500/40 bg-gradient-to-br shadow-glow"
                : "bg-surface border-token"
            )}
          >
            {p.id === current && (
              <Badge variant="brand" icon={Sparkles} className="absolute right-4 top-4">
                Current
              </Badge>
            )}
            <h3 className="font-display text-default text-xl font-bold">
              {p.name}
            </h3>
            <p className="font-display text-default mt-3 text-4xl font-bold">
              ${p.price[cycle]}
              <span className="text-muted text-sm font-normal"> / month</span>
            </p>
            <ul className="mt-5 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <span className="bg-brand-500/15 text-brand-400 mt-0.5 grid size-5 place-items-center rounded-full">
                    <Check className="size-3" />
                  </span>
                  <span className="text-default">{f}</span>
                </li>
              ))}
            </ul>
            <Button
              className="mt-6 w-full"
              variant={p.id === current ? "secondary" : p.highlight ? "primary" : "secondary"}
            >
              {p.id === current ? "Current plan" : `Switch to ${p.name}`}
            </Button>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="bg-surface border-token rounded-3xl border p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-default text-lg font-semibold">Invoices</h2>
              <p className="text-muted text-xs">All your past payments.</p>
            </div>
            <Button variant="secondary" size="sm" leftIcon={Download}>
              Export all
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-subtle text-left text-[11px] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-token text-default">
                {invoices.map((i) => (
                  <tr key={i.id}>
                    <td className="px-3 py-3 font-semibold">{i.id}</td>
                    <td className="px-3 py-3 text-muted">{i.date}</td>
                    <td className="px-3 py-3">{i.amount}</td>
                    <td className="px-3 py-3">
                      <Badge variant="success">{i.status}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button size="icon" variant="ghost">
                        <Download className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface border-token rounded-3xl border p-6">
          <h2 className="text-default text-lg font-semibold">Payment method</h2>
          <div className="bg-surface-2 border-token mt-4 rounded-2xl border p-4">
            <div className="flex items-center gap-3">
              <div className="from-brand-500 to-accent-500 grid size-10 place-items-center rounded-xl bg-gradient-to-br text-white">
                <CreditCard className="size-4.5" />
              </div>
              <div>
                <p className="text-default text-sm font-semibold">
                  Visa •••• 4421
                </p>
                <p className="text-subtle text-xs">Expires 09 / 28</p>
              </div>
            </div>
          </div>
          <Button variant="secondary" className="mt-4 w-full">
            Update payment method
          </Button>
        </div>
      </div>
    </div>
  );
}
