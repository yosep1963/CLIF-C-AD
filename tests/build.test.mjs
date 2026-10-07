/**
 * 배포 폴더 만들기 테스트 (scripts/build.js)
 * 임시 폴더에 빌드해서 버전 표시와 서비스 워커 사전 캐시를 확인
 * 실행: node --test
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { build } = require('../scripts/build.js');
const { version } = require('../package.json');

let outDir;
let buildResult;

before(() => {
    outDir = mkdtempSync(path.join(tmpdir(), 'clif-c-ad-dist-'));
    buildResult = build({ outDir });
});

after(() => {
    rmSync(outDir, { recursive: true, force: true });
});

const read = (file) => readFileSync(path.join(outDir, file), 'utf8');

function listFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? listFiles(full) : [full];
    });
}

// 서비스 워커를 실행해 install 때 사전 캐시하는 요청을 모음 (importScripts도 같은 컨텍스트에서 실행)
async function getPrecacheRequests(entry) {
    const listeners = {};
    const added = [];
    const context = vm.createContext({
        console: { log() {}, error() {} },
        self: {
            addEventListener: (type, handler) => { listeners[type] = handler; },
            skipWaiting: async () => {},
            clients: { claim: async () => {} }
        },
        caches: {
            open: async () => ({ addAll: async (requests) => { added.push(...requests); } }),
            keys: async () => [],
            match: async () => undefined,
            delete: async () => true
        },
        Request: class {
            constructor(url, init = {}) {
                this.url = url;
                this.cache = init.cache;
            }
        },
        importScripts: (...urls) => {
            for (const url of urls) {
                vm.runInContext(read(url), context, { filename: url });
            }
        }
    });
    vm.runInContext(read(entry), context, { filename: entry });

    let pending;
    listeners.install({ waitUntil: (promise) => { pending = promise; } });
    await pending;

    return added.map((request) => (typeof request === 'string' ? { url: request } : request));
}

// index.html이 불러오는 이 앱의 파일 (스크립트·스타일·아이콘·매니페스트)
function getPageAssets() {
    return [...read('index.html').matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((match) => match[1])
        .filter((ref) => !/^(https?:|#|mailto:)/.test(ref))
        .map((ref) => '/' + ref.replace(/^\//, ''));
}

describe('배포 폴더', () => {
    it('버전과 빌드 ID 자리표시를 모두 채운다', () => {
        for (const file of ['index.html', 'service-worker.js']) {
            assert.doesNotMatch(read(file), /__APP_VERSION__|__BUILD_ID__/, file);
        }
    });

    it('스크립트·스타일 주소에 이번 빌드 ID를 붙인다', () => {
        assert.match(buildResult.buildId, /^[0-9a-f]{8}$/);
        assert.match(read('index.html'), new RegExp(`src/app\\.js\\?v=${buildResult.buildId}`));
    });

    it('화면 아래에 package.json 버전을 표시한다', () => {
        assert.ok(read('index.html').includes(`v${version}`));
    });

    it('Netlify 설정 파일(_headers, _redirects)을 함께 담는다', () => {
        assert.ok(existsSync(path.join(outDir, '_headers')));
        assert.ok(existsSync(path.join(outDir, '_redirects')));
    });

    it('숨김 파일(.DS_Store 등)은 담지 않는다', () => {
        const hidden = listFiles(outDir).filter((file) => path.basename(file).startsWith('.'));

        assert.deepEqual(hidden, []);
    });
});

describe('오프라인 사전 캐시', () => {
    it('index.html이 불러오는 파일을 버전 쿼리까지 그대로 사전 캐시한다', async () => {
        const urls = (await getPrecacheRequests('service-worker.js')).map((request) => request.url);
        const missing = getPageAssets().filter((asset) => !urls.includes(asset));

        assert.deepEqual(missing, []);
    });

    it('첫 화면용으로 / 와 /index.html을 사전 캐시한다', async () => {
        const urls = (await getPrecacheRequests('service-worker.js')).map((request) => request.url);

        assert.ok(urls.includes('/'));
        assert.ok(urls.includes('/index.html'));
    });

    it('HTTP 캐시에 남은 이전 파일을 받지 않도록 새로 받는다 (cache: reload)', async () => {
        const requests = await getPrecacheRequests('service-worker.js');

        assert.ok(requests.length > 0);
        assert.ok(requests.every((request) => request.cache === 'reload'));
    });

    it('사전 캐시하는 파일이 모두 배포 폴더에 있다 (하나라도 없으면 캐시 전체가 실패)', async () => {
        const urls = (await getPrecacheRequests('service-worker.js')).map((request) => request.url);
        const missingFiles = urls
            .map((url) => url.split('?')[0])
            .map((urlPath) => (urlPath === '/' ? '/index.html' : urlPath))
            .filter((urlPath) => !existsSync(path.join(outDir, urlPath)));

        assert.deepEqual(missingFiles, []);
    });

    it('이전 배포가 등록한 sw.js로도 같은 파일을 사전 캐시한다 (기존 설치 사용자 업데이트)', async () => {
        const fromLegacy = (await getPrecacheRequests('sw.js')).map((request) => request.url);
        const fromCurrent = (await getPrecacheRequests('service-worker.js')).map((request) => request.url);

        assert.deepEqual(fromLegacy, fromCurrent);
    });
});
