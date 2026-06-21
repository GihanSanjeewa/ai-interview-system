import { motion } from "framer-motion";

const brands = [
  "Google",
  "Stripe",
  "Spotify",
  "Airbnb",
  "Notion",
  "Linear",
  "Figma",
];

export default function Trusted() {
  return (
    <section className="border-y border-token bg-surface/40 py-10">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <p className="text-subtle text-center text-xs font-semibold uppercase tracking-widest">
          Candidates we've helped get hired at
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {brands.map((b, i) => (
            <motion.span
              key={b}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="text-muted font-display text-xl font-semibold opacity-70 grayscale transition hover:opacity-100"
            >
              {b}
            </motion.span>
          ))}
        </div>
      </div>
    </section>
  );
}
