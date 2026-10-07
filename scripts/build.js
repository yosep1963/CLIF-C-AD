// Build script for CLIF-C AD Calculator
// 배포 폴더(dist) 만들기: public/은 그대로, src/는 dist/src/로 복사하고 버전·빌드 ID를 채움 (의존성 없음)
// 실행: npm run build (node scripts/build.js)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const DEFAULT_OUT_DIR = path.join(ROOT, 'dist');

// __APP_VERSION__(package.json 버전)과 __BUILD_ID__를 채우는 파일 (배포 폴더 기준 경로)
const STAMPED_FILES = ['index.html', 'service-worker.js'];

// 숨김 파일(.DS_Store 등)은 빼고 하위 폴더까지 나열
function listFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true })
        .filter(entry => !entry.name.startsWith('.'))
        .flatMap(entry => {
            const full = path.join(dir, entry.name);
            return entry.isDirectory() ? listFiles(full) : [full];
        });
}

function collectSources() {
    const publicDir = path.join(ROOT, 'public');
    const srcDir = path.join(ROOT, 'src');
    const toPosix = (relativePath) => relativePath.split(path.sep).join('/');

    return [
        ...listFiles(publicDir).map(file => ({ file, dest: toPosix(path.relative(publicDir, file)) })),
        ...listFiles(srcDir).map(file => ({ file, dest: 'src/' + toPosix(path.relative(srcDir, file)) }))
    ].sort((a, b) => (a.dest < b.dest ? -1 : 1));
}

// 버전이나 파일 내용이 하나라도 바뀌면 달라지는 값
// 캐시 이름과 ?v=에 써서, 파일을 고친 뒤 버전 올리기를 잊어도 사용자가 새 파일을 받게 함
function computeBuildId(version, sources) {
    const hash = crypto.createHash('sha256');
    hash.update(version);
    for (const { file, dest } of sources) {
        hash.update(dest);
        hash.update(fs.readFileSync(file));
    }
    return hash.digest('hex').slice(0, 8);
}

function build({ outDir = DEFAULT_OUT_DIR } = {}) {
    const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const sources = collectSources();
    const buildId = computeBuildId(version, sources);

    fs.rmSync(outDir, { recursive: true, force: true });

    for (const { file, dest } of sources) {
        const target = path.join(outDir, dest);
        fs.mkdirSync(path.dirname(target), { recursive: true });

        if (STAMPED_FILES.includes(dest)) {
            const text = fs.readFileSync(file, 'utf8')
                .replaceAll('__APP_VERSION__', version)
                .replaceAll('__BUILD_ID__', buildId);
            fs.writeFileSync(target, text);
        } else {
            fs.copyFileSync(file, target);
        }
    }

    return { outDir, version, buildId, files: sources.map(source => source.dest) };
}

module.exports = { build };

if (require.main === module) {
    const { outDir, version, buildId, files } = build();
    console.log(`CLIF-C AD v${version} (빌드 ${buildId}) → ${path.relative(ROOT, outDir)}/ 에 파일 ${files.length}개`);
}
