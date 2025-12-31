// CLIF-C AD Score Calculator
// Formula: CLIF-C AD = 10 × [0.03 × Age + 0.66 × ln(Creatinine) + 1.71 × ln(INR) + 0.88 × ln(WBC/1000) - 0.05 × Sodium + 8]

(function() {
    'use strict';

    // Constants
    const STORAGE_KEY = 'clif-c-ad-history';
    const MAX_HISTORY = 5;

    // Validation ranges
    const VALIDATION = {
        age: { min: 18, max: 100, message: '나이는 18-100세 사이여야 합니다' },
        creatinine: { min: 0.1, max: 10, message: '크레아티닌은 0.1-10 사이여야 합니다' },
        inr: { min: 0.1, max: 8, message: 'INR은 0.1-8 사이여야 합니다' },
        wbc: { min: 100, max: 50000, message: '백혈구는 100-50,000 사이여야 합니다' },
        sodium: { min: 100, max: 160, message: '나트륨은 100-160 사이여야 합니다' }
    };

    // DOM Elements
    const form = document.getElementById('calculator-form');
    const resultSection = document.getElementById('result-section');
    const historySection = document.getElementById('history-section');
    const scoreValue = document.getElementById('score-value');
    const riskBadge = document.getElementById('risk-badge');
    const historyList = document.getElementById('history-list');

    const resetBtn = document.getElementById('reset-btn');
    const shareBtn = document.getElementById('share-btn');
    const historyBtn = document.getElementById('history-btn');
    const closeHistoryBtn = document.getElementById('close-history-btn');

    const inputs = {
        age: document.getElementById('age'),
        creatinine: document.getElementById('creatinine'),
        inr: document.getElementById('inr'),
        wbc: document.getElementById('wbc'),
        sodium: document.getElementById('sodium')
    };

    // Initialize
    function init() {
        setupEventListeners();
        setupServiceWorker();
    }

    // Event Listeners
    function setupEventListeners() {
        // Form submission
        form.addEventListener('submit', handleSubmit);

        // Reset button
        resetBtn.addEventListener('click', handleReset);

        // Share button
        shareBtn.addEventListener('click', handleShare);

        // History buttons
        historyBtn.addEventListener('click', showHistory);
        closeHistoryBtn.addEventListener('click', hideHistory);

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
    function validateField(fieldName) {
        const input = inputs[fieldName];
        const value = parseFloat(input.value);
        const validation = VALIDATION[fieldName];
        const errorElement = document.getElementById(`${fieldName}-error`);

        if (input.value === '') {
            input.classList.remove('valid', 'invalid');
            errorElement.textContent = '';
            return false;
        }

        if (isNaN(value) || value < validation.min || value > validation.max) {
            input.classList.remove('valid');
            input.classList.add('invalid');
            errorElement.textContent = validation.message;
            return false;
        }

        input.classList.remove('invalid');
        input.classList.add('valid');
        errorElement.textContent = '';
        return true;
    }

    function validateAll() {
        let isValid = true;
        Object.keys(inputs).forEach(key => {
            if (!validateField(key)) {
                isValid = false;
            }
        });
        return isValid;
    }

    // Calculate CLIF-C AD Score
    function calculateScore(age, creatinine, inr, wbc, sodium) {
        // WBC is entered as cells/μL, convert to 10^9/L by dividing by 1000
        const wbcConverted = wbc / 1000;

        // Ensure values for ln() are positive
        const safeCreatinine = Math.max(creatinine, 0.01);
        const safeInr = Math.max(inr, 0.01);
        const safeWbc = Math.max(wbcConverted, 0.01);

        const score = 10 * (
            0.03 * age +
            0.66 * Math.log(safeCreatinine) +
            1.71 * Math.log(safeInr) +
            0.88 * Math.log(safeWbc) -
            0.05 * sodium +
            8
        );

        return Math.round(score * 10) / 10; // Round to 1 decimal place
    }

    // Get risk category
    function getRiskCategory(score) {
        if (score < 45) {
            return {
                level: 'low',
                text: '저위험군',
                className: 'risk-low'
            };
        } else if (score <= 60) {
            return {
                level: 'moderate',
                text: '중등도 위험군',
                className: 'risk-moderate'
            };
        } else {
            return {
                level: 'high',
                text: '고위험군',
                className: 'risk-high'
            };
        }
    }

    // Handle form submission
    function handleSubmit(e) {
        e.preventDefault();

        if (!validateAll()) {
            return;
        }

        const values = {
            age: parseFloat(inputs.age.value),
            creatinine: parseFloat(inputs.creatinine.value),
            inr: parseFloat(inputs.inr.value),
            wbc: parseFloat(inputs.wbc.value),
            sodium: parseFloat(inputs.sodium.value)
        };

        const score = calculateScore(
            values.age,
            values.creatinine,
            values.inr,
            values.wbc,
            values.sodium
        );

        const risk = getRiskCategory(score);

        // Display results
        displayResult(score, risk);

        // Save to history
        saveToHistory(score, risk, values);

        // Scroll to result
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Display result
    function displayResult(score, risk) {
        scoreValue.textContent = score.toFixed(1);
        scoreValue.className = 'score-value ' + risk.className;

        riskBadge.textContent = risk.text;
        riskBadge.className = 'risk-badge ' + risk.className;

        // Highlight current risk row in table
        const rows = document.querySelectorAll('.mortality-table tbody tr');
        rows.forEach(row => row.classList.remove('current-risk'));

        const riskRowMap = {
            'low': 0,
            'moderate': 1,
            'high': 2
        };
        rows[riskRowMap[risk.level]].classList.add('current-risk');

        resultSection.classList.remove('hidden');
    }

    // Handle reset
    function handleReset() {
        form.reset();
        Object.keys(inputs).forEach(key => {
            inputs[key].classList.remove('valid', 'invalid');
            document.getElementById(`${key}-error`).textContent = '';
        });
        resultSection.classList.add('hidden');
        historySection.classList.add('hidden');
    }

    // Handle share
    async function handleShare() {
        const score = scoreValue.textContent;
        const risk = riskBadge.textContent;

        const shareData = {
            title: 'CLIF-C AD 점수',
            text: `CLIF-C AD 점수: ${score}\n위험도: ${risk}`,
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
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    function saveToHistory(score, risk, values) {
        const history = getHistory();
        const entry = {
            score,
            risk: risk.level,
            riskText: risk.text,
            values,
            timestamp: new Date().toISOString()
        };

        history.unshift(entry);

        // Keep only last MAX_HISTORY entries
        if (history.length > MAX_HISTORY) {
            history.pop();
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch {
            console.warn('Failed to save history');
        }
    }

    function showHistory() {
        const history = getHistory();

        if (history.length === 0) {
            historyList.innerHTML = '<p class="no-history">저장된 기록이 없습니다</p>';
        } else {
            historyList.innerHTML = history.map(entry => {
                const date = new Date(entry.timestamp);
                const dateStr = date.toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const riskClass = `risk-${entry.risk}`;

                return `
                    <div class="history-item">
                        <div>
                            <span class="history-item-score">${entry.score.toFixed(1)}</span>
                            <span class="history-item-date">${dateStr}</span>
                        </div>
                        <span class="history-item-risk ${riskClass}">${entry.riskText}</span>
                    </div>
                `;
            }).join('');
        }

        historySection.classList.remove('hidden');
        historySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function hideHistory() {
        historySection.classList.add('hidden');
    }

    // Initialize app
    document.addEventListener('DOMContentLoaded', init);
})();
