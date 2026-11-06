/**
 * Formats byte size into human readable string (KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
  return `${val} ${sizes[i]}`;
}

/**
 * Returns formatted savings string, e.g. "-64.5%"
 */
export function formatSavings(originalBytes: number, processedBytes: number): string {
  if (!originalBytes || originalBytes <= 0) return '0%';
  const diff = originalBytes - processedBytes;
  if (diff <= 0) return '0%';
  const pct = ((diff / originalBytes) * 100).toFixed(1);
  return `-${pct}%`;
}

/**
 * Format relative time (e.g. "Just now", "2 mins ago")
 */
export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
