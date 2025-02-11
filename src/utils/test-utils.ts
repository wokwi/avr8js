// SPDX-License-Identifier: MIT
// Copyright (c) Uri Shaked and contributors

import { CPU } from '../cpu/cpu';
import { assemble } from './assembler';
import { avrInstruction } from '../cpu/instruction';

const BREAK_OPCODE = 0x9598;

export function asmProgram(source: string) {
  const { bytes, errors, lines, labels } = assemble(source);
  if (errors.length) {
    throw new Error('Assembly failed: ' + errors);
  }
  return { program: new Uint16Array(bytes.buffer), lines, instructionCount: lines.length, labels };
}

const defaultOnBreak = () => {
  throw new Error('BREAK instruction encountered');
};

export class TestProgramRunner {
  constructor(
    private readonly cpu: CPU,
    private readonly onBreak: (cpu: CPU) => void = defaultOnBreak,
  ) {}

  runInstructions(count: number) {
    const { cpu, onBreak } = this;
    for (let i = 0; i < count; i++) {
      if (cpu.progMem[cpu.pc] === BREAK_OPCODE) {
        onBreak?.(cpu);
      }
      avrInstruction(cpu);
      cpu.tick();
    }
  }

  runUntil(predicate: (cpu: CPU) => boolean, maxIterations = 5000) {
    const { cpu, onBreak } = this;
    for (let i = 0; i < maxIterations; i++) {
      if (cpu.progMem[cpu.pc] === BREAK_OPCODE) {
        onBreak?.(cpu);
      }
      if (predicate(cpu)) {
        return;
      }
      avrInstruction(cpu);
      cpu.tick();
    }
    throw new Error('Test program ran for too long, check your predicate');
  }

  runToBreak() {
    this.runUntil((cpu) => cpu.progMem[cpu.pc] === BREAK_OPCODE);
  }

  runToAddress(byteAddr: number) {
    this.runUntil((cpu) => cpu.pc * 2 === byteAddr);
  }
}
