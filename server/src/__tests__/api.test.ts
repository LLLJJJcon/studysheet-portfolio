import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app';

const TEST_MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/studysheet_test';

let token: string;
const testEmail = `test_${Date.now()}@example.com`;
const testPassword = 'testPassword123';

beforeAll(async () => {
  await mongoose.connect(TEST_MONGO_URI);
});

afterAll(async () => {
  // Clean up test data
  if (mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }
  await mongoose.disconnect();
});

describe('Health Check', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('Auth Endpoints', () => {
  describe('POST /api/auth/register', () => {
    it('creates a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(testEmail);
      token = res.body.token;
    });

    it('rejects duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(409);
    });

    it('rejects missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'x@x.com' });

      expect(res.status).toBe(400);
    });

    it('rejects short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'short@x.com', password: '123' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('rejects wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'wrong' });

      expect(res.status).toBe(401);
    });

    it('rejects non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@x.com', password: testPassword });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns user info with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(testEmail);
    });

    it('rejects without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('rejects invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken');

      expect(res.status).toBe(401);
    });
  });
});

describe('Course Endpoints', () => {
  let courseId: string;

  describe('POST /api/courses', () => {
    it('creates a new course', async () => {
      const res = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Course', description: 'A test course' });

      expect(res.status).toBe(201);
      expect(res.body.course.name).toBe('Test Course');
      courseId = res.body.course._id;
    });

    it('rejects without auth', async () => {
      const res = await request(app)
        .post('/api/courses')
        .send({ name: 'No Auth' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/courses', () => {
    it('lists user courses', async () => {
      const res = await request(app)
        .get('/api/courses')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.courses)).toBe(true);
      expect(res.body.courses.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/courses/:id', () => {
    it('returns a specific course', async () => {
      const res = await request(app)
        .get(`/api/courses/${courseId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.course.name).toBe('Test Course');
    });

    it('returns 404 for non-existent course', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/courses/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/courses/:id', () => {
    it('updates a course', async () => {
      const res = await request(app)
        .put(`/api/courses/${courseId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Course' });

      expect(res.status).toBe(200);
      expect(res.body.course.name).toBe('Updated Course');
    });
  });

  describe('DELETE /api/courses/:id', () => {
    it('deletes a course', async () => {
      const res = await request(app)
        .delete(`/api/courses/${courseId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it('returns 404 after deletion', async () => {
      const res = await request(app)
        .get(`/api/courses/${courseId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });
});
