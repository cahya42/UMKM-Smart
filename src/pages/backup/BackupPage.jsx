import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  HardDriveDownload,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { Card, CardBody, CardHeader, StatCard } from '../../components/ui/Card'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import PageHeader from '../../components/ui/PageHeader'
import { Field } from '../../components/ui/Field'
import { useToast } from '../../components/ui/Toast'
import { getDatabaseInfo } from '../../database/db'
import {
  downloadBackup,
  downloadPayload,
  getLocalBackup,
  listLocalBackups,
  restoreBackup,
  restoreLocalBackup,
  validateBackupPayload,
} from '../../services/backup/backupService'
import { runConsistencyCheck } from '../../services/backup/consistency'
import { formatDateTime } from '../../utils/dates'
import { formatNumber } from '../../utils/money'

function formatBytes(bytes) {
  const size = Number(bytes || 0)
  if (size <= 0) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(2)} MB`
}

function formatCounts(counts) {
  return Object.entries(counts ?? {})
    .filter(([, value]) => Number(value) > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => `${name}: ${formatNumber(value)}`)
    .join(' · ')
}

export default function BackupPage() {
  const toast = useToast()
  const fileInputRef = useRef(null)

  const [downloading, setDownloading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [filePreview, setFilePreview] = useState(null)
  const [restoreTarget, setRestoreTarget] = useState(null)
  const [confirmText, setConfirmText] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState(null)

  const data = useLiveQuery(async () => {
    const [backups, database] = await Promise.all([listLocalBackups(), getDatabaseInfo()])
    return { backups, database }
  }, [])

  async function handleDownload() {
    setDownloading(true)
    try {
      const payload = await downloadBackup()
      toast.push(
        `Cadangan ${payload.counts ? Object.values(payload.counts).reduce((sum, value) => sum + value, 0) : 0} baris diunduh dan disimpan lokal.`,
      )
    } catch (error) {
      toast.push(error?.message ?? 'Cadangan gagal dibuat.', { tone: 'error' })
    } finally {
      setDownloading(false)
    }
  }

  async function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setValidating(true)
    setFilePreview(null)
    try {
      const text = await file.text()
      const result = await validateBackupPayload(text)
      setFilePreview({ ...result, fileName: file.name })
      if (!result.ok) {
        toast.push(result.errors[0] ?? 'Berkas cadangan tidak valid.', { tone: 'error' })
      }
    } catch (error) {
      toast.push(error?.message ?? 'Berkas tidak dapat dibaca.', { tone: 'error' })
    } finally {
      setValidating(false)
    }
  }

  function openRestore(payload, label, localId = null) {
    setRestoreTarget({ payload, label, localId })
    setConfirmText('')
  }

  async function handleRestore() {
    if (!restoreTarget) return
    if (confirmText.trim().toUpperCase() !== 'PULIHKAN') {
      toast.push('Ketik PULIHKAN untuk mengonfirmasi pemulihan.', { tone: 'error' })
      return
    }

    setRestoring(true)
    try {
      const summary = restoreTarget.localId
        ? await restoreLocalBackup(restoreTarget.localId)
        : await restoreBackup(restoreTarget.payload)

      toast.push('Data berhasil dipulihkan dari cadangan.')
      setRestoreTarget(null)
      setFilePreview(null)
      setCheckResult(null)
      if (summary) {
        toast.push(`Dipulihkan: ${formatCounts(summary.counts)}`, { tone: 'info' })
      }
    } catch (error) {
      toast.push(error?.message ?? 'Pemulihan gagal.', { tone: 'error' })
    } finally {
      setRestoring(false)
    }
  }

  async function handleCheck() {
    setChecking(true)
    try {
      const result = await runConsistencyCheck()
      setCheckResult(result)
      if (result.issues.length === 0) {
        toast.push('Pemeriksaan selesai: tidak ditemukan ketidaksesuaian.')
      } else {
        toast.push(
          `Pemeriksaan selesai: ${result.errorCount} error dan ${result.warningCount} peringatan.`,
          { tone: 'info' },
        )
      }
    } catch (error) {
      toast.push(error?.message ?? 'Pemeriksaan data gagal.', { tone: 'error' })
    } finally {
      setChecking(false)
    }
  }

  async function handleDownloadLocal(id) {
    try {
      const backup = await getLocalBackup(id)
      if (!backup) throw new Error('Cadangan lokal tidak ditemukan.')
      downloadPayload(backup.payload)
    } catch (error) {
      toast.push(error?.message ?? 'Cadangan gagal diunduh.', { tone: 'error' })
    }
  }

  const totalRows = filePreview?.summary?.total ?? 0

  return (
    <>
      <PageHeader
        title="Backup & Data"
        description="Cadangkan seluruh data usaha ke satu berkas, pulihkan dengan validasi ketat, dan periksa konsistensi stok, penjualan, kas, serta HPP."
      />

      <div className="stat-grid">
        <StatCard
          label="Cadangan lokal"
          value={`${data?.backups?.length ?? 0} berkas`}
          hint="Maksimal 2 cadangan terbaru disimpan di perangkat"
          icon={HardDriveDownload}
        />
        <StatCard
          label="Versi skema"
          value={`v${data?.database?.version ?? '-'}`}
          hint={`${data?.database?.tables?.length ?? 0} tabel`}
          icon={Database}
        />
        <StatCard
          label="Cadangan terakhir"
          value={data?.backups?.[0] ? formatDateTime(data.backups[0].createdAt) : '-'}
          hint={data?.backups?.[0]?.reason ?? 'Belum ada cadangan'}
          icon={ShieldCheck}
        />
      </div>

      <div className="grid grid--sidebar">
        <div className="stack">
          <Card>
            <CardHeader
              title="Ekspor cadangan"
              subtitle="Seluruh tabel data usaha dalam satu berkas JSON berversi dan ber-checksum"
              icon={Download}
            />
            <CardBody>
              <p className="muted">
                Simpan berkas ini di tempat aman (flashdisk, folder laptop, atau penyimpanan pribadi). Data
                lisensi perangkat tidak disertakan. Cadangan juga disimpan otomatis di perangkat ini agar bisa
                dipulihkan tanpa berkas.
              </p>
              <div className="form-actions">
                <Button icon={Download} loading={downloading} onClick={handleDownload}>
                  Unduh cadangan
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Pulihkan dari berkas" subtitle="Berkas akan divalidasi sebelum dipakai" icon={Upload} />
            <CardBody>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFile}
                aria-label="Pilih berkas cadangan"
                style={{ display: 'none' }}
              />
              <div className="form-actions">
                <Button
                  variant="secondary"
                  icon={Upload}
                  loading={validating}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Pilih berkas cadangan
                </Button>
              </div>

              {filePreview && !filePreview.ok ? (
                <div className="alert alert--danger" style={{ marginTop: 14 }}>
                  <AlertTriangle size={17} />
                  <div>
                    <strong>Berkas tidak dapat dipulihkan</strong>
                    <ul style={{ margin: '6px 0 0 18px' }}>
                      {filePreview.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              {filePreview?.ok ? (
                <div style={{ marginTop: 14 }}>
                  <div className="alert alert--success">
                    <CheckCircle2 size={17} />
                    <div>
                      <strong>Berkas valid</strong>
                      <p>
                        {filePreview.fileName} · dibuat {formatDateTime(filePreview.summary.createdAt)} ·{' '}
                        {formatNumber(totalRows)} baris data
                      </p>
                    </div>
                  </div>
                  <dl className="info-list" style={{ marginTop: 12 }}>
                    <div>
                      <dt>Versi aplikasi</dt>
                      <dd>{filePreview.summary.appVersion ?? '-'}</dd>
                    </div>
                    <div>
                      <dt>Versi skema</dt>
                      <dd>v{filePreview.summary.schemaVersion ?? '-'}</dd>
                    </div>
                    <div>
                      <dt>Isi data</dt>
                      <dd>{formatCounts(filePreview.summary.counts) || 'Tidak ada data'}</dd>
                    </div>
                  </dl>
                  <div className="form-actions">
                    <Button
                      icon={RotateCcw}
                      onClick={() =>
                        openRestore(filePreview.payload, `Berkas ${filePreview.fileName}`)
                      }
                    >
                      Pulihkan data ini
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Cadangan lokal" subtitle="Dibuat otomatis sebelum pemulihan atau saat mengunduh" icon={HardDriveDownload} />
            <CardBody>
              {!data ? (
                <p className="muted">Memuat cadangan...</p>
              ) : data.backups.length === 0 ? (
                <p className="muted">Belum ada cadangan lokal.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table table--right">
                    <thead>
                      <tr>
                        <th>Waktu</th>
                        <th>Keterangan</th>
                        <th>Data</th>
                        <th>Ukuran</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.backups.map((backup) => (
                        <tr key={backup.id}>
                          <td>{formatDateTime(backup.createdAt)}</td>
                          <td className="muted">{backup.reason}</td>
                          <td className="num">{formatNumber(backup.total)} baris</td>
                          <td className="num">{formatBytes(backup.size)}</td>
                          <td>
                            <div className="row-actions">
                              <button
                                type="button"
                                className="icon-button icon-button--sm"
                                title="Unduh"
                                aria-label={`Unduh cadangan ${backup.createdAt}`}
                                onClick={() => handleDownloadLocal(backup.id)}
                              >
                                <Download size={15} />
                              </button>
                              <button
                                type="button"
                                className="icon-button icon-button--sm"
                                title="Pulihkan"
                                aria-label={`Pulihkan cadangan ${backup.createdAt}`}
                                onClick={async () => {
                                  const full = await getLocalBackup(backup.id)
                                  if (full) openRestore(full.payload, `Cadangan lokal ${formatDateTime(backup.createdAt)}`, backup.id)
                                }}
                              >
                                <RotateCcw size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHeader title="Pemeriksaan konsistensi" subtitle="Hanya membaca, tidak mengubah data" icon={ShieldCheck} />
            <CardBody>
              <Button variant="secondary" icon={RefreshCw} loading={checking} onClick={handleCheck}>
                Periksa konsistensi data
              </Button>

              {checkResult ? (
                <div style={{ marginTop: 14 }}>
                  <div className="row" style={{ marginBottom: 10 }}>
                    <Badge tone={checkResult.errorCount > 0 ? 'red' : 'green'}>
                      {checkResult.errorCount} error
                    </Badge>
                    <Badge tone={checkResult.warningCount > 0 ? 'amber' : 'gray'}>
                      {checkResult.warningCount} peringatan
                    </Badge>
                  </div>

                  {checkResult.issues.length === 0 ? (
                    <div className="alert alert--success">
                      <CheckCircle2 size={17} />
                      <div>
                        <strong>Tidak ditemukan ketidaksesuaian.</strong>
                        <p>
                          Diperiksa: {formatNumber(checkResult.stats.products)} produk,{' '}
                          {formatNumber(checkResult.stats.sales)} nota,{' '}
                          {formatNumber(checkResult.stats.expenses)} pengeluaran,{' '}
                          {formatNumber(checkResult.stats.cashTransactions)} mutasi kas.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <ul className="activity-list">
                      {checkResult.issues.map((issue) => (
                        <li className="activity-item" key={issue.id}>
                          <div className="activity-item__body">
                            <p className="activity-item__title">{issue.title}</p>
                            <p className="activity-item__meta">{issue.description}</p>
                            {issue.samples.length > 0 ? (
                              <p className="activity-item__meta" style={{ marginTop: 4 }}>
                                Contoh: {issue.samples.join('; ')}
                              </p>
                            ) : null}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <Badge tone={issue.severity === 'error' ? 'red' : 'amber'}>
                              {issue.severity === 'error' ? 'Error' : 'Peringatan'}
                            </Badge>
                            <p className="activity-item__meta" style={{ marginTop: 4 }}>
                              {formatNumber(issue.count)} data
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="form-note" style={{ marginTop: 10 }}>
                  Memeriksa stok vs kartu stok, total nota vs item, kas vs transaksi, data yatim, nomor nota
                  ganda, dan HPP vs komponennya.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Sebelum memulihkan" icon={AlertTriangle} />
            <CardBody>
              <p className="muted">
                Pemulihan menimpa seluruh data usaha saat ini. Aplikasi otomatis membuat cadangan
                “sebelum pemulihan” terlebih dahulu, sehingga tindakan ini masih bisa dibatalkan. Lisensi
                perangkat tidak berubah.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        title="Pulihkan data dari cadangan?"
        description={
          restoreTarget
            ? `Seluruh data usaha saat ini akan diganti dengan ${restoreTarget.label}. Cadangan otomatis data saat ini dibuat lebih dulu. Ketik PULIHKAN untuk melanjutkan.`
            : ''
        }
        confirmLabel="Pulihkan data"
        loading={restoring}
        onConfirm={handleRestore}
        onCancel={() => setRestoreTarget(null)}
      >
        <Field label="Konfirmasi" htmlFor="restoreConfirm" required hint="Ketik PULIHKAN (huruf besar).">
          <input
            id="restoreConfirm"
            className="input"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder="PULIHKAN"
          />
        </Field>
      </ConfirmDialog>
    </>
  )
}
