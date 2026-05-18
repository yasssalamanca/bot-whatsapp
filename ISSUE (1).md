# 📋 ISSUE: WhatsApp Bot — Local Monitor Tool

## Ringkasan

Membangun sebuah **bot/tools/program WhatsApp yang berjalan secara lokal** di mesin developer, dapat dikembangkan lebih lanjut (extensible), dan untuk tahap pertama mampu **memonitor status online/offline** suatu nomor WhatsApp serta mengirimkan laporan ke nomor pribadi pemilik.

---

## 🎯 Tujuan Proyek

- Membuat bot WhatsApp yang berjalan **lokal di terminal/mesin developer**.
- Koneksi ke akun WhatsApp dilakukan via **scan QR code di terminal** (tanpa browser manual).
- Arsitektur proyek harus **modular dan dapat dikembangkan** untuk fitur-fitur berikutnya.
- Tugas pertama: perintah **`#monit [nomor_wa]`** untuk memonitor status nomor target.

---

## 🛠️ Stack & Library yang Direkomendasikan

| Komponen | Pilihan | Alasan |
|---|---|---|
| **Runtime** | Node.js (v18+) | Ekosistem terluas untuk WhatsApp unofficial library |
| **WhatsApp Library** | [`baileys`](https://github.com/WhiskeySockets/Baileys) | Open source, aktif, multi-device, tanpa Puppeteer/browser |
| **Penyimpanan sesi** | File-based (via Baileys `useMultiFileAuthState`) | Simpel, lokal, tidak perlu DB |
| **Penyimpanan log** | JSON file lokal | Mudah dibaca manusia & mesin |
| **Scheduler/event** | Event listener bawaan Baileys | Real-time presence update |
| **Package manager** | `npm` atau `pnpm` | Standar Node.js |

> **Mengapa Baileys?**
> Baileys menggunakan protokol WhatsApp Web multi-device secara langsung (WebSocket), ringan, tidak membutuhkan Puppeteer/Chrome, dan aktif di-maintain. Cocok untuk proyek lokal yang extensible.

---

## 📁 Struktur Proyek yang Diusulkan

```
wa-bot/
├── index.js               # Entry point, inisialisasi koneksi & QR
├── config.json            # Konfigurasi (nomor pribadi, dll)
├── auth/                  # Folder sesi Baileys (auto-generated)
├── logs/
│   └── monitor_[nomor].json  # Log monitoring per nomor target
├── commands/
│   └── monit.js           # Handler perintah #monit
├── utils/
│   ├── presence.js        # Parser & formatter status presence
│   └── logger.js          # Fungsi simpan log ke JSON
└── package.json
```

---

## ✅ Tugas Pertama: Fitur `#monit [nomor_wa]`

### Cara Kerja

1. Pengguna mengirim perintah ke bot (ke nomor sendiri / chat bot):
   ```
   #monit 6281234567890
   ```
2. Bot mulai **subscribe presence** nomor target via Baileys.
3. Setiap ada **update status** dari nomor target, bot:
   - Mengirim notifikasi ke **nomor pribadi pemilik** dalam bahasa manusia.
   - Menyimpan log ke file **`logs/monitor_6281234567890.json`**.

### Status yang Dipantau

| Status Baileys | Pesan ke Pemilik (contoh) |
|---|---|
| `available` | ✅ `[6281234567890] sedang Online — 14:32 WIB` |
| `unavailable` | 🔴 `[6281234567890] Offline — terakhir online 14:45 WIB` |
| `composing` | ✍️ `[6281234567890] sedang mengetik... — 14:33 WIB` |
| `recording` | 🎤 `[6281234567890] sedang merekam pesan suara — 14:34 WIB` |
| `paused` | ⏸️ `[6281234567890] berhenti mengetik — 14:33 WIB` |

> Semua status di atas tersedia dari event `presence.update` di Baileys.

### Format Log JSON

```json
{
  "nomor": "6281234567890",
  "log": [
    {
      "status": "available",
      "label": "Online",
      "timestamp": "2025-05-18T07:32:00.000Z",
      "waktu_lokal": "14:32:00 WIB"
    },
    {
      "status": "composing",
      "label": "Sedang mengetik",
      "timestamp": "2025-05-18T07:33:10.000Z",
      "waktu_lokal": "14:33:10 WIB"
    }
  ]
}
```

---

## 🚀 Langkah Implementasi (untuk Developer / AI Agent)

### Step 1 — Setup Proyek
```bash
mkdir wa-bot && cd wa-bot
npm init -y
npm install @whiskeysockets/baileys qrcode-terminal pino
```

### Step 2 — Koneksi & QR
- Buat `index.js` yang menginisialisasi koneksi Baileys.
- Tampilkan QR code di terminal menggunakan `qrcode-terminal`.
- Simpan sesi di folder `auth/` agar tidak perlu scan ulang setiap restart.

### Step 3 — Parser Perintah
- Dengarkan event `messages.upsert`.
- Jika pesan masuk dari nomor pribadi pemilik dan diawali `#monit`, ekstrak nomor target.
- Panggil `handler` di `commands/monit.js`.

### Step 4 — Subscribe Presence
- Gunakan `sock.presenceSubscribe(jid)` untuk nomor target.
- Dengarkan event `presence.update`.
- Format pesan status dengan `utils/presence.js`.

### Step 5 — Kirim Notifikasi & Simpan Log
- Gunakan `sock.sendMessage(ownerJid, { text: pesanStatus })`.
- Append log baru ke `logs/monitor_[nomor].json` via `utils/logger.js`.

---

## ⚙️ Konfigurasi (`config.json`)

```json
{
  "owner_number": "6281234567890@s.whatsapp.net",
  "log_dir": "./logs",
  "timezone": "Asia/Jakarta"
}
```

---

## 📌 Catatan Penting

- **Baileys adalah library tidak resmi.** Gunakan untuk tujuan pribadi/edukasi. Risiko pemblokiran akun ada jika digunakan berlebihan atau melanggar ToS WhatsApp.
- Sesi tersimpan lokal di folder `auth/`. Jangan commit folder ini ke repository publik (tambahkan ke `.gitignore`).
- Presence update **hanya tersedia jika nomor target tidak menyembunyikan status online** di pengaturan privasinya.
- Proyek ini dirancang modular: fitur baru (reminder, auto-reply, dll) cukup ditambahkan sebagai file baru di folder `commands/`.

---

## 🔮 Kemungkinan Pengembangan Berikutnya

- `#stop [nomor_wa]` — hentikan monitoring nomor tertentu.
- `#list` — tampilkan semua nomor yang sedang dimonitor.
- Auto-reply berdasarkan kata kunci.
- Integrasi dengan AI (misal: ringkasan harian aktivitas nomor target).
- Dashboard log via web sederhana (Express.js).

---

*ISSUE ini ditujukan untuk dibaca oleh AI agent maupun developer manusia. Semua keputusan teknis di atas dapat didiskusikan dan diubah sesuai kebutuhan.*
