import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Mic } from "lucide-react";
import Button from "@/components/ui/Button";

export default function CtaBanner() {
  return (
    <section className="px-4 pb-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="from-brand-600 via-brand-500 to-accent-500 relative overflow-hidden rounded-3xl bg-gradient-to-br p-10 sm:p-16"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_40%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.12),transparent_50%)]" />
          <div className="relative grid items-center gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <h2 className="font-display text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
                Your next interview is closer<br />
                than you think.
              </h2>
              <p className="mt-3 max-w-xl text-white/85">
                Run your first 15-minute mock interview free. No card. No
                pressure. Just Aria, your patient AI interviewer.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Link to="/register">
                <Button
                  variant="glass"
                  size="lg"
                  className="!text-white !backdrop-blur-xl !bg-white/15 hover:!bg-white/25"
                  leftIcon={Mic}
                  rightIcon={ArrowRight}
                >
                  Start free mock
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
