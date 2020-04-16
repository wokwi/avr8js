import * as fs from 'fs';
import * as prettier from 'prettier';
import prettierOptions from '../prettier.config';

const input = fs.readFileSync('src/cpu/instruction.ts', { encoding: 'utf-8' });
let fnName = '';
let fnBody = '';
let currentInstruction = '';
let pattern = '';
let output = `
import { ICPU } from '../src/cpu/cpu';

function isTwoWordInstruction(opcode: number) {
  return (
    /* LDS */
    (opcode & 0xfe0f) === 0x9000 ||
    /* STS */
    (opcode & 0xfe0f) === 0x9200 ||
    /* CALL */
    (opcode & 0xfe0e) === 0x940e ||
    /* JMP */
    (opcode & 0xfe0e) === 0x940c
  );
}

/* eslint-disable @typescript-eslint/no-unused-vars */
`;
const patternToFn: Array<[string, string]> = [];
for (const line of input.split('\n')) {
  if (line.startsWith('    /* ') && line.includes(', ')) {
    currentInstruction = line
      .trim()
      .split(',')[0]
      .split(' ')[1];
    fnBody = '';
    pattern = line.split(',')[1].split('*')[0];
    console.log(currentInstruction);
    fnName = 'inst' + currentInstruction.replace(/[()]/g, '');
    patternToFn.push([pattern.trim(), fnName]);
  } else if (line.startsWith('  }')) {
    output += `
      export function ${fnName}(cpu: ICPU, opcode: number) {
        /*${pattern}*/
        ${fnBody}
        cpu.cycles++;
        if (++cpu.pc >= cpu.progMem.length) {
          cpu.pc = 0;
        }
      }
    `;
    currentInstruction = '';
  } else if (currentInstruction) {
    fnBody += line;
  }
}

let executeInstructionCases = ``;
output += `\nexport const instructions = [`;
let i = 1;
for (const [fnPattern, fn] of patternToFn) {
  output += `{pattern: '${fnPattern}', fn: ${fn}, idx: ${i}},`;
  executeInstructionCases += `case ${i}: ${fn}(cpu, opcode); break;\n`;
  i++;
}
output += ']';

output += `\n
export function executeInstruction(idx: number, cpu: ICPU, opcode: number) {
  switch (idx) {
    ${executeInstructionCases}
    default: instNOP(cpu, opcode);
  }
}`;

const formattedOutput = prettier.format(output, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...(prettierOptions as any),
  parser: 'babel'
});

fs.writeFileSync('benchmark/instruction-fn.ts', formattedOutput, {
  encoding: 'utf-8'
});
