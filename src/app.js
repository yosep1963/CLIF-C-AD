// CLIF-C AD Score Calculator - 화면 처리 (계산 로직은 calculator.js의 ClifCAd)

(function() {
    'use strict';

    // Constants
    const STORAGE_KEY = 'clif-c-ad-history';
    const MAX_HISTORY = 5;
    const INSTALL_PROMPT_KEY = 'clif-c-ad-install-dismissed';

    // DOM Elements
    const form = document.getElementById('calculator-form');
    const resultSection = document.getElementById('result-section');
    const historySection = document.getElementById('history-section');
    const scoreValue = document.getElementById('score-value');
    const riskBadge = document.getElementById('risk-badge');
    const aclfAlert = document.getElementById('aclf-alert');
    const prognosisBlock = document.getElementById('prognosis-block');
    const mortality90 = document.getElementById('mortality-90');
    const mortality365 = document.getElementById('mortality-365');
    const historyList = document.getElementById('history-list');
    const historyNote = document.getElementById('history-note');

    const resetBtn = document.getElementById('reset-btn');
    const shareBtn = document.getElementById('share-btn');
    const historyBtn = document.getElementById('history-btn');
    const closeHistoryBtn = document.getElementById('close-history-btn');

    const installBanner = document.getElementById('install-banner');
    const installMessage = document.getElementById('install-message');
    const installBtn = document.getElementById('install-btn');
    const closeInstallBtn = document.getElementById('close-install-btn');

    const inputs = {
        age: document.getElementById('age'),
        creatinine: document.getElementById('creatinine'),
        inr: document.getElementById('inr'),
        wbc: document.getElementById('wbc'),
        sodium: document.getElementById('sodium')
    };

    // 마지막 계산 (공유하기에 사용)
    let lastResult = null;
    let lastValues = null;

    // PWA Install prompt (안드로이드 Chrome)
    let deferredPrompt = null;

    // Initialize
    function init() {
        setupEventListeners();
        setupServiceWorker();
        setupInstallPrompt();
    }

    // Event Listeners
    function setupEventListeners() {
        form.addEventListener('submit', handleSubmit);
        resetBtn.addEventListener('click', handleReset);
        shareBtn.addEventListener('click', handleShare);
        historyBtn.addEventListener('click', showHistory);
        closeHistoryBtn.addEventListener('click', hideHistory);
        installBtn.addEventListener('click', handleInstall);
        closeInstallBtn.addEventListener('click', dismissInstallBanner);

        // Real-time validation
        Object.keys(inputs).forEach(key => {
            inputs[key].addEventListener('input', () => validateField(key));
            inputs[key].addEventListener('blur', () => validateField(key));
        });
    }

    // Service Worker Registration
    function setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('service-worker.js')
                    .then(registration => {
                        console.log('ServiceWorker registered:', registration.scope);
                    })
                    .catch(error => {
                        console.log('ServiceWorker registration failed:', error);
                    });
            });
        }
    }

    // Validation
    function showFieldState(key, error) {
        inputs[key].classList.toggle('invalid', Boolean(error));
        inputs[key].classList.toggle('valid', !error);
        document.getElementById(`${key}-error`).textContent = error || '';
    }

    function clearFieldState(key) {
        inputs[key].classList.remove('valid', 'invalid');
        document.getElementById(`${key}-error`).textContent = '';
    }

    // 입력 중에는 빈칸을 오류로 표시하지 않음 (계산하기를 누르면 표시)
    function validateField(key) {
        if (inputs[key].value.trim() === '') {
            clearFieldState(key);
            return;
        }
        showFieldState(key, ClifCAd.validateValue(key, inputs[key].value).error);
    }

    function readInputs() {
        const raw = {};
        Object.keys(inputs).forEach(key => {
            raw[key] = inputs[key].value;
        });
        return raw;
    }

    // Handle form submission
    function handleSubmit(e) {
        e.preventDefault();

        const { isValid, values, errors } = ClifCAd.validateInputs(readInputs());
        Object.keys(inputs).forEach(key => showFieldState(key, errors[key]));

        if (!isValid) {
            inputs[Object.keys(errors)[0]].focus();
            return;
        }

        const result = ClifCAd.calculate(values);
        lastResult = result;
        lastValues = values;

        displayResult(result);
        saveToHistory(result, values);

        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function getRiskClass(result) {
        return result.applicable ? `risk-${result.riskGroup}` : 'risk-na';
    }

    // Display result
    function displayResult(result) {
        const riskClass = getRiskClass(result);

        scoreValue.textContent = result.score.toFixed(1);
        scoreValue.className = `score-value ${riskClass}`;
        riskBadge.textContent = ClifCAd.getRiskLabel(result);
        riskBadge.className = `risk-badge ${riskClass}`;

        // 입력값이 ACLF 기준에 해당하면 안내
        aclfAlert.textContent = result.aclf ? result.aclf.message : '';
        aclfAlert.className = result.aclf ? `aclf-alert aclf-alert-${result.aclf.level}` : 'aclf-alert hidden';

        // ACLF 기준을 충족하면 예측 사망률과 위험군 표를 보여주지 않음
        prognosisBlock.classList.toggle('hidden', !result.applicable);
        if (result.applicable) {
            mortality90.textContent = `${result.mortality.day90}%`;
            mortality365.textContent = `${result.mortality.day365}%`;

            // Highlight current risk row in table
            document.querySelectorAll('.risk-table tbody tr').forEach(row => {
                row.classList.toggle('current-risk', row.dataset.risk === result.riskGroup);
            });
        }

        resultSection.classList.remove('hidden');
    }

    // Handle reset
    function handleReset() {
        form.reset();
        Object.keys(inputs).forEach(clearFieldState);
        lastResult = null;
        lastValues = null;
        resultSection.classList.add('hidden');
        historySection.classList.add('hidden');
    }

    // Handle share
    async function handleShare() {
        if (!lastResult) return;

        const shareData = {
            title: 'CLIF-C AD 점수',
            text: ClifCAd.formatShareText(lastResult, lastValues),
            url: window.location.href
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                if (err.name !== 'AbortError') {
                    fallbackShare(shareData.text);
                }
            }
        } else {
            fallbackShare(shareData.text);
        }
    }

    // Fallback share (copy to clipboard)
    function fallbackShare(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                alert('결과가 클립보드에 복사되었습니다');
            }).catch(() => {
                alert('공유 기능을 사용할 수 없습니다');
            });
        } else {
            alert('공유 기능을 사용할 수 없습니다');
        }
    }

    // History functions
    function getHistory() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            const history = data ? JSON.parse(data) : [];
            return Array.isArray(history) ? history : [];
        } catch {
            return [];
        }
    }

    function saveToHistory(result, values) {
        const history = getHistory();
        history.unshift({
            score: result.score,
            risk: ClifCAd.getRiskKey(result),
            riskText: ClifCAd.getRiskLabel(result),
            values,
            timestamp: new Date().toISOString()
        });

        // Keep only last MAX_HISTORY entries
        history.splice(MAX_HISTORY);

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch {
            console.warn('Failed to save history');
        }
    }

    function renderHistoryItem(record) {
        const dateStr = new Date(record.timestamp).toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const detail = record.mortality
            ? `90일 ${record.mortality.day90}% · 1년 ${record.mortality.day365}%`
            : 'ACLF 기준 충족';
        const changed = record.isChanged ? '<span class="history-changed">기준 변경</span>' : '';

        return `
            <div class="history-item">
                <div class="history-item-main">
                    <span class="history-item-score">${record.score.toFixed(1)}</span>
                    <span class="history-item-date">${dateStr}</span>
                    <span class="history-item-detail">${detail}</span>
                </div>
                <div class="history-item-tags">
                    <span class="history-item-risk ${getRiskClass(record)}">${ClifCAd.getRiskLabel(record)}</span>
                    ${changed}
                </div>
            </div>
        `;
    }

    function showHistory() {
        // 저장된 기록은 그대로 두고, 현재 기준으로 다시 계산해서 보여줌
        const records = getHistory().map(record => ClifCAd.recalculate(record)).filter(Boolean);

        if (records.length === 0) {
            historyList.innerHTML = '<p class="no-history">저장된 기록이 없습니다</p>';
        } else {
            historyList.innerHTML = records.map(renderHistoryItem).join('');
        }
        historyNote.classList.toggle('hidden', !records.some(record => record.isChanged));

        historySection.classList.remove('hidden');
        historySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function hideHistory() {
        historySection.classList.add('hidden');
    }

    // PWA Install Prompt
    function setupInstallPrompt() {
        // For Android Chrome - beforeinstallprompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            showInstallBanner(false);
        });

        // Check if already installed
        window.addEventListener('appinstalled', () => {
            hideInstallBanner();
            deferredPrompt = null;
        });

        // For iOS Safari - show manual instructions (iPadOS는 Mac으로 표시되므로 터치 지원으로 구분)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true;

        if (isIOS && !isInStandaloneMode) {
            setTimeout(() => showInstallBanner(true), 2000);
        }
    }

    function isInstallDismissed() {
        try {
            return localStorage.getItem(INSTALL_PROMPT_KEY) === 'true';
        } catch {
            return false;
        }
    }

    function showInstallBanner(isIOS) {
        if (isInstallDismissed()) return;

        if (isIOS) {
            installMessage.textContent = '홈 화면에 추가: Safari의 공유 버튼 → "홈 화면에 추가"';
            installBtn.classList.add('hidden');
        }
        installBanner.classList.remove('hidden');
    }

    function hideInstallBanner() {
        installBanner.classList.add('hidden');
    }

    function dismissInstallBanner() {
        hideInstallBanner();
        try {
            localStorage.setItem(INSTALL_PROMPT_KEY, 'true');
        } catch {
            // 저장하지 못해도 이번에는 닫힘
        }
    }

    async function handleInstall() {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            hideInstallBanner();
        }
        deferredPrompt = null;
    }

    // Initialize app
    document.addEventListener('DOMContentLoaded', init);
})();
