import { inject } from 'vue';
import { DialogueBranchClient } from '../dlb-lib/DialogueBranchClient.js';
import { logApiCall } from './debug-log.js';
import { redirectToLogin } from '../auth.js';
import { DocumentFunctions } from '../dlb-lib/util/DocumentFunctions.js';

let _client = null;

export function useClient() {
    const config = inject('config');

    if (!_client) {
        _client = new DialogueBranchClient({
            baseUrl: config.baseUrl,
            credentials: 'include',
            // CSRF header only matters to Spring Security's filter on state-changing methods —
            // that restriction is CSRF-specific, so it's applied here rather than inside the
            // client, which calls onRequest on every request regardless of method.
            onRequest: (url, init) => {
                const method = (init.method || 'GET').toUpperCase();
                if (['GET', 'HEAD'].includes(method)) return;
                const csrfToken = DocumentFunctions.getCookie('XSRF-TOKEN');
                if (csrfToken) {
                    init.headers = { ...init.headers, 'X-XSRF-TOKEN': csrfToken };
                }
            },
            onApiCall: logApiCall,
            onUnauthorized: redirectToLogin,
        });
    }

    return _client;
}

export function resetClient() {
    _client = null;
}
