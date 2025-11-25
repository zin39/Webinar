/**
 * Database Unit Tests
 * Tests Prisma models and database operations
 */
const { PrismaClient } = require('@prisma/client');

describe('Database Connection', () => {
  let prisma;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should connect to database', async () => {
    await expect(prisma.$connect()).resolves.not.toThrow();
  });

  it('should be able to query database', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    expect(result).toBeDefined();
  });
});

describe('Attendee Model', () => {
  let prisma;
  let testAttendeeId;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    // Cleanup test data
    if (testAttendeeId) {
      await prisma.attendee.delete({ where: { id: testAttendeeId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('should create an attendee', async () => {
    const email = `test-${Date.now()}@example.com`;
    const attendee = await prisma.attendee.create({
      data: {
        name: 'Test Attendee',
        email: email,
        company: 'Test Company',
        jobTitle: 'Developer'
      }
    });

    testAttendeeId = attendee.id;

    expect(attendee).toBeDefined();
    expect(attendee.id).toBeDefined();
    expect(attendee.name).toBe('Test Attendee');
    expect(attendee.email).toBe(email);
    expect(attendee.emailSent).toBe(false);
  });

  it('should not allow duplicate emails', async () => {
    const email = `unique-${Date.now()}@example.com`;

    // Create first attendee
    await prisma.attendee.create({
      data: {
        name: 'First Attendee',
        email: email
      }
    });

    // Try to create duplicate
    await expect(
      prisma.attendee.create({
        data: {
          name: 'Second Attendee',
          email: email
        }
      })
    ).rejects.toThrow();

    // Cleanup
    await prisma.attendee.delete({ where: { email } });
  });

  it('should update emailSent status', async () => {
    const email = `update-test-${Date.now()}@example.com`;
    const attendee = await prisma.attendee.create({
      data: {
        name: 'Update Test',
        email: email
      }
    });

    const updated = await prisma.attendee.update({
      where: { id: attendee.id },
      data: { emailSent: true }
    });

    expect(updated.emailSent).toBe(true);

    // Cleanup
    await prisma.attendee.delete({ where: { id: attendee.id } });
  });

  it('should count attendees', async () => {
    const count = await prisma.attendee.count();
    expect(typeof count).toBe('number');
  });
});

describe('User Model', () => {
  let prisma;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should find user by email', async () => {
    // This test checks the query works, even if no user exists
    const user = await prisma.user.findUnique({
      where: { email: 'nonexistent@example.com' }
    });

    expect(user).toBeNull();
  });

  it('should check if any user exists', async () => {
    const user = await prisma.user.findFirst();
    // Returns user or null, both are valid
    expect(user === null || user.id).toBeTruthy();
  });
});

describe('WebinarConfig Model', () => {
  let prisma;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should find active webinar config', async () => {
    const config = await prisma.webinarConfig.findFirst({
      where: { isActive: true }
    });

    // May or may not exist, both are valid
    expect(config === null || config.id).toBeTruthy();
  });
});
