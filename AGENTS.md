# 🤖 AGENTS.md — Project Rules & Agent Guidelines

Dokumen ini berisi aturan yang **wajib** diikuti saat mengembangkan, mengubah, atau meninjau kode di repositori ini. Berlaku untuk semua kontributor manusia maupun AI agent.

---

## 📚 0. Dokumentasi Proyek (Documentation Map)

Dokumen di folder `docs/` adalah **single source of truth** untuk arsitektur, keputusan, dan operasional. Agent wajib membaca dokumen yang relevan sebelum mengerjakan tugas pada domain terkait.

| Dokumen | Peran / Tanggung Jawab | Kapan dibaca/diperbarui |
|---------|------------------------|--------------------------|
| [output_diagram.md](file:///home/almuzky/E-Tani-Smart-Hub/docs/output_diagram.md) | Arsitektur sistem, workflow IoT, dan diagram alur pengemasan kentang. | Sebelum perubahan arsitektur atau sistem IoT. |
| [logs.md](file:///home/almuzky/E-Tani-Smart-Hub/logs.md) | Log harian aktivitas & keputusan teknis (wajib diupdate tiap tugas). | Update setelah setiap tugas selesai. |

---

## 🌐 1. Aturan Bahasa (Language Rule)

**Semua teks antarmuka (UI) dan seluruh respons dari API harus menggunakan Bahasa Inggris (English).**

1. **Frontend (Web App)**: Semua label, judul, tombol, placeholder, pesan error, dan teks statis di UI wajib berbahasa Inggris.
2. **API Responses (Backend)**: Semua pesan respons API — termasuk `message`, `error`, `description`, validasi field, dan status — wajib menggunakan Bahasa Inggris.
3. **Dokumentasi API**: Contoh dan deskripsi endpoint menggunakan Bahasa Inggris agar konsisten dengan respons aktual.

---

## 🛠️ 2. Alur Kerja Terstruktur (Structured Workflow)

### 2.1 Fase Perencanaan
Sebelum melakukan modifikasi kode yang bersifat kompleks:
1. Riset & pahami arsitektur sistem di [output_diagram.md](file:///home/almuzky/E-Tani-Smart-Hub/docs/output_diagram.md).
2. Buat rencana implementasi langkah demi langkah sebelum eksekusi.

### 2.2 Fase Pelacakan Tugas
1. Gunakan format to-do list untuk melacak progress: `[ ]` belum dimulai, `[/]` in progress, `[x]` selesai.
2. Pecah tugas besar menjadi sub-tugas yang lebih kecil dan terukur.

### 2.3 Fase Verifikasi
1. Verifikasi kode secara lokal sebelum melaporkan selesai.
2. Wajib tambah/update test case untuk fitur baru.
3. Dokumentasikan hasil pengujian di [logs.md](file:///home/almuzky/E-Tani-Smart-Hub/logs.md).

---

## 📝 3. Aturan Pencatatan & Dokumentasi (Logging & Documentation)

1. **Update logs.md**: Setiap kali menyelesaikan sebuah tugas, wajib memperbarui [logs.md](file:///home/almuzky/E-Tani-Smart-Hub/logs.md) menggunakan tabel Markdown.
2. **Gunakan Status yang Konsisten**:
   - `✅` untuk aktivitas yang sudah selesai (Done)
   - `🟡` untuk aktivitas yang sedang berjalan (In Progress)
   - `❌` untuk aktivitas yang terhambat (Blocked)
   - `📝` untuk catatan penting/issues tambahan
3. **Keputusan Teknis**: Jika membuat keputusan arsitektural penting, tambahkan baris baru ke tabel **Keputusan Teknis** di `logs.md`.

---

## 🏗️ 4. Konsistensi Arsitektur & Pola Kode (Architectural Consistency)

1. **Database Isolation**: Setiap layer/modul wajib menggunakan database atau storage yang sesuai. Dilarang melakukan query langsung lintas modul. Komunikasi data antar komponen wajib melalui API atau Event Bus (MQTT).
2. **Struktur Direktori**: Ikuti struktur standar yang ada di proyek. Setiap modul/komponen wajib memiliki folder yang jelas untuk model, logic, dan handler.
3. **Manajemen Environment Variables**: Setiap variabel lingkungan (env) baru wajib dideklarasikan di `.env.example` beserta deskripsi/default value-nya. Dilarang hardcode kredensial, token, atau port.
4. **Standardisasi API Response Wrapper**:
   - Respons Sukses (2xx): `{ "success": true, "data": <payload/array/object> }`.
   - Respons Error (4xx/5xx): `{ "success": false, "error": { "code": "<KODE_ERROR>", "message": "<pesan_error_dalam_bahasa_inggris>" } }`.
5. **Manajemen Migrasi Database**: Setiap perubahan skema database wajib dikelola menggunakan sistem migrasi. Dilarang modifikasi skema database secara manual.
6. **MQTT Topic Convention**: Semua topic MQTT harus mengikuti format yang konsisten (misal: `etani/<area>/<tipe_data>`). Dokumentasikan topic yang digunakan di [output_diagram.md](file:///home/almuzky/E-Tani-Smart-Hub/docs/output_diagram.md) jika ada perubahan.

---

## 🔒 5. Keamanan Kode (Security Guidelines)

1. **Rahasia & Kredensial**: Dilarang melakukan commit terhadap file `.env`, key file, atau file berisi kredensial sensitif ke repositori Git.
2. **Input Validation**: Lakukan validasi dan sanitasi input pada semua endpoint API untuk mencegah SQL Injection, XSS, dan serangan injeksi lainnya.
3. **Autentikasi & Otorisasi**: Gunakan sistem autentikasi yang sesuai untuk melindungi endpoint sensitif dan patuhi RBAC (Role-Based Access Control) yang sudah ditentukan.
4. **HTTPS**: Semua komunikasi API dan akses web harus menggunakan HTTPS di lingkungan produksi.

---

## 💬 6. Gaya Komunikasi & Protokol Perilaku Agent (Agent Communication & Behavior Protocol)

### 6.1 Gaya Komunikasi
1. **Ringkas & Informatif**: Berikan penjelasan yang padat, langsung ke tujuan, dan format dengan Markdown yang bersih.
2. **Konfirmasi Tindakan Berisiko**: Minta konfirmasi pengguna sebelum melakukan tindakan yang merusak (seperti menghapus database, file penting, atau mereset sistem).

### 6.2 Protokol Perilaku AI Agent
1. **Zero-Placeholder Rule**: DILARANG KERAS menghasilkan kode dengan komentar placeholder seperti `// TODO: implement here`, `/* sisa kode ... */`, atau `// ...`. Semua perubahan kode harus lengkap, fungsional, dan siap dijalankan.
2. **Prinsip Konteks Penuh**: Sebelum mengedit berkas, bacalah file target secara menyeluruh untuk memahami struktur kode yang ada. Pertahankan komentar dokumentatif dan lisensi yang sudah ada.
3. **Prinsip Dampak Minimal**: Lakukan modifikasi kode dengan cara yang paling terfokus dan terlokalisasi. Hindari mengubah file atau baris kode yang tidak berhubungan dengan tugas yang diberikan.
4. **Verifikasi Mandiri Sebelum Melapor**: Jalankan perintah kompilasi dan pengujian lokal setelah melakukan perubahan kode, guna memastikan tidak ada sintaks rusak atau pengujian yang gagal sebelum melaporkar pekerjaan selesai.
5. **Pencegahan Perulangan Error Tanpa Ujung**: Jika Agen menemui error kompilasi atau kegagalan tes yang sama setelah 3 kali percobaan perbaikan berturut-turut, Agen harus berhenti dan melaporkan kendala tersebut kepada Pengguna secara mendetail beserta opsi-opsi pemecahannya.
6. **Perlindungan Test**: DILARANG KERAS memodifikasi, menghapus, atau melemahkan asersi (assertions) pada unit test yang sudah ada hanya agar tes tersebut "lolos" secara paksa. Jika tes gagal, cari letak kesalahan pada kode implementasi baru.
7. **Larangan Dependensi Tanpa Izin**: DILARANG KERAS menginstal atau mengimpor library, package, atau dependensi eksternal baru tanpa persetujuan tertulis atau instruksi eksplisit dari Pengguna.

---

## 🛠️ 7. Aturan Penulisan Kode (Coding Guidelines)

### 7.1 Backend (Go / Python / Node.js)
1. **Explicit Error Handling**: Selalu periksa error yang dikembalikan fungsi. Gunakan wrapping error untuk mempermudah debugging log.
2. **Structured Logging**: Gunakan structured logger dengan level yang tepat (`INFO`, `WARN`, `ERROR`, `DEBUG`).
3. **Context Propagation**: Teruskan context ke semua fungsi yang melakukan operasi I/O (database, HTTP request, MQTT publish/subscribe) untuk mendukung timeout dan cancellation.
4. **Code Formatting & Linting**: Pastikan semua file kode diformat menggunakan formatter standar (`go fmt`, `black`, `prettier`, dll.) sebelum melakukan commit.
5. **Unit Testing**: Setiap fungsi bisnis kritis wajib memiliki unit test yang memadai. Gunakan mocking framework untuk memisahkan pengujian dari dependensi eksternal.
6. **Graceful Shutdown**: Setiap entrypoint aplikasi wajib mengimplementasikan mekanisme penanganan sinyal OS (`SIGINT` dan `SIGTERM`) untuk shutdown yang bersih.

### 7.2 Frontend (React / Vite)
1. **Functional Components & Hooks**: Gunakan functional components dengan React Hooks (bukan class components). Patuhi aturan Hooks dengan ketat.
2. **Zero Memory Leaks**: Bersihkan efek samping di dalam `useEffect` menggunakan return cleanup function.
3. **Styling**: Ikuti sistem styling yang ada (Vanilla CSS atau Tailwind). Pertahankan konsistensi desain sistem.
4. **Code Formatting & Linting**: Wajib menggunakan `eslint` dan `prettier` sebelum melakukan commit.

---

## 📄 8. Standar Commit & Git Workflow

AI Agent dan kontributor wajib mengikuti standar commit berikut:

1. **Format Conventional Commits**: Format pesan commit: `<type>(<scope>): <deskripsi singkat>` (semuanya dalam bahasa Inggris).
   - `feat`: Fitur baru.
   - `fix`: Perbaikan bug.
   - `docs`: Perubahan dokumentasi.
   - `refactor`: Rekonstruksi kode tanpa mengubah fungsionalitas.
   - `test`: Menambah atau memodifikasi pengujian.
   - `chore`: Tugas pemeliharaan, update dependencies, dll.
   *Contoh:* `feat(auth): implement JWT token verification`
2. **Atomic Commits**: Lakukan commit dalam ukuran kecil dan fokus pada satu perubahan spesifik. Jangan menggabungkan beberapa fitur tidak terkait dalam satu commit besar.
