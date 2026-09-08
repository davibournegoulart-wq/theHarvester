"use client";

import { useActiveCase } from "@/lib/activeCase";

export default function ActiveCaseBanner() {
  const { activeCase } = useActiveCase();
  return (
    <div style={{ fontSize: 12, color: activeCase ? "var(--success)" : "var(--text-muted)", marginBottom: 16 }}>
      {activeCase ? `Caso ativo: ${activeCase.name}` : 'Nenhum caso ativo — selecione um na aba "Casos" pra salvar achados'}
    </div>
  );
}
