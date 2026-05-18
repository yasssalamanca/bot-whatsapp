/**
 * Commands Handler for WhatsApp Monitoring Bot
 * Supports #monit, #stop, and #list
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '../monitored.json');

/**
 * Clean and parse input phone number into standard WhatsApp JID
 * @param {string} input 
 * @returns {string} Standard JID format (e.g. "6281234567890@s.whatsapp.net")
 */
function cleanJid(input) {
  if (!input) return null;
  
  // Extract digits
  let clean = input.replace(/\D/g, '');
  
  if (!clean) return null;
  
  // If it starts with '0', replace with '62' (standard Indonesian country code)
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }
  
  // Ensure it has standard whatsapp suffix
  return `${clean}@s.whatsapp.net`;
}

/**
 * Load monitored targets list from state file as objects
 * @returns {object[]} Array of { jid, nickname }
 */
function loadMonitoredObjects() {
  if (!fs.existsSync(STATE_FILE)) {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify([], null, 2), 'utf8');
    } catch (e) {
      console.error('[State Error] Failed to create monitored.json:', e);
    }
    return [];
  }
  
  try {
    const content = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return [];
    
    // Legacy migration: convert flat strings array to array of objects
    return parsed.map(item => {
      if (typeof item === 'string') {
        return { jid: item, nickname: null };
      }
      return item;
    });
  } catch (e) {
    console.error('[State Error] Failed to read/parse monitored.json:', e);
    return [];
  }
}

/**
 * Save monitored objects list to state file
 * @param {object[]} objects Array of { jid, nickname }
 */
function saveMonitoredObjects(objects) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(objects, null, 2), 'utf8');
  } catch (e) {
    console.error('[State Error] Failed to write monitored.json:', e);
  }
}

/**
 * Load monitored JIDs list from state file (flat string array for triggers)
 * @returns {string[]} Array of JIDs
 */
function loadMonitoredJids() {
  const list = loadMonitoredObjects();
  return list.map(item => item.jid);
}

/**
 * Retrieve the nickname of a JID
 * @param {string} jid 
 * @returns {string|null} Nickname or null
 */
function getNickname(jid) {
  const list = loadMonitoredObjects();
  const found = list.find(item => item.jid === jid);
  return found ? found.nickname : null;
}

/**
 * Start monitoring a JID
 * @param {string} numberInput 
 * @param {string|null} nickname 
 * @returns {object} { success: boolean, jid: string, message: string }
 */
function addMonitor(numberInput, nickname) {
  const jid = cleanJid(numberInput);
  if (!jid) {
    return {
      success: false,
      message: '❌ Format nomor tidak valid. Pastikan berisi angka saja (contoh: 08123456789 atau 628123456789).'
    };
  }
  
  const list = loadMonitoredObjects();
  const existingIndex = list.findIndex(item => item.jid === jid);
  const cleanNickname = nickname ? nickname.trim() : null;
  
  if (existingIndex !== -1) {
    // If target exists but owner changes/sets nickname, update it!
    list[existingIndex].nickname = cleanNickname;
    saveMonitoredObjects(list);
    
    const numStr = jid.split('@')[0];
    const nicknameDisplay = cleanNickname ? `"${cleanNickname}"` : 'tanpa nickname';
    return {
      success: true,
      jid,
      message: `🔄 Memperbarui informasi nomor [${numStr}]: Nickname diubah menjadi ${nicknameDisplay}.`
    };
  }
  
  list.push({ jid, nickname: cleanNickname });
  saveMonitoredObjects(list);
  
  const numStr = jid.split('@')[0];
  const nicknameDisplay = cleanNickname ? ` *${cleanNickname}*` : '';
  return {
    success: true,
    jid,
    message: `👁️ Mulai memantau status nomor [${numStr}]${nicknameDisplay ? ' sebagai' + nicknameDisplay : ''}.\nNotifikasi status online/typing akan dikirim secara real-time.`
  };
}

/**
 * Stop monitoring a JID
 * @param {string} numberInput 
 * @returns {object} { success: boolean, jid: string, message: string }
 */
function removeMonitor(numberInput) {
  const jid = cleanJid(numberInput);
  if (!jid) {
    return {
      success: false,
      message: '❌ Format nomor tidak valid.'
    };
  }
  
  const list = loadMonitoredObjects();
  const existing = list.find(item => item.jid === jid);
  
  if (!existing) {
    return {
      success: false,
      jid,
      message: `⚠️ Nomor [${jid.split('@')[0]}] tidak ditemukan dalam daftar monitoring.`
    };
  }
  
  const updatedList = list.filter(item => item.jid !== jid);
  saveMonitoredObjects(updatedList);
  
  const numStr = jid.split('@')[0];
  const nicknameDisplay = existing.nickname ? ` (${existing.nickname})` : '';
  return {
    success: true,
    jid,
    message: `🛑 Berhenti memantau status nomor [${numStr}]${nicknameDisplay}.`
  };
}

/**
 * Get formatting list of currently monitored targets
 * @returns {string} Formatted markdown list of active targets
 */
function getMonitoredListMessage() {
  const list = loadMonitoredObjects();
  if (list.length === 0) {
    return '📋 *Daftar Monitoring Kosong*\n\nGunakan perintah `#monit [nomor] [nickname]` untuk menambahkan target.';
  }
  
  let msg = `📋 *Daftar Nomor yang Dipantau (${list.length})*\n\n`;
  list.forEach((item, index) => {
    const numStr = item.jid.split('@')[0];
    const nicknameDisplay = item.nickname ? ` - *${item.nickname}*` : '';
    msg += `${index + 1}. *${numStr}*${nicknameDisplay}\n`;
  });
  
  msg += '\nGunakan `#stop [nomor]` untuk berhenti memantau.';
  return msg;
}

module.exports = {
  cleanJid,
  loadMonitoredJids,
  loadMonitoredObjects,
  getNickname,
  addMonitor,
  removeMonitor,
  getMonitoredListMessage
};
