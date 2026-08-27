import { motion } from "framer-motion";

const brands = [
  "Google",
  "Meta",
  "Amazon",
  "Stripe",
  "Microsoft",
  "Spotify",
  "Datadog",
  "Airbnb",
];

export default function Trusted() {
  return (
    <section className="border-y border-token/60 bg-surface/30 py-8 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <p className="text-subtle text-center text-xs font-bold uppercase tracking-widest">
          Engineers prepared with Inverview AI have landed offers at
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {brands.map((b, i) => (
            <motion.span
              key={b}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="text-muted/70 hover:text-default font-display text-lg font-bold tracking-tight transition-colors cursor-default"
            >
              {b}
            </motion.span>
          ))}
        </div>
      </div>
    </section>
  );
}
