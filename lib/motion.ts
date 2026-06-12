import type { Variants } from "framer-motion";

export const easeOutExpo = [0.16, 1, 0.3, 1] as const;

export const motionTiming = {
  fast: { duration: 0.18, ease: easeOutExpo },
  base: { duration: 0.28, ease: easeOutExpo },
  slow: { duration: 0.42, ease: easeOutExpo },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: motionTiming.base },
  exit: { opacity: 0, transition: motionTiming.fast },
};

export const riseIn: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: motionTiming.base },
  exit: { opacity: 0, y: 12, transition: motionTiming.fast },
};

export const panelIn: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: motionTiming.base },
  exit: { opacity: 0, y: 10, scale: 0.98, transition: motionTiming.fast },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -24, scale: 0.98 },
  show: { opacity: 1, x: 0, scale: 1, transition: motionTiming.base },
  exit: { opacity: 0, x: -18, scale: 0.98, transition: motionTiming.fast },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24, scale: 0.98 },
  show: { opacity: 1, x: 0, scale: 1, transition: motionTiming.base },
  exit: { opacity: 0, x: 18, scale: 0.98, transition: motionTiming.fast },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.04,
    },
  },
};

export const cardIn: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: motionTiming.base },
  exit: { opacity: 0, y: 12, scale: 0.98, transition: motionTiming.fast },
};

export const pressMotion = {
  whileTap: { scale: 0.97 },
};
