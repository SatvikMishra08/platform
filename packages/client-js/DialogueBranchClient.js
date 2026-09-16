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

import { BaseClient } from "./BaseClient.js";
import { Variable } from "./model/Variable.js";

/**
 * Playback-only client for a Dialogue Branch Web Service: running dialogues (published content)
 * and reading/writing the current user's variables. No project/dialogue authoring — see
 * {@link DialogueBranchAuthoringClient} for that (`@dialoguebranch/client-js/authoring`).
 */
export class DialogueBranchClient extends BaseClient {

    logout() {
        return this._fetch(this._baseUrl + "/auth/logout", {
            method: "POST",
        }).then((response) => this._handleResponse(response));
    }

    getServerInfo() {
        return this._fetch(this._baseUrl + "/info/all", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        })
        .then((response) => this._handleResponse(response));
    }

    // Requires the `editor`/`admin` role — see the Web Service's own docs for direct API clients.
    listDialogues(projectSlug) {
        const url = this._baseUrl + "/dialogue/list-dialogues?projectSlug=" + encodeURIComponent(projectSlug);

        return this._fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        })
        .then((response) => this._handleResponse(response));
    }

    startDialogue(projectSlug, dialogueName, language, startNodeId) {
        var url = this._baseUrl + "/dialogue/start";

        url += "?projectSlug="+encodeURIComponent(projectSlug);
        url += "&dialogueName="+dialogueName;
        url += "&language="+language;
        url += "&timeZone="+this._timeZone;
        if (startNodeId) url += "&startNodeId=" + encodeURIComponent(startNodeId);
        url += this._delegateParam;

        return this._fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        })
        .then((response) => this._handleResponse(response))
        .then((json) => this.createDialogueStepObject(json));
    }

    // `inputValues`, when given, is an object mapping Dialogue Branch variable names to the values
    // the user provided for a reply's <<input>> command(s); it is sent as the JSON request body,
    // which the Web Service stores before progressing (see DialogueController.doProgressDialogue).
    progressDialogue(loggedDialogueId, loggedInteractionIndex, replyId, inputValues = null) {
        var url = this._baseUrl + "/dialogue/progress";

        url += "?loggedDialogueId="+loggedDialogueId;
        url += "&loggedInteractionIndex="+loggedInteractionIndex;
        url += "&replyId="+replyId;
        url += this._delegateParam;

        const body = inputValues ? JSON.stringify(inputValues) : null;
        return this._fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            ...(body != null ? { body } : {})
        }, body)
        .then((response) => this._handleResponse(response))
        .then((json) => json.value ? this.createDialogueStepObject(json.value) : null);
    }

    continueDialogue(projectSlug, dialogueName) {
        var url = this._baseUrl + "/dialogue/continue";

        url += "?projectSlug="+encodeURIComponent(projectSlug);
        url += "&dialogueName="+dialogueName;
        url += "&timeZone="+this._timeZone;
        url += this._delegateParam;

        return this._fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        })
        .then((response) => this._handleResponse(response))
        .then((data) => {
            var dialogueData = data?.value;
            if (dialogueData && 'dialogue' in dialogueData) {
                // Create a DialogueStep object from the received data
                return this.createDialogueStepObject(dialogueData);
            }
            return null;
        });
    }

    cancelDialogue(loggedDialogueId) {
        let url = this._baseUrl + "/dialogue/cancel?loggedDialogueId=" + loggedDialogueId;
        url += this._delegateParam;

        return this._fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        })
        .then((response) => this._handleResponse(response));
    }

    getVariables(projectSlug) {
        var url = this._baseUrl + "/variables/get";

        url += "?projectSlug="+encodeURIComponent(projectSlug);
        url += "&timeZone="+this._timeZone;
        url += this._delegateParam;

        return this._fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        })
        .then((response) => this._handleResponse(response))
        .then((data) => {
            if(data == null || data.length == 0) {
                return new Array();
            } else {
                var variables = new Array();

                data.forEach(entry => {
                    var variable = new Variable();
                    variable.name = entry.name;
                    variable.value = entry.value;
                    variable.updatedTime = entry.updatedTime;
                    variable.updatedTimeZone = entry.updatedTimeZone;
                    variable.updatedSource = entry.updatedSource;
                    variables.push(variable);
                });

                return variables;
            }
        })
    }

    getOngoingDialogue(projectSlug) {
        let url = this._baseUrl + "/dialogue/get-ongoing";
        url += "?projectSlug=" + encodeURIComponent(projectSlug);
        url += "&timeZone=" + this._timeZone;
        url += this._delegateParam;

        return this._fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        })
        .then((response) => this._handleResponse(response))
        .then((data) => data?.value ?? null);
    }

    setVariable(projectSlug, variableName, variableValue) {
        var url = this._baseUrl + "/variables/set-single";

        url += "?projectSlug="+encodeURIComponent(projectSlug);
        url += "&name="+variableName;
        if(variableValue != null) url += "&value="+variableValue;
        url += "&timeZone="+this._timeZone;
        url += this._delegateParam;

        return this._fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        })
        .then((response) => this._handleResponse(response));
    }

}
