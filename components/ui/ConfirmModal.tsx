"use client"

import { useEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { X } from "lucide-react"
import { Button } from "@heroui/react"

import { SURFACE, BORDER, TEXT, MUTED } from "@/lib/theme"

// Renderiza num portal pro <body> — a animação de transição de página (motion.div
// com transform no Shell) cria um containing block novo pra elementos fixed, então
// um modal "fixed inset-0" preso dentro da árvore da página não cobre o header fixo.
function useBodyPortal() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}

export function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode
}) {
  const mounted = useBodyPortal()
  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.div
            className="relative rounded-2xl w-full max-w-md z-10 overflow-hidden"
            style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <h2 className="text-[15px] font-bold" style={{ color: TEXT }}>{title}</h2>
              <button onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-white/5" style={{ color: MUTED }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export function ConfirmModal({ open, onClose, onConfirm, title, description, confirmLabel = "Confirmar", danger = false }: {
  open: boolean; onClose: () => void; onConfirm: () => void
  title: string; description: string; confirmLabel?: string; danger?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-5">
        <p className="text-[13px] leading-relaxed" style={{ color: MUTED }}>{description}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onPress={onClose} className="font-semibold">Cancelar</Button>
          <Button variant={danger ? "danger-soft" : "primary"} size="sm" onPress={onConfirm} className="font-semibold">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
