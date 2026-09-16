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

import { AutoForwardReply } from "./model/AutoForwardReply.js";
import { BasicReply } from "./model/BasicReply.js";
import { DialogueStep } from "./model/DialogueStep.js";
import { Action } from "./model/Action.js";
import { Segment } from "./model/Segment.js";
import { Statement } from "./model/Statement.js";

/**
 * Shared transport + response handling for {@link DialogueBranchClient} (playback) and
 * {@link DialogueBranchAuthoringClient} (authoring) — not part of this package's public contract
 * on its own (not re-exported via `package.json`'s `exports`), since a consumer only ever needs
 * one or both of the two concrete clients, never this base directly.
 */
export class BaseClient {

    // Transport is injected, not imported, so this client has no upward dependency on Studio
    // (or on Vue/`document`) and can run in any JS runtime. `onRequest` is the generic seam for
    // attaching auth — called on every request, not just state-changing ones, since a
    // token-based consumer needs it on GETs too; Studio's own `onRequest` restricts its CSRF
    // header to non-GET/HEAD itself, since that restriction is CSRF-specific, not generic.
    // The default binds globalThis.fetch to globalThis — native fetch throws "Illegal
    // invocation" when called as a plain property (`this._fetchImpl(...)`) instead of a method
    // on window/globalThis, since it checks its receiver's internal type.
    constructor({ baseUrl, fetch = globalThis.fetch.bind(globalThis), credentials = 'same-origin', onRequest, onApiCall, onUnauthorized } = {}) {
        this._baseUrl = baseUrl;
        this._fetchImpl = fetch;
        this._credentials = credentials;
        this._onRequest = onRequest;
        this._onApiCall = onApiCall;
        this._onUnauthorized = onUnauthorized;
        this._timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        this.delegateUser = null;
    }

    get _delegateParam() {
        return this.delegateUser ? '&delegateUser=' + encodeURIComponent(this.delegateUser) : '';
    }

    // ----------------------------------------------------------
    // ---------- Helper functions related to Dialogue ----------
    // ----------------------------------------------------------

    createDialogueStepObject(data) {
        // Instantiate an empty DialogueStep
        var dialogueStep = DialogueStep.emptyInstance();

        // Add the simple parameters
        dialogueStep.dialogueName = data.dialogue;
        dialogueStep.node = data.node;
        dialogueStep.speaker = data.speaker;
        dialogueStep.loggedDialogueId = data.loggedDialogueId;
        dialogueStep.loggedInteractionIndex = data.loggedInteractionIndex;

        // Add the statement (consisting of a list of segments)
        var statement = Statement.emptyInstance();
        data.statement.segments.forEach(
            (element) => {
                statement.addSegment(Segment.fromJSON(element));
            }
        );
        dialogueStep.statement = statement;

        // Add the replies
        data.replies.forEach(
            (element) => {
                var reply = null;
                if(element.statement == null) {
                    reply = AutoForwardReply.emptyInstance();
                } else {
                    reply = BasicReply.emptyInstance();
                }
                reply.replyId = element.replyId;
                reply.endsDialogue = element.endsDialogue;

                if(reply instanceof BasicReply) {
                    statement = Statement.emptyInstance();
                    element.statement.segments.forEach(
                        (segmentElement) => {
                            statement.addSegment(Segment.fromJSON(segmentElement));
                        }
                    );
                    reply.statement = statement;
                }
                reply.actions = (element.actions ?? []).map((a) => Action.fromJSON(a));
                dialogueStep.addReply(reply);
            }
        );
        return dialogueStep;
    }

    // Attaches credentials to every call via the injected `_credentials` mode, and gives
    // `_onRequest` a chance to mutate headers before the call goes out (e.g. Studio attaches its
    // CSRF header there — that restriction to state-changing methods is CSRF-specific, so it
    // lives at the call site, not here; `_onRequest` itself fires on every request).
    async _fetch(url, options, logRequestBody = null) {
        const method = (options?.method || 'GET').toUpperCase();
        const path = url.startsWith(this._baseUrl) ? url.slice(this._baseUrl.length) : url;

        const fetchOptions = { ...options, credentials: this._credentials };
        this._onRequest?.(url, fetchOptions);

        let response;
        try {
            response = await this._fetchImpl(url, fetchOptions);
        } catch (networkError) {
            this._onApiCall?.(method, path, 0, null, logRequestBody);
            throw networkError;
        }
        if (!this._onApiCall) {
            return response;
        }
        // Debug-log capture reads the body as text and reconstructs a new Response from that
        // string — skipped entirely above when nothing is listening, since that reconstruction
        // would corrupt binary content and isn't free.
        const text = await response.text().catch(() => null);
        this._onApiCall(method, path, response.status, text, logRequestBody);
        const nullBodyStatus = [204, 205, 304].includes(response.status);
        return new Response(nullBodyStatus ? null : text, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    }

    // Shared 401 handling. With an `onUnauthorized` hook (Studio's real-navigation login
    // redirect), returns a promise that never resolves so callers' .then()/.catch() don't fire
    // while that navigation is in flight. Without one, rejects with a normal error instead of
    // hanging forever — a consumer with no hook still needs to find out the call failed.
    _unauthorizedResult() {
        if (this._onUnauthorized) {
            this._onUnauthorized();
            return new Promise(() => {});
        }
        return Promise.reject({
            status: 401,
            statusText: 'Unauthorized',
            code: null,
            message: 'Unauthorized',
            fieldErrors: [],
            errors: null,
        });
    }

    _handleResponse(response) {
        if (response.status === 401) {
            return this._unauthorizedResult();
        }
        if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.startsWith('application/json')) {
                // A 2xx response can still have an empty/malformed body (e.g. truncated by a
                // proxy) — without this catch, response.json()'s rejection has no `status` field
                // and describeError() would mislabel it as a generic network error.
                return response.json().catch(() => Promise.reject({
                    status: response.status,
                    statusText: response.statusText,
                    code: null,
                    message: 'The server returned an invalid response.',
                    fieldErrors: [],
                    errors: null,
                }));
            } else {
                return response.text();
            }
        }
        // Error responses are JSON HttpError bodies (code, message, fieldErrors, and — for some
        // errors, e.g. a project that fails to parse — a structured "errors" field mirroring
        // /publish/verify's shape). Parse it so callers (see error-message.js) can show the
        // actual backend message instead of just the HTTP status.
        return response.json()
            .catch(() => null)
            .then((body) => Promise.reject({
                status: response.status,
                statusText: response.statusText,
                code: body?.code ?? null,
                message: body?.message ?? null,
                fieldErrors: body?.fieldErrors ?? [],
                errors: body?.errors ?? null,
            }));
    }
}
