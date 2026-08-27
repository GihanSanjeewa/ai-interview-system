import { motion } from "framer-motion";
import { Star, Trophy, Quote } from "lucide-react";
import { SectionHeading } from "./Categories";

const reviews = [
  {
    name: "Alex Rivera",
    role: "Senior Software Engineer",
    company: "Landed role at Stripe",
    text: "Aria's follow-up questions caught me completely off-guard on distributed transactions in the best way possible. The WPM pacing feedback helped me stop rushing my answers.",
    score: 95,
    tag: "Software Engineering",
  },
  {
    name: "Priya Sharma",
    role: "Full Stack Developer",
    company: "Landed role at Microsoft",
    text: "Being able to upload my actual resume and get probed on my exact tech stack made the experience 10x more realistic than generic leetcode flashcards.",
    score: 92,
    tag: "React / Node Loop",
  },
  {
    name: "Marcus Chen",
    role: "Tech Lead Candidate",
    company: "Landed role at Datadog",
    text: "The behavioral feedback using the STAR framework gave me clear structure for leadership stories. Walked into my final on-site loop completely confident.",
    score: 98,
    tag: "System Design & Leadership",
  },
];

export default function Testimonials() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <SectionHeading
          eyebrow="Success Stories"
          title="From Practice Sessions to Real Offers"
          subtitle="See how developers and engineering candidates worldwide used Inverview AI to conquer high-stakes interviews."
        />

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {reviews.map((r, i) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-card relative rounded-3xl p-6 sm:p-7 border border-token flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} className="size-4 fill-amber-400" />
                    ))}
                  </div>
                  <span className="rounded-full bg-brand-500/10 border border-brand-500/30 px-2.5 py-0.5 text-[10px] font-bold text-brand-300">
                    {r.score}/100 Score
                  </span>
                </div>

                <p className="text-default mt-5 text-sm sm:text-base leading-relaxed italic">
                  "{r.text}"
                </p>
              </div>

              <div className="mt-6 pt-5 border-t border-token/60 flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center text-white font-bold text-sm shadow">
                  {r.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <p className="text-default text-sm font-bold">{r.name}</p>
                  <p className="text-brand-400 text-xs font-semibold">{r.company}</p>
                  <p className="text-subtle text-[11px]">{r.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
