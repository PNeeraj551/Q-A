import { motion, useReducedMotion } from 'framer-motion'

const ease = [0.23, 1, 0.32, 1]

export const fadeUpVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.2 } },
}

export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}

export const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease } },
}

export const modalVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 4 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.25, ease } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.15 } },
}

export const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

export function PageWrapper({ children, className }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduced ? false : 'hidden'}
      animate="visible"
      variants={fadeUpVariants}
    >
      {children}
    </motion.div>
  )
}

export function FadeUp({ children, delay, className }) {
  const reduced = useReducedMotion()
  const variants = delay
    ? {
        ...fadeUpVariants,
        visible: {
          ...fadeUpVariants.visible,
          transition: { ...fadeUpVariants.visible.transition, delay },
        },
      }
    : fadeUpVariants
  return (
    <motion.div
      className={className}
      initial={reduced ? false : 'hidden'}
      animate="visible"
      variants={variants}
    >
      {children}
    </motion.div>
  )
}

export function StaggerList({ children, className }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduced ? false : 'hidden'}
      animate="visible"
      variants={staggerContainer}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={className}
      variants={staggerItem}
      whileHover={reduced ? undefined : { y: -2 }}
    >
      {children}
    </motion.div>
  )
}
