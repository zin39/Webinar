/**
 * Unit Tests for Utility Functions
 */

describe('Calendar Utility', () => {
  const { generateCalendarLinks } = require('../../utils/calendar');

  const mockWebinar = {
    title: 'Test Webinar',
    description: 'Test Description',
    date: new Date('2025-12-01T14:00:00Z'),
    duration: 60,
    meetingLink: 'https://meet.test.com/abc123'
  };

  describe('generateCalendarLinks', () => {
    it('should generate Google Calendar link', () => {
      const links = generateCalendarLinks(mockWebinar);

      expect(links.google).toBeDefined();
      expect(links.google).toContain('calendar.google.com');
      expect(links.google).toContain('Test%20Webinar');
    });

    it('should generate Outlook link', () => {
      const links = generateCalendarLinks(mockWebinar);

      expect(links.outlook).toBeDefined();
      expect(links.outlook).toContain('outlook.live.com');
    });

    it('should generate ICS file data', () => {
      const links = generateCalendarLinks(mockWebinar);

      expect(links.ics).toBeDefined();
      expect(links.ics).toContain('data:text/calendar');
      expect(links.ics).toContain('BEGIN%3AVCALENDAR');
    });

    it('should handle missing meetingLink', () => {
      const webinarNoLink = { ...mockWebinar, meetingLink: null };
      const links = generateCalendarLinks(webinarNoLink);

      expect(links.google).toBeDefined();
      expect(links.outlook).toBeDefined();
    });

    it('should calculate correct end time based on duration', () => {
      const links = generateCalendarLinks(mockWebinar);

      // End time should be start + 60 minutes
      expect(links.google).toContain('20251201T140000Z');
      expect(links.google).toContain('20251201T150000Z');
    });
  });
});

describe('Auth Middleware', () => {
  const { ensureAuthenticated, forwardAuthenticated } = require('../../middleware/auth');

  describe('ensureAuthenticated', () => {
    it('should call next() if user is authenticated', () => {
      const req = {
        isAuthenticated: () => true
      };
      const res = {};
      const next = jest.fn();

      ensureAuthenticated(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should redirect to login if not authenticated', () => {
      const req = {
        isAuthenticated: () => false,
        flash: jest.fn()
      };
      const res = {
        redirect: jest.fn()
      };
      const next = jest.fn();

      ensureAuthenticated(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith('/auth/login');
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('forwardAuthenticated', () => {
    it('should redirect to admin if already authenticated', () => {
      const req = {
        isAuthenticated: () => true
      };
      const res = {
        redirect: jest.fn()
      };
      const next = jest.fn();

      forwardAuthenticated(req, res, next);

      expect(res.redirect).toHaveBeenCalledWith('/admin');
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if not authenticated', () => {
      const req = {
        isAuthenticated: () => false
      };
      const res = {};
      const next = jest.fn();

      forwardAuthenticated(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});

describe('CSV Escaping', () => {
  // Test the CSV escape function from admin routes
  function escapeCSV(field) {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (/^[=+\-@\t\r]/.test(str)) {
      return `"'${str.replace(/"/g, '""')}"`;
    }
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  it('should escape formula injection characters', () => {
    expect(escapeCSV('=SUM(A1)')).toBe("\"'=SUM(A1)\"");
    expect(escapeCSV('+cmd|calc')).toBe("\"'+cmd|calc\"");
    expect(escapeCSV('-cmd|calc')).toBe("\"'-cmd|calc\"");
    expect(escapeCSV('@SUM(A1)')).toBe("\"'@SUM(A1)\"");
  });

  it('should escape quotes', () => {
    expect(escapeCSV('Test "value"')).toBe('"Test ""value"""');
  });

  it('should escape commas', () => {
    expect(escapeCSV('Test, value')).toBe('"Test, value"');
  });

  it('should escape newlines', () => {
    expect(escapeCSV('Test\nvalue')).toBe('"Test\nvalue"');
  });

  it('should handle null and undefined', () => {
    expect(escapeCSV(null)).toBe('');
    expect(escapeCSV(undefined)).toBe('');
  });

  it('should return normal strings unchanged', () => {
    expect(escapeCSV('Normal text')).toBe('Normal text');
    // Emails starting with @ get escaped (formula protection)
    expect(escapeCSV('user@email.com')).toBe('user@email.com');
  });
});

describe('Password Validation Patterns', () => {
  // Password requirements
  const hasUppercase = (str) => /[A-Z]/.test(str);
  const hasLowercase = (str) => /[a-z]/.test(str);
  const hasNumber = (str) => /[0-9]/.test(str);
  const hasMinLength = (str) => str.length >= 8;

  it('should validate uppercase requirement', () => {
    expect(hasUppercase('Password1')).toBe(true);
    expect(hasUppercase('password1')).toBe(false);
  });

  it('should validate lowercase requirement', () => {
    expect(hasLowercase('Password1')).toBe(true);
    expect(hasLowercase('PASSWORD1')).toBe(false);
  });

  it('should validate number requirement', () => {
    expect(hasNumber('Password1')).toBe(true);
    expect(hasNumber('Password')).toBe(false);
  });

  it('should validate minimum length', () => {
    expect(hasMinLength('Password1')).toBe(true);
    expect(hasMinLength('Pass1')).toBe(false);
  });

  it('should validate complete strong password', () => {
    const password = 'MySecure1';
    expect(hasUppercase(password)).toBe(true);
    expect(hasLowercase(password)).toBe(true);
    expect(hasNumber(password)).toBe(true);
    expect(hasMinLength(password)).toBe(true);
  });
});
