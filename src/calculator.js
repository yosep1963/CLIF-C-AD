// CLIF-C AD Score Calculator - 계산 로직 (화면과 테스트가 함께 씀, DOM을 쓰지 않음)
// Jalan R, et al. J Hepatol 2015;62:831-40
// CLIF-C AD = 10 × [0.03 × Age + 0.66 × ln(Creatinine) + 1.71 × ln(INR) + 0.88 × ln(WBC/1000) - 0.05 × Sodium + 8]

const ClifCAd = (function() {
    'use strict';

    // 입력 범위 (요청서 기준), 오류 문구에 쓰는 주어와 단위
    const INPUT_RANGES = {
        age: { min: 18, max: 100, subject: '나이는', unit: '세' },
        creatinine: { min: 0.1, max: 10, subject: '크레아티닌은', unit: ' mg/dL' },
        inr: { min: 0.1, max: 8, subject: 'INR은', unit: '' },
        wbc: { min: 100, max: 50000, subject: '백혈구는', unit: ' cells/µL' },
        sodium: { min: 100, max: 160, subject: '나트륨은', unit: ' mEq/L' }
    };

    // 예측 사망률 P = 1 − exp(−ci × exp(beta × score)), EF CLIF 공식 계산기와 같은 계수
    const MORTALITY_MODEL = {
        day90: { ci: 0.00056, beta: 0.1007 },
        day365: { ci: 0.00879, beta: 0.0698 }
    };

    // 위험군 (Jalan 2015: 45 이하 저위험, 60 이상 고위험)
    const RISK_GROUPS = {
        low: { label: '저위험군', range: '45 이하' },
        moderate: { label: '중등도 위험군', range: '45 초과 ~ 60 미만' },
        high: { label: '고위험군', range: '60 이상' }
    };

    // ACLF 판정 기준 (CANONIC): 신부전 Cr ≥2.0, 신기능 장애 Cr 1.5–1.9, 응고 부전 INR ≥2.5
    const KIDNEY_FAILURE_CREATININE = 2.0;
    const KIDNEY_DYSFUNCTION_CREATININE = 1.5;
    const COAGULATION_FAILURE_INR = 2.5;

    const NOT_APPLICABLE = 'not-applicable';
    const NOT_APPLICABLE_LABEL = '적용 대상 아님';

    const roundToOneDecimal = (value) => Math.round(value * 10) / 10;

    function formatRange(field) {
        const { min, max, subject, unit } = INPUT_RANGES[field];
        return `${subject} ${min.toLocaleString('en-US')}–${max.toLocaleString('en-US')}${unit} 사이로 입력하세요`;
    }

    /**
     * 입력값 하나 확인
     * @returns {{ value: number|null, error: string|null }}
     */
    function validateValue(field, raw) {
        const text = raw == null ? '' : String(raw).trim();
        if (text === '') {
            return { value: null, error: '값을 입력하세요' };
        }

        const value = Number(text);
        const { min, max } = INPUT_RANGES[field];
        if (!Number.isFinite(value) || value < min || value > max) {
            const hint = field === 'wbc' ? ' (예: 8.0 ×10⁹/L → 8000)' : '';
            return { value: null, error: formatRange(field) + hint };
        }

        return { value, error: null };
    }

    /**
     * 입력값 전체 확인
     * @returns {{ isValid: boolean, values: Object, errors: Object }}
     */
    function validateInputs(rawValues) {
        const values = {};
        const errors = {};
        Object.keys(INPUT_RANGES).forEach(field => {
            const { value, error } = validateValue(field, rawValues[field]);
            if (error) {
                errors[field] = error;
            } else {
                values[field] = value;
            }
        });
        return { isValid: Object.keys(errors).length === 0, values, errors };
    }

    // WBC는 cells/µL(검사지 수치 그대로)로 받아 10⁹/L로 바꿔 계산
    function calculateScore({ age, creatinine, inr, wbc, sodium }) {
        const score = 10 * (
            0.03 * age +
            0.66 * Math.log(creatinine) +
            1.71 * Math.log(inr) +
            0.88 * Math.log(wbc / 1000) -
            0.05 * sodium +
            8
        );
        return roundToOneDecimal(score);
    }

    // 예측 사망률 (%, 정수)
    function predictMortality(score, { ci, beta }) {
        return Math.round(100 * (1 - Math.exp(-ci * Math.exp(beta * score))));
    }

    function getRiskGroup(score) {
        if (score <= 45) return 'low';
        if (score < 60) return 'moderate';
        return 'high';
    }

    /**
     * 입력한 Cr·INR만으로 ACLF 기준을 충족하는지 확인 (다른 장기는 CLIF-C OF로 확인해야 함)
     * @returns {{ level: 'aclf'|'caution', message: string }|null}
     */
    function checkAclfCriteria({ creatinine, inr }) {
        if (creatinine >= KIDNEY_FAILURE_CREATININE) {
            return {
                level: 'aclf',
                message: 'Creatinine 2.0 mg/dL 이상은 신부전으로 ACLF 기준을 충족합니다. CLIF-C AD 대신 CLIF-C ACLF 점수를 사용하세요.'
            };
        }
        if (inr >= COAGULATION_FAILURE_INR && creatinine >= KIDNEY_DYSFUNCTION_CREATININE) {
            return {
                level: 'aclf',
                message: 'INR 2.5 이상(응고 부전)과 Creatinine 1.5–1.9 mg/dL(신기능 장애)이 함께 있어 ACLF-1 기준을 충족합니다. CLIF-C AD 대신 CLIF-C ACLF 점수를 사용하세요.'
            };
        }
        if (inr >= COAGULATION_FAILURE_INR) {
            return {
                level: 'caution',
                message: 'INR 2.5 이상은 응고 부전입니다. 간성뇌증 1–2단계가 함께 있으면 ACLF-1이므로 CLIF-C OF로 ACLF 여부를 확인하세요.'
            };
        }
        return null;
    }

    /**
     * 확인된 입력값(숫자)으로 결과 계산
     * 입력값이 ACLF 기준을 충족하면 위험군과 예측 사망률을 내지 않음 (CLIF-C AD는 ACLF가 없는 환자용)
     */
    function calculate(values) {
        const score = calculateScore(values);
        const aclf = checkAclfCriteria(values);
        const applicable = !(aclf && aclf.level === 'aclf');

        return {
            score,
            applicable,
            riskGroup: applicable ? getRiskGroup(score) : null,
            mortality: applicable ? {
                day90: predictMortality(score, MORTALITY_MODEL.day90),
                day365: predictMortality(score, MORTALITY_MODEL.day365)
            } : null,
            aclf
        };
    }

    // 저장 기록의 위험군 값 (적용 대상 아님은 'not-applicable')
    function getRiskKey(result) {
        return result.applicable ? result.riskGroup : NOT_APPLICABLE;
    }

    function getRiskLabel(result) {
        return result.applicable ? RISK_GROUPS[result.riskGroup].label : NOT_APPLICABLE_LABEL;
    }

    /**
     * 저장된 기록을 현재 기준으로 다시 계산 (저장된 기록은 바꾸지 않음)
     * @returns {Object|null} 입력값이 없거나 잘못된 기록은 null
     */
    function recalculate(record) {
        if (!record || !record.values) return null;

        const { isValid, values } = validateInputs(record.values);
        if (!isValid) return null;

        const result = calculate(values);
        return {
            ...result,
            values,
            timestamp: record.timestamp,
            savedScore: record.score,
            savedRisk: record.risk,
            isChanged: result.score !== record.score || getRiskKey(result) !== record.risk
        };
    }

    // 결과 공유·복사 문구
    function formatShareText(result, values) {
        const lines = ['[CLIF-C AD 점수]'];
        lines.push(`점수: ${result.score.toFixed(1)} (${getRiskLabel(result)})`);
        if (result.mortality) {
            lines.push(`예측 사망률: 90일 ${result.mortality.day90}% · 1년 ${result.mortality.day365}%`);
        }
        if (result.aclf) {
            lines.push(`주의: ${result.aclf.message}`);
        }
        lines.push(
            `입력: 나이 ${values.age}세, Cr ${values.creatinine} mg/dL, INR ${values.inr}, ` +
            `WBC ${values.wbc.toLocaleString('en-US')}/µL, Na ${values.sodium} mEq/L`
        );
        return lines.join('\n');
    }

    return {
        INPUT_RANGES,
        MORTALITY_MODEL,
        RISK_GROUPS,
        validateValue,
        validateInputs,
        calculateScore,
        predictMortality,
        getRiskGroup,
        checkAclfCriteria,
        calculate,
        getRiskKey,
        getRiskLabel,
        recalculate,
        formatShareText
    };
})();
