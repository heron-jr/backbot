class Utils {
  minutesAgo(timestampMs) {
    const now = Date.now();
    const diffMs = now - timestampMs;
    return Math.floor(diffMs / 60000);
  }

  getIntervalInSeconds(interval) {
    if (typeof interval !== 'string') return 60;

    const match = interval.match(/^(\d+)([smhd])$/i);
    if (!match) return 60;

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    const unitToSeconds = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    return value * (unitToSeconds[unit] || 60);
  }
}

export default new Utils();
