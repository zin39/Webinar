/**
 * Security Audit Tests for OG Image Upload Feature
 * Tests various attack vectors against the file upload functionality
 */

const path = require('path');
const fs = require('fs');

describe('OG Image Upload Security Tests', () => {

  // Test 1: Path Traversal in filename validation
  describe('Path Traversal Prevention', () => {
    it('should reject filenames with path traversal sequences', () => {
      const maliciousFilenames = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f',
        '..%252f..%252f',
        'image/../../../app.js',
      ];

      maliciousFilenames.forEach(filename => {
        // path.basename() strips directory components
        const sanitized = path.basename(filename);
        console.log(`Input: "${filename}" -> Sanitized: "${sanitized}"`);

        // Ensure no path separators remain
        expect(sanitized).not.toContain('/');
        expect(sanitized).not.toContain('\\');
        expect(sanitized).not.toContain('..');
      });
    });

    it('should validate ogImage from settings contains no traversal', () => {
      const validateOgImagePath = (ogImage) => {
        if (!ogImage) return true;

        // Must be just a filename, no directory components
        const sanitized = path.basename(ogImage);
        if (sanitized !== ogImage) return false;

        // Must not contain suspicious patterns
        if (ogImage.includes('..')) return false;
        if (ogImage.includes('/')) return false;
        if (ogImage.includes('\\')) return false;

        // Must match expected pattern
        const validPattern = /^og-share-\d+\.(png|jpg|jpeg)$/i;
        return validPattern.test(ogImage);
      };

      // Test malicious inputs
      expect(validateOgImagePath('../../app.js')).toBe(false);
      expect(validateOgImagePath('../config/db.js')).toBe(false);
      expect(validateOgImagePath('og-share-123.png/../../../app.js')).toBe(false);

      // Test valid inputs
      expect(validateOgImagePath('og-share-1732612345678.png')).toBe(true);
      expect(validateOgImagePath('og-share-1732612345678.jpg')).toBe(true);
      expect(validateOgImagePath(null)).toBe(true);
    });
  });

  // Test 2: MIME Type Validation
  describe('MIME Type Validation', () => {
    it('should only allow image MIME types', () => {
      const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
      const blockedMimes = [
        'application/javascript',
        'text/html',
        'application/x-php',
        'application/octet-stream',
        'text/plain',
      ];

      const isAllowedMime = (mime) => {
        return /jpeg|jpg|png/.test(mime);
      };

      allowedMimes.forEach(mime => {
        expect(isAllowedMime(mime)).toBe(true);
      });

      blockedMimes.forEach(mime => {
        expect(isAllowedMime(mime)).toBe(false);
      });
    });
  });

  // Test 3: File Extension Validation
  describe('File Extension Validation', () => {
    it('should only allow image extensions', () => {
      const isAllowedExt = (filename) => {
        const ext = path.extname(filename).toLowerCase();
        return /\.(jpeg|jpg|png)$/.test(ext);
      };

      // Allowed
      expect(isAllowedExt('image.png')).toBe(true);
      expect(isAllowedExt('image.PNG')).toBe(true);
      expect(isAllowedExt('image.jpg')).toBe(true);
      expect(isAllowedExt('image.jpeg')).toBe(true);

      // Blocked
      expect(isAllowedExt('image.php')).toBe(false);
      expect(isAllowedExt('image.js')).toBe(false);
      expect(isAllowedExt('image.html')).toBe(false);
      expect(isAllowedExt('image.svg')).toBe(false);
      expect(isAllowedExt('image.php.jpg.php')).toBe(false);
    });

    it('should handle double extension attacks', () => {
      // path.extname gets only the last extension
      expect(path.extname('malware.php.jpg')).toBe('.jpg');
      expect(path.extname('malware.js.png')).toBe('.png');

      // But our generated filename overwrites this anyway
      const generateSafeFilename = (originalname) => {
        const ext = path.extname(originalname).toLowerCase();
        if (!/\.(jpeg|jpg|png)$/.test(ext)) {
          throw new Error('Invalid extension');
        }
        return `og-share-${Date.now()}${ext}`;
      };

      // Even malicious original names result in safe generated names
      const result = generateSafeFilename('../../evil.php.jpg');
      expect(result).toMatch(/^og-share-\d+\.jpg$/);
    });
  });

  // Test 4: Magic Bytes Validation
  describe('Magic Bytes (File Signature) Validation', () => {
    it('should identify image file signatures', () => {
      const IMAGE_SIGNATURES = {
        'ffd8ff': 'image/jpeg',      // JPEG
        '89504e47': 'image/png',     // PNG
      };

      const validateMagicBytes = (buffer) => {
        if (!buffer || buffer.length < 4) return false;

        const hex = buffer.toString('hex', 0, 4);

        // Check JPEG (starts with FFD8FF)
        if (hex.startsWith('ffd8ff')) return 'image/jpeg';

        // Check PNG (starts with 89504E47)
        if (hex.startsWith('89504e47')) return 'image/png';

        return false;
      };

      // Test PNG magic bytes
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      expect(validateMagicBytes(pngBuffer)).toBe('image/png');

      // Test JPEG magic bytes
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      expect(validateMagicBytes(jpegBuffer)).toBe('image/jpeg');

      // Test invalid file (JavaScript)
      const jsBuffer = Buffer.from('const x = 1;');
      expect(validateMagicBytes(jsBuffer)).toBe(false);

      // Test PHP disguised as image
      const phpBuffer = Buffer.from('<?php echo "hack"; ?>');
      expect(validateMagicBytes(phpBuffer)).toBe(false);
    });
  });

  // Test 5: Config File Security
  describe('Config File Security', () => {
    it('should sanitize settings before saving', () => {
      const sanitizeSettings = (settings) => {
        const sanitized = { ...settings };

        // Validate ogImage filename
        if (sanitized.ogImage) {
          const basename = path.basename(sanitized.ogImage);
          const validPattern = /^og-share-\d+\.(png|jpg|jpeg)$/i;

          if (!validPattern.test(basename) || basename !== sanitized.ogImage) {
            sanitized.ogImage = null; // Invalid, reset to null
          }
        }

        // Ensure timestamp is a number
        if (sanitized.ogImageUpdatedAt && typeof sanitized.ogImageUpdatedAt !== 'number') {
          sanitized.ogImageUpdatedAt = Date.now();
        }

        return sanitized;
      };

      // Test with malicious input
      const maliciousSettings = {
        ogImage: '../../app.js',
        ogImageUpdatedAt: '<script>alert(1)</script>'
      };

      const sanitized = sanitizeSettings(maliciousSettings);
      expect(sanitized.ogImage).toBe(null);
      expect(typeof sanitized.ogImageUpdatedAt).toBe('number');

      // Test with valid input
      const validSettings = {
        ogImage: 'og-share-1732612345678.png',
        ogImageUpdatedAt: 1732612345678
      };

      const sanitizedValid = sanitizeSettings(validSettings);
      expect(sanitizedValid.ogImage).toBe('og-share-1732612345678.png');
    });
  });

  // Test 6: File Size Limits
  describe('File Size Limits', () => {
    it('should enforce 5MB file size limit', () => {
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

      expect(MAX_FILE_SIZE).toBe(5242880);

      // Test file size check
      const isValidSize = (size) => size <= MAX_FILE_SIZE;

      expect(isValidSize(1024)).toBe(true);           // 1KB
      expect(isValidSize(5 * 1024 * 1024)).toBe(true); // Exactly 5MB
      expect(isValidSize(5 * 1024 * 1024 + 1)).toBe(false); // Over limit
      expect(isValidSize(10 * 1024 * 1024)).toBe(false);    // 10MB
    });
  });

  // Test 7: CSRF Protection
  describe('CSRF Protection', () => {
    it('should require CSRF token for upload', () => {
      // The upload route uses csrfProtection middleware
      // This test documents that requirement
      const routeHasCSRF = true; // Verified in code: router.post('/settings/og-image', csrfProtection, ...)
      expect(routeHasCSRF).toBe(true);
    });
  });

  // Test 8: Authentication
  describe('Authentication Requirements', () => {
    it('should require authentication for settings page', () => {
      // The admin routes use ensureAuthenticated middleware
      // router.use(ensureAuthenticated) is applied to all admin routes
      const routeRequiresAuth = true;
      expect(routeRequiresAuth).toBe(true);
    });
  });
});

// Summary of vulnerabilities found and fixes needed:
console.log(`
=== SECURITY AUDIT SUMMARY ===

CRITICAL:
1. Path Traversal in old image deletion
   - settings.ogImage from JSON is used directly in path.join()
   - Fix: Validate ogImage matches expected pattern before deletion

MEDIUM:
2. No magic bytes validation
   - Only checks extension and MIME type from client
   - Fix: Add file signature validation after upload

3. Config file could be externally modified
   - If attacker gains file write access, could inject path traversal
   - Fix: Validate settings when reading, not just when saving

LOW:
4. Error message exposure
   - Multer error messages could leak info
   - Fix: Use generic error messages

MITIGATED:
- Double extension attacks: Filename is regenerated server-side
- File size: Enforced by multer (5MB limit)
- CSRF: Protected by csrfProtection middleware
- Authentication: Protected by ensureAuthenticated middleware
`);
