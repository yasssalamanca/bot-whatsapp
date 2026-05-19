/**
 * ============================================================
 *  SECRET REPLY — Auto-Reply Sequential (One-Shot Feature)
 * ============================================================
 *
 *  Target : HANYA nomor di bawah ini (tidak akan bocor ke nomor lain)
 *  Mode   : Sequential — setiap kali dia balas, bot balas dengan
 *           teks berikutnya di array REPLIES
 *  Sifat  : One-shot per sesi (setelah array habis, berhenti otomatis)
 *
 * ============================================================
 *  CARA EDIT:
 *  - Ubah isi teks di dalam array REPLIES sesuka hati
 *  - Tambah elemen baru cukup dengan menambah string baru ke array
 *  - Urutan array = urutan balasan bot (index 0 = balasan pertama, dst)
 * ============================================================
 */

// ─── TARGET NUMBER (LOCKED — JANGAN DIUBAH) ──────────────────────────────────
// Nomor 0838-6510-6916 dikonversi ke format WhatsApp JID
const TARGET_NUMBER = '6283865106916';
const TARGET_JID = `${TARGET_NUMBER}@s.whatsapp.net`;

// ─── TEMPLATE BALASAN (EDIT SESUKA HATI) ─────────────────────────────────────
//
//  Aturan:
//  • Setiap string = satu balasan
//  • Balasan pertama keluar saat dia kirim pesan pertama
//  • Balasan berikutnya keluar setiap dia balas lagi
//  • Setelah semua balasan habis, bot diam (tidak balas lagi)
//
//  Tips format WhatsApp:
//  • *teks*   = bold
//  • _teks_   = italic
//  • ~teks~   = strikethrough
//  • ```teks``` = monospace
//  • \n       = baris baru
//
const REPLIES = [
  // ── Balasan ke-1 (pesan pertama dari dia) ──────────────────────
  `aull, si iyass nya udaa pergi ngajiii, ini di kendaliin sm ai pribadi nya sih`,

  // ── Balasan ke-2 ───────────────────────────────────────────────
  `hehe iyaa, keknyaa dia bakalan pulangg seperti jam biasaa `,

  // ── Balasan ke-3 ───────────────────────────────────────────────
  `kataa dia "see u in the night, sweetiee!!"`,

  // ── Balasan ke-4 ───────────────────────────────────────────────
  `oke itu ajaa, babaaii!!`,

  // ── Balasan ke-5 (terakhir) ────────────────────────────────────
  `[CHAT ENDED]`,

  // ── Tambah balasan baru? Copy baris di bawah, uncomment, dan ganti teksnya:
  // `Balasan tambahan 6`,
  // `Balasan tambahan 7`,
];

// ─── STATE INTERNAL (jangan diubah) ──────────────────────────────────────────

// Menyimpan index balasan berikutnya untuk target. Direset ke 0 setiap restart.
let currentIndex = 0;

// Flag: apakah fitur masih aktif (false jika semua balasan sudah terpakai)
let isActive = true;

// ─── FUNGSI UTAMA ─────────────────────────────────────────────────────────────

/**
 * Cek apakah pesan berasal dari nomor target khusus
 * @param {string} remoteJid - JID pengirim pesan
 * @returns {boolean}
 */
function isTargetNumber(remoteJid) {
  if (!remoteJid) return false;
  // Bersihkan suffix device Baileys (misal: 6283865106916:1@s.whatsapp.net)
  const cleanNumber = remoteJid.split('@')[0].split(':')[0];
  return cleanNumber === TARGET_NUMBER;
}

/**
 * Proses pesan dari target dan kembalikan teks balasan berikutnya
 * @returns {string|null} Teks balasan, atau null jika sudah habis/tidak aktif
 */
function getNextReply() {
  if (!isActive) return null;
  if (currentIndex >= REPLIES.length) {
    isActive = false;
    console.log('[SecretReply] Semua balasan sudah terpakai. Fitur dinonaktifkan.');
    return null;
  }

  const reply = REPLIES[currentIndex];
  currentIndex++;

  console.log(`[SecretReply] Mengirim balasan #${currentIndex}/${REPLIES.length} ke ${TARGET_NUMBER}`);

  if (currentIndex >= REPLIES.length) {
    isActive = false;
    console.log('[SecretReply] Ini adalah balasan terakhir. Fitur selesai dan dinonaktifkan.');
  }

  return reply;
}

/**
 * Reset fitur ke kondisi awal (opsional, bisa dipanggil manual)
 */
function resetSecretReply() {
  currentIndex = 0;
  isActive = true;
  console.log('[SecretReply] Fitur direset ke kondisi awal.');
}

/**
 * Info status fitur saat ini
 * @returns {object}
 */
function getStatus() {
  return {
    isActive,
    currentIndex,
    totalReplies: REPLIES.length,
    remaining: Math.max(0, REPLIES.length - currentIndex),
  };
}

module.exports = {
  TARGET_JID,
  isTargetNumber,
  getNextReply,
  resetSecretReply,
  getStatus,
};
