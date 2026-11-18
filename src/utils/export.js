/**
 * Ekspor laporan ke Excel (.xlsx) dan PDF.
 * Pustaka dimuat dinamis agar tidak memperbesar muatan awal aplikasi.
 */

function safeFileName(name) {
  return String(name || 'laporan').replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-')
}

function generatedAtLabel() {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date())
}

function summaryLines(report) {
  return (report.summary ?? []).map((item) => [item.label, item.value, item.hint ?? ''])
}

export async function exportReportToExcel(report) {
  const XLSX = await import('xlsx')
  const title = report.title ?? report.label ?? 'Laporan'

  const header = [
    [title],
    [`Periode: ${report.periodLabel}`],
    [`Dibuat: ${generatedAtLabel()}`],
    [],
    report.columns.map((column) => column.label),
  ]

  const body = report.rows.map((row) => report.columns.map((column) => row[column.key] ?? ''))
  const summaryHeader = [['Ringkasan'], ['Keterangan', 'Nilai', 'Catatan']]

  const sheet = XLSX.utils.aoa_to_sheet([
    ...header,
    ...body,
    [],
    ...summaryHeader,
    ...summaryLines(report),
  ])

  sheet['!cols'] = report.columns.map((column) => ({
    wch: Math.max(12, Math.min(40, column.label.length + 6)),
  }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Laporan')
  XLSX.writeFile(workbook, `${safeFileName(report.fileName)}.xlsx`)
}

export async function exportReportToPdf(report) {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const title = report.title ?? report.label ?? 'Laporan'

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

  doc.setFontSize(15)
  doc.text(title, 40, 42)

  doc.setFontSize(9)
  doc.setTextColor(90, 105, 96)
  doc.text(`Periode: ${report.periodLabel}`, 40, 60)
  doc.text(`Dibuat: ${generatedAtLabel()} - UMKM SMART`, 40, 74)

  autoTable(doc, {
    startY: 90,
    head: [report.columns.map((column) => column.label)],
    body: report.rows.map((row) => report.columns.map((column) => String(row[column.key] ?? ''))),
    styles: { fontSize: 8, cellPadding: 5, textColor: [20, 35, 26] },
    headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 250, 247] },
    columnStyles: Object.fromEntries(
      report.columns.map((column, index) => [index, { halign: column.align === 'right' ? 'right' : 'left' }]),
    ),
    margin: { left: 40, right: 40 },
  })

  const summary = report.summary ?? []
  if (summary.length > 0) {
    const afterTable = doc.lastAutoTable?.finalY ?? 120
    autoTable(doc, {
      startY: afterTable + 16,
      head: [['Ringkasan', 'Nilai', 'Catatan']],
      body: summary.map((item) => [item.label, item.value, item.hint ?? '']),
      styles: { fontSize: 8, cellPadding: 5 },
      headStyles: { fillColor: [22, 101, 52], textColor: 255 },
      margin: { left: 40, right: 40 },
    })
  }

  doc.setFontSize(8)
  doc.setTextColor(120, 135, 125)
  doc.text('Dihitung dari data lokal UMKM SMART.', 40, doc.internal.pageSize.getHeight() - 24)

  doc.save(`${safeFileName(report.fileName)}.pdf`)
}
