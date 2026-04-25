import Fastify from 'fastify';
import { AppError, ValidationError } from '../errors';
import { buildApp } from '../app';

describe('Global Error Handler', () => {
  let app: any;

  beforeAll(async () => {
    app = await buildApp();
    
    // Add a test route that throws
    app.get('/test-error', async () => {
      throw new Error('Technical database error');
    });

    app.get('/test-app-error', async () => {
      throw new ValidationError('Specific validation failed', { field: 'amount' });
    });
    
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should mask technical errors with a generic message', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test-error',
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('An unexpected error occurred. Please try again later.');
    expect(body.code).toBe('internal_server_error');
    // Ensure technical details are NOT in the response
    expect(response.payload).not.toContain('Technical database error');
  });

  it('should preserve AppError messages and codes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test-app-error',
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe('Specific validation failed');
    expect(body.code).toBe('validation_error');
    expect(body.details).toEqual({ field: 'amount' });
  });
});
