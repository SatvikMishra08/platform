import { describe, it, expect, vi, afterEach } from 'vitest';
import { DialogueBranchClient } from './DialogueBranchClient.js';
import { DialogueBranchAuthoringClient } from './DialogueBranchAuthoringClient.js';
import { DialogueBranchError } from './DialogueBranchError.js';

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('DialogueBranchError', () => {
    it('is a real Error subclass', () => {
        const error = new DialogueBranchError('boom', { status: 500 });
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DialogueBranchError);
        expect(error.name).toBe('DialogueBranchError');
        expect(error.message).toBe('boom');
        expect(error.stack).toBeDefined();
    });

    it('defaults code/fieldErrors/errors when not given', () => {
        const error = new DialogueBranchError('boom', { status: 500 });
        expect(error.code).toBeNull();
        expect(error.fieldErrors).toEqual([]);
        expect(error.errors).toBeNull();
    });
});

describe('rejected requests reject with a DialogueBranchError', () => {
    it('a structured HttpError body (code, message, fieldErrors, errors)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
            code: 'PROJECT_NOT_FOUND',
            message: 'No project with slug "missing".',
            fieldErrors: [{ field: 'projectSlug', message: 'unknown' }],
            errors: null,
        }, 404)));

        const client = new DialogueBranchClient({ baseUrl: '/api/v1' });
        const error = await client.getServerInfo().catch((e) => e);

        expect(error).toBeInstanceOf(DialogueBranchError);
        expect(error.status).toBe(404);
        expect(error.code).toBe('PROJECT_NOT_FOUND');
        expect(error.message).toBe('No project with slug "missing".');
        expect(error.fieldErrors).toEqual([{ field: 'projectSlug', message: 'unknown' }]);
    });

    it('an error response with no parseable JSON body', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response('<html>502 Bad Gateway</html>', { status: 502 }),
        ));

        const client = new DialogueBranchClient({ baseUrl: '/api/v1' });
        const error = await client.getServerInfo().catch((e) => e);

        expect(error).toBeInstanceOf(DialogueBranchError);
        expect(error.status).toBe(502);
        expect(error.message).toBe('The server returned an error (502).');
    });

    it('a 2xx response with a malformed JSON body', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            new Response('not json', { status: 200, headers: { 'content-type': 'application/json' } }),
        ));

        const client = new DialogueBranchClient({ baseUrl: '/api/v1' });
        const error = await client.getServerInfo().catch((e) => e);

        expect(error).toBeInstanceOf(DialogueBranchError);
        expect(error.status).toBe(200);
        expect(error.message).toBe('The server returned an invalid response.');
    });

    it('a 401 with no onUnauthorized hook (rejects instead of hanging)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

        const client = new DialogueBranchClient({ baseUrl: '/api/v1' });
        const error = await client.getServerInfo().catch((e) => e);

        expect(error).toBeInstanceOf(DialogueBranchError);
        expect(error.status).toBe(401);
    });

    it('exportProject on a failed export (its own bypass path)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
            code: 'FORBIDDEN', message: 'Admin role required.',
        }, 403)));

        const client = new DialogueBranchAuthoringClient({ baseUrl: '/api/v1' });
        const error = await client.exportProject('default-test').catch((e) => e);

        expect(error).toBeInstanceOf(DialogueBranchError);
        expect(error.status).toBe(403);
        expect(error.code).toBe('FORBIDDEN');
        expect(error.message).toBe('Admin role required.');
    });
});
