/**
 * PDF del diario de reparaciones de un coche, en blanco y negro (se imprime bien y sirve para enseñarlo al venderlo).
 * Se genera en el navegador: las reparaciones no salen del dispositivo, tampoco las del modo invitado.
 */
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'

import type { MaintenancePlan, Repair, VehicleSpec } from '../../api/types.ts'
import { engineLabel, normalizeText } from '../../lib/vehicle.ts'
import { formatKm } from '../report/health.ts'
import { formatDate, formatPrice, isoDate, typeLabel } from './diary.ts'

const MARGIN = 16
const BLACK = 0
const DARK = 60
const GREY = 110
const LINE = 170
const SHADE = 238

/** Construye el PDF. `repairs`: las de este coche, de la más reciente a la más antigua. */
export function buildRepairPdf(vehicle: VehicleSpec, repairs: Repair[], plan: MaintenancePlan | null, now: Date): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const width = doc.internal.pageSize.getWidth()
  const right = width - MARGIN
  doc.setProperties({ title: `Historial de reparaciones · ${vehicle.brand} ${vehicle.model} (${vehicle.year})`, creator: 'MecanicAI' })

  // Cabecera: logotipo (tapacubos con la M) y fecha
  doc.setFillColor(BLACK, BLACK, BLACK)
  doc.circle(MARGIN + 6, 22, 6, 'F')
  doc.setDrawColor(255)
  doc.setLineWidth(0.5)
  doc.circle(MARGIN + 6, 22, 4.6, 'S')
  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('M', MARGIN + 6, 22, { align: 'center', baseline: 'middle' })

  doc.setTextColor(BLACK)
  doc.setFontSize(20)
  doc.text('MecanicAI', MARGIN + 15, 21)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(DARK)
  doc.text('Historial de reparaciones', MARGIN + 15, 26.5)
  doc.setFontSize(9)
  doc.setTextColor(GREY)
  doc.text(`Generado el ${formatDate(isoDate(now))}`, right, 21, { align: 'right' })

  doc.setDrawColor(BLACK)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, 32, right, 32)

  // El coche
  doc.setTextColor(GREY)
  doc.setFontSize(8)
  doc.text('VEHÍCULO', MARGIN, 40)
  doc.setTextColor(BLACK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(`${vehicle.brand} ${vehicle.model}`, MARGIN, 47)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(DARK)
  const engine = engineLabel(vehicle)
  doc.text(`Año ${vehicle.year}${engine ? ` · ${engine}` : ''}`, MARGIN, 53)

  // Resumen
  const total = repairs.reduce((sum, r) => sum + (r.priceCents ?? 0), 0)
  const oldest = repairs[repairs.length - 1]
  const facts: [string, string][] = [
    ['Reparaciones', String(repairs.length)],
    ['Gasto total', formatPrice(total)],
    ['Últimos km', formatKm(Math.max(...repairs.map((r) => r.km)))],
    ['Periodo', oldest.date === repairs[0].date ? formatDate(oldest.date) : `${formatDate(oldest.date)} – ${formatDate(repairs[0].date)}`],
  ]
  const boxTop = 59
  const boxHeight = 16
  const cell = (right - MARGIN) / facts.length
  doc.setDrawColor(LINE)
  doc.setLineWidth(0.3)
  doc.setFillColor(SHADE, SHADE, SHADE)
  doc.rect(MARGIN, boxTop, right - MARGIN, boxHeight, 'FD')
  facts.forEach(([label, value], i) => {
    const x = MARGIN + cell * i + 4
    if (i > 0) doc.line(MARGIN + cell * i, boxTop + 3, MARGIN + cell * i, boxTop + boxHeight - 3)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(GREY)
    doc.text(label.toUpperCase(), x, boxTop + 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(i === 3 ? 8.5 : 11)
    doc.setTextColor(BLACK)
    doc.text(doc.splitTextToSize(value, cell - 6) as string[], x, boxTop + 11.5)
  })

  // Las reparaciones: cada una con lo que se hizo y, debajo, sus observaciones
  autoTable(doc, {
    startY: boxTop + boxHeight + 8,
    margin: { left: MARGIN, right: MARGIN, top: 20, bottom: 18 },
    head: [['Fecha', 'Km', 'Trabajos realizados', 'Taller', 'Precio']],
    body: repairs.map((r) => [
      formatDate(r.date),
      formatKm(r.km),
      r.types.map((id) => typeLabel(id, plan)).join(', ') + (r.notes ? `\n\nObservaciones: ${r.notes}` : ''),
      r.workshop ?? '—',
      r.priceCents !== null ? formatPrice(r.priceCents) : '—',
    ]),
    foot: [['', '', '', 'Total', formatPrice(total)]],
    showFoot: 'lastPage',
    rowPageBreak: 'avoid',
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, textColor: BLACK, lineColor: LINE, lineWidth: 0.2, cellPadding: 2.2, valign: 'top' },
    headStyles: { fillColor: BLACK, textColor: 255, fontStyle: 'bold', lineColor: BLACK },
    footStyles: { fillColor: SHADE, textColor: BLACK, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: 248 },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 24, halign: 'right' },
      3: { cellWidth: 34 },
      4: { cellWidth: 24, halign: 'right' },
    },
    // Los títulos de las columnas de números, alineados como sus números
    didParseCell: (data) => {
      if (data.section !== 'body' && (data.column.index === 1 || data.column.index === 4)) data.cell.styles.halign = 'right'
    },
  })

  // Pie de cada página
  const pages = doc.getNumberOfPages()
  const height = doc.internal.pageSize.getHeight()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setDrawColor(LINE)
    doc.setLineWidth(0.3)
    doc.line(MARGIN, height - 12, right, height - 12)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(GREY)
    doc.text('MecanicAI · Datos apuntados por el propietario del vehículo; MecanicAI no los comprueba.', MARGIN, height - 8)
    doc.text(`Página ${page} de ${pages}`, right, height - 8, { align: 'right' })
  }
  return doc
}

/** "historial-reparaciones-seat-leon-2015.pdf" */
export function pdfFileName(vehicle: VehicleSpec): string {
  const slug = normalizeText(`${vehicle.brand} ${vehicle.model} ${vehicle.year}`)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `historial-reparaciones-${slug}.pdf`
}

/** Genera el PDF y lo descarga. */
export function downloadRepairPdf(vehicle: VehicleSpec, repairs: Repair[], plan: MaintenancePlan | null): void {
  buildRepairPdf(vehicle, repairs, plan, new Date()).save(pdfFileName(vehicle))
}
