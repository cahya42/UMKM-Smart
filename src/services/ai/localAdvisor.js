import { formatNumber, formatPercent, formatRupiah } from '../../utils/money'

/**
 * Analisis lokal tanpa AI generatif.
 *
 * Dipakai ketika proxy AI belum dikonfigurasi atau pengguna memilih tetap di
 * perangkat. Hasilnya deterministik dari angka yang sama dengan ringkasan,
 * dan selalu diberi label "analisis lokal" agar tidak disangka jawaban AI.
 */

function pushFinding(findings, text) {
  findings.push(text)
}

export function buildLocalAdvice(context) {
  const facts = context?.facts ?? {}
  const findings = []
  const recommendations = []

  if (facts.transactions === 0) {
    pushFinding(
      findings,
      'Belum ada nota penjualan selesai pada periode ini, sehingga laba dan margin belum bisa dinilai.',
    )
  } else if (facts.margin < 20) {
    pushFinding(
      findings,
      `Margin laba kotor ${formatPercent(facts.margin)} dari omzet ${formatRupiah(
        facts.omzet,
      )}; sebagian besar omzet habis untuk HPP.`,
    )
  } else {
    pushFinding(
      findings,
      `Margin laba kotor ${formatPercent(facts.margin)} dengan laba kotor ${formatRupiah(
        facts.grossProfit,
      )}.`,
    )
  }

  if (facts.netProfit < 0) {
    pushFinding(
      findings,
      `Biaya operasional ${formatRupiah(facts.operatingExpenses)} melebihi laba kotor, sehingga periode ini rugi ${formatRupiah(
        Math.abs(facts.netProfit),
      )}.`,
    )
  } else if (facts.grossProfit > 0 && facts.operatingExpenses > facts.grossProfit * 0.6) {
    pushFinding(
      findings,
      `Biaya operasional menyerap ${formatPercent(
        (facts.operatingExpenses / facts.grossProfit) * 100,
      )} dari laba kotor.`,
    )
  }

  if (facts.cashTotal < 0) {
    pushFinding(
      findings,
      `Saldo kas seluruh akun ${formatRupiah(facts.cashTotal)} (negatif): uang keluar lebih besar daripada uang masuk yang tercatat.`,
    )
  }

  if (facts.lowStock.length > 0) {
    pushFinding(
      findings,
      `${facts.lowStock.length} produk menyentuh atau melewati batas minimum stok, misalnya ${facts.lowStock[0].name}.`,
    )
  }

  if (facts.topProducts.length > 0 && facts.omzet > 0) {
    const share = (facts.topProducts[0].omzet / facts.omzet) * 100
    if (share >= 50) {
      pushFinding(
        findings,
        `Produk ${facts.topProducts[0].name} menyumbang ${formatPercent(
          share,
        )} omzet, sehingga usaha bergantung pada satu produk.`,
      )
    }
  }

  if (facts.lowestMargin.length > 0 && facts.lowestMargin[0].margin < 25) {
    pushFinding(
      findings,
      `Margin terendah ada pada ${facts.lowestMargin[0].name} (${formatPercent(
        facts.lowestMargin[0].margin,
      )}) dengan HPP ${formatRupiah(facts.lowestMargin[0].hpp)} dari harga jual ${formatRupiah(
        facts.lowestMargin[0].sellingPrice,
      )}.`,
    )
  }

  if (facts.transactions === 0) {
    recommendations.push(
      'Catat penjualan harian lebih dulu agar analisis laba, margin, dan produk terlaris punya dasar.',
    )
  } else {
    if (facts.netProfit < 0) {
      recommendations.push(
        'Tekan biaya operasional terbesar terlebih dahulu, lalu bandingkan laba bersih pada periode berikutnya.',
      )
    }
    if (facts.margin < 25) {
      recommendations.push(
        'Tinjau HPP dan harga jual produk bermargin terendah; naikkan harga secara bertahap atau cari pemasok bahan yang lebih murah.',
      )
    }
    if (facts.lowStock.length > 0) {
      recommendations.push(
        `Susun daftar belanja untuk ${facts.lowStock
          .slice(0, 3)
          .map((product) => product.name)
          .join(', ')} agar penjualan tidak terhenti.`,
      )
    }
    if (facts.topProducts.length > 0) {
      recommendations.push(
        `Fokuskan promosi pada ${facts.topProducts
          .slice(0, 2)
          .map((product) => product.name)
          .join(' dan ')} sambil menguji satu produk pendamping.`,
      )
    }
  }

  while (recommendations.length < 1) {
    recommendations.push(
      'Lengkapi pencatatan penjualan, pengeluaran, dan stok minggu ini agar analisis berikutnya lebih akurat.',
    )
  }

  const periodText = facts.periodLabel ?? context?.periodLabel ?? 'periode terpilih'
  const lines = []
  const add = (line = '') => lines.push(line)

  add('CATATAN: analisis ini dihitung aplikasi dari data lokal, bukan jawaban AI generatif.')
  add('')
  add('KONDISI USAHA')
  add(
    `Periode ${periodText}: omzet ${formatRupiah(facts.omzet)} dari ${formatNumber(
      facts.transactions,
    )} nota selesai, HPP ${formatRupiah(facts.hpp)}, laba kotor ${formatRupiah(
      facts.grossProfit,
    )} (margin ${formatPercent(facts.margin)}).`,
  )
  add(
    `Biaya operasional ${formatRupiah(facts.operatingExpenses)} sehingga ${
      facts.netProfit >= 0 ? 'laba bersih' : 'rugi bersih'
    } ${formatRupiah(Math.abs(facts.netProfit))}. Saldo kas saat ini ${formatRupiah(
      facts.cashTotal,
    )} dan nilai persediaan ${formatRupiah(facts.stockValue)}.`,
  )
  add('')
  add('TEMUAN')
  for (const finding of findings.slice(0, 5)) add(`- ${finding}`)
  add('')
  add('REKOMENDASI')
  recommendations.slice(0, 3).forEach((recommendation, index) => {
    add(`${index + 1}. ${recommendation}`)
  })
  add('')
  add('LANGKAH TINDAKAN')
  add('1. Buka menu Laporan Usaha, pilih Laba rugi, lalu catat omzet, HPP, dan biaya periode ini sebagai pembanding.')
  add('2. Periksa menu Persediaan untuk produk berstok minimum dan catat kebutuhan belanja sebelum stok habis.')
  add('3. Periksa menu Kas & Rekening; cocokkan saldo akun dengan uang yang benar-benar tersedia.')
  add('')
  add('CATATAN')
  add(
    'Angka di atas berasal dari data yang tercatat di aplikasi ini. Analisis lokal tidak mempertimbangkan faktor pasar, musim, atau kondisi di luar catatan, dan bukan jaminan hasil.',
  )

  return lines.join('\n')
}
