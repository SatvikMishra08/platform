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

/**
 * The error both {@link DialogueBranchClient} and {@link DialogueBranchAuthoringClient} reject
 * with on a failed request — a real `Error` subclass (`instanceof Error` works, `.stack` is
 * populated), carrying the Web Service's structured error response as properties.
 *
 * @extends Error
 */
export class DialogueBranchError extends Error {

    /**
     * @param {string} message Human-readable error message — from the Web Service's response
     * body when available, otherwise a generic description of what went wrong.
     * @param {Object} [details]
     * @param {number} details.status The HTTP status code (`0` for a network-level failure that
     * never reached the server).
     * @param {string} [details.statusText] The HTTP status text, if available.
     * @param {string|null} [details.code] The Web Service's machine-readable error code, if the
     * response body provided one.
     * @param {Object[]} [details.fieldErrors] Per-field validation errors, if any.
     * @param {Object|null} [details.errors] A structured error detail object for some failure
     * kinds (e.g. a project that fails to parse) — mirrors `/publish/verify`'s shape.
     */
    constructor(message, { status, statusText, code = null, fieldErrors = [], errors = null } = {}) {
        super(message);
        this.name = 'DialogueBranchError';
        this.status = status;
        this.statusText = statusText;
        this.code = code;
        this.fieldErrors = fieldErrors;
        this.errors = errors;
    }

}
