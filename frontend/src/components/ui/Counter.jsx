import { animate, useInView, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

export default function Counter({ to = 100, duration = 1.6, format = (v) => v }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => format(Math.round(v)));

  useEffect(() => {
    if (inView) animate(motionValue, to, { duration, ease: "easeOut" });
  }, [inView, to, duration, motionValue]);

  return <motion-span ref={ref}>{rounded}</motion-span>;
}

// SSR-safe variant returning span
export function CountUp({ to = 100, duration = 1.6, suffix = "", prefix = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const mv = useMotionValue(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, to, {
      duration,
      ease: "easeOut",
      onUpdate(v) {
        if (ref.current) ref.current.textContent = `${prefix}${Math.round(v).toLocaleString()}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [inView, to, duration, mv, suffix, prefix]);

  return <span ref={ref}>{prefix}0{suffix}</span>;
}
