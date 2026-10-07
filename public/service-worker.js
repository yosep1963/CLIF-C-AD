// Service Worker for CLIF-C AD Calculator (오프라인 지원)
// __APP_VERSION__, __BUILD_ID__는 scripts/build.js가 배포 폴더(dist)를 만들 때 채움
const VERSION = '__APP_VERSION__';
const BUILD_ID = '__BUILD_ID__';
const CACHE_PREFIX = 'clif-c-ad-';
const CACHE_NAME = `${CACHE_PREFIX}v${VERSION}-${BUILD_ID}`;

// index.html이 ?v=빌드ID를 붙여 불러오는 파일: 페이지가 요청하는 주소 그대로 캐시해야 오프라인에서 찾을 수 있음
const VERSIONED_ASSETS = [
    '/src/styles.css',
    '/src/calculator.js',
    '/src/app.js'
].map(path => `${path}?v=${BUILD_ID}`);

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icons/icon-16.png',
    '/icons/icon-32.png',
    '/icons/icon-180.png',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable-192.png',
    '/icons/icon-maskable-512.png'
];

// Install event - 앱 파일 사전 캐시 (하나라도 실패하면 설치하지 않고 이전 버전을 계속 씀)
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                // HTTP 캐시에 남은 이전 버전 파일을 받지 않도록 서버에서 새로 받음
                const requests = [...STATIC_ASSETS, ...VERSIONED_ASSETS]
                    .map(url => new Request(url, { cache: 'reload' }));
                return cache.addAll(requests);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - 이 앱의 이전 캐시 정리 (v1.0.0의 clif-c-ad-v1, clif-c-ad-v1.0.0 포함)
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames
                    .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

// Fetch event - 캐시 우선, 없으면 네트워크에서 받아 캐시에 추가
self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) {
        return;
    }

    const isNavigation = request.mode === 'navigate';

    event.respondWith(
        // 화면 주소에 ?쿼리가 붙어도 캐시한 화면을 씀
        caches.match(request, { ignoreSearch: isNavigation })
            .then(cachedResponse => cachedResponse || fetch(request)
                .then(response => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
                    }
                    return response;
                })
                .catch(() => {
                    if (isNavigation) {
                        return caches.match('/index.html');
                    }
                    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
                }))
    );
});
