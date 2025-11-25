/**
 * Security Integration Tests
 * Tests CSRF, rate limiting, input validation, and security headers
 */
const request = require('supertest');
const createTestApp = require('../testApp');

describe('Security Features', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('CSRF Protection', () => {
    it('should reject POST /register without CSRF token', async () => {
      const res = await request(app)
        .post('/register')
        .send({
          name: 'Test User',
          email: 'test@example.com'
        })
        .expect(403);
    });

    it('should reject POST /auth/login without CSRF token', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'password123'
        })
        .expect(403);
    });

    it('should reject POST /auth/setup without CSRF token', async () => {
      const res = await request(app)
        .post('/auth/setup')
        .send({
          name: 'Admin',
          email: 'admin@example.com',
          password: 'Password123',
          password2: 'Password123'
        })
        .expect(403);
    });
  });

  describe('Security Headers', () => {
    it('should include X-Content-Type-Options header', async () => {
      const res = await request(app).get('/');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should include X-Frame-Options header', async () => {
      const res = await request(app).get('/');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('should include X-DNS-Prefetch-Control header', async () => {
      const res = await request(app).get('/');
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
    });

    it('should include Referrer-Policy header', async () => {
      const res = await request(app).get('/');
      expect(res.headers['referrer-policy']).toBeDefined();
    });

    it('should not include X-Powered-By header', async () => {
      const res = await request(app).get('/');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Input Validation', () => {
    let csrfToken;
    let cookies;

    beforeEach(async () => {
      // Get CSRF token from registration page
      const res = await request(app).get('/register');
      cookies = res.headers['set-cookie'];

      // Extract CSRF token from HTML
      const match = res.text.match(/name="_csrf" value="([^"]+)"/);
      csrfToken = match ? match[1] : '';
    });

    it('should reject registration with invalid email', async () => {
      const res = await request(app)
        .post('/register')
        .set('Cookie', cookies)
        .send({
          _csrf: csrfToken,
          name: 'Test User',
          email: 'invalid-email'
        });

      expect(res.text).toContain('Valid email is required');
    });

    it('should reject registration with empty name', async () => {
      const res = await request(app)
        .post('/register')
        .set('Cookie', cookies)
        .send({
          _csrf: csrfToken,
          name: '',
          email: 'test@example.com'
        });

      expect(res.text).toContain('Name is required');
    });
  });

  describe('Rate Limiting Headers', () => {
    it('should include rate limit headers', async () => {
      const res = await request(app).get('/');

      expect(res.headers['ratelimit-limit']).toBeDefined();
      expect(res.headers['ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Body Size Limits', () => {
    it('should reject oversized JSON body', async () => {
      const largeBody = { data: 'x'.repeat(20000) };

      const res = await request(app)
        .post('/api/test')
        .send(largeBody)
        .expect(413);
    });
  });
});

describe('XSS Prevention', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  it('should escape HTML in success page email parameter', async () => {
    const xssPayload = '<script>alert("xss")</script>';
    const res = await request(app)
      .get(`/success?email=${encodeURIComponent(xssPayload)}`)
      .expect(200);

    // Should not contain raw script tag
    expect(res.text).not.toContain('<script>alert');
    // Should be escaped
    expect(res.text).toContain('&lt;script&gt;');
  });
});

describe('Session Security', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  it('should set httpOnly cookie', async () => {
    const res = await request(app).get('/');
    const cookies = res.headers['set-cookie'];

    if (cookies) {
      const sessionCookie = cookies.find(c => c.includes('sessionId'));
      if (sessionCookie) {
        expect(sessionCookie).toContain('HttpOnly');
      }
    }
  });

  it('should set SameSite cookie attribute', async () => {
    const res = await request(app).get('/');
    const cookies = res.headers['set-cookie'];

    if (cookies) {
      const sessionCookie = cookies.find(c => c.includes('sessionId'));
      if (sessionCookie) {
        expect(sessionCookie.toLowerCase()).toContain('samesite');
      }
    }
  });
});
