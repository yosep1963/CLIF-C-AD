/**
 * CLIF-C AD 계산 로직 테스트 (src/calculator.js)
 * 실행: node --test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadCalculator } from './load-scripts.mjs';

const ClifCAd = loadCalculator();

// vm 컨텍스트에서 만든 객체를 이 테스트 쪽 객체로 바꿔 비교
const plain = (value) => JSON.parse(JSON.stringify(value));

const valuesOf = (age, creatinine, inr, wbc, sodium) => ({ age, creatinine, inr, wbc, sodium });

describe('CLIF-C AD 점수 (Jalan 2015)', () => {
    it('공식대로 계산하고 소수점 1자리로 반올림한다 (WBC는 cells/µL 그대로 입력)', () => {
        assert.equal(ClifCAd.calculateScore(valuesOf(60, 1.2, 1.5, 8000, 135)), 56.9);
        assert.equal(ClifCAd.calculateScore(valuesOf(55, 1.0, 1.2, 6000, 138)), 46.4);
        assert.equal(ClifCAd.calculateScore(valuesOf(60, 1.7, 1.5, 8000, 135)), 59.2);
    });
});

describe('예측 사망률 (EF CLIF 공식 계산기와 같은 계수)', () => {
    for (const [score, day90, day365] of [[40, 3, 13], [50, 8, 25], [60, 21, 44], [70, 48, 69]]) {
        it(`${score}점: 90일 ${day90}%, 1년 ${day365}%`, () => {
            assert.equal(ClifCAd.predictMortality(score, ClifCAd.MORTALITY_MODEL.day90), day90);
            assert.equal(ClifCAd.predictMortality(score, ClifCAd.MORTALITY_MODEL.day365), day365);
        });
    }
});

describe('위험군 (Jalan 2015: 45 이하 저위험, 60 이상 고위험)', () => {
    it('45점은 저위험군', () => {
        assert.equal(ClifCAd.getRiskGroup(45), 'low');
    });

    it('45점 초과 60점 미만은 중등도 위험군', () => {
        assert.equal(ClifCAd.getRiskGroup(45.1), 'moderate');
        assert.equal(ClifCAd.getRiskGroup(59.9), 'moderate');
    });

    it('60점은 고위험군', () => {
        assert.equal(ClifCAd.getRiskGroup(60), 'high');
    });
});

describe('입력값만으로 ACLF 기준을 충족하는지 확인 (CANONIC)', () => {
    it('Creatinine 2.0 이상은 신부전이므로 ACLF', () => {
        assert.equal(ClifCAd.checkAclfCriteria({ creatinine: 2.0, inr: 1.2 }).level, 'aclf');
    });

    it('INR 2.5 이상(응고 부전) + Creatinine 1.5–1.9는 ACLF-1', () => {
        assert.equal(ClifCAd.checkAclfCriteria({ creatinine: 1.5, inr: 2.5 }).level, 'aclf');
        assert.equal(ClifCAd.checkAclfCriteria({ creatinine: 1.9, inr: 3.0 }).level, 'aclf');
    });

    it('INR 2.5 이상 + Creatinine 1.5 미만이면 간성뇌증을 확인하라고 안내', () => {
        const check = ClifCAd.checkAclfCriteria({ creatinine: 1.4, inr: 2.5 });

        assert.equal(check.level, 'caution');
        assert.match(check.message, /간성뇌증/);
    });

    it('Creatinine 2.0 미만이고 INR 2.5 미만이면 안내하지 않음', () => {
        assert.equal(ClifCAd.checkAclfCriteria({ creatinine: 1.9, inr: 2.4 }), null);
    });
});

describe('계산 결과', () => {
    it('ACLF 기준이 아니면 점수, 위험군, 90일·1년 예측 사망률을 낸다', () => {
        const result = plain(ClifCAd.calculate(valuesOf(60, 1.7, 1.5, 8000, 135)));

        assert.deepEqual(result, {
            score: 59.2,
            applicable: true,
            riskGroup: 'moderate',
            mortality: { day90: 20, day365: 42 },
            aclf: null
        });
    });

    it('입력값이 ACLF 기준을 충족하면 위험군과 예측 사망률을 내지 않는다', () => {
        const result = plain(ClifCAd.calculate(valuesOf(60, 2.1, 1.5, 8000, 135)));

        assert.equal(result.score, 60.6);
        assert.equal(result.applicable, false);
        assert.equal(result.riskGroup, null);
        assert.equal(result.mortality, null);
        assert.equal(result.aclf.level, 'aclf');
    });

    it('간성뇌증 확인 안내가 있어도 점수와 예측 사망률은 낸다', () => {
        const result = plain(ClifCAd.calculate(valuesOf(60, 1.2, 2.6, 8000, 135)));

        assert.equal(result.applicable, true);
        assert.equal(result.riskGroup, 'high');
        assert.deepEqual(result.mortality, { day90: 36, day365: 59 });
        assert.equal(result.aclf.level, 'caution');
    });
});

describe('입력값 확인', () => {
    it('비어 있으면 입력하라고 안내한다', () => {
        assert.match(ClifCAd.validateValue('age', '').error, /입력/);
        assert.match(ClifCAd.validateValue('age', '  ').error, /입력/);
    });

    it('범위를 벗어나면 허용 범위를 알려준다', () => {
        const { error } = ClifCAd.validateValue('sodium', '170');

        assert.match(error, /100/);
        assert.match(error, /160/);
    });

    it('범위 끝값은 받는다', () => {
        assert.equal(ClifCAd.validateValue('creatinine', '0.1').value, 0.1);
        assert.equal(ClifCAd.validateValue('creatinine', '10').value, 10);
    });

    it('WBC를 10⁹/L 단위로 넣으면 cells/µL로 넣으라고 안내한다', () => {
        assert.match(ClifCAd.validateValue('wbc', '8').error, /cells\/µL/);
    });

    it('숫자가 아니면 받지 않는다', () => {
        assert.ok(ClifCAd.validateValue('inr', 'abc').error);
        assert.ok(ClifCAd.validateValue('inr', '1.2abc').error);
    });

    it('모두 맞으면 숫자로 바꿔 돌려준다', () => {
        const checked = ClifCAd.validateInputs({ age: '60', creatinine: '1.2', inr: '1.5', wbc: '8000', sodium: '135' });

        assert.equal(checked.isValid, true);
        assert.deepEqual(plain(checked.values), valuesOf(60, 1.2, 1.5, 8000, 135));
        assert.deepEqual(plain(checked.errors), {});
    });

    it('틀린 항목만 오류로 알려준다', () => {
        const checked = ClifCAd.validateInputs({ age: '60', creatinine: '', inr: '1.5', wbc: '8000', sodium: '135' });

        assert.equal(checked.isValid, false);
        assert.deepEqual(Object.keys(checked.errors), ['creatinine']);
    });
});

describe('저장된 기록을 현재 기준으로 다시 계산', () => {
    const TIMESTAMP = '2026-01-02T03:04:05.000Z';
    const saved = (values, score, risk) => ({ score, risk, riskText: '저장 당시 위험군', values, timestamp: TIMESTAMP });

    it('예전 기준에서 중등도였던 60.0점은 고위험군으로 바꾸고 기준 변경으로 표시한다', () => {
        const record = plain(ClifCAd.recalculate(saved(valuesOf(50, 0.9, 2.0, 12000, 136), 60, 'moderate')));

        assert.equal(record.score, 60);
        assert.equal(record.riskGroup, 'high');
        assert.deepEqual(record.mortality, { day90: 21, day365: 44 });
        assert.equal(record.isChanged, true);
        assert.equal(record.savedScore, 60);
        assert.equal(record.savedRisk, 'moderate');
        assert.equal(record.timestamp, TIMESTAMP);
    });

    it('예전 기준에서 중등도였던 45.0점은 저위험군으로 바꾼다', () => {
        const record = ClifCAd.recalculate(saved(valuesOf(50, 0.8, 1.4, 6000, 140), 45, 'moderate'));

        assert.equal(record.riskGroup, 'low');
        assert.equal(record.isChanged, true);
    });

    it('결과가 같으면 기준 변경이 아니다', () => {
        const record = ClifCAd.recalculate(saved(valuesOf(60, 1.7, 1.5, 8000, 135), 59.2, 'moderate'));

        assert.equal(record.isChanged, false);
    });

    it('입력값이 ACLF 기준을 충족하는 기록은 적용 대상 아님으로 바꾼다', () => {
        const record = ClifCAd.recalculate(saved(valuesOf(60, 2.1, 1.5, 8000, 135), 60.6, 'high'));

        assert.equal(record.applicable, false);
        assert.equal(record.isChanged, true);
    });

    it('입력값이 없거나 범위를 벗어난 기록은 다시 계산하지 않는다 (null)', () => {
        assert.equal(ClifCAd.recalculate({ score: 50, risk: 'moderate', timestamp: TIMESTAMP }), null);
        assert.equal(ClifCAd.recalculate(saved(valuesOf(60, 0, 1.5, 8000, 135), 50, 'moderate')), null);
        assert.equal(ClifCAd.recalculate(null), null);
    });
});

describe('결과 공유 문구', () => {
    it('점수, 위험군, 예측 사망률, 입력값을 담는다', () => {
        const values = valuesOf(60, 1.7, 1.5, 8000, 135);
        const text = ClifCAd.formatShareText(ClifCAd.calculate(values), values);

        assert.match(text, /59\.2/);
        assert.match(text, /중등도 위험군/);
        assert.match(text, /90일 20%/);
        assert.match(text, /1년 42%/);
        assert.match(text, /나이 60세/);
        assert.match(text, /WBC 8,000/);
        assert.match(text, /Na 135/);
    });

    it('ACLF 기준을 충족하면 적용 대상이 아님을 알리고 예측 사망률은 넣지 않는다', () => {
        const values = valuesOf(60, 2.1, 1.5, 8000, 135);
        const text = ClifCAd.formatShareText(ClifCAd.calculate(values), values);

        assert.match(text, /60\.6/);
        assert.match(text, /적용 대상 아님/);
        assert.match(text, /CLIF-C ACLF/);
        assert.doesNotMatch(text, /90일/);
    });
});
