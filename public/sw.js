// 이전 배포(v1.0.0)가 등록한 서비스 워커 주소
// 이미 설치해 쓰던 사용자도 새 버전을 받도록 같은 서비스 워커를 불러옴
// (새 화면이 service-worker.js로 다시 등록하면 그쪽으로 넘어감)
importScripts('service-worker.js');
