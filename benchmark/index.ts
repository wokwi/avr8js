import { CPU } from '../src/cpu';
import { avrInstruction } from '../src/instruction';
import { createBenchmark } from './benchmark';
import { instLDY } from './instruction-fn';

/* Approach 1: use large Uint16Array with all possible opcodes */
const instructionMap = new Uint16Array(65536);
instructionMap[0x8088] = 0x5;

function avrInstructionUintArray(cpu: CPU) {
  const opcode = cpu.progMem[cpu.pc];
  const mapped = instructionMap[opcode];
  switch (mapped) {
    case 5:
      instLDY(cpu, opcode);
      break;
  }
}

/* Approach 1: use Map() */
const objMap = new Map<number, (cpu: CPU, opcode: number) => void>();
objMap.set(0x8088, instLDY);

function avrInstructionObjMap(cpu: CPU) {
  const opcode = cpu.progMem[cpu.pc];
  objMap.get(cpu.progMem[cpu.pc])(cpu, opcode);
}

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
