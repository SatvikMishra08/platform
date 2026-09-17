/* @license
 *
 *                Copyright (c) 2023-2026 Fruit Tree Labs (www.fruittreelabs.com)
 *
 *
 *     This material is part of the Dialogue Branch Platform, and is covered by the MIT License
 *                                        as outlined below.
 *
 *                                            ----------
 *
 * Copyright (c) 2023-2026 Fruit Tree Labs (www.fruittreelabs.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 * associated documentation files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
 * NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// Covers BaseClient's shared transport plumbing (_unauthorizedResult's onUnauthorized-hook
// branch, and _fetch's onApiCall gating) via DialogueBranchClient, the concrete class it's
// tested through — BaseClient itself isn't part of the package's public exports.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { DialogueBranchClient } from './DialogueBranchClient.js';

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('_unauthorizedResult', () => {
    it('with an onUnauthorized hook: calls it and never resolves or rejects', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
        const onUnauthorized = vi.fn();
        const client = new DialogueBranchClient({ baseUrl: '/api/v1', onUnauthorized });

        let settled = false;
        client.getServerInfo().then(() => { settled = true; }, () => { settled = true; });
        // Let any pending microtasks run; a settled promise would have fired its callback by now.
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(onUnauthorized).toHaveBeenCalledTimes(1);
        expect(settled).toBe(false);
    });
});

describe('onApiCall gating', () => {
    it('is called with method, path, status and both bodies on success', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
            serviceVersion: '0.1.8', protocolVersion: '1', build: 'b', upTime: '1h',
        })));
        const onApiCall = vi.fn();
        const client = new DialogueBranchClient({ baseUrl: '/api/v1', onApiCall });

        await client.getServerInfo();

        expect(onApiCall).toHaveBeenCalledTimes(1);
        const [method, path, status, responseBody, requestBody] = onApiCall.mock.calls[0];
        expect(method).toBe('GET');
        expect(path).toBe('/info/all');
        expect(status).toBe(200);
        expect(JSON.parse(responseBody)).toEqual({
            serviceVersion: '0.1.8', protocolVersion: '1', build: 'b', upTime: '1h',
        });
        expect(requestBody).toBeNull();
    });

    it('the reconstructed Response is still correctly parsed downstream', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
            serviceVersion: '0.1.8', protocolVersion: '1', build: 'b', upTime: '1h',
        })));
        const client = new DialogueBranchClient({ baseUrl: '/api/v1', onApiCall: vi.fn() });

        const info = await client.getServerInfo();

        expect(info.serviceVersion).toBe('0.1.8');
    });

    it('is called with status 0 and a null response body on a network error', async () => {
        const networkError = new TypeError('Failed to fetch');
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError));
        const onApiCall = vi.fn();
        const client = new DialogueBranchClient({ baseUrl: '/api/v1', onApiCall });

        await expect(client.getServerInfo()).rejects.toBe(networkError);

        expect(onApiCall).toHaveBeenCalledTimes(1);
        const [method, path, status, responseBody] = onApiCall.mock.calls[0];
        expect(method).toBe('GET');
        expect(path).toBe('/info/all');
        expect(status).toBe(0);
        expect(responseBody).toBeNull();
    });

    it('is not called at all when unset', async () => {
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
            serviceVersion: '0.1.8', protocolVersion: '1', build: 'b', upTime: '1h',
        }));
        vi.stubGlobal('fetch', fetchMock);
        const client = new DialogueBranchClient({ baseUrl: '/api/v1' });

        const info = await client.getServerInfo();

        expect(info.serviceVersion).toBe('0.1.8');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
