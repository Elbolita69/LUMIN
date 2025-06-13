import * as XLSX from "xlsx"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

interface ReportData {
  id: string
  estado: string
  problema: string
  fechaReporte: string
  horaReporte: string
  fechaSolucion: string
  horaSolucion: string
  tiempoInactividad: string
  coordenadas: string
}

/**
 * Genera un reporte en formato Excel con los datos de las luminarias
 * @param data Datos para el reporte
 */
export async function generateExcelReport(data: ReportData[]): Promise<void> {
  // Crear un libro de trabajo
  const wb = XLSX.utils.book_new()

  // Crear una hoja de trabajo con los datos
  const ws = XLSX.utils.json_to_sheet(data)

  // Añadir la hoja al libro
  XLSX.utils.book_append_sheet(wb, ws, "Luminarias")

  // Generar el archivo Excel y descargarlo
  XLSX.writeFile(wb, `Reporte_Luminarias_${new Date().toISOString().split("T")[0]}.xlsx`)
}

/**
 * Genera un reporte en formato PDF con los datos de las luminarias
 * @param data Datos para el reporte
 */
export async function generatePdfReport(data: ReportData[]): Promise<void> {
  // Crear un nuevo documento PDF
  const doc = new jsPDF()

  // Añadir título
  doc.setFontSize(18)
  doc.text("Reporte de Luminarias", 14, 22)

  // Añadir fecha
  doc.setFontSize(11)
  doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 30)

  // Preparar datos para la tabla
  const tableColumn = ["ID", "Estado", "Problema", "Fecha Reporte", "Tiempo Inactividad", "Coordenadas"]
  const tableRows = data.map((item) => [
    item.id,
    item.estado,
    item.problema,
    `${item.fechaReporte} ${item.horaReporte !== "N/A" ? item.horaReporte : ""}`,
    item.tiempoInactividad,
    item.coordenadas,
  ])

  // Añadir tabla al documento
  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 35,
    theme: "striped",
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: 255,
    },
    styles: {
      overflow: "linebreak",
      cellWidth: "wrap",
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 20 },
      2: { cellWidth: 30 },
      3: { cellWidth: 30 },
      4: { cellWidth: 30 },
      5: { cellWidth: 40 },
    },
  })

  // Añadir resumen
  const finalY = (doc as any).lastAutoTable.finalY || 35
  doc.text(`Total de luminarias: ${data.length}`, 14, finalY + 10)

  const problemCount = data.filter((item) => item.estado !== "OK").length
  doc.text(`Luminarias con problemas: ${problemCount}`, 14, finalY + 18)

  // Guardar el PDF
  doc.save(`Reporte_Luminarias_${new Date().toISOString().split("T")[0]}.pdf`)
}
