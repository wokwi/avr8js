/**
 * AVR-8 Instruction Simulation
 * Part of AVR8js
 *
 * Reference: http://ww1.microchip.com/downloads/en/devicedoc/atmel-0856-avr-instruction-set-manual.pdf
 *
 * Instruction timing is currently based on ATmega328p (see the Instruction Set Summary at the end of
 * the datasheet)
 *
 * Copyright (C) 2019, 2020 Uri Shaked
 */

import { ICPU } from './cpu';
import { u16 } from '../types';

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

export function avrInstruction(cpu: ICPU) {
  const opcode = cpu.progMem[cpu.pc];

  if ((opcode & 0xfc00) === 0x1c00) {
    /* ADC, 0001 11rd dddd rrrr */
    const d = cpu.data[(opcode & 0x1f0) >> 4];
    const r = cpu.data[(opcode & 0xf) | ((opcode & 0x200) >> 5)];
    const sum = d + r + (cpu.data[95] & 1);
    const R = sum & 255;
    cpu.data[(opcode & 0x1f0) >> 4] = R;
    let sreg = cpu.data[95] & 0xc0;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= (R ^ r) & (d ^ R) & 128 ? 8 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    sreg |= sum & 256 ? 1 : 0;
    sreg |= 1 & ((d & r) | (r & ~R) | (~R & d)) ? 0x20 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xfc00) === 0xc00) {
    /* ADD, 0000 11rd dddd rrrr */
    const d = cpu.data[(opcode & 0x1f0) >> 4];
    const r = cpu.data[(opcode & 0xf) | ((opcode & 0x200) >> 5)];
    const R = (d + r) & 255;
    cpu.data[(opcode & 0x1f0) >> 4] = R;
    let sreg = cpu.data[95] & 0xc0;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= (R ^ r) & (R ^ d) & 128 ? 8 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    sreg |= (d + r) & 256 ? 1 : 0;
    sreg |= 1 & ((d & r) | (r & ~R) | (~R & d)) ? 0x20 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xff00) === 0x9600) {
    /* ADIW, 1001 0110 KKdd KKKK */
    const addr = 2 * ((opcode & 0x30) >> 4) + 24;
    const value = cpu.dataView.getUint16(addr, true);
    const R = (value + ((opcode & 0xf) | ((opcode & 0xc0) >> 2))) & 0xffff;
    cpu.dataView.setUint16(addr, R, true);
    let sreg = cpu.data[95] & 0xe0;
    sreg |= R ? 0 : 2;
    sreg |= 0x8000 & R ? 4 : 0;
    sreg |= ~value & R & 0x8000 ? 8 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    sreg |= ~R & value & 0x8000 ? 1 : 0;
    cpu.data[95] = sreg;
    cpu.cycles++;
  } else if ((opcode & 0xfc00) === 0x2000) {
    /* AND, 0010 00rd dddd rrrr */
    const R = cpu.data[(opcode & 0x1f0) >> 4] & cpu.data[(opcode & 0xf) | ((opcode & 0x200) >> 5)];
    cpu.data[(opcode & 0x1f0) >> 4] = R;
    let sreg = cpu.data[95] & 0xe1;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xf000) === 0x7000) {
    /* ANDI, 0111 KKKK dddd KKKK */
    const R = cpu.data[((opcode & 0xf0) >> 4) + 16] & ((opcode & 0xf) | ((opcode & 0xf00) >> 4));
    cpu.data[((opcode & 0xf0) >> 4) + 16] = R;
    let sreg = cpu.data[95] & 0xe1;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xfe0f) === 0x9405) {
    /* ASR, 1001 010d dddd 0101 */
    const value = cpu.data[(opcode & 0x1f0) >> 4];
    const R = (value >>> 1) | (128 & value);
    cpu.data[(opcode & 0x1f0) >> 4] = R;
    let sreg = cpu.data[95] & 0xe0;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= value & 1;
    sreg |= ((sreg >> 2) & 1) ^ (sreg & 1) ? 8 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xff8f) === 0x9488) {
    /* BCLR, 1001 0100 1sss 1000 */
    cpu.data[95] &= ~(1 << ((opcode & 0x70) >> 4));
  } else if ((opcode & 0xfe08) === 0xf800) {
    /* BLD, 1111 100d dddd 0bbb */
    const b = opcode & 7;
    const d = (opcode & 0x1f0) >> 4;
    cpu.data[d] = (~(1 << b) & cpu.data[d]) | (((cpu.data[95] >> 6) & 1) << b);
  } else if ((opcode & 0xfc00) === 0xf400) {
    /* BRBC, 1111 01kk kkkk ksss */
    if (!(cpu.data[95] & (1 << (opcode & 7)))) {
      cpu.pc = cpu.pc + (((opcode & 0x1f8) >> 3) - (opcode & 0x200 ? 0x40 : 0));
      cpu.cycles++;
    }
  } else if ((opcode & 0xfc00) === 0xf000) {
    /* BRBS, 1111 00kk kkkk ksss */
    if (cpu.data[95] & (1 << (opcode & 7))) {
      cpu.pc = cpu.pc + (((opcode & 0x1f8) >> 3) - (opcode & 0x200 ? 0x40 : 0));
      cpu.cycles++;
    }
  } else if ((opcode & 0xff8f) === 0x9408) {
    /* BSET, 1001 0100 0sss 1000 */
    cpu.data[95] |= 1 << ((opcode & 0x70) >> 4);
  } else if ((opcode & 0xfe08) === 0xfa00) {
    /* BST, 1111 101d dddd 0bbb */
    const d = cpu.data[(opcode & 0x1f0) >> 4];
    const b = opcode & 7;
    cpu.data[95] = (cpu.data[95] & 0xbf) | ((d >> b) & 1 ? 0x40 : 0);
  } else if ((opcode & 0xfe0e) === 0x940e) {
    /* CALL, 1001 010k kkkk 111k kkkk kkkk kkkk kkkk */
    const k = cpu.progMem[cpu.pc + 1] | ((opcode & 1) << 16) | ((opcode & 0x1f0) << 13);
    const ret = cpu.pc + 2;
    const sp = cpu.dataView.getUint16(93, true);
    const { pc22Bits } = cpu;
    cpu.data[sp] = 255 & ret;
    cpu.data[sp - 1] = (ret >> 8) & 255;
    if (pc22Bits) {
      cpu.data[sp - 2] = (ret >> 16) & 255;
    }
    cpu.dataView.setUint16(93, sp - (pc22Bits ? 3 : 2), true);
    cpu.pc = k - 1;
    cpu.cycles += pc22Bits ? 4 : 3;
  } else if ((opcode & 0xff00) === 0x9800) {
    /* CBI, 1001 1000 AAAA Abbb */
    const A = opcode & 0xf8;
    const b = opcode & 7;
    const R = cpu.readData((A >> 3) + 32);
    cpu.writeData((A >> 3) + 32, R & ~(1 << b));
  } else if ((opcode & 0xfe0f) === 0x9400) {
    /* COM, 1001 010d dddd 0000 */
    const d = (opcode & 0x1f0) >> 4;
    const R = 255 - cpu.data[d];
    cpu.data[d] = R;
    let sreg = (cpu.data[95] & 0xe1) | 1;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xfc00) === 0x1400) {
    /* CP, 0001 01rd dddd rrrr */
    const val1 = cpu.data[(opcode & 0x1f0) >> 4];
    const val2 = cpu.data[(opcode & 0xf) | ((opcode & 0x200) >> 5)];
    const R = val1 - val2;
    let sreg = cpu.data[95] & 0xc0;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= 0 !== ((val1 ^ val2) & (val1 ^ R) & 128) ? 8 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    sreg |= val2 > val1 ? 1 : 0;
    sreg |= 1 & ((~val1 & val2) | (val2 & R) | (R & ~val1)) ? 0x20 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xfc00) === 0x400) {
    /* CPC, 0000 01rd dddd rrrr */
    const arg1 = cpu.data[(opcode & 0x1f0) >> 4];
    const arg2 = cpu.data[(opcode & 0xf) | ((opcode & 0x200) >> 5)];
    let sreg = cpu.data[95];
    const r = arg1 - arg2 - (sreg & 1);
    sreg = (sreg & 0xc0) | (!r && (sreg >> 1) & 1 ? 2 : 0) | (arg2 + (sreg & 1) > arg1 ? 1 : 0);
    sreg |= 128 & r ? 4 : 0;
    sreg |= (arg1 ^ arg2) & (arg1 ^ r) & 128 ? 8 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    sreg |= 1 & ((~arg1 & arg2) | (arg2 & r) | (r & ~arg1)) ? 0x20 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xf000) === 0x3000) {
    /* CPI, 0011 KKKK dddd KKKK */
    const arg1 = cpu.data[((opcode & 0xf0) >> 4) + 16];
    const arg2 = (opcode & 0xf) | ((opcode & 0xf00) >> 4);
    const r = arg1 - arg2;
    let sreg = cpu.data[95] & 0xc0;
    sreg |= r ? 0 : 2;
    sreg |= 128 & r ? 4 : 0;
    sreg |= (arg1 ^ arg2) & (arg1 ^ r) & 128 ? 8 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    sreg |= arg2 > arg1 ? 1 : 0;
    sreg |= 1 & ((~arg1 & arg2) | (arg2 & r) | (r & ~arg1)) ? 0x20 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xfc00) === 0x1000) {
    /* CPSE, 0001 00rd dddd rrrr */
    if (cpu.data[(opcode & 0x1f0) >> 4] === cpu.data[(opcode & 0xf) | ((opcode & 0x200) >> 5)]) {
      const nextOpcode = cpu.progMem[cpu.pc + 1];
      const skipSize = isTwoWordInstruction(nextOpcode) ? 2 : 1;
      cpu.pc += skipSize;
      cpu.cycles += skipSize;
    }
  } else if ((opcode & 0xfe0f) === 0x940a) {
    /* DEC, 1001 010d dddd 1010 */
    const value = cpu.data[(opcode & 0x1f0) >> 4];
    const R = value - 1;
    cpu.data[(opcode & 0x1f0) >> 4] = R;
    let sreg = cpu.data[95] & 0xe1;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= 128 === value ? 8 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    cpu.data[95] = sreg;
  } else if (opcode === 0x9519) {
    /* EICALL, 1001 0101 0001 1001 */
    const retAddr = cpu.pc + 1;
    const sp = cpu.dataView.getUint16(93, true);
    const eind = cpu.data[0x3c];
    cpu.data[sp] = retAddr & 255;
    cpu.data[sp - 1] = (retAddr >> 8) & 255;
    cpu.dataView.setUint16(93, sp - 2, true);
    cpu.pc = ((eind << 16) | cpu.dataView.getUint16(30, true)) - 1;
    cpu.cycles += 3;
  } else if (opcode === 0x9419) {
    /* EIJMP, 1001 0100 0001 1001 */
    const eind = cpu.data[0x3c];
    cpu.pc = ((eind << 16) | cpu.dataView.getUint16(30, true)) - 1;
    cpu.cycles++;
  } else if (opcode === 0x95d8) {
    /* ELPM, 1001 0101 1101 1000 */
    const rampz = cpu.data[0x3b];
    cpu.data[0] = cpu.progBytes[(rampz << 16) | cpu.dataView.getUint16(30, true)];
    cpu.cycles += 2;
  } else if ((opcode & 0xfe0f) === 0x9006) {
    /* ELPM(REG), 1001 000d dddd 0110 */
    const rampz = cpu.data[0x3b];
    cpu.data[(opcode & 0x1f0) >> 4] =
      cpu.progBytes[(rampz << 16) | cpu.dataView.getUint16(30, true)];
    cpu.cycles += 2;
  } else if ((opcode & 0xfe0f) === 0x9007) {
    /* ELPM(INC), 1001 000d dddd 0111 */
    const rampz = cpu.data[0x3b];
    const i = cpu.dataView.getUint16(30, true);
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.progBytes[(rampz << 16) | i];
    cpu.dataView.setUint16(30, i + 1, true);
    if (i === 0xffff) {
      cpu.data[0x3b] = (rampz + 1) % (cpu.progBytes.length >> 16);
    }
    cpu.cycles += 2;
  } else if ((opcode & 0xfc00) === 0x2400) {
    /* EOR, 0010 01rd dddd rrrr */
    const R = cpu.data[(opcode & 0x1f0) >> 4] ^ cpu.data[(opcode & 0xf) | ((opcode & 0x200) >> 5)];
    cpu.data[(opcode & 0x1f0) >> 4] = R;
    let sreg = cpu.data[95] & 0xe1;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xff88) === 0x308) {
    /* FMUL, 0000 0011 0ddd 1rrr */
    const v1 = cpu.data[((opcode & 0x70) >> 4) + 16];
    const v2 = cpu.data[(opcode & 7) + 16];
    const R = (v1 * v2) << 1;
    cpu.dataView.setUint16(0, R, true);
    cpu.data[95] = (cpu.data[95] & 0xfc) | (0xffff & R ? 0 : 2) | ((v1 * v2) & 0x8000 ? 1 : 0);
    cpu.cycles++;
  } else if ((opcode & 0xff88) === 0x380) {
    /* FMULS, 0000 0011 1ddd 0rrr */
    const v1 = cpu.dataView.getInt8(((opcode & 0x70) >> 4) + 16);
    const v2 = cpu.dataView.getInt8((opcode & 7) + 16);
    const R = (v1 * v2) << 1;
    cpu.dataView.setInt16(0, R, true);
    cpu.data[95] = (cpu.data[95] & 0xfc) | (0xffff & R ? 0 : 2) | ((v1 * v2) & 0x8000 ? 1 : 0);
    cpu.cycles++;
  } else if ((opcode & 0xff88) === 0x388) {
    /* FMULSU, 0000 0011 1ddd 1rrr */
    const v1 = cpu.dataView.getInt8(((opcode & 0x70) >> 4) + 16);
    const v2 = cpu.data[(opcode & 7) + 16];
    const R = (v1 * v2) << 1;
    cpu.dataView.setInt16(0, R, true);
    cpu.data[95] = (cpu.data[95] & 0xfc) | (0xffff & R ? 2 : 0) | ((v1 * v2) & 0x8000 ? 1 : 0);
    cpu.cycles++;
  } else if (opcode === 0x9509) {
    /* ICALL, 1001 0101 0000 1001 */
    const retAddr = cpu.pc + 1;
    const sp = cpu.dataView.getUint16(93, true);
    const { pc22Bits } = cpu;
    cpu.data[sp] = retAddr & 255;
    cpu.data[sp - 1] = (retAddr >> 8) & 255;
    if (pc22Bits) {
      cpu.data[sp - 2] = (retAddr >> 16) & 255;
    }
    cpu.dataView.setUint16(93, sp - (pc22Bits ? 3 : 2), true);
    cpu.pc = cpu.dataView.getUint16(30, true) - 1;
    cpu.cycles += pc22Bits ? 3 : 2;
  } else if (opcode === 0x9409) {
    /* IJMP, 1001 0100 0000 1001 */
    cpu.pc = cpu.dataView.getUint16(30, true) - 1;
    cpu.cycles++;
  } else if ((opcode & 0xf800) === 0xb000) {
    /* IN, 1011 0AAd dddd AAAA */
    const i = cpu.readData(((opcode & 0xf) | ((opcode & 0x600) >> 5)) + 32);
    cpu.data[(opcode & 0x1f0) >> 4] = i;
  } else if ((opcode & 0xfe0f) === 0x9403) {
    /* INC, 1001 010d dddd 0011 */
    const d = cpu.data[(opcode & 0x1f0) >> 4];
    const r = (d + 1) & 255;
    cpu.data[(opcode & 0x1f0) >> 4] = r;
    let sreg = cpu.data[95] & 0xe1;
    sreg |= r ? 0 : 2;
    sreg |= 128 & r ? 4 : 0;
    sreg |= 127 === d ? 8 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xfe0e) === 0x940c) {
    /* JMP, 1001 010k kkkk 110k kkkk kkkk kkkk kkkk */
    cpu.pc = (cpu.progMem[cpu.pc + 1] | ((opcode & 1) << 16) | ((opcode & 0x1f0) << 13)) - 1;
    cpu.cycles += 2;
  } else if ((opcode & 0xfe0f) === 0x9206) {
    /* LAC, 1001 001r rrrr 0110 */
    const r = (opcode & 0x1f0) >> 4;
    const clear = cpu.data[r];
    const value = cpu.readData(cpu.dataView.getUint16(30, true));
    cpu.writeData(cpu.dataView.getUint16(30, true), value & (255 - clear));
    cpu.data[r] = value;
  } else if ((opcode & 0xfe0f) === 0x9205) {
    /* LAS, 1001 001r rrrr 0101 */
    const r = (opcode & 0x1f0) >> 4;
    const set = cpu.data[r];
    const value = cpu.readData(cpu.dataView.getUint16(30, true));
    cpu.writeData(cpu.dataView.getUint16(30, true), value | set);
    cpu.data[r] = value;
  } else if ((opcode & 0xfe0f) === 0x9207) {
    /* LAT, 1001 001r rrrr 0111 */
    const r = cpu.data[(opcode & 0x1f0) >> 4];
    const R = cpu.readData(cpu.dataView.getUint16(30, true));
    cpu.writeData(cpu.dataView.getUint16(30, true), r ^ R);
    cpu.data[(opcode & 0x1f0) >> 4] = R;
  } else if ((opcode & 0xf000) === 0xe000) {
    /* LDI, 1110 KKKK dddd KKKK */
    cpu.data[((opcode & 0xf0) >> 4) + 16] = (opcode & 0xf) | ((opcode & 0xf00) >> 4);
  } else if ((opcode & 0xfe0f) === 0x9000) {
    /* LDS, 1001 000d dddd 0000 kkkk kkkk kkkk kkkk */
    cpu.cycles++;
    const value = cpu.readData(cpu.progMem[cpu.pc + 1]);
    cpu.data[(opcode & 0x1f0) >> 4] = value;
    cpu.pc++;
  } else if ((opcode & 0xfe0f) === 0x900c) {
    /* LDX, 1001 000d dddd 1100 */
    cpu.cycles++;
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(cpu.dataView.getUint16(26, true));
  } else if ((opcode & 0xfe0f) === 0x900d) {
    /* LDX(INC), 1001 000d dddd 1101 */
    const x = cpu.dataView.getUint16(26, true);
    cpu.cycles++;
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(x);
    cpu.dataView.setUint16(26, x + 1, true);
  } else if ((opcode & 0xfe0f) === 0x900e) {
    /* LDX(DEC), 1001 000d dddd 1110 */
    const x = cpu.dataView.getUint16(26, true) - 1;
    cpu.dataView.setUint16(26, x, true);
    cpu.cycles++;
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(x);
  } else if ((opcode & 0xfe0f) === 0x8008) {
    /* LDY, 1000 000d dddd 1000 */
    cpu.cycles++;
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(cpu.dataView.getUint16(28, true));
  } else if ((opcode & 0xfe0f) === 0x9009) {
    /* LDY(INC), 1001 000d dddd 1001 */
    const y = cpu.dataView.getUint16(28, true);
    cpu.cycles++;
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(y);
    cpu.dataView.setUint16(28, y + 1, true);
  } else if ((opcode & 0xfe0f) === 0x900a) {
    /* LDY(DEC), 1001 000d dddd 1010 */
    const y = cpu.dataView.getUint16(28, true) - 1;
    cpu.dataView.setUint16(28, y, true);
    cpu.cycles++;
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(y);
  } else if (
    (opcode & 0xd208) === 0x8008 &&
    (opcode & 7) | ((opcode & 0xc00) >> 7) | ((opcode & 0x2000) >> 8)
  ) {
    /* LDDY, 10q0 qq0d dddd 1qqq */
    cpu.cycles++;
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(
      cpu.dataView.getUint16(28, true) +
        ((opcode & 7) | ((opcode & 0xc00) >> 7) | ((opcode & 0x2000) >> 8))
    );
  } else if ((opcode & 0xfe0f) === 0x8000) {
    /* LDZ, 1000 000d dddd 0000 */
    cpu.cycles++;
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(cpu.dataView.getUint16(30, true));
  } else if ((opcode & 0xfe0f) === 0x9001) {
    /* LDZ(INC), 1001 000d dddd 0001 */
    const z = cpu.dataView.getUint16(30, true);
    cpu.cycles++;
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(z);
    cpu.dataView.setUint16(30, z + 1, true);
  } else if ((opcode & 0xfe0f) === 0x9002) {
    /* LDZ(DEC), 1001 000d dddd 0010 */
    const z = cpu.dataView.getUint16(30, true) - 1;
    cpu.dataView.setUint16(30, z, true);
    cpu.cycles++;
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(z);
  } else if (
    (opcode & 0xd208) === 0x8000 &&
    (opcode & 7) | ((opcode & 0xc00) >> 7) | ((opcode & 0x2000) >> 8)
  ) {
    /* LDDZ, 10q0 qq0d dddd 0qqq */
    cpu.cycles++;
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.readData(
      cpu.dataView.getUint16(30, true) +
        ((opcode & 7) | ((opcode & 0xc00) >> 7) | ((opcode & 0x2000) >> 8))
    );
  } else if (opcode === 0x95c8) {
    /* LPM, 1001 0101 1100 1000 */
    cpu.data[0] = cpu.progBytes[cpu.dataView.getUint16(30, true)];
    cpu.cycles += 2;
  } else if ((opcode & 0xfe0f) === 0x9004) {
    /* LPM(REG), 1001 000d dddd 0100 */
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.progBytes[cpu.dataView.getUint16(30, true)];
    cpu.cycles += 2;
  } else if ((opcode & 0xfe0f) === 0x9005) {
    /* LPM(INC), 1001 000d dddd 0101 */
    const i = cpu.dataView.getUint16(30, true);
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.progBytes[i];
    cpu.dataView.setUint16(30, i + 1, true);
    cpu.cycles += 2;
  } else if ((opcode & 0xfe0f) === 0x9406) {
    /* LSR, 1001 010d dddd 0110 */
    const value = cpu.data[(opcode & 0x1f0) >> 4];
    const R = value >>> 1;
    cpu.data[(opcode & 0x1f0) >> 4] = R;
    let sreg = cpu.data[95] & 0xe0;
    sreg |= R ? 0 : 2;
    sreg |= value & 1;
    sreg |= ((sreg >> 2) & 1) ^ (sreg & 1) ? 8 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xfc00) === 0x2c00) {
    /* MOV, 0010 11rd dddd rrrr */
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.data[(opcode & 0xf) | ((opcode & 0x200) >> 5)];
  } else if ((opcode & 0xff00) === 0x100) {
    /* MOVW, 0000 0001 dddd rrrr */
    const r2 = 2 * (opcode & 0xf);
    const d2 = 2 * ((opcode & 0xf0) >> 4);
    cpu.data[d2] = cpu.data[r2];
    cpu.data[d2 + 1] = cpu.data[r2 + 1];
  } else if ((opcode & 0xfc00) === 0x9c00) {
    /* MUL, 1001 11rd dddd rrrr */
    const R = cpu.data[(opcode & 0x1f0) >> 4] * cpu.data[(opcode & 0xf) | ((opcode & 0x200) >> 5)];
    cpu.dataView.setUint16(0, R, true);
    cpu.data[95] = (cpu.data[95] & 0xfc) | (0xffff & R ? 0 : 2) | (0x8000 & R ? 1 : 0);
    cpu.cycles++;
  } else if ((opcode & 0xff00) === 0x200) {
    /* MULS, 0000 0010 dddd rrrr */
    const R =
      cpu.dataView.getInt8(((opcode & 0xf0) >> 4) + 16) * cpu.dataView.getInt8((opcode & 0xf) + 16);
    cpu.dataView.setInt16(0, R, true);
    cpu.data[95] = (cpu.data[95] & 0xfc) | (0xffff & R ? 0 : 2) | (0x8000 & R ? 1 : 0);
    cpu.cycles++;
  } else if ((opcode & 0xff88) === 0x300) {
    /* MULSU, 0000 0011 0ddd 0rrr */
    const R = cpu.dataView.getInt8(((opcode & 0x70) >> 4) + 16) * cpu.data[(opcode & 7) + 16];
    cpu.dataView.setInt16(0, R, true);
    cpu.data[95] = (cpu.data[95] & 0xfc) | (0xffff & R ? 0 : 2) | (0x8000 & R ? 1 : 0);
    cpu.cycles++;
  } else if ((opcode & 0xfe0f) === 0x9401) {
    /* NEG, 1001 010d dddd 0001 */
    const d = (opcode & 0x1f0) >> 4;
    const value = cpu.data[d];
    const R = 0 - value;
    cpu.data[d] = R;
    let sreg = cpu.data[95] & 0xc0;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= 128 === R ? 8 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    sreg |= R ? 1 : 0;
    sreg |= 1 & (R | value) ? 0x20 : 0;
    cpu.data[95] = sreg;
  } else if (opcode === 0) {
    /* NOP, 0000 0000 0000 0000 */
    /* NOP */
  } else if ((opcode & 0xfc00) === 0x2800) {
    /* OR, 0010 10rd dddd rrrr */
    const R = cpu.data[(opcode & 0x1f0) >> 4] | cpu.data[(opcode & 0xf) | ((opcode & 0x200) >> 5)];
    cpu.data[(opcode & 0x1f0) >> 4] = R;
    let sreg = cpu.data[95] & 0xe1;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xf000) === 0x6000) {
    /* SBR, 0110 KKKK dddd KKKK */
    const R = cpu.data[((opcode & 0xf0) >> 4) + 16] | ((opcode & 0xf) | ((opcode & 0xf00) >> 4));
    cpu.data[((opcode & 0xf0) >> 4) + 16] = R;
    let sreg = cpu.data[95] & 0xe1;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xf800) === 0xb800) {
    /* OUT, 1011 1AAr rrrr AAAA */
    cpu.writeData(((opcode & 0xf) | ((opcode & 0x600) >> 5)) + 32, cpu.data[(opcode & 0x1f0) >> 4]);
  } else if ((opcode & 0xfe0f) === 0x900f) {
    /* POP, 1001 000d dddd 1111 */
    const value = cpu.dataView.getUint16(93, true) + 1;
    cpu.dataView.setUint16(93, value, true);
    cpu.data[(opcode & 0x1f0) >> 4] = cpu.data[value];
    cpu.cycles++;
  } else if ((opcode & 0xfe0f) === 0x920f) {
    /* PUSH, 1001 001d dddd 1111 */
    const value = cpu.dataView.getUint16(93, true);
    cpu.data[value] = cpu.data[(opcode & 0x1f0) >> 4];
    cpu.dataView.setUint16(93, value - 1, true);
    cpu.cycles++;
  } else if ((opcode & 0xf000) === 0xd000) {
    /* RCALL, 1101 kkkk kkkk kkkk */
    const k = (opcode & 0x7ff) - (opcode & 0x800 ? 0x800 : 0);
    const retAddr = cpu.pc + 1;
    const sp = cpu.dataView.getUint16(93, true);
    const { pc22Bits } = cpu;
    cpu.data[sp] = 255 & retAddr;
    cpu.data[sp - 1] = (retAddr >> 8) & 255;
    if (pc22Bits) {
      cpu.data[sp - 2] = (retAddr >> 16) & 255;
    }
    cpu.dataView.setUint16(93, sp - (pc22Bits ? 3 : 2), true);
    cpu.pc += k;
    cpu.cycles += pc22Bits ? 3 : 2;
  } else if (opcode === 0x9508) {
    /* RET, 1001 0101 0000 1000 */
    const { pc22Bits } = cpu;
    const i = cpu.dataView.getUint16(93, true) + (pc22Bits ? 3 : 2);
    cpu.dataView.setUint16(93, i, true);
    cpu.pc = (cpu.data[i - 1] << 8) + cpu.data[i] - 1;
    if (pc22Bits) {
      cpu.pc |= cpu.data[i - 2] << 16;
    }
    cpu.cycles += pc22Bits ? 4 : 3;
  } else if (opcode === 0x9518) {
    /* RETI, 1001 0101 0001 1000 */
    const { pc22Bits } = cpu;
    const i = cpu.dataView.getUint16(93, true) + (pc22Bits ? 3 : 2);
    cpu.dataView.setUint16(93, i, true);
    cpu.pc = (cpu.data[i - 1] << 8) + cpu.data[i] - 1;
    if (pc22Bits) {
      cpu.pc |= cpu.data[i - 2] << 16;
    }
    cpu.cycles += pc22Bits ? 4 : 3;
    cpu.data[95] |= 0x80; // Enable interrupts
  } else if ((opcode & 0xf000) === 0xc000) {
    /* RJMP, 1100 kkkk kkkk kkkk */
    cpu.pc = cpu.pc + ((opcode & 0x7ff) - (opcode & 0x800 ? 0x800 : 0));
    cpu.cycles++;
  } else if ((opcode & 0xfe0f) === 0x9407) {
    /* ROR, 1001 010d dddd 0111 */
    const d = cpu.data[(opcode & 0x1f0) >> 4];
    const r = (d >>> 1) | ((cpu.data[95] & 1) << 7);
    cpu.data[(opcode & 0x1f0) >> 4] = r;
    let sreg = cpu.data[95] & 0xe0;
    sreg |= r ? 0 : 2;
    sreg |= 128 & r ? 4 : 0;
    sreg |= 1 & d ? 1 : 0;
    sreg |= ((sreg >> 2) & 1) ^ (sreg & 1) ? 8 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xfc00) === 0x800) {
    /* SBC, 0000 10rd dddd rrrr */
    const val1 = cpu.data[(opcode & 0x1f0) >> 4];
    const val2 = cpu.data[(opcode & 0xf) | ((opcode & 0x200) >> 5)];
    let sreg = cpu.data[95];
    const R = val1 - val2 - (sreg & 1);
    cpu.data[(opcode & 0x1f0) >> 4] = R;
    sreg = (sreg & 0xc0) | (!R && (sreg >> 1) & 1 ? 2 : 0) | (val2 + (sreg & 1) > val1 ? 1 : 0);
    sreg |= 128 & R ? 4 : 0;
    sreg |= (val1 ^ val2) & (val1 ^ R) & 128 ? 8 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    sreg |= 1 & ((~val1 & val2) | (val2 & R) | (R & ~val1)) ? 0x20 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xf000) === 0x4000) {
    /* SBCI, 0100 KKKK dddd KKKK */
    const val1 = cpu.data[((opcode & 0xf0) >> 4) + 16];
    const val2 = (opcode & 0xf) | ((opcode & 0xf00) >> 4);
    let sreg = cpu.data[95];
    const R = val1 - val2 - (sreg & 1);
    cpu.data[((opcode & 0xf0) >> 4) + 16] = R;
    sreg = (sreg & 0xc0) | (!R && (sreg >> 1) & 1 ? 2 : 0) | (val2 + (sreg & 1) > val1 ? 1 : 0);
    sreg |= 128 & R ? 4 : 0;
    sreg |= (val1 ^ val2) & (val1 ^ R) & 128 ? 8 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    sreg |= 1 & ((~val1 & val2) | (val2 & R) | (R & ~val1)) ? 0x20 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xff00) === 0x9a00) {
    /* SBI, 1001 1010 AAAA Abbb */
    const target = ((opcode & 0xf8) >> 3) + 32;
    cpu.writeData(target, cpu.readData(target) | (1 << (opcode & 7)));
    cpu.cycles++;
  } else if ((opcode & 0xff00) === 0x9900) {
    /* SBIC, 1001 1001 AAAA Abbb */
    const value = cpu.readData(((opcode & 0xf8) >> 3) + 32);
    if (!(value & (1 << (opcode & 7)))) {
      const nextOpcode = cpu.progMem[cpu.pc + 1];
      const skipSize = isTwoWordInstruction(nextOpcode) ? 2 : 1;
      cpu.cycles += skipSize;
      cpu.pc += skipSize;
    }
  } else if ((opcode & 0xff00) === 0x9b00) {
    /* SBIS, 1001 1011 AAAA Abbb */
    const value = cpu.readData(((opcode & 0xf8) >> 3) + 32);
    if (value & (1 << (opcode & 7))) {
      const nextOpcode = cpu.progMem[cpu.pc + 1];
      const skipSize = isTwoWordInstruction(nextOpcode) ? 2 : 1;
      cpu.cycles += skipSize;
      cpu.pc += skipSize;
    }
  } else if ((opcode & 0xff00) === 0x9700) {
    /* SBIW, 1001 0111 KKdd KKKK */
    const i = 2 * ((opcode & 0x30) >> 4) + 24;
    const a = cpu.dataView.getUint16(i, true);
    const l = (opcode & 0xf) | ((opcode & 0xc0) >> 2);
    const R = a - l;
    cpu.dataView.setUint16(i, R, true);
    let sreg = cpu.data[95] & 0xc0;
    sreg |= R ? 0 : 2;
    sreg |= 0x8000 & R ? 4 : 0;
    sreg |= a & ~R & 0x8000 ? 8 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    sreg |= l > a ? 1 : 0;
    sreg |= 1 & ((~a & l) | (l & R) | (R & ~a)) ? 0x20 : 0;
    cpu.data[95] = sreg;
    cpu.cycles++;
  } else if ((opcode & 0xfe08) === 0xfc00) {
    /* SBRC, 1111 110r rrrr 0bbb */
    if (!(cpu.data[(opcode & 0x1f0) >> 4] & (1 << (opcode & 7)))) {
      const nextOpcode = cpu.progMem[cpu.pc + 1];
      const skipSize = isTwoWordInstruction(nextOpcode) ? 2 : 1;
      cpu.cycles += skipSize;
      cpu.pc += skipSize;
    }
  } else if ((opcode & 0xfe08) === 0xfe00) {
    /* SBRS, 1111 111r rrrr 0bbb */
    if (cpu.data[(opcode & 0x1f0) >> 4] & (1 << (opcode & 7))) {
      const nextOpcode = cpu.progMem[cpu.pc + 1];
      const skipSize = isTwoWordInstruction(nextOpcode) ? 2 : 1;
      cpu.cycles += skipSize;
      cpu.pc += skipSize;
    }
  } else if (opcode === 0x9588) {
    /* SLEEP, 1001 0101 1000 1000 */
    /* not implemented */
  } else if (opcode === 0x95e8) {
    /* SPM, 1001 0101 1110 1000 */
    /* not implemented */
  } else if (opcode === 0x95f8) {
    /* SPM(INC), 1001 0101 1111 1000 */
    /* not implemented */
  } else if ((opcode & 0xfe0f) === 0x9200) {
    /* STS, 1001 001d dddd 0000 kkkk kkkk kkkk kkkk */
    const value = cpu.data[(opcode & 0x1f0) >> 4];
    const addr = cpu.progMem[cpu.pc + 1];
    cpu.writeData(addr, value);
    cpu.pc++;
    cpu.cycles++;
  } else if ((opcode & 0xfe0f) === 0x920c) {
    /* STX, 1001 001r rrrr 1100 */
    cpu.writeData(cpu.dataView.getUint16(26, true), cpu.data[(opcode & 0x1f0) >> 4]);
    cpu.cycles++;
  } else if ((opcode & 0xfe0f) === 0x920d) {
    /* STX(INC), 1001 001r rrrr 1101 */
    const x = cpu.dataView.getUint16(26, true);
    cpu.writeData(x, cpu.data[(opcode & 0x1f0) >> 4]);
    cpu.dataView.setUint16(26, x + 1, true);
    cpu.cycles++;
  } else if ((opcode & 0xfe0f) === 0x920e) {
    /* STX(DEC), 1001 001r rrrr 1110 */
    const i = cpu.data[(opcode & 0x1f0) >> 4];
    const x = cpu.dataView.getUint16(26, true) - 1;
    cpu.dataView.setUint16(26, x, true);
    cpu.writeData(x, i);
    cpu.cycles++;
  } else if ((opcode & 0xfe0f) === 0x8208) {
    /* STY, 1000 001r rrrr 1000 */
    cpu.writeData(cpu.dataView.getUint16(28, true), cpu.data[(opcode & 0x1f0) >> 4]);
    cpu.cycles++;
  } else if ((opcode & 0xfe0f) === 0x9209) {
    /* STY(INC), 1001 001r rrrr 1001 */
    const i = cpu.data[(opcode & 0x1f0) >> 4];
    const y = cpu.dataView.getUint16(28, true);
    cpu.writeData(y, i);
    cpu.dataView.setUint16(28, y + 1, true);
    cpu.cycles++;
  } else if ((opcode & 0xfe0f) === 0x920a) {
    /* STY(DEC), 1001 001r rrrr 1010 */
    const i = cpu.data[(opcode & 0x1f0) >> 4];
    const y = cpu.dataView.getUint16(28, true) - 1;
    cpu.dataView.setUint16(28, y, true);
    cpu.writeData(y, i);
    cpu.cycles++;
  } else if (
    (opcode & 0xd208) === 0x8208 &&
    (opcode & 7) | ((opcode & 0xc00) >> 7) | ((opcode & 0x2000) >> 8)
  ) {
    /* STDY, 10q0 qq1r rrrr 1qqq */
    cpu.writeData(
      cpu.dataView.getUint16(28, true) +
        ((opcode & 7) | ((opcode & 0xc00) >> 7) | ((opcode & 0x2000) >> 8)),
      cpu.data[(opcode & 0x1f0) >> 4]
    );
    cpu.cycles++;
  } else if ((opcode & 0xfe0f) === 0x8200) {
    /* STZ, 1000 001r rrrr 0000 */
    cpu.writeData(cpu.dataView.getUint16(30, true), cpu.data[(opcode & 0x1f0) >> 4]);
    cpu.cycles++;
  } else if ((opcode & 0xfe0f) === 0x9201) {
    /* STZ(INC), 1001 001r rrrr 0001 */
    const z = cpu.dataView.getUint16(30, true);
    cpu.writeData(z, cpu.data[(opcode & 0x1f0) >> 4]);
    cpu.dataView.setUint16(30, z + 1, true);
    cpu.cycles++;
  } else if ((opcode & 0xfe0f) === 0x9202) {
    /* STZ(DEC), 1001 001r rrrr 0010 */
    const i = cpu.data[(opcode & 0x1f0) >> 4];
    const z = cpu.dataView.getUint16(30, true) - 1;
    cpu.dataView.setUint16(30, z, true);
    cpu.writeData(z, i);
    cpu.cycles++;
  } else if (
    (opcode & 0xd208) === 0x8200 &&
    (opcode & 7) | ((opcode & 0xc00) >> 7) | ((opcode & 0x2000) >> 8)
  ) {
    /* STDZ, 10q0 qq1r rrrr 0qqq */
    cpu.writeData(
      cpu.dataView.getUint16(30, true) +
        ((opcode & 7) | ((opcode & 0xc00) >> 7) | ((opcode & 0x2000) >> 8)),
      cpu.data[(opcode & 0x1f0) >> 4]
    );
    cpu.cycles++;
  } else if ((opcode & 0xfc00) === 0x1800) {
    /* SUB, 0001 10rd dddd rrrr */
    const val1 = cpu.data[(opcode & 0x1f0) >> 4];
    const val2 = cpu.data[(opcode & 0xf) | ((opcode & 0x200) >> 5)];
    const R = val1 - val2;

    cpu.data[(opcode & 0x1f0) >> 4] = R;
    let sreg = cpu.data[95] & 0xc0;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= (val1 ^ val2) & (val1 ^ R) & 128 ? 8 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    sreg |= val2 > val1 ? 1 : 0;
    sreg |= 1 & ((~val1 & val2) | (val2 & R) | (R & ~val1)) ? 0x20 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xf000) === 0x5000) {
    /* SUBI, 0101 KKKK dddd KKKK */
    const val1 = cpu.data[((opcode & 0xf0) >> 4) + 16];
    const val2 = (opcode & 0xf) | ((opcode & 0xf00) >> 4);
    const R = val1 - val2;
    cpu.data[((opcode & 0xf0) >> 4) + 16] = R;
    let sreg = cpu.data[95] & 0xc0;
    sreg |= R ? 0 : 2;
    sreg |= 128 & R ? 4 : 0;
    sreg |= (val1 ^ val2) & (val1 ^ R) & 128 ? 8 : 0;
    sreg |= ((sreg >> 2) & 1) ^ ((sreg >> 3) & 1) ? 0x10 : 0;
    sreg |= val2 > val1 ? 1 : 0;
    sreg |= 1 & ((~val1 & val2) | (val2 & R) | (R & ~val1)) ? 0x20 : 0;
    cpu.data[95] = sreg;
  } else if ((opcode & 0xfe0f) === 0x9402) {
    /* SWAP, 1001 010d dddd 0010 */
    const d = (opcode & 0x1f0) >> 4;
    const i = cpu.data[d];
    cpu.data[d] = ((15 & i) << 4) | ((240 & i) >>> 4);
  } else if (opcode === 0x95a8) {
    /* WDR, 1001 0101 1010 1000 */
    /* not implemented */
  } else if ((opcode & 0xfe0f) === 0x9204) {
    /* XCH, 1001 001r rrrr 0100 */
    const r = (opcode & 0x1f0) >> 4;
    const val1 = cpu.data[r];
    const val2 = cpu.data[cpu.dataView.getUint16(30, true)];
    cpu.data[cpu.dataView.getUint16(30, true)] = val1;
    cpu.data[r] = val2;
  }

  cpu.pc = (cpu.pc + 1) % cpu.progMem.length;
  cpu.cycles++;
}
