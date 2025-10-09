const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

/**
 * Structured logging system for PJE Automation
 * Provides multiple output formats and log levels with rotation
 */
class Logger {
  constructor(options = {}) {
    this.options = {
      level: options.level || process.env.LOG_LEVEL || 'info',
      outputDir: options.outputDir || path.join(process.cwd(), 'logs'),
      maxFileSize: options.maxFileSize || '10m',
      maxFiles: options.maxFiles || '14d',
      datePattern: options.datePattern || 'YYYY-MM-DD',
      enableConsole: options.enableConsole !== false,
      enableFile: options.enableFile !== false,
      component: options.component || 'PJE-Automation',
      ...options
    };

    this.logger = null;
    this.initialize();
  }

  /**
   * Initialize the Winston logger with configured transports
   */
  initialize() {
    // Ensure log directory exists
    if (this.options.enableFile && !fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }

    // Create custom format
    const customFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, component, context, stack, ...meta }) => {
        const logEntry = {
          timestamp,
          level: level.toUpperCase(),
          component: component || this.options.component,
          message,
          ...(context && { context }),
          ...(stack && { stack }),
          ...(Object.keys(meta).length > 0 && { meta })
        };

        return JSON.stringify(logEntry);
      })
    );

    // Console format for development
    const consoleFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'HH:mm:ss.SSS'
      }),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, component, context }) => {
        const contextStr = context ? ` [${JSON.stringify(context)}]` : '';
        const componentStr = component ? `[${component}] ` : '';
        return `${timestamp} ${level}: ${componentStr}${message}${contextStr}`;
      })
    );

    // Configure transports
    const transports = [];

    // Console transport
    if (this.options.enableConsole) {
      transports.push(new winston.transports.Console({
        level: this.options.level,
        format: consoleFormat,
        handleExceptions: true,
        handleRejections: true
      }));
    }

    // File transports
    if (this.options.enableFile) {
      // General log file with rotation
      transports.push(new DailyRotateFile({
        filename: path.join(this.options.outputDir, 'application-%DATE%.log'),
        datePattern: this.options.datePattern,
        maxSize: this.options.maxFileSize,
        maxFiles: this.options.maxFiles,
        format: customFormat,
        level: this.options.level,
        handleExceptions: true,
        handleRejections: true
      }));

      // Error-only log file
      transports.push(new DailyRotateFile({
        filename: path.join(this.options.outputDir, 'error-%DATE%.log'),
        datePattern: this.options.datePattern,
        maxSize: this.options.maxFileSize,
        maxFiles: this.options.maxFiles,
        format: customFormat,
        level: 'error',
        handleExceptions: true,
        handleRejections: true
      }));

      // Debug log file (only in development)
      if (process.env.NODE_ENV === 'development' || this.options.level === 'debug') {
        transports.push(new DailyRotateFile({
          filename: path.join(this.options.outputDir, 'debug-%DATE%.log'),
          datePattern: this.options.datePattern,
          maxSize: this.options.maxFileSize,
          maxFiles: '7d', // Keep debug logs for shorter period
          format: customFormat,
          level: 'debug'
        }));
      }
    }

    // Create Winston logger
    this.logger = winston.createLogger({
      level: this.options.level,
      format: customFormat,
      transports,
      exitOnError: false
    });

    // Handle uncaught exceptions and rejections
    this.logger.exceptions.handle(
      new winston.transports.File({ 
        filename: path.join(this.options.outputDir, 'exceptions.log') 
      })
    );

    this.logger.rejections.handle(
      new winston.transports.File({ 
        filename: path.join(this.options.outputDir, 'rejections.log') 
      })
    );
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {Object} context - Additional context data
   */
  debug(message, context = {}) {
    this.logger.debug(message, { context, component: this.options.component });
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} context - Additional context data
   */
  info(message, context = {}) {
    this.logger.info(message, { context, component: this.options.component });
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {Object} context - Additional context data
   */
  warn(message, context = {}) {
    this.logger.warn(message, { context, component: this.options.component });
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {Error} error - Error object (optional)
   * @param {Object} context - Additional context data
   */
  error(message, error = null, context = {}) {
    const logData = { 
      context, 
      component: this.options.component 
    };

    if (error) {
      logData.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        ...(error.context && { context: error.context })
      };
    }

    this.logger.error(message, logData);
  }

  /**
   * Log success message
   * @param {string} message - Log message
   * @param {Object} context - Additional context data
   */
  success(message, context = {}) {
    this.logger.info(message, { 
      context, 
      component: this.options.component,
      level: 'success'
    });
  }

  /**
   * Create a child logger with additional context
   * @param {Object} context - Context to add to all log messages
   * @returns {Logger} Child logger instance
   */
  child(context = {}) {
    return new Logger({
      ...this.options,
      context: { ...this.options.context, ...context }
    });
  }

  /**
   * Create a logger for a specific component
   * @param {string} componentName - Name of the component
   * @param {Object} options - Additional options
   * @returns {Logger} Component logger instance
   */
  static forComponent(componentName, options = {}) {
    return new Logger({
      component: componentName,
      ...options
    });
  }

  /**
   * Set log level dynamically
   * @param {string} level - New log level
   */
  setLevel(level) {
    this.options.level = level;
    this.logger.level = level;
    
    // Update transport levels
    this.logger.transports.forEach(transport => {
      if (transport.name !== 'error-file') { // Keep error file at error level
        transport.level = level;
      }
    });
  }

  /**
   * Get current log level
   * @returns {string} Current log level
   */
  getLevel() {
    return this.options.level;
  }

  /**
   * Flush all log transports
   * @returns {Promise} Promise that resolves when all transports are flushed
   */
  async flush() {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }

  /**
   * Close all log transports
   */
  close() {
    this.logger.close();
  }

  /**
   * Get log statistics
   * @returns {Object} Log statistics
   */
  getStats() {
    const stats = {
      level: this.options.level,
      outputDir: this.options.outputDir,
      transports: this.logger.transports.length,
      component: this.options.component
    };

    // Add file stats if file logging is enabled
    if (this.options.enableFile && fs.existsSync(this.options.outputDir)) {
      try {
        const files = fs.readdirSync(this.options.outputDir);
        stats.logFiles = files.filter(file => file.endsWith('.log')).length;
        
        // Calculate total log directory size
        let totalSize = 0;
        files.forEach(file => {
          const filePath = path.join(this.options.outputDir, file);
          const stat = fs.statSync(filePath);
          totalSize += stat.size;
        });
        stats.totalSizeMB = Math.round(totalSize / (1024 * 1024) * 100) / 100;
      } catch (error) {
        stats.error = 'Could not read log directory stats';
      }
    }

    return stats;
  }
}

// Create default logger instance
const defaultLogger = new Logger();

// Export both the class and default instance
module.exports = Logger;
module.exports.default = defaultLogger;
module.exports.Logger = Logger;