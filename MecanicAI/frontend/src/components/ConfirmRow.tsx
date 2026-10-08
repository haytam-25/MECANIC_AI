/** Confirmación en línea para borrar algo de una lista. */
export function ConfirmRow({ text, onYes, onNo }: { text: string; onYes(): void; onNo(): void }) {
  return (
    <div className="confirm-row">
      <span className="small">{text}</span>
      <button type="button" className="btn btn--danger btn--xs" onClick={onYes}>
        Borrar
      </button>
      <button type="button" className="btn btn--ghost btn--xs" onClick={onNo}>
        No
      </button>
    </div>
  )
}
