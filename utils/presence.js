/**
 * Presence formatting utility for WhatsApp Bot
 */

/**
 * Format timestamp to localized time string based on timezone
 * @param {Date|number|string} date 
 * @param {string} timezone 
 * @returns {string} Formatted time string, e.g. "14:32:00 WIB"
 */
function formatLocalTime(date, timezone = 'Asia/Jakarta') {
  const d = typeof date === 'number' ? new Date(date * 1000) : new Date(date);
  
  // Format with Intl.DateTimeFormat
  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  let formattedTime = formatter.format(d);
  
  // Determine timezone abbreviation
  let tzAbbr = 'WIB';
  if (timezone === 'Asia/Jakarta') tzAbbr = 'WIB';
  else if (timezone === 'Asia/Makassar') tzAbbr = 'WITA';
  else if (timezone === 'Asia/Jayapura') tzAbbr = 'WIT';
  else {
    // Fallback search in timezone string or generic offset
    try {
      const tzFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'short'
      });
      const parts = tzFormatter.formatToParts(d);
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      if (tzPart) tzAbbr = tzPart.value;
    } catch (e) {
      tzAbbr = timezone;
    }
  }

  return `${formattedTime} ${tzAbbr}`;
}

/**
 * Maps Baileys presence status to human-readable strings and emojis
 */
const STATUS_MAP = {
  available: {
    emoji: '✅',
    label: 'Online',
    desc: 'sedang Online'
  },
  unavailable: {
    emoji: '🔴',
    label: 'Offline',
    desc: 'Offline'
  },
  composing: {
    emoji: '✍️',
    label: 'Sedang mengetik',
    desc: 'sedang mengetik...'
  },
  recording: {
    emoji: '🎤',
    label: 'Sedang merekam suara',
    desc: 'sedang merekam pesan suara'
  },
  paused: {
    emoji: '⏸️',
    label: 'Berhenti mengetik',
    desc: 'berhenti mengetik'
  }
};

/**
 * Formats a presence update into a user-friendly notification message
 * @param {string} jid WhatsApp target JID
 * @param {string} status Baileys status type
 * @param {number|undefined} lastSeen Timestamp of last seen
 * @param {string} timezone Configured timezone
 * @param {string|null} nickname Nickname of the target
 * @returns {string} Formatted text message
 */
function formatPresenceMessage(jid, status, lastSeen, timezone = 'Asia/Jakarta', nickname = null) {
  const number = jid.split('@')[0];
  const now = new Date();
  const timeStr = formatLocalTime(now, timezone);
  
  const statusInfo = STATUS_MAP[status] || { emoji: '❓', label: 'Unknown', desc: `status unknown (${status})` };
  const identity = nickname ? `${nickname} (${number})` : number;
  
  if (status === 'unavailable' && lastSeen) {
    const lastSeenStr = formatLocalTime(lastSeen, timezone);
    return `${statusInfo.emoji} [${identity}] ${statusInfo.desc} — terakhir online ${lastSeenStr}`;
  }
  
  return `${statusInfo.emoji} [${identity}] ${statusInfo.desc} — ${timeStr}`;
}

/**
 * Prepares JSON log object for storage
 * @param {string} status 
 * @param {number|undefined} lastSeen 
 * @param {string} timezone 
 * @param {string|null} nickname Nickname of the target
 * @returns {object} Log entry structure
 */
function createLogEntry(status, lastSeen, timezone = 'Asia/Jakarta', nickname = null) {
  const now = new Date();
  const statusInfo = STATUS_MAP[status] || { label: 'Unknown' };
  
  return {
    status: status,
    label: statusInfo.label,
    timestamp: now.toISOString(),
    waktu_lokal: formatLocalTime(now, timezone),
    ...(nickname ? { nama: nickname } : {}),
    ...(status === 'unavailable' && lastSeen ? { last_seen: new Date(lastSeen * 1000).toISOString(), last_seen_lokal: formatLocalTime(lastSeen, timezone) } : {})
  };
}

module.exports = {
  formatLocalTime,
  formatPresenceMessage,
  createLogEntry,
  STATUS_MAP
};
