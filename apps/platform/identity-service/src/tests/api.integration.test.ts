import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { startTestServer } from './test-setup.js'; // We will create this helper

let testServer: {
    app: Express;
    stopServer: () => Promise<void>;
} | undefined;

describe('API Endpoints (Integration)', () => {
    // Start the server once before all tests in this file
    beforeAll(async () => {
        testServer = await startTestServer();

        if (testServer == undefined)
            throw new Error("testServer undefine")

    }, 60000);

    // Stop the server once after all tests in this file
    afterAll(async () => {
        if (testServer)
            await testServer.stopServer();
    }, 60000);

    it('GET /api/auth/status should return not authenticated for unauthenticated requests', async () => {
        if (!testServer)
            throw new Error("testServer undefine")

        const response = await request(testServer.app).get('/api/auth/status');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            authenticated: false,
            user: null,
        });
    });

    it('GET /api/users/by-email/:email should fail without an internal API key', async () => {
        if (!testServer)
            throw new Error("testServer undefine")
        const response = await request(testServer.app).get('/api/users/by-email/test@example.com');

        expect(response.status).toBe(401);
        expect(response.body.error).toContain('Invalid internal API key');
    });
});