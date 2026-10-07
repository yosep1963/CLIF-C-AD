/**
 * 브라우저용 계산 스크립트(src/calculator.js)를 vm 컨텍스트에 불러옴
 * (테스트 파일이 아니라 테스트에서 쓰는 도우미)
 */

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function loadCalculator() {
    const context = vm.createContext({});
    const code = readFileSync(new URL('../src/calculator.js', import.meta.url), 'utf8');
    vm.runInContext(code, context, { filename: 'calculator.js' });
    return vm.runInContext('ClifCAd', context);
}
