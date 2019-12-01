import * as fs from 'fs';
import * as prettier from 'prettier';

const input = fs.readFileSync('src/instruction.ts', { encoding: 'utf-8' });
let fnBody = '';
let openingBrace = false;
let currentInstruction = '';
let pattern = '';
let output = `
import { ICPU } from '../src/cpu';
import { u16 } from '../src/types';

function isTwoWordInstruction(opcode: u16) {
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
`;
for (const line of input.split('\n')) {
  if (line.startsWith('  /* ')) {
    currentInstruction = line
      .trim()
      .split(',')[0]
      .split(' ')[1];
    fnBody = '';
    openingBrace = false;
    pattern = line.split(',')[1].split('*')[0];
    console.log(currentInstruction);
    currentInstruction = currentInstruction.replace(/[\(\)]/g, '');
  }
  if (line.startsWith('  }')) {
    output += `
      export function inst${currentInstruction}(cpu: ICPU, opcode: number) {
        /*${pattern}*/
        ${fnBody}
        cpu.cycles++;
        if (++cpu.pc >= cpu.progMem.length) {
          cpu.pc = 0;
        }
      }
    `;
    currentInstruction = '';
  } else if (currentInstruction && openingBrace) {
    fnBody += line;
  } else if (currentInstruction && !openingBrace) {
    openingBrace = line.includes('{');
  }
}

const formattedOutput = prettier.format(output, { singleQuote: true, parser: 'babel' });

fs.writeFileSync('benchmark/instruction-fn.ts', formattedOutput, {
  encoding: 'utf-8'
});
