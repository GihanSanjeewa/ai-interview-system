import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";
import { SectionHeading } from "./Categories";

const reviews = [
  {
    name: "Tharindu Wijesinghe",
    role: "Senior Engineer, Sysco LABS",
    quote:
      "Aria caught the things my friends were too polite to point out. I went from sweating in real interviews to actually enjoying them.",
    rating: 5,
    accent: "from-brand-500 to-violet-500",
  },
  {
    name: "Anjali Perera",
    role: "Software Engineer, WSO2",
    quote:
      "The 6-metric report is gold. I now know exactly which 3 things to work on every week, instead of generic 'be more confident'.",
    rating: 5,
    accent: "from-pink-500 to-rose-500",
  },
  {
    name: "Dilanka Fernando",
    role: "Tech Lead, IFS",
    quote:
      "We're using Inverview for our junior coaching internally. The system design persona is shockingly good.",
    rating: 5,
    accent: "from-cyan-500 to-sky-500",
  },
  {
    name: "Sasha Karunaratne",
    role: "PM → SWE switcher",
    quote:
      "I did 14 mock interviews here before switching careers. Got two offers in two weeks. This thing is unfair.",
    rating: 5,
    accent: "from-amber-400 to-orange-500",
  },
  {
    name: "Ravindu de Silva",
    role: ".NET Engineer, 99x",
    quote:
      "The behavioral round on Aria is uncomfortably realistic. Including the awkward silences. Loved it.",
    rating: 5,
    accent: "from-emerald-400 to-teal-500",
  },
  {
    name: "Methuli Senanayake",
    role: "Final-year CS student",
    quote:
      "Got my first internship offer after 3 weeks of daily mocks. The replay + transcript loop is a cheat code.",
    rating: 5,
    accent: "from-indigo-500 to-blue-500",
  },
];

export default function Testimonials() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <SectionHeading
          eyebrow="Loved by candidates"
          title="Real interviews. Real results."
        />

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r, i) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ delay: i * 0.05 }}
              className="bg-surface border-token group relative overflow-hidden rounded-2xl border p-6"
            >
              <Quote className="text-brand-500/15 absolute right-4 top-4 size-20" />
              <div className="relative">
                <div className="flex items-center gap-1">
                  {[...Array(r.rating)].map((_, j) => (
                    <Star key={j} className="size-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-default mt-4 text-sm leading-relaxed">
                  "{r.quote}"
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <div
                    className={`size-10 rounded-full bg-gradient-to-br ${r.accent} text-sm font-bold text-white grid place-items-center`}
                  >
                    {r.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div>
                    <p className="text-default text-sm font-semibold">
                      {r.name}
                    </p>
                    <p className="text-subtle text-xs">{r.role}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
