// SPDX-License-Identifier: MIT
// Copyright (c) Uri Shaked and contributors

/**
 * AVR-8 Interrupt Handling
 * Part of AVR8js
 * Reference: http://ww1.microchip.com/downloads/en/devicedoc/atmel-0856-avr-instruction-set-manual.pdf
 *
 * Copyright (C) 2019, Uri Shaked
 */

import { CPU } from './cpu';

export function avrInterrupt(cpu: CPU, addr: number) {
  const sp = cpu.dataView.getUint16(93, true);
  cpu.data[sp] = cpu.pc & 0xff;
  cpu.data[sp - 1] = (cpu.pc >> 8) & 0xff;
  if (cpu.pc22Bits) {
    cpu.data[sp - 2] = (cpu.pc >> 16) & 0xff;
  }
  cpu.dataView.setUint16(93, sp - (cpu.pc22Bits ? 3 : 2), true);
  cpu.data[95] &= 0x7f; // clear global interrupt flag
  cpu.cycles += 2;
  cpu.pc = addr;
}
