import { CPU, ICPU } from '../src/cpu/cpu';
import { avrInstruction } from '../src/cpu/instruction';
import { createBenchmark } from './benchmark';
import { permutations } from './permutations';
import { instructions, executeInstruction } from './instruction-fn';

/* Approach 1: use large Uint16Array with all possible opcodes */
const instructionArray = new Uint16Array(65536);
for (let i = 0; i < instructions.length; i++) {
  const { pattern } = instructions[i];
  for (const opcode of permutations(pattern.replace(/ /g, '').substr(0, 16))) {
    if (!instructionArray[opcode]) {
      instructionArray[opcode] = i + 1;
    }
  }
}

function avrInstructionUintArray(cpu: CPU) {
  const opcode = cpu.progMem[cpu.pc];
  executeInstruction(instructionArray[opcode], cpu, opcode);
}

/* Approach 2: use instMap */
const instructionMap: { [key: number]: (cpu: ICPU, opcode: number) => void } = {};
for (const { pattern, fn } of instructions) {
  for (const opcode of permutations(pattern.replace(/ /g, '').substr(0, 16))) {
    if (!instructionMap[opcode]) {
      instructionMap[opcode] = fn;
    }
  }
}

function avrInstructionObjMap(cpu: CPU) {
  const opcode = cpu.progMem[cpu.pc];
  instructionMap[opcode](cpu, opcode);
}

/* Run the benchmark */
function run() {
  const benchmark = createBenchmark('cpu-benchmark');

  const cpu = new CPU(new Uint16Array(0x1000));
  cpu.progMem[0] = 0x8088;
  const timeA = benchmark('avrInstruction');
  while (timeA()) {
    cpu.pc = 0;
    avrInstruction(cpu);
  }

  const timeB = benchmark('avrInstructionObjMap');
  while (timeB()) {
    cpu.pc = 0;
    avrInstructionObjMap(cpu);
  }

  const timeC = benchmark('avrInstructionUintArray');
  while (timeC()) {
    cpu.pc = 0;
    avrInstructionUintArray(cpu);
  }

  benchmark.report();
}

run();
