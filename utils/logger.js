/**
 * Local JSON logging utility for WhatsApp Bot
 */

const fs = require('fs');
const path = require('path');

/**
 * Log presence event to localized JSON file
 * @param {string} logDir Path to the logs directory
 * @param {string} jid WhatsApp target JID
 * @param {object} logEntry Prepared log entry object
 */
function logPresence(logDir, jid, logEntry) {
  const number = jid.split('@')[0];
  
  // Resolve absolute path or standard path
  const absoluteLogDir = path.resolve(logDir);
  
  // Create logs directory if it doesn't exist
  if (!fs.existsSync(absoluteLogDir)) {
    fs.mkdirSync(absoluteLogDir, { recursive: true });
  }
  
  const filePath = path.join(absoluteLogDir, `monitor_${number}.json`);
  let data = {
    nomor: number,
    log: []
  };
  
  // Read existing logs if file exists
  if (fs.existsSync(filePath)) {
    try {
      const rawContent = fs.readFileSync(filePath, 'utf8');
      if (rawContent.trim()) {
        data = JSON.parse(rawContent);
        // Fallback or initialization if format is incorrect
        if (!data.nomor) data.nomor = number;
        if (!Array.isArray(data.log)) data.log = [];
      }
    } catch (e) {
      console.error(`[Logger Error] Failed to read/parse ${filePath}. Re-initializing file.`, e);
    }
  }
  
  // Append new log entry
  data.log.push(logEntry);
  
  // Keep logs at a reasonable size, e.g., max 1000 entries to prevent memory bloating
  if (data.log.length > 1000) {
    data.log.shift();
  }
  
  // Write back to file with nice formatting
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`[Logger Error] Failed to write log to ${filePath}:`, e);
  }
}

/**
 * Retrieve all currently monitored numbers from existing log files
 * @param {string} logDir Path to the logs directory
 * @returns {string[]} Array of numbers
 */
function getMonitoredNumbersFromLogs(logDir) {
  const absoluteLogDir = path.resolve(logDir);
  if (!fs.existsSync(absoluteLogDir)) return [];
  
  try {
    const files = fs.readdirSync(absoluteLogDir);
    return files
      .filter(f => f.startsWith('monitor_') && f.endsWith('.json'))
      .map(f => f.replace('monitor_', '').replace('.json', ''));
  } catch (e) {
    console.error(`[Logger Error] Failed to read directory ${absoluteLogDir}:`, e);
    return [];
  }
}

module.exports = {
  logPresence,
  getMonitoredNumbersFromLogs
};
