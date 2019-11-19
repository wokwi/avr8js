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

  /* ADC, 0001 11rd dddd rrrr */
  if ((opcode & 0xfc00) === 0x1c00) {
    /* not implemented */
  }

  /* ADD, 0000 11rd dddd rrrr */
  if ((opcode & 0xfc00) === 0xc00) {
    /* not implemented */
  }

  /* ADIW, 1001 0110 KKdd KKKK */
  if ((opcode & 0xff00) === 0x9600) {
    /* not implemented */
  }

  /* AND, 0010 00rd dddd rrrr */
  if ((opcode & 0xfc00) === 0x2000) {
    /* not implemented */
  }

  /* ANDI, 0111 KKKK dddd KKKK */
  if ((opcode & 0xf000) === 0x7000) {
    /* not implemented */
  }

  /* ASR, 1001 010d dddd 0101 */
  if ((opcode & 0xfe0f) === 0x9405) {
    /* not implemented */
  }

  /* BCLR, 1001 0100 1sss 1000 */
  if ((opcode & 0xff8f) === 0x9488) {
    /* not implemented */
  }

  /* BLD, 1111 100d dddd 0bbb */
  if ((opcode & 0xfe08) === 0xf800) {
    /* not implemented */
  }

  /* BRBS, 1111 00kk kkkk ksss */
  if ((opcode & 0xfc00) === 0xf000) {
    /* not implemented */
  }

  /* BRCC, 1111 01kk kkkk k000 */
  if ((opcode & 0xfc00) === 0xf400) {
    /* not implemented */
  }

  /* BSET, 1001 0100 0sss 1000 */
  if ((opcode & 0xff8f) === 0x9408) {
    /* not implemented */
  }

  /* BST, 1111 101d dddd 0bbb */
  if ((opcode & 0xfe08) === 0xfa00) {
    /* not implemented */
  }

  /* CALL, 1001 010k kkkk 111k kkkk kkkk kkkk kkkk */
  if ((opcode & 0xfe0e) === 0x940e) {
    /* not implemented */
  }

  /* CBI, 1001 1000 AAAA Abbb */
  if ((opcode & 0xff00) === 0x9800) {
    /* not implemented */
  }

  /* COM, 1001 010d dddd 0000 */
  if ((opcode & 0xfe0f) === 0x9400) {
    /* not implemented */
  }

  /* CP, 0001 01rd dddd rrrr */
  if ((opcode & 0xfc00) === 0x1400) {
    /* not implemented */
  }

  /* CPC, 0000 01rd dddd rrrr */
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

  /* CPI, 0011 KKKK dddd KKKK */
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

  /* CPSE, 0001 00rd dddd rrrr */
  if ((opcode & 0xfc00) === 0x1000) {
    /* not implemented */
  }

  /* DEC, 1001 010d dddd 1010 */
  if ((opcode & 0xfe0f) === 0x940a) {
    /* not implemented */
  }

  /* EOR, 0010 01rd dddd rrrr */
  if ((opcode & 0xfc00) === 0x2400) {
    /* not implemented */
  }

  /* FMUL, 0000 0011 0ddd 1rrr */
  if ((opcode & 0xff88) === 0x308) {
    /* not implemented */
  }

  /* FMULS, 0000 0011 1ddd 0rrr */
  if ((opcode & 0xff88) === 0x380) {
    /* not implemented */
  }

  /* FMULSU, 0000 0011 1ddd 1rrr */
  if ((opcode & 0xff88) === 0x388) {
    /* not implemented */
  }

  /* ICALL, 1001 0101 0000 1001 */
  if (opcode === 0x9509) {
    /* not implemented */
  }

  /* IJMP, 1001 0100 0000 1001 */
  if (opcode === 0x9409) {
    /* not implemented */
  }

  /* IN, 1011 0AAd dddd AAAA */
  if ((opcode & 0xf800) === 0xb000) {
    /* not implemented */
  }

  /* INC, 1001 010d dddd 0011 */
  if ((opcode & 0xfe0f) === 0x9403) {
    /* not implemented */
  }

  /* JMP, 1001 010k kkkk 110k kkkk kkkk kkkk kkkk */
  if ((opcode & 0xfe0e) === 0x940c) {
    cpu.pc = (cpu.progMem[cpu.pc + 1] | ((opcode & 1) << 16) | ((opcode & 0x1f0) << 13)) - 1;
    cpu.cycles += 2;
  }

  /* LAC, 1001 001r rrrr 0110 */
  if ((opcode & 0xfe0f) === 0x9206) {
    /* not implemented */
  }

  /* LAS, 1001 001r rrrr 0101 */
  if ((opcode & 0xfe0f) === 0x9205) {
    /* not implemented */
  }

  /* LAT, 1001 001r rrrr 0111 */
  if ((opcode & 0xfe0f) === 0x9207) {
    /* not implemented */
  }

  /* LDI, 1110 KKKK dddd KKKK */
  if ((opcode & 0xf000) === 0xe000) {
    cpu.data[((opcode & 0xf0) >> 4) + 16] = (opcode & 0xf) | ((opcode & 0xf00) >> 4);
  }

  /* LDS, 1001 000d dddd 0000 kkkk kkkk kkkk kkkk */
  if ((opcode & 0xfe0f) === 0x9000) {
    /* not implemented */
  }

  /* LDX, 1001 000d dddd 1100 */
  if ((opcode & 0xfe0f) === 0x900c) {
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(cpu.dataView.getUint16(26, true));
  }

  /* LDX, 1001 000d dddd 1101 */
  if ((opcode & 0xfe0f) === 0x900d) {
    const x = cpu.dataView.getUint16(26, true);
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(x);
    cpu.dataView.setUint16(26, x + 1, true);
    cpu.cycles++;
  }

  /* LDX, 1001 000d dddd 1110 */
  if ((opcode & 0xfe0f) === 0x900e) {
    const x = cpu.dataView.getUint16(26, true) - 1;
    cpu.dataView.setUint16(26, x, true);
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(x);
    cpu.cycles += 2;
  }

  /* LDY, 1000 000d dddd 1000 */
  if ((opcode & 0xfe0f) === 0x8008) {
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(cpu.dataView.getUint16(28, true));
  }

  /* LDY, 1001 000d dddd 1001 */
  if ((opcode & 0xfe0f) === 0x9009) {
    const y = cpu.dataView.getUint16(28, true);
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(y);
    cpu.dataView.setUint16(28, y + 1, true);
    cpu.cycles++;
  }

  /* LDY, 1001 000d dddd 1010 */
  if ((opcode & 0xfe0f) === 0x900a) {
    const y = cpu.dataView.getUint16(28, true) - 1;
    cpu.dataView.setUint16(28, y, true);
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(y);
    cpu.cycles += 2;
  }

  /* LDDY, 10q0 qq0d dddd 1qqq */
  if (
    (opcode & 0xd208) === 0x8008 &&
    (opcode & 7) | ((opcode & 0xc00) >> 7) | ((opcode & 0x2000) >> 8)
  ) {
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(
      cpu.dataView.getUint16(28, true) +
        ((opcode & 7) | ((opcode & 0xc00) >> 7) | ((opcode & 0x2000) >> 8))
    );
    cpu.cycles += 2;
  }

  /* LDZ, 1000 000d dddd 0000 */
  if ((opcode & 0xfe0f) === 0x8000) {
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(cpu.dataView.getUint16(30, true));
  }

  /* LDZ, 1001 000d dddd 0001 */
  if ((opcode & 0xfe0f) === 0x9001) {
    const z = cpu.dataView.getUint16(30, true);
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(z);
    cpu.dataView.setUint16(30, z + 1, true);
    cpu.cycles++;
  }

  /* LDZ, 1001 000d dddd 0010 */
  if ((opcode & 0xfe0f) === 0x9002) {
    const z = cpu.dataView.getUint16(30, true) - 1;
    cpu.dataView.setUint16(30, z, true);
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(z);
    cpu.cycles += 2;
  }

  /* LDDZ, 10q0 qq0d dddd 0qqq */
  if (
    (opcode & 0xd208) === 0x8000 &&
    (opcode & 7) | ((opcode & 0xc00) >> 7) | ((opcode & 0x2000) >> 8)
  ) {
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(
      cpu.dataView.getUint16(30, true) +
        ((opcode & 7) | ((opcode & 0xc00) >> 7) | ((opcode & 0x2000) >> 8))
    );
    cpu.cycles += 2;
  }

  /* LPM, 1001 0101 1100 1000 */
  if (opcode === 0x95c8) {
    /* not implemented */
  }

  /* LPM, 1001 000d dddd 0100 */
  if ((opcode & 0xfe0f) === 0x9004) {
    /* not implemented */
  }

  /* LPM, 1001 000d dddd 0101 */
  if ((opcode & 0xfe0f) === 0x9005) {
    /* not implemented */
  }

  /* LSR, 1001 010d dddd 0110 */
  if ((opcode & 0xfe0f) === 0x9406) {
    /* not implemented */
  }

  /* MOV, 0010 11rd dddd rrrr */
  if ((opcode & 0xfc00) === 0x2c00) {
    /* not implemented */
  }

  /* MOVW, 0000 0001 dddd rrrr */
  if ((opcode & 0xff00) === 0x100) {
    /* not implemented */
  }

  /* MUL, 1001 11rd dddd rrrr */
  if ((opcode & 0xfc00) === 0x9c00) {
    /* not implemented */
  }

  /* MULS, 0000 0010 dddd rrrr */
  if ((opcode & 0xff00) === 0x200) {
    /* not implemented */
  }

  /* MULSU, 0000 0011 0ddd 0rrr */
  if ((opcode & 0xff88) === 0x300) {
    /* not implemented */
  }

  /* NEG, 1001 010d dddd 0001 */
  if ((opcode & 0xfe0f) === 0x9401) {
    /* not implemented */
  }

  /* NOP, 0000 0000 0000 0000 */
  if (opcode === 0) {
    /* NOP */
  }

  /* OR, 0010 10rd dddd rrrr */
  if ((opcode & 0xfc00) === 0x2800) {
    /* not implemented */
  }

  /* SBR, 0110 KKKK dddd KKKK */
  if ((opcode & 0xf000) === 0x6000) {
    /* not implemented */
  }

  /* OUT, 1011 1AAr rrrr AAAA */
  if ((opcode & 0xf800) === 0xb800) {
    cpu.writeData(((opcode & 0xf) | ((opcode & 0x600) >> 5)) + 32, cpu.data[(opcode & 0x1f0) >> 4]);
  }

  /* POP, 1001 000d dddd 1111 */
  if ((opcode & 0xfe0f) === 0x900f) {
    /* not implemented */
  }

  /* PUSH, 1001 001d dddd 1111 */
  if ((opcode & 0xfe0f) === 0x920f) {
    /* not implemented */
  }

  /* RCALL, 1101 kkkk kkkk kkkk */
  if ((opcode & 0xf000) === 0xd000) {
    /* not implemented */
  }

  /* RET, 1001 0101 0000 1000 */
  if (opcode === 0x9508) {
    /* not implemented */
  }

  /* RETI, 1001 0101 0001 1000 */
  if (opcode === 0x9518) {
    /* not implemented */
  }

  /* RJMP, 1100 kkkk kkkk kkkk */
  if ((opcode & 0xf000) === 0xc000) {
    cpu.pc = cpu.pc + ((opcode & 0x7ff) - (opcode & 0x800 ? 0x800 : 0));
    cpu.cycles++;
  }

  /* ROR, 1001 010d dddd 0111 */
  if ((opcode & 0xfe0f) === 0x9407) {
    /* not implemented */
  }

  /* SBC, 0000 10rd dddd rrrr */
  if ((opcode & 0xfc00) === 0x800) {
    /* not implemented */
  }

  /* SBCI */
  if ((opcode & 0xf000) === 0x4000) {
    /* not implemented */
  }

  /* SBI, 0100 KKKK dddd KKKK */
  if ((opcode & 0xff00) === 0x9a00) {
    /* not implemented */
  }

  /* SBIC, 1001 1001 AAAA Abbb */
  if ((opcode & 0xff00) === 0x9900) {
    /* not implemented */
  }

  /* SBIS, 1001 1011 AAAA Abbb */
  if ((opcode & 0xff00) === 0x9b00) {
    /* not implemented */
  }

  /* SBIW, 1001 0111 KKdd KKKK */
  if ((opcode & 0xff00) === 0x9700) {
    /* not implemented */
  }

  /* SBRC, 1111 110r rrrr 0bbb */
  if ((opcode & 0xfe08) === 0xfc00) {
    /* not implemented */
  }

  /* SBRS, 1111 111r rrrr 0bbb */
  if ((opcode & 0xfe08) === 0xfe00) {
    /* not implemented */
  }

  /* SLEEP, 1001 0101 1000 1000 */
  if (opcode === 0x9588) {
    /* not implemented */
  }

  /* SPM, 1001 0101 1110 1000 */
  if (opcode === 0x95e8) {
    /* not implemented */
  }

  /* SPM, 1001 0101 1111 1000 */
  if (opcode === 0x95f8) {
    /* not implemented */
  }

  /* STS, 1001 001d dddd 0000 kkkk kkkk kkkk kkkk */
  if ((opcode & 0xfe0f) === 0x9200) {
    /* not implemented */
  }

  /* STX, 1001 001r rrrr 1100 */
  if ((opcode & 0xfe0f) === 0x920c) {
    cpu.writeData(cpu.dataView.getUint16(26, true), cpu.data[(opcode & 0x1f0) >> 4]);
  }

  /* STX, 1001 001r rrrr 1101 */
  if ((opcode & 0xfe0f) === 0x920d) {
    const x = cpu.dataView.getUint16(26, true);
    cpu.writeData(x, cpu.data[(opcode & 0x1f0) >> 4]);
    cpu.dataView.setUint16(26, x + 1, true);
  }

  /* STX, 1001 001r rrrr 1110 */
  if ((opcode & 0xfe0f) === 0x920e) {
    const i = cpu.data[(opcode & 0x1f0) >> 4];
    const x = cpu.dataView.getUint16(26, true) - 1;
    cpu.dataView.setUint16(26, x, true);
    cpu.writeData(x, i);
    cpu.cycles++;
  }

  /* STY, 1000 001r rrrr 1000 */
  if ((opcode & 0xfe0f) === 0x8208) {
    cpu.writeData(cpu.dataView.getUint16(28, true), cpu.data[(opcode & 0x1f0) >> 4]);
  }

  /* STY, 1001 001r rrrr 1001 */
  if ((opcode & 0xfe0f) === 0x9209) {
    const i = cpu.data[(opcode & 0x1f0) >> 4];
    const y = cpu.dataView.getUint16(28, true);
    cpu.writeData(y, i);
    cpu.dataView.setUint16(28, y + 1, true);
  }

  /* STY, 1001 001r rrrr 1010 */
  if ((opcode & 0xfe0f) === 0x920a) {
    const i = cpu.data[(opcode & 0x1f0) >> 4];
    const y = cpu.dataView.getUint16(28, true) - 1;
    cpu.dataView.setUint16(28, y, true);
    cpu.writeData(y, i);
    cpu.cycles++;
  }

  /* STDY, 10q0 qq1r rrrr 1qqq */
  if (
    (opcode & 0xd208) === 0x8208 &&
    (opcode & 7) | ((opcode & 0xc00) >> 7) | ((opcode & 0x2000) >> 8)
  ) {
    cpu.writeData(
      cpu.dataView.getUint16(28, true) +
        ((opcode & 7) | ((opcode & 0xc00) >> 7) | ((opcode & 0x2000) >> 8)),
      cpu.data[(opcode & 0x1f0) >> 4]
    );
    cpu.cycles++;
  }

  /* STZ, 1000 001r rrrr 0000 */
  if ((opcode & 0xfe0f) === 0x8200) {
    cpu.writeData(cpu.dataView.getUint16(30, true), cpu.data[(opcode & 0x1f0) >> 4]);
  }

  /* STZ, 1001 001r rrrr 0001 */
  if ((opcode & 0xfe0f) === 0x9201) {
    const z = cpu.dataView.getUint16(30, true);
    cpu.writeData(z, cpu.data[(opcode & 0x1f0) >> 4]);
    cpu.dataView.setUint16(30, z + 1, true);
  }

  /* STZ, 1001 001r rrrr 0010 */
  if ((opcode & 0xfe0f) === 0x9202) {
    const i = cpu.data[(opcode & 0x1f0) >> 4];
    const z = cpu.dataView.getUint16(30, true) - 1;
    cpu.dataView.setUint16(30, z, true);
    cpu.writeData(z, i);
    cpu.cycles++;
  }

  /* STDZ, 10q0 qq1r rrrr 0qqq */
  if (
    (opcode & 0xd208) === 0x8200 &&
    (opcode & 7) | ((opcode & 0xc00) >> 7) | ((opcode & 0x2000) >> 8)
  ) {
    cpu.writeData(
      cpu.dataView.getUint16(30, true) +
        ((opcode & 7) | ((opcode & 0xc00) >> 7) | ((opcode & 0x2000) >> 8)),
      cpu.data[(opcode & 0x1f0) >> 4]
    );
    cpu.cycles++;
  }

  /* SUB, 0001 10rd dddd rrrr */
  if ((opcode & 0xfc00) === 0x1800) {
    /* not implemented */
  }

  /* SUBI, 0101 KKKK dddd KKKK */
  if ((opcode & 0xf000) === 0x5000) {
    /* not implemented */
  }

  /* SWAP, 1001 010d dddd 0010 */
  if ((opcode & 0xfe0f) === 0x9402) {
    /* not implemented */
  }

  /* WDR, 1001 0101 1010 1000 */
  if (opcode === 0x95a8) {
    /* not implemented */
  }

  /* XCH, 1001 001r rrrr 0100 */
  if ((opcode & 0xfe0f) === 0x9204) {
    /* not implemented */
  }

  cpu.pc = (cpu.pc + 1) % cpu.progMem.length;
  cpu.cycles++;
}
