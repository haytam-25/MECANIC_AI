/** Borrador que llega al abrir el chat desde otra pantalla: `navigate(ruta, { state: { draft } })`. */
export function draftFromState(state: unknown): string | undefined {
  const draft = (state as { draft?: unknown } | null)?.draft
  return typeof draft === 'string' ? draft : undefined
}
