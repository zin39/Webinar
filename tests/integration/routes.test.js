/**
 * Route Integration Tests
 * Tests all public routes and their responses
 */
const request = require('supertest');
const createTestApp = require('../testApp');

describe('Public Routes', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('GET /', () => {
    it('should return 200 and render homepage', async () => {
      const res = await request(app)
        .get('/')
        .expect(200);

      expect(res.text).toContain('Webinar');
      expect(res.text).toContain('Register');
    });

    it('should include security headers', async () => {
      const res = await request(app)
        .get('/')
        .expect(200);

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('should not expose X-Powered-By header', async () => {
      const res = await request(app)
        .get('/')
        .expect(200);

      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('GET /register', () => {
    it('should return 200 and render registration form', async () => {
      const res = await request(app)
        .get('/register')
        .expect(200);

      expect(res.text).toContain('Register');
      expect(res.text).toContain('name');
      expect(res.text).toContain('email');
      expect(res.text).toContain('_csrf');
    });

    it('should include CSRF token in form', async () => {
      const res = await request(app)
        .get('/register')
        .expect(200);

      expect(res.text).toMatch(/name="_csrf"/);
    });
  });

  describe('GET /success', () => {
    it('should return 200 and render success page', async () => {
      const res = await request(app)
        .get('/success')
        .expect(200);

      expect(res.text).toContain('Registration Successful');
    });

    it('should display email parameter if provided', async () => {
      const res = await request(app)
        .get('/success?email=test@example.com')
        .expect(200);

      expect(res.text).toContain('test@example.com');
    });
  });

  describe('GET /auth/login', () => {
    it('should return 200 and render login form', async () => {
      const res = await request(app)
        .get('/auth/login')
        .expect(200);

      expect(res.text).toContain('Login');
      expect(res.text).toContain('email');
      expect(res.text).toContain('password');
    });
  });

  describe('GET /auth/setup', () => {
    it('should return 200 when no admin exists', async () => {
      const res = await request(app)
        .get('/auth/setup')
        .expect(200);

      // Should show setup form or redirect if admin exists
      expect(res.status).toBeLessThanOrEqual(302);
    });
  });

  describe('GET /api/attendee-count', () => {
    it('should return JSON with count', async () => {
      const res = await request(app)
        .get('/api/attendee-count')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(res.body).toHaveProperty('count');
      expect(typeof res.body.count).toBe('number');
    });
  });

  describe('GET /api/webinar-config', () => {
    it('should return JSON with webinar config', async () => {
      const res = await request(app)
        .get('/api/webinar-config')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(res.body).toHaveProperty('date');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app)
        .get('/unknown-route-12345')
        .expect(404);
    });
  });
});

describe('Protected Routes (Unauthenticated)', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('GET /admin', () => {
    it('should redirect to login when not authenticated', async () => {
      const res = await request(app)
        .get('/admin')
        .expect(302);

      expect(res.headers.location).toContain('/auth/login');
    });
  });

  describe('GET /admin/export', () => {
    it('should redirect to login when not authenticated', async () => {
      const res = await request(app)
        .get('/admin/export')
        .expect(302);

      expect(res.headers.location).toContain('/auth/login');
    });
  });
});
