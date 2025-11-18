/**
 * Sistema de Logging Centralizado para Microservicios
 * 
 * Características:
 * - Logs en consola con colores
 * - Logs en archivos rotativos
 * - Niveles: debug, info, warn, error
 * - Formato JSON para logs de archivo
 * - Metadata contextual (servicio, timestamp, etc.)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Colores ANSI para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
}

// Niveles de log
const levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

class Logger {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName
    this.logLevel = options.logLevel || process.env.LOG_LEVEL || 'info'
    this.enableFileLogging = options.enableFileLogging !== false
    this.logDir = options.logDir || path.join(__dirname, '..', '..', '..', 'logs')
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024 // 10MB
    this.maxFiles = options.maxFiles || 5
    
    // Crear directorio de logs si no existe
    if (this.enableFileLogging) {
      this.ensureLogDirectory()
    }
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true })
    }
  }

  shouldLog(level) {
    return levels[level] >= levels[this.logLevel]
  }

  formatTimestamp() {
    return new Date().toISOString()
  }

  formatConsoleMessage(level, message, meta = {}) {
    const timestamp = this.formatTimestamp()
    const levelColors = {
      debug: colors.gray,
      info: colors.cyan,
      warn: colors.yellow,
      error: colors.red
    }
    
    const color = levelColors[level] || colors.white
    const levelStr = level.toUpperCase().padEnd(5)
    
    let output = `${colors.gray}[${timestamp}]${colors.reset} `
    output += `${color}${levelStr}${colors.reset} `
    output += `${colors.magenta}[${this.serviceName}]${colors.reset} `
    output += `${message}`
    
    if (Object.keys(meta).length > 0) {
      output += `\n${colors.dim}${JSON.stringify(meta, null, 2)}${colors.reset}`
    }
    
    return output
  }

  formatFileMessage(level, message, meta = {}) {
    return JSON.stringify({
      timestamp: this.formatTimestamp(),
      level,
      service: this.serviceName,
      message,
      ...meta,
      pid: process.pid
    }) + '\n'
  }

  getLogFilePath(level) {
    const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    return path.join(this.logDir, `${this.serviceName}-${level}-${date}.log`)
  }

  rotateLogFile(filePath) {
    try {
      const stats = fs.statSync(filePath)
      
      if (stats.size >= this.maxFileSize) {
        // Rotar archivos
        const dir = path.dirname(filePath)
        const basename = path.basename(filePath, '.log')
        
        // Eliminar el archivo más antiguo si excede maxFiles
        const rotatedFile = `${basename}.${this.maxFiles}.log`
        const rotatedPath = path.join(dir, rotatedFile)
        if (fs.existsSync(rotatedPath)) {
          fs.unlinkSync(rotatedPath)
        }
        
        // Mover archivos existentes
        for (let i = this.maxFiles - 1; i >= 1; i--) {
          const oldFile = path.join(dir, `${basename}.${i}.log`)
          const newFile = path.join(dir, `${basename}.${i + 1}.log`)
          if (fs.existsSync(oldFile)) {
            fs.renameSync(oldFile, newFile)
          }
        }
        
        // Rotar el archivo actual
        fs.renameSync(filePath, path.join(dir, `${basename}.1.log`))
      }
    } catch (error) {
      // Si el archivo no existe, ignorar
      if (error.code !== 'ENOENT') {
        console.error('Error rotando archivo de log:', error)
      }
    }
  }

  writeToFile(level, message, meta = {}) {
    if (!this.enableFileLogging) return
    
    try {
      const filePath = this.getLogFilePath(level)
      
      // Verificar si necesita rotación
      if (fs.existsSync(filePath)) {
        this.rotateLogFile(filePath)
      }
      
      // Escribir log
      const logMessage = this.formatFileMessage(level, message, meta)
      fs.appendFileSync(filePath, logMessage, 'utf8')
      
      // También escribir en archivo combinado
      const combinedPath = this.getLogFilePath('combined')
      fs.appendFileSync(combinedPath, logMessage, 'utf8')
      
    } catch (error) {
      console.error('Error escribiendo log a archivo:', error)
    }
  }

  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return
    
    // Log a consola
    console.log(this.formatConsoleMessage(level, message, meta))
    
    // Log a archivo
    this.writeToFile(level, message, meta)
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta)
  }

  info(message, meta = {}) {
    this.log('info', message, meta)
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta)
  }

  error(message, meta = {}) {
    this.log('error', message, meta)
  }

  // Middleware para Express
  expressMiddleware() {
    return (req, res, next) => {
      const start = Date.now()
      
      // Log de request
      this.info(`${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent')
      })
      
      // Interceptar response
      const originalSend = res.send
      res.send = function(data) {
        const duration = Date.now() - start
        
        const logger = req.app.get('logger')
        if (logger) {
          const level = res.statusCode >= 400 ? 'error' : 'info'
          logger.log(level, `${req.method} ${req.path} ${res.statusCode}`, {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`
          })
        }
        
        return originalSend.call(this, data)
      }
      
      next()
    }
  }

  // Manejador de errores no capturados
  setupErrorHandlers() {
    process.on('uncaughtException', (error) => {
      this.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
      })
      // Dar tiempo para escribir logs antes de salir
      setTimeout(() => process.exit(1), 1000)
    })
    
    process.on('unhandledRejection', (reason, promise) => {
      this.error('Unhandled Rejection', {
        reason: reason?.toString(),
        stack: reason?.stack,
        promise: promise.toString()
      })
    })
  }
}

// Factory function
export function createLogger(serviceName, options = {}) {
  const logger = new Logger(serviceName, options)
  logger.setupErrorHandlers()
  return logger
}

// Export default para uso simple
export default createLogger
