import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { useKitStore } from '../lib/store'

export default function Toast() {
  const toast = useKitStore((s) => s.toast)
  const clearToast = useKitStore((s) => s.clearToast)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(clearToast, 3400)
    return () => clearTimeout(t)
  }, [toast, clearToast])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
            role="status"
            className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-2xl ${
              toast.kind === 'error'
                ? 'bg-cardred text-white'
                : toast.kind === 'info'
                  ? 'bg-graphite text-bone'
                  : 'bg-pitch text-white'
            }`}
          >
            {toast.kind === 'error' ? (
              <AlertTriangle size={16} aria-hidden />
            ) : toast.kind === 'info' ? (
              <Info size={16} aria-hidden />
            ) : (
              <CheckCircle2 size={16} aria-hidden />
            )}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
