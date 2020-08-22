import { CPU } from '../cpu/cpu';
import { assemble } from './assembler';
import { avrInstruction } from '../cpu/instruction';

const BREAK_OPCODE = 0x9598;

export function asmProgram(source: string) {
  const { bytes, errors, lines } = assemble(source);
  if (errors.length) {
    throw new Error('Assembly failed: ' + errors);
  }
  return { program: new Uint16Array(bytes.buffer), lines, instructionCount: lines.length };
}

export class TestProgramRunner {
  constructor(
    private readonly cpu: CPU,
    private readonly peripheral: { tick: () => void },
    private readonly onBreak?: (cpu: CPU) => void
  ) {}

  runInstructions(count: number) {
    const { cpu, peripheral, onBreak } = this;
    for (let i = 0; i < count; i++) {
      if (cpu.progMem[cpu.pc] === BREAK_OPCODE) {
        onBreak?.(cpu);
        throw new Error('BREAK instruction encountered');
      }
      avrInstruction(cpu);
      peripheral.tick();
    }
  }

  runToBreak(maxIterations = 5000) {
    const { cpu, peripheral, onBreak } = this;
    for (let i = 0; i < maxIterations; i++) {
      if (cpu.progMem[cpu.pc] === BREAK_OPCODE) {
        onBreak?.(cpu);
        return;
      }
      avrInstruction(cpu);
      peripheral.tick();
    }
    throw new Error('Program ran for too long without a BREAK instruction');
  }
}
