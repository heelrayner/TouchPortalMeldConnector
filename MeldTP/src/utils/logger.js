const levels = ['error', 'warn', 'info', 'debug'];

class Logger {
  constructor(level = 'info') {
    this.setLevel(level);
  }

  setLevel(level) {
    this.level = levels.includes(level) ? level : 'info';
  }

  shouldLog(level) {
    return levels.indexOf(level) <= levels.indexOf(this.level);
  }

  log(level, message, meta) {
    if (!this.shouldLog(level)) {
      return;
    }
    const prefix = `[${new Date().toISOString()}][${level.toUpperCase()}]`;
    if (meta) {
      console.log(prefix, message, meta);
    } else {
      console.log(prefix, message);
    }
  }

  error(message, meta) {
    this.log('error', message, meta);
  }

  warn(message, meta) {
    this.log('warn', message, meta);
  }

  info(message, meta) {
    this.log('info', message, meta);
  }

  debug(message, meta) {
    this.log('debug', message, meta);
  }
}

module.exports = { Logger };
