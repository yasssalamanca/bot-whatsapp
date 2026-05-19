/**
 * WhatsApp Bot — Local Monitor Tool
 * Entry point for Baileys connection, authentication & event handling
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

const config = require('./config.json');
const { formatPresenceMessage, createLogEntry } = require('./utils/presence');
const { logPresence } = require('./utils/logger');
const { loadMonitoredJids, addMonitor, removeMonitor, getMonitoredListMessage, cleanJid, getNickname } = require('./commands/monit');
const secretReply = require('./commands/secret_reply');

// Initialize pino logger with minimal output to keep console clean
const logger = pino({ level: 'silent' });

// Cache for de-duplicating rapid identical presence updates
const lastPresenceState = new Map();

// Active WhatsApp Socket reference
let sock = null;
let isConnected = false;

/**
 * Main function to connect and run the WhatsApp socket
 */
async function connectToWhatsApp() {
  console.log('\n==================================================');
  console.log('🚀 Menginisialisasi Koneksi WhatsApp...');
  console.log('==================================================\n');

  // Ensure logs directory exists
  const logsDir = path.resolve(config.log_dir || './logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Setup multi-file auth state in auth/ folder
  const { state, saveCreds } = await useMultiFileAuthState(path.resolve('./auth'));

  // Create socket
  sock = makeWASocket({
    auth: state,
    logger: logger,
    printQRInTerminal: false, // We'll handle QR manually for better console control
    browser: ['WA Monitor Local', 'Chrome', '1.0.0']
  });

  // Track credentials update
  sock.ev.on('creds.update', saveCreds);

  // Connection status update handler
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📷 Silakan scan QR Code di bawah menggunakan WhatsApp HP Anda:');
      QRCode.generate(qr, { small: true });
      console.log('💡 Petunjuk: Buka WhatsApp > Perangkat Tertaut (Linked Devices) > Tautkan Perangkat.');
    }

    if (connection === 'close') {
      isConnected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log(`\n🔴 Koneksi terputus! Alasan: ${statusCode || 'Unknown'}`);
      
      if (shouldReconnect) {
        console.log('🔄 Mencoba menghubungkan kembali dalam 5 detik...');
        setTimeout(connectToWhatsApp, 5000);
      } else {
        console.log('⚠️ Sesi telah keluar (logged out). Silakan hapus folder "./auth" dan jalankan ulang bot untuk scan QR baru.');
      }
    } else if (connection === 'open') {
      isConnected = true;
      const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
      console.log('\n==================================================');
      console.log('✅ KONEKSI BERHASIL TERHUBUNG!');
      console.log(`🤖 Bot Aktif sebagai: ${sock.user.name || 'WhatsApp Bot'} (${myJid.split('@')[0]})`);
      console.log('==================================================\n');

      // Set owner JID dynamically if default/empty
      let ownerJid = config.owner_number;
      if (!ownerJid || ownerJid.startsWith('6281234567890')) {
        ownerJid = myJid;
        config.owner_number = myJid;
        console.log(`ℹ️ [Auto-Detect] Perintah & Laporan diarahkan ke nomor Anda sendiri: ${myJid.split('@')[0]}`);
      } else {
        console.log(`ℹ️ Laporan akan dikirim ke nomor pemilik: ${ownerJid.split('@')[0]}`);
      }

      // Proactively send a greeting message to the owner to signal bot is online
      try {
        await sock.sendMessage(ownerJid, { 
          text: `🤖 *WA Monitor Bot telah Aktif!*\n\nKoneksi berhasil dibuat. Bot siap memantau status.\n\n*Perintah yang tersedia:*\n• \`#monit [nomor] [nickname]\` - Mulai memantau nomor dengan nickname\n• \`#stop [nomor]\` - Hentikan memantau nomor\n• \`#list\` - Tampilkan daftar monitoring`
        });
      } catch (err) {
        console.error('[Notification Error] Gagal mengirim pesan inisialisasi ke pemilik:', err.message);
      }

      // Auto re-subscribe to all active targets
      await subscribeAllMonitored();
    }
  });

  // Handle incoming messages (command parser + secret reply)
  sock.ev.on('messages.upsert', async (m) => {
    // Only parse standard text messages
    if (m.type !== 'notify') return;
    const msg = m.messages[0];
    if (!msg.message) return;

    const fromMe = msg.key.fromMe;
    // remoteJid = chat room / sender for private messages
    const remoteJid = msg.key.remoteJid || '';
    // participant is only set in group messages; for private chats use remoteJid
    const senderJid = msg.key.participant || remoteJid;

    // ── Secret Reply Handler ───────────────────────────────────────────────────
    // HANYA aktif untuk nomor target khusus, tidak bocor ke nomor lain
    // fromMe=false: pesan masuk dari dia ke bot
    if (!fromMe && secretReply.isTargetNumber(remoteJid)) {
      const replyText = secretReply.getNextReply();
      if (replyText) {
        try {
          // Kirim dengan delay kecil agar terasa natural
          await new Promise(r => setTimeout(r, 800));
          await sock.sendMessage(remoteJid, { text: replyText });
        } catch (err) {
          console.error('[SecretReply Error] Gagal mengirim balasan:', err.message);
        }
      }
      // Setelah handle secret reply, STOP — jangan proses sebagai command
      return;
    }
    // ── END Secret Reply Handler ───────────────────────────────────────────────

    // Resolve dynamic owner number
    const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const ownerJid = config.owner_number || myJid;

    // FIX: Baileys multi-device JID bisa punya suffix ':device' (misal: 62xxx:1@s.whatsapp.net)
    // Harus strip suffix itu sebelum membandingkan, supaya owner check tidak gagal
    const senderNumber = senderJid.split('@')[0].split(':')[0];
    const ownerNumber  = ownerJid.split('@')[0].split(':')[0];

    // Verify sender is authorized (either self-messages or owner number match)
    const isOwner = fromMe || senderNumber === ownerNumber;
    if (!isOwner) return;

    // Extract text content from message body
    const body = msg.message.conversation || 
                 msg.message.extendedTextMessage?.text || 
                 '';
                 
    const text = body.trim();
    if (!text.startsWith('#')) return; // Commands must start with '#'

    console.log(`💬 Menerima perintah dari pemilik: "${text}"`);

    // Parse commands
    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    if (command === '#monit') {
      if (!arg) {
        await reply(msg, '❌ Harap masukkan nomor target dan nickname. Contoh: `#monit 08123456789 Budi`');
        return;
      }
      
      const subParts = arg.split(/\s+/);
      const targetNumber = subParts[0];
      const nickname = subParts.slice(1).join(' ') || null;
      
      const result = addMonitor(targetNumber, nickname);
      await reply(msg, result.message);
      
      if (result.success && isConnected) {
        await sock.presenceSubscribe(result.jid);
        console.log(`[Presence] Berhasil subscribe presence untuk: ${result.jid}`);
      }
    } 
    else if (command === '#stop') {
      if (!arg) {
        await reply(msg, '❌ Harap masukkan nomor target. Contoh: `#stop 08123456789`');
        return;
      }
      
      const result = removeMonitor(arg);
      await reply(msg, result.message);
    } 
    else if (command === '#list') {
      const listMsg = getMonitoredListMessage();
      await reply(msg, listMsg);
    }
  });

  // Handle presence updates from target numbers
  sock.ev.on('presence.update', async (update) => {
    const jid = update.id;
    const activeJids = loadMonitoredJids();

    // Check if this update belongs to an actively monitored number
    if (activeJids.includes(jid)) {
      // Bulletproof extraction: WhatsApp multi-device payload keys often contain device suffixes (e.g. "number:1@s.whatsapp.net")
      const keys = Object.keys(update.presences || {});
      const presenceKey = keys.find(k => k.split(':')[0].split('@')[0] === jid.split('@')[0]) || keys[0] || jid;
      const presence = update.presences[presenceKey];
      if (!presence) return;

      const status = presence.lastKnownPresence;
      const lastSeen = presence.lastSeen;

      // De-duplicate updates if the status state has not changed
      const cacheKey = `${jid}:${status}`;
      const lastState = lastPresenceState.get(jid);
      if (lastState === status) {
        // Skip duplicate transitions (e.g. available to available) to avoid spamming the owner
        return;
      }

      // Update local state cache
      lastPresenceState.set(jid, status);

      const targetNumber = jid.split('@')[0];
      console.log(`🔔 [Presence Update] Target ${targetNumber}: ${status}`);

      // Format notification and send to owner
      const nickname = getNickname(jid);
      const messageText = formatPresenceMessage(jid, status, lastSeen, config.timezone, nickname);
      const ownerJid = config.owner_number || (sock.user.id.split(':')[0] + '@s.whatsapp.net');

      try {
        await sock.sendMessage(ownerJid, { text: messageText });
      } catch (err) {
        console.error(`[Notification Error] Gagal mengirim status target ${targetNumber} ke pemilik:`, err.message);
      }

      // Write structured JSON log entry
      const logEntry = createLogEntry(status, lastSeen, config.timezone, nickname);
      logPresence(config.log_dir, jid, logEntry);
    }
  });
}

/**
 * Utility helper to send replies to WhatsApp messages
 * @param {object} msg Original message object
 * @param {string} text Response text
 */
async function reply(msg, text) {
  if (!sock) return;
  try {
    await sock.sendMessage(msg.key.remoteJid, { text: text }, { quoted: msg });
  } catch (err) {
    console.error('[Reply Error] Failed to send message reply:', err);
  }
}

/**
 * Subscribe to presence updates for all configured JIDs
 */
async function subscribeAllMonitored() {
  if (!sock || !isConnected) return;
  
  const activeJids = loadMonitoredJids();
  if (activeJids.length === 0) {
    console.log('📋 Tidak ada nomor aktif yang perlu dimonitor saat ini.');
    return;
  }

  console.log(`👁️ Berlangganan presence untuk ${activeJids.length} nomor target...`);
  
  for (const jid of activeJids) {
    try {
      await sock.presenceSubscribe(jid);
      // Small delay between subscriptions to respect WhatsApp rate limits
      await delay(300);
    } catch (err) {
      console.error(`❌ Gagal berlangganan presence untuk ${jid.split('@')[0]}:`, err.message);
    }
  }
  
  console.log('✅ Selesai berlangganan status presence.');
}

// Set up periodic re-subscription (every 10 minutes) to keep presence subscriptions active
setInterval(() => {
  if (isConnected) {
    console.log('🔄 [Keep-Alive] Menyegarkan langganan presence untuk target...');
    subscribeAllMonitored().catch(err => console.error('Error refreshing subscriptions:', err));
  }
}, 10 * 60 * 1000);

// Start the application
connectToWhatsApp().catch(err => {
  console.error('💥 Fatal Error occurred during initialization:', err);
});
