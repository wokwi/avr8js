/**
 * AVR-8 Instruction Simulation
 * Part of avr8js
 * Reference: http://ww1.microchip.com/downloads/en/devicedoc/atmel-0856-avr-instruction-set-manual.pdf
 *
 * Copyright (C) 2019, Uri Shaked
 */

import { ICPU } from './cpu';

export function avrInstruction(cpu: ICPU) {
  const opcode = cpu.progMem[cpu.pc];

  /* ADC */
  if ((opcode & 0xfc00) === 0x1c00) {
    /* not implemented */
  }

  /* ADD */
  if ((opcode & 0xfc00) === 0xc00) {
    /* not implemented */
  }

  /* ADIW */
  if ((opcode & 0xff00) === 0x9600) {
    /* not implemented */
  }

  /* AND */
  if ((opcode & 0xfc00) === 0x2000) {
    /* not implemented */
  }

  /* ANDI */
  if ((opcode & 0xf000) === 0x7000) {
    /* not implemented */
  }

  /* ASR */
  if ((opcode & 0xfe0f) === 0x9405) {
    /* not implemented */
  }

  /* BCLR */
  if ((opcode & 0xff8f) === 0x9488) {
    /* not implemented */
  }

  /* BLD */
  if ((opcode & 0xfe08) === 0xf800) {
    /* not implemented */
  }

  /* BRBC */
  if ((opcode & 0xfc00) === 0xf400) {
    /* not implemented */
  }

  /* BRBS */
  if ((opcode & 0xfc00) === 0xf000) {
    /* not implemented */
  }

  /* BSET */
  if ((opcode & 0xff8f) === 0x9408) {
    /* not implemented */
  }

  /* BST */
  if ((opcode & 0xfe08) === 0xfa00) {
    /* not implemented */
  }

  /* CALL */
  if ((opcode & 0xfe0e) === 0x940e) {
    /* not implemented */
  }

  /* CBI */
  if ((opcode & 0xff00) === 0x9800) {
    /* not implemented */
  }

  /* COM */
  if ((opcode & 0xfe0f) === 0x9400) {
    /* not implemented */
  }

  /* CP */
  if ((opcode & 0xfc00) === 0x1400) {
    /* not implemented */
  }

  /* CPC */
  if ((opcode & 0xfc00) === 0x400) {
    const arg1 = cpu.data[(opcode & 0x1f0) >> 4];
    const arg2 = cpu.data[(opcode & 0xf) | ((opcode & 0x200) >> 5)];
    let sreg = cpu.data[95];
    const r = arg1 - arg2 - (sreg & 1);
    sreg = (sreg & 0xfd) | (0 === r && (sreg >> 1) & 1 ? 2 : 0);
    sreg = (sreg & 0xfb) | (128 & r ? 4 : 0);
    sreg = (sreg & 0xf7) | ((arg1 ^ arg2) & (arg1 ^ r) & 128 ? 8 : 0);
    sreg = (sreg & 0xef) | (((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0);
    sreg = (sreg & 0xfe) | (arg2 + (sreg & 1) > arg1 ? 1 : 0);
    sreg = (sreg & 0xdf) | (1 & ((~arg1 & arg2) | (arg2 & r) | (r & ~arg1)) ? 0x20 : 0);
    cpu.data[95] = sreg;
  }

  /* CPI */
  if ((opcode & 0xf000) === 0x3000) {
    const arg1 = cpu.data[((opcode & 0xf0) >> 4) + 16];
    const arg2 = (opcode & 0xf) | ((opcode & 0xf00) >> 4);
    const r = arg1 - arg2;
    let sreg = cpu.data[95];
    sreg = (sreg & 0xfd) | (0 === r ? 2 : 0);
    sreg = (sreg & 0xfb) | (128 & r ? 4 : 0);
    sreg = (sreg & 0xf7) | ((arg1 ^ arg2) & (arg1 ^ r) & 128 ? 8 : 0);
    sreg = (sreg & 0xef) | (((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0);
    sreg = (sreg & 0xfe) | (arg2 > arg1 ? 1 : 0);
    sreg = (sreg & 0xdf) | (1 & ((~arg1 & arg2) | (arg2 & r) | (r & ~arg1)) ? 0x20 : 0);
    cpu.data[95] = sreg;
  }

  /* CPSE */
  if ((opcode & 0xfc00) === 0x1000) {
    /* not implemented */
  }

  /* DEC */
  if ((opcode & 0xfe0f) === 0x940a) {
    /* not implemented */
  }

  /* EOR */
  if ((opcode & 0xfc00) === 0x2400) {
    /* not implemented */
  }

  /* FMUL */
  if ((opcode & 0xff88) === 0x308) {
    /* not implemented */
  }

  /* FMULS */
  if ((opcode & 0xff88) === 0x380) {
    /* not implemented */
  }

  /* FMULSU */
  if ((opcode & 0xff88) === 0x388) {
    /* not implemented */
  }

  /* ICALL */
  if (opcode === 0x9509) {
    /* not implemented */
  }

  /* IJMP */
  if (opcode === 0x9409) {
    /* not implemented */
  }

  /* IN */
  if ((opcode & 0xf800) === 0xb000) {
    /* not implemented */
  }

  /* INC */
  if ((opcode & 0xfe0f) === 0x9403) {
    /* not implemented */
  }

  /* JMP */
  if ((opcode & 0xfe0e) === 0x940c) {
    cpu.pc = (cpu.progMem[cpu.pc + 1] | ((opcode & 1) << 16) | ((opcode & 0x1f0) << 13)) - 1;
    cpu.cycles += 2;
  }

  /* LAC */
  if ((opcode & 0xfe0f) === 0x9206) {
    /* not implemented */
  }

  /* LAS */
  if ((opcode & 0xfe0f) === 0x9205) {
    /* not implemented */
  }

  /* LAT */
  if ((opcode & 0xfe0f) === 0x9207) {
    /* not implemented */
  }

  /* LDI */
  if ((opcode & 0xf000) === 0xe000) {
    cpu.data[((opcode & 0xf0) >> 4) + 16] = (opcode & 0xf) | ((opcode & 0xf00) >> 4);
  }

  /* LDS */
  if ((opcode & 0xfe0f) === 0x9000) {
    /* not implemented */
  }

  /* LDX */
  if ((opcode & 0xfe0f) === 0x900c) {
    /* not implemented */
  }

  /* LDX */
  if ((opcode & 0xfe0f) === 0x900d) {
    /* not implemented */
  }

  /* LDX */
  if ((opcode & 0xfe0f) === 0x900e) {
    /* not implemented */
  }

  /* LDY */
  if ((opcode & 0xfe0f) === 0x8008) {
    /* not implemented */
  }

  /* LDY */
  if ((opcode & 0xfe0f) === 0x9009) {
    /* not implemented */
  }

  /* LDY */
  if ((opcode & 0xfe0f) === 0x900a) {
    /* not implemented */
  }

  /* LDY */
  if ((opcode & 0xd208) === 0x8008) {
    /* not implemented */
  }

  /* LDZ */
  if ((opcode & 0xfe0f) === 0x8000) {
    /* not implemented */
  }

  /* LDZ */
  if ((opcode & 0xfe0f) === 0x9001) {
    /* not implemented */
  }

  /* LDZ */
  if ((opcode & 0xfe0f) === 0x9002) {
    /* not implemented */
  }

  /* LDZ */
  if ((opcode & 0xd208) === 0x8000) {
    /* not implemented */
  }

  /* LPM */
  if (opcode === 0x95c8) {
    /* not implemented */
  }

  /* LPM */
  if ((opcode & 0xfe0f) === 0x9004) {
    /* not implemented */
  }

  /* LPM */
  if ((opcode & 0xfe0f) === 0x9005) {
    /* not implemented */
  }

  /* LSR */
  if ((opcode & 0xfe0f) === 0x9406) {
    /* not implemented */
  }

  /* MOV */
  if ((opcode & 0xfc00) === 0x2c00) {
    /* not implemented */
  }

  /* MOVW */
  if ((opcode & 0xff00) === 0x100) {
    /* not implemented */
  }

  /* MUL */
  if ((opcode & 0xfc00) === 0x9c00) {
    /* not implemented */
  }

  /* MULS */
  if ((opcode & 0xff00) === 0x200) {
    /* not implemented */
  }

  /* MULSU */
  if ((opcode & 0xff88) === 0x300) {
    /* not implemented */
  }

  /* NEG */
  if ((opcode & 0xfe0f) === 0x9401) {
    /* not implemented */
  }

  /* NOP */
  if (opcode === 0) {
    /* NOP */
  }

  /* OR */
  if ((opcode & 0xfc00) === 0x2800) {
    /* not implemented */
  }

  /* SBR */
  if ((opcode & 0xf000) === 0x6000) {
    /* not implemented */
  }

  /* OUT */
  if ((opcode & 0xf800) === 0xb800) {
    cpu.writeData(((opcode & 0xf) | ((opcode & 0x600) >> 5)) + 32, cpu.data[(opcode & 0x1f0) >> 4]);
  }

  /* POP */
  if ((opcode & 0xfe0f) === 0x900f) {
    /* not implemented */
  }

  /* PUSH */
  if ((opcode & 0xfe0f) === 0x920f) {
    /* not implemented */
  }

  /* RCALL */
  if ((opcode & 0xf000) === 0xd000) {
    /* not implemented */
  }

  /* RET */
  if (opcode === 0x9508) {
    /* not implemented */
  }

  /* RETI */
  if (opcode === 0x9518) {
    /* not implemented */
  }

  /* RJMP */
  if ((opcode & 0xf000) === 0xc000) {
    cpu.pc = cpu.pc + ((opcode & 0x7ff) - (opcode & 0x800 ? 0x800 : 0));
    cpu.cycles++;
  }

  /* ROR */
  if ((opcode & 0xfe0f) === 0x9407) {
    /* not implemented */
  }

  /* SBC */
  if ((opcode & 0xfc00) === 0x800) {
    /* not implemented */
  }

  /* SBCI */
  if ((opcode & 0xf000) === 0x4000) {
    /* not implemented */
  }

  /* SBI */
  if ((opcode & 0xff00) === 0x9a00) {
    /* not implemented */
  }

  /* SBIC */
  if ((opcode & 0xff00) === 0x9900) {
    /* not implemented */
  }

  /* SBIS */
  if ((opcode & 0xff00) === 0x9b00) {
    /* not implemented */
  }

  /* SBIW */
  if ((opcode & 0xff00) === 0x9700) {
    /* not implemented */
  }

  /* SBRC */
  if ((opcode & 0xfe08) === 0xfc00) {
    /* not implemented */
  }

  /* SBRS */
  if ((opcode & 0xfe08) === 0xfe00) {
    /* not implemented */
  }

  /* SLEEP */
  if (opcode === 0x9588) {
    /* not implemented */
  }

  /* SPM */
  if (opcode === 0x95e8) {
    /* not implemented */
  }

  /* SPM */
  if (opcode === 0x95f8) {
    /* not implemented */
  }

  /* STS */
  if ((opcode & 0xfe0f) === 0x9200) {
    /* not implemented */
  }

  /* STX */
  if ((opcode & 0xfe0f) === 0x920c) {
    cpu.writeData(cpu.dataView.getUint16(26, true), cpu.data[(opcode & 0x1f0) >> 4]);
  }

  /* STX */
  if ((opcode & 0xfe0f) === 0x920d) {
    cpu.writeData(cpu.dataView.getUint16(26, true), cpu.data[(opcode & 0x1f0) >> 4]);
    cpu.dataView.setUint16(26, cpu.dataView.getUint16(26, true) + 1, true);
  }

  /* STX */
  if ((opcode & 0xfe0f) === 0x920e) {
    const i = cpu.data[(opcode & 0x1f0) >> 4];
    cpu.dataView.setUint16(26, cpu.dataView.getUint16(26, true) - 1, true);
    cpu.writeData(cpu.dataView.getUint16(26, true), i);
    cpu.cycles++;
  }

  /* STY */
  if ((opcode & 0xfe0f) === 0x8208) {
    /* not implemented */
  }

  /* STY */
  if ((opcode & 0xfe0f) === 0x9209) {
    /* not implemented */
  }

  /* STY */
  if ((opcode & 0xfe0f) === 0x920a) {
    /* not implemented */
  }

  /* STY */
  if ((opcode & 0xd208) === 0x8208) {
    /* not implemented */
  }

  /* STZ */
  if ((opcode & 0xfe0f) === 0x8200) {
    /* not implemented */
  }

  /* STZ */
  if ((opcode & 0xfe0f) === 0x9201) {
    /* not implemented */
  }

  /* STZ */
  if ((opcode & 0xfe0f) === 0x9202) {
    /* not implemented */
  }

  /* STZ */
  if ((opcode & 0xd208) === 0x8200) {
    /* not implemented */
  }

  /* SUB */
  if ((opcode & 0xfc00) === 0x1800) {
    /* not implemented */
  }

  /* SUBI */
  if ((opcode & 0xf000) === 0x5000) {
    /* not implemented */
  }

  /* SWAP */
  if ((opcode & 0xfe0f) === 0x9402) {
    /* not implemented */
  }

  /* WDR */
  if (opcode === 0x95a8) {
    /* not implemented */
  }

  /* XCH */
  if ((opcode & 0xfe0f) === 0x9204) {
    /* not implemented */
  }

  cpu.pc = (cpu.pc + 1) % cpu.progMem.length;
  cpu.cycles++;
}
