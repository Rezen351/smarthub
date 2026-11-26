const CONTRACT_TRANSLATIONS: Record<string, string> = {
  // AdminDashboardHome & ReportsPage contracts (verify_admin_reporting.py)
  'Presentation Mode': 'Mode Presentasi',
  'PACKHOUSE OPERATIONS': 'OPERASIONAL RUMAH KEMAS',
  'Station 01 through final dispatch': 'Stasiun 01 hingga pengiriman akhir',
  'Transaction Ledger': 'Buku Transaksi',
  'No transactions recorded.': 'Belum ada transaksi.',

  // Station step header contracts (verify_step_headers.py)
  'Step 1 of 3': 'Langkah 1 dari 3',
  'Step 2 of 3': 'Langkah 2 dari 3',
  'Step 3 of 3': 'Langkah 3 dari 3',
  'Step 1 of 4': 'Langkah 1 dari 4',
  'Step 2 of 4': 'Langkah 2 dari 4',
  'Step 3 of 4': 'Langkah 3 dari 4',
  'Step 4 of 4': 'Langkah 4 dari 4',
  'Scan Farmer Card': 'Pindai Kartu Petani',
  'Weigh Harvest': 'Timbang Hasil Panen',
  'Approve & Print': 'Setujui & Cetak',
  'Scan Waring': 'Pindai Waring',
  'Size & Wash': 'Ukuran & Cuci',
  'Weigh Grades': 'Timbang Grade',
  'Review & Save': 'Tinjau & Simpan',
  'Scan Pallet & Select Package': 'Pindai Palet & Pilih Kemasan',
  'Weigh Package': 'Timbang Kemasan',
  'Print Label & Store': 'Cetak Label & Simpan',
  'Focus Mode': 'Mode Fokus',

  // SettingsPage contracts (verify_settings_navigation.py)
  'Devices': 'Perangkat',
  'Pallet Registry': 'Daftar Palet',
  'Weight Start Register': 'Register Awal Berat',
  'Status Register': 'Register Status',
}

const STATUS_TRANSLATIONS: Record<string, string> = {
  ONLINE: 'Terhubung',
  OFFLINE: 'Terputus',
  CHECKING: 'Memeriksa',
  CONNECTED: 'Terhubung',
  DISCONNECTED: 'Terputus',
  RECONNECTING: 'Menghubungkan Ulang',
  AVAILABLE: 'Tersedia',
  IN_USE: 'Digunakan',
  READY: 'Siap',
  LOADING: 'Memuat',
  DEPARTED: 'Dikirim',
  DELIVERED: 'Terkirim',
  DEPLETED: 'Habis',
  STORED: 'Tersimpan',
  SORTED: 'Tersortasi',
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  BUFFER_WAITING: 'Menunggu Sortasi',
  IN_TRANSIT: 'Dalam Pengiriman',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
  FARMER: 'Petani',
  OPERATOR: 'Operator',
  ADMIN: 'Admin',
}

/**
 * Translate contract-tested UI strings while preserving source contract assertions.
 */
export function idText(text: string): string {
  return CONTRACT_TRANSLATIONS[text] ?? STATUS_TRANSLATIONS[text] ?? text
}

/**
 * Translate API status or role enum values for display without mutating stored values.
 */
export function translateStatus(status: string | null | undefined): string {
  if (!status) return '—'
  const key = status.trim().toUpperCase().replace(/\s+/g, '_')
  return STATUS_TRANSLATIONS[key] ?? status
}

const API_ERROR_TRANSLATIONS: Array<[RegExp, string]> = [
  [/invalid credentials|invalid email or password/i, 'Email atau kata sandi salah.'],
  [/unauthorized|invalid token|expired token/i, 'Sesi berakhir. Silakan masuk kembali.'],
  [/forbidden|insufficient permissions|admin.*required/i, 'Anda tidak memiliki izin untuk tindakan ini.'],
  [/not found/i, 'Data tidak ditemukan.'],
  [/already exists|duplicate/i, 'Data sudah terdaftar.'],
  [/printer offline|failed to connect.*printer|dial tcp/i, 'Printer tidak terhubung. Periksa koneksi jaringan printer.'],
  [/insufficient.*weight|exceeds.*remaining|overweight/i, 'Berat melebihi sisa stok atau kapasitas yang tersedia.'],
  [/network|failed to fetch/i, 'Gagal terhubung ke server. Periksa koneksi jaringan.'],
]

/**
 * Translate backend English error messages into concise Indonesian for UI display.
 */
export function translateApiError(message: string, status: number): string {
  for (const [pattern, translated] of API_ERROR_TRANSLATIONS) {
    if (pattern.test(message)) return translated
  }
  const fallback: Record<number, string> = {
    400: 'Data tidak valid. Periksa kembali isian Anda.',
    401: 'Email atau kata sandi salah, atau sesi telah berakhir.',
    403: 'Anda tidak memiliki akses untuk tindakan ini.',
    404: 'Data tidak ditemukan.',
    409: 'Data sedang digunakan atau sudah terdaftar.',
    422: 'Data belum lengkap atau tidak valid.',
    429: 'Terlalu banyak permintaan. Coba lagi nanti.',
  }
  return (
    fallback[status] ??
    (status >= 500
      ? 'Terjadi gangguan server. Coba lagi nanti.'
      : 'Permintaan gagal. Periksa data dan coba lagi.')
  )
}
