import { AlertTriangle, Database, KeyRound, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'
import { db, getDatabaseInfo } from '../../database/db'
import { getRecentAuditLogs } from '../../database/repositories/auditLogRepo'
import { useLicense } from '../../services/license/LicenseContext'
import { getOfflineGraceDays } from '../../services/license/licenseStorage'
import { APP_VERSION } from '../../services/license/constants'
import { refreshLicense, removeLicense } from '../../services/license/licenseService'
import { formatDateTime } from '../../utils/dates'

export default function SettingsPage() {
  const license = useLicense()
  const toast = useToast()
  const [refreshing, setRefreshing] = useState(false)
  const [removeDialog, setRemoveDialog] = useState(false)
  const [removing, setRemoving] = useState(false)

  const info = useLiveQuery(async () => {
    const [installedSetting, graceDays, logs, database] = await Promise.all([
      db.settings.get('app.installedAt'),
      getOfflineGraceDays(),
      getRecentAuditLogs(10),
      getDatabaseInfo(),
    ])
    return { installedAt: installedSetting?.value ?? null, graceDays, logs, database }
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const payload = await refreshLicense()
      await license.refresh()
      toast.push(`Lisensi diperiksa ulang untuk ${payload.email}.`)
    } catch (error) {
      toast.push(error?.message ?? 'Pemeriksaan lisensi gagal.', { tone: 'error' })
    } finally {
      setRefreshing(false)
    }
  }

  async function handleDevModeChange(enabled) {
    try {
      await license.updateDevMode(enabled)
      toast.push(
        enabled
          ? 'Mode pengembangan aktif. Aplikasi terbuka tanpa lisensi sah.'
          : 'Mode pengembangan dimatikan.',
        { tone: enabled ? 'info' : 'success' },
      )
    } catch (error) {
      toast.push(error?.message ?? 'Pengaturan mode pengembangan gagal disimpan.', { tone: 'error' })
    }
  }

  async function handleRemoveLicense() {
    setRemoving(true)
    try {
      await removeLicense()
      await license.refresh()
      setRemoveDialog(false)
      toast.push('Lisensi dihapus dari perangkat ini.', { tone: 'info' })
    } catch (error) {
      toast.push(error?.message ?? 'Lisensi gagal dihapus.', { tone: 'error' })
    } finally {
      setRemoving(false)
    }
  }

  const statusTone =
    license.status?.state === 'active'
      ? 'green'
      : license.status?.state === 'offline_grace'
        ? 'amber'
        : license.status?.state === 'dev_mode'
          ? 'amber'
          : 'red'

  return (
    <>
      <PageHeader
        title="Pengaturan"
        description="Status lisensi, informasi aplikasi, dan catatan perubahan penting. Backup, pemulihan, dan pemeriksaan konsistensi data tersedia di menu Backup & Data."
      />

      <div className="stack">
        <Card>
          <CardHeader
            title="Lisensi aplikasi"
            subtitle="Satu lisensi untuk satu unit usaha pada satu perangkat"
            icon={ShieldCheck}
            action={<Badge tone={statusTone}>{license.status?.label ?? 'Memeriksa'}</Badge>}
          />
          <CardBody>
            {license.error ? (
              <div className="alert alert--danger" style={{ marginBottom: 14 }}>
                <AlertTriangle size={17} />
                <div>
                  <strong>Bukti lisensi bermasalah.</strong>
                  <p>{license.error}</p>
                </div>
              </div>
            ) : null}

            <dl className="info-list">
              <div>
                <dt>Email pembeli</dt>
                <dd>{license.payload?.email ?? (license.devMode ? 'Mode pengembangan' : '-')}</dd>
              </div>
              <div>
                <dt>ID lisensi</dt>
                <dd>{license.payload?.licenseId ?? '-'}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{license.status?.label ?? '-'}</dd>
              </div>
              <div>
                <dt>Berlaku sampai</dt>
                <dd>{license.status?.expiresAt ? formatDateTime(license.status.expiresAt) : 'Tanpa batas waktu'}</dd>
              </div>
              <div>
                <dt>Pemeriksaan online terakhir</dt>
                <dd>{license.record?.lastVerifiedAt ? formatDateTime(license.record.lastVerifiedAt) : '-'}</dd>
              </div>
              <div>
                <dt>Sisa toleransi offline</dt>
                <dd>
                  {license.status?.daysLeft != null
                    ? `${license.status.daysLeft} dari ${license.status.graceDays} hari`
                    : `${info?.graceDays ?? 30} hari (belum aktif)`}
                </dd>
              </div>
            </dl>

            <div className="row" style={{ marginTop: 18 }}>
              <Button
                variant="secondary"
                icon={RefreshCw}
                loading={refreshing}
                onClick={handleRefresh}
                disabled={!license.payload}
              >
                Periksa ulang lisensi
              </Button>
              <Link to="/aktivasi" className="btn btn--ghost">
                <KeyRound size={16} aria-hidden="true" />
                Halaman aktivasi
              </Link>
              {license.payload ? (
                <Button variant="ghost" icon={Trash2} onClick={() => setRemoveDialog(true)}>
                  Hapus lisensi perangkat ini
                </Button>
              ) : null}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Mode pengembangan" icon={AlertTriangle} />
          <CardBody>
            <label className="switch-row">
              <div>
                <strong style={{ fontSize: 13.5 }}>Buka aplikasi tanpa lisensi sah</strong>
                <p>
                  Hanya untuk pengembangan dan pengujian. Aplikasi akan menampilkan penanda mode pengembangan
                  di seluruh halaman. Matikan sebelum aplikasi dipakai untuk usaha nyata.
                </p>
              </div>
              <span className="switch">
                <input
                  type="checkbox"
                  checked={license.devMode}
                  onChange={(event) => handleDevModeChange(event.target.checked)}
                  aria-label="Aktifkan mode pengembangan"
                />
                <span className="switch__track" aria-hidden="true" />
              </span>
            </label>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Informasi aplikasi dan basis data" icon={Database} />
          <CardBody>
            <dl className="info-list">
              <div>
                <dt>Nama aplikasi</dt>
                <dd>UMKM SMART</dd>
              </div>
              <div>
                <dt>Versi aplikasi</dt>
                <dd>{APP_VERSION}</dd>
              </div>
              <div>
                <dt>Nama basis data lokal</dt>
                <dd>{info?.database?.name ?? '-'}</dd>
              </div>
              <div>
                <dt>Versi skema database</dt>
                <dd>v{info?.database?.version ?? '-'}</dd>
              </div>
              <div>
                <dt>Jumlah tabel</dt>
                <dd>{info?.database?.tables?.length ?? '-'} tabel</dd>
              </div>
              <div>
                <dt>Aplikasi pertama dipasang</dt>
                <dd>{info?.installedAt ? formatDateTime(info.installedAt) : '-'}</dd>
              </div>
            </dl>

            <div className="alert alert--warning" style={{ marginTop: 16 }}>
              <AlertTriangle size={17} />
              <div>
                <strong>Data hanya ada di browser perangkat ini.</strong>
                <p>
                  Menghapus data browser, memakai mode privat, atau berpindah perangkat membuat data tidak
                  terbaca. Unduh cadangan secara berkala dan simpan di tempat aman.
                </p>
                <Link to="/backup" className="btn btn--secondary" style={{ marginTop: 10 }}>
                  <Database size={16} aria-hidden="true" />
                  Buka Backup & Data
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Audit log terbaru" subtitle="Catatan perubahan penting pada aplikasi" icon={ShieldCheck} />
          <CardBody>
            {!info ? (
              <p className="muted">Memuat catatan...</p>
            ) : info.logs.length === 0 ? (
              <p className="muted">Belum ada catatan perubahan.</p>
            ) : (
              <ul className="log-list">
                {info.logs.map((log) => (
                  <li className="log-item" key={log.id}>
                    <span>{log.description}</span>
                    <span className="log-item__time">{formatDateTime(log.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={removeDialog}
        title="Hapus lisensi dari perangkat ini?"
        description="Lisensi akan dihapus dari perangkat ini. Anda perlu mengaktifkan ulang dengan email dan token, dan mungkin memerlukan persetujuan administrator untuk memindahkan perangkat. Data usaha tidak dihapus."
        confirmLabel="Hapus lisensi"
        loading={removing}
        onConfirm={handleRemoveLicense}
        onCancel={() => setRemoveDialog(false)}
      />
    </>
  )
}
