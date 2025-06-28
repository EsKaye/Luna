const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const winston = require('winston');

class SecurityService {
  constructor(logger) {
    this.logger = logger;
    this.encryptionAlgorithms = {
      'aes-256-gcm': { keyLength: 32, ivLength: 16, tagLength: 16 },
      'aes-256-cbc': { keyLength: 32, ivLength: 16 },
      'chacha20-poly1305': { keyLength: 32, ivLength: 12, tagLength: 16 }
    };
    this.initializeSecurity();
  }

  async initializeSecurity() {
    try {
      // Initialize security logging
      this.securityLogger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        defaultMeta: { service: 'security' },
        transports: [
          new winston.transports.File({ 
            filename: 'logs/security.log',
            level: 'info'
          }),
          new winston.transports.File({ 
            filename: 'logs/security-error.log',
            level: 'error'
          })
        ]
      });

      // Initialize rate limiting cache
      this.rateLimitCache = new Map();
      
      // Initialize blacklist
      this.blacklist = new Set();
      
      this.logger.info('Security service initialized');

    } catch (error) {
      this.logger.error('Security initialization failed:', error);
    }
  }

  async encrypt(data, algorithm = 'aes-256-gcm') {
    try {
      const algo = this.encryptionAlgorithms[algorithm];
      if (!algo) {
        throw new Error(`Unsupported algorithm: ${algorithm}`);
      }

      // Generate key and IV
      const key = crypto.randomBytes(algo.keyLength);
      const iv = crypto.randomBytes(algo.ivLength);

      // Convert data to buffer if it's a string
      const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');

      let encrypted;
      let tag;

      if (algorithm === 'aes-256-gcm') {
        const cipher = crypto.createCipherGCM(algorithm, key, iv);
        encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);
        tag = cipher.getAuthTag();
      } else if (algorithm === 'aes-256-cbc') {
        const cipher = crypto.createCipher(algorithm, key, iv);
        encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);
      } else if (algorithm === 'chacha20-poly1305') {
        const cipher = crypto.createCipher(algorithm, key, iv);
        encrypted = Buffer.concat([cipher.update(dataBuffer), cipher.final()]);
        tag = cipher.getAuthTag();
      }

      // Combine IV, encrypted data, and auth tag
      const result = Buffer.concat([iv, encrypted]);
      if (tag) {
        result = Buffer.concat([result, tag]);
      }

      // Return base64 encoded result and key
      return {
        encrypted: result.toString('base64'),
        key: key.toString('base64'),
        algorithm
      };

    } catch (error) {
      this.logger.error('Encryption failed:', error);
      throw error;
    }
  }

  async decrypt(encryptedData, key, algorithm = 'aes-256-gcm') {
    try {
      const algo = this.encryptionAlgorithms[algorithm];
      if (!algo) {
        throw new Error(`Unsupported algorithm: ${algorithm}`);
      }

      // Decode base64 data
      const encryptedBuffer = Buffer.from(encryptedData, 'base64');
      const keyBuffer = Buffer.from(key, 'base64');

      // Extract IV, encrypted data, and auth tag
      const iv = encryptedBuffer.slice(0, algo.ivLength);
      let encrypted = encryptedBuffer.slice(algo.ivLength);
      let tag;

      if (algo.tagLength) {
        encrypted = encryptedBuffer.slice(algo.ivLength, -algo.tagLength);
        tag = encryptedBuffer.slice(-algo.tagLength);
      }

      let decrypted;

      if (algorithm === 'aes-256-gcm') {
        const decipher = crypto.createDecipherGCM(algorithm, keyBuffer, iv);
        decipher.setAuthTag(tag);
        decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      } else if (algorithm === 'aes-256-cbc') {
        const decipher = crypto.createDecipher(algorithm, keyBuffer, iv);
        decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      } else if (algorithm === 'chacha20-poly1305') {
        const decipher = crypto.createDecipher(algorithm, keyBuffer, iv);
        decipher.setAuthTag(tag);
        decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      }

      return decrypted.toString('utf8');

    } catch (error) {
      this.logger.error('Decryption failed:', error);
      throw error;
    }
  }

  async hashPassword(password, saltRounds = 12) {
    try {
      const salt = await bcrypt.genSalt(saltRounds);
      const hash = await bcrypt.hash(password, salt);
      
      this.securityLogger.info('Password hashed successfully');
      
      return hash;
    } catch (error) {
      this.logger.error('Password hashing failed:', error);
      throw error;
    }
  }

  async verifyPassword(password, hash) {
    try {
      const isValid = await bcrypt.compare(password, hash);
      
      this.securityLogger.info('Password verification completed', {
        isValid,
        timestamp: new Date().toISOString()
      });
      
      return isValid;
    } catch (error) {
      this.logger.error('Password verification failed:', error);
      throw error;
    }
  }

  generateToken(payload, secret = process.env.JWT_SECRET, options = {}) {
    try {
      const defaultOptions = {
        expiresIn: '24h',
        issuer: 'celestial-syndicate',
        audience: 'celestial-syndicate-users'
      };

      const token = jwt.sign(payload, secret, { ...defaultOptions, ...options });
      
      this.securityLogger.info('JWT token generated', {
        userId: payload.userId,
        timestamp: new Date().toISOString()
      });
      
      return token;
    } catch (error) {
      this.logger.error('Token generation failed:', error);
      throw error;
    }
  }

  verifyToken(token, secret = process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, secret);
      
      // Check if token is blacklisted
      if (this.blacklist.has(token)) {
        throw new Error('Token is blacklisted');
      }
      
      this.securityLogger.info('JWT token verified', {
        userId: decoded.userId,
        timestamp: new Date().toISOString()
      });
      
      return decoded;
    } catch (error) {
      this.logger.error('Token verification failed:', error);
      throw error;
    }
  }

  blacklistToken(token) {
    try {
      this.blacklist.add(token);
      
      // Set expiration for blacklisted token (24 hours)
      setTimeout(() => {
        this.blacklist.delete(token);
      }, 24 * 60 * 60 * 1000);
      
      this.securityLogger.info('Token blacklisted', {
        timestamp: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      this.logger.error('Token blacklisting failed:', error);
      throw error;
    }
  }

  generateSecureRandom(length = 32) {
    try {
      return crypto.randomBytes(length).toString('hex');
    } catch (error) {
      this.logger.error('Secure random generation failed:', error);
      throw error;
    }
  }

  generateAPIKey(prefix = 'cs') {
    try {
      const randomPart = this.generateSecureRandom(16);
      const timestamp = Date.now().toString(36);
      return `${prefix}_${timestamp}_${randomPart}`;
    } catch (error) {
      this.logger.error('API key generation failed:', error);
      throw error;
    }
  }

  async rateLimit(identifier, limit = 100, windowMs = 15 * 60 * 1000) {
    try {
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Get existing requests for this identifier
      const requests = this.rateLimitCache.get(identifier) || [];
      
      // Remove old requests outside the window
      const validRequests = requests.filter(timestamp => timestamp > windowStart);
      
      // Check if limit exceeded
      if (validRequests.length >= limit) {
        this.securityLogger.warn('Rate limit exceeded', {
          identifier,
          limit,
          windowMs,
          timestamp: new Date().toISOString()
        });
        
        return {
          allowed: false,
          remaining: 0,
          resetTime: validRequests[0] + windowMs
        };
      }
      
      // Add current request
      validRequests.push(now);
      this.rateLimitCache.set(identifier, validRequests);
      
      return {
        allowed: true,
        remaining: limit - validRequests.length,
        resetTime: now + windowMs
      };
      
    } catch (error) {
      this.logger.error('Rate limiting failed:', error);
      throw error;
    }
  }

  validateInput(input, rules) {
    try {
      const errors = [];
      
      for (const [field, rule] of Object.entries(rules)) {
        const value = input[field];
        
        if (rule.required && !value) {
          errors.push(`${field} is required`);
          continue;
        }
        
        if (value) {
          // Type validation
          if (rule.type && typeof value !== rule.type) {
            errors.push(`${field} must be of type ${rule.type}`);
          }
          
          // Length validation
          if (rule.minLength && value.length < rule.minLength) {
            errors.push(`${field} must be at least ${rule.minLength} characters`);
          }
          
          if (rule.maxLength && value.length > rule.maxLength) {
            errors.push(`${field} must be at most ${rule.maxLength} characters`);
          }
          
          // Pattern validation
          if (rule.pattern && !rule.pattern.test(value)) {
            errors.push(`${field} format is invalid`);
          }
          
          // Custom validation
          if (rule.validator && typeof rule.validator === 'function') {
            try {
              const isValid = rule.validator(value);
              if (!isValid) {
                errors.push(`${field} validation failed`);
              }
            } catch (error) {
              errors.push(`${field} validation error: ${error.message}`);
            }
          }
        }
      }
      
      return {
        isValid: errors.length === 0,
        errors
      };
      
    } catch (error) {
      this.logger.error('Input validation failed:', error);
      throw error;
    }
  }

  sanitizeInput(input, options = {}) {
    try {
      const sanitized = {};
      
      for (const [key, value] of Object.entries(input)) {
        if (typeof value === 'string') {
          // Remove HTML tags
          if (options.removeHtml) {
            sanitized[key] = value.replace(/<[^>]*>/g, '');
          }
          
          // Escape special characters
          if (options.escapeHtml) {
            sanitized[key] = value
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#x27;');
          }
          
          // Trim whitespace
          if (options.trim) {
            sanitized[key] = value.trim();
          }
          
          // Convert to lowercase
          if (options.toLowerCase) {
            sanitized[key] = value.toLowerCase();
          }
          
          // If no sanitization options specified, just trim
          if (!options.removeHtml && !options.escapeHtml && !options.trim && !options.toLowerCase) {
            sanitized[key] = value.trim();
          }
        } else {
          sanitized[key] = value;
        }
      }
      
      return sanitized;
      
    } catch (error) {
      this.logger.error('Input sanitization failed:', error);
      throw error;
    }
  }

  detectThreats(request) {
    try {
      const threats = [];
      
      // SQL Injection detection
      const sqlPatterns = [
        /(\b(union|select|insert|update|delete|drop|create|alter)\b)/i,
        /(\b(and|or)\b\s+\d+\s*=\s*\d+)/i,
        /(\b(and|or)\b\s+['"]\w+['"]\s*=\s*['"]\w+['"])/i
      ];
      
      const requestString = JSON.stringify(request);
      for (const pattern of sqlPatterns) {
        if (pattern.test(requestString)) {
          threats.push({
            type: 'sql_injection',
            pattern: pattern.source,
            severity: 'high'
          });
        }
      }
      
      // XSS detection
      const xssPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /<iframe[^>]*>/gi
      ];
      
      for (const pattern of xssPatterns) {
        if (pattern.test(requestString)) {
          threats.push({
            type: 'xss',
            pattern: pattern.source,
            severity: 'high'
          });
        }
      }
      
      // Path traversal detection
      const pathPatterns = [
        /\.\.\//g,
        /\.\.\\/g
      ];
      
      for (const pattern of pathPatterns) {
        if (pattern.test(requestString)) {
          threats.push({
            type: 'path_traversal',
            pattern: pattern.source,
            severity: 'medium'
          });
        }
      }
      
      if (threats.length > 0) {
        this.securityLogger.warn('Security threats detected', {
          threats,
          request: {
            method: request.method,
            url: request.url,
            ip: request.ip,
            userAgent: request.headers?.['user-agent']
          },
          timestamp: new Date().toISOString()
        });
      }
      
      return {
        hasThreats: threats.length > 0,
        threats,
        riskLevel: this.calculateRiskLevel(threats)
      };
      
    } catch (error) {
      this.logger.error('Threat detection failed:', error);
      throw error;
    }
  }

  calculateRiskLevel(threats) {
    try {
      const severityScores = {
        low: 1,
        medium: 2,
        high: 3,
        critical: 4
      };
      
      const totalScore = threats.reduce((score, threat) => {
        return score + (severityScores[threat.severity] || 1);
      }, 0);
      
      if (totalScore >= 8) return 'critical';
      if (totalScore >= 5) return 'high';
      if (totalScore >= 3) return 'medium';
      return 'low';
      
    } catch (error) {
      this.logger.error('Risk level calculation failed:', error);
      return 'unknown';
    }
  }

  async auditLog(action, userId, details = {}) {
    try {
      const auditEntry = {
        action,
        userId,
        timestamp: new Date().toISOString(),
        ip: details.ip,
        userAgent: details.userAgent,
        resource: details.resource,
        outcome: details.outcome || 'success',
        metadata: details.metadata || {}
      };
      
      this.securityLogger.info('Audit log entry', auditEntry);
      
      return auditEntry;
      
    } catch (error) {
      this.logger.error('Audit logging failed:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      const health = {
        status: 'healthy',
        service: 'Security Service',
        timestamp: new Date().toISOString(),
        features: {
          encryption: true,
          hashing: true,
          jwt: true,
          rateLimiting: true,
          inputValidation: true,
          threatDetection: true,
          auditLogging: true
        },
        algorithms: Object.keys(this.encryptionAlgorithms),
        blacklistedTokens: this.blacklist.size,
        rateLimitEntries: this.rateLimitCache.size
      };
      
      return health;
    } catch (error) {
      this.logger.error('Security health check failed:', error);
      return { status: 'unhealthy', error: error.message };
    }
  }
}

module.exports = SecurityService; 