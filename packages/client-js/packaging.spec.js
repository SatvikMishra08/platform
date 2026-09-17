import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('.', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf8'));
let packedFiles;

beforeAll(() => {
    // npm test supplies its CLI path, avoiding platform-specific npm shell shims.
    const output = execFileSync(process.execPath, [
        process.env.npm_execpath, 'pack', '--dry-run', '--json', '--ignore-scripts',
    ], { cwd: packageRoot, encoding: 'utf8' });
    packedFiles = JSON.parse(output)[0].files.map(file => file.path);
}, 30000);

describe('npm package contents', () => {
    it('ships the runtime modules, including the shared client base', () => {
        expect(packedFiles).toEqual(expect.arrayContaining([
            'BaseClient.js', 'ClientState.js', 'DialogueBranchClient.js',
            'DialogueBranchAuthoringClient.js', 'protocol.js',
            'model/Action.js', 'model/AutoForwardReply.js', 'model/BasicReply.js',
            'model/DialogueStep.js', 'model/OngoingDialogue.js', 'model/Reply.js',
            'model/Segment.js', 'model/ServerInfo.js', 'model/Statement.js',
            'model/User.js', 'model/Variable.js',
            'util/AbstractLogger.js', 'util/ConsoleLogger.js', 'package.json',
        ]));
    });

    it('does not ship specs, test configuration or the development lockfile', () => {
        expect(packedFiles.filter(path => path.endsWith('.spec.js'))).toEqual([]);
        expect(packedFiles).not.toContain('vitest.config.js');
        expect(packedFiles).not.toContain('package-lock.json');
    });

    it('ships a package-local copy of the project licence', () => {
        expect(packedFiles).toContain('LICENSE');
        expect(readFileSync(new URL('LICENSE', import.meta.url), 'utf8')).toBe(
            readFileSync(new URL('../../LICENSE', import.meta.url), 'utf8'),
        );
    });

    it('points consumers back to the monorepo and issue tracker', () => {
        expect(manifest.repository).toEqual({
            type: 'git',
            url: 'git+https://github.com/dialoguebranch/platform.git',
            directory: 'packages/client-js',
        });
        expect(manifest.homepage).toBe('https://github.com/dialoguebranch/platform/tree/main/packages/client-js#readme');
        expect(manifest.bugs).toEqual({ url: 'https://github.com/dialoguebranch/platform/issues' });
    });
});
