import { CPU } from '../cpu/cpu';
import { assemble } from './assembler';
import { avrInstruction } from '../cpu/instruction';

export function asmProgram(source: string) {
  const { bytes, errors, lines } = assemble(source);
  if (errors.length) {
    throw new Error('Assembly failed: ' + errors);
  }
  return { program: new Uint16Array(bytes.buffer), lines };
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
      if (cpu.progMem[cpu.pc] === 0x9598) {
        onBreak?.(cpu);
        throw new Error('BREAK instruction encountered');
      }
      avrInstruction(cpu);
      peripheral.tick();
    }
  }
}
