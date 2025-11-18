/**
 * Simple logger utility for the application
 */

class Logger {
  constructor(serviceName) {
    this.serviceName = serviceName;
  }

  _formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] ${level.toUpperCase()} [${this.serviceName}] ${message}`;
  }

  info(message, meta = {}) {
    console.log(this._formatMessage('info', message, meta));
  }

  warn(message, meta = {}) {
    console.warn(this._formatMessage('warn', message, meta));
  }

  error(message, meta = {}) {
    console.error(this._formatMessage('error', message, meta));
  }

  debug(message, meta = {}) {
    console.log(this._formatMessage('debug', message, meta));
  }

  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      const { method, url } = req;

      res.on('finish', () => {
        const duration = Date.now() - start;
        this.info(`${method} ${url} ${res.statusCode} - ${duration}ms`);
      });

      next();
    };
  }
}

export function createLogger(serviceName) {
  return new Logger(serviceName);
}