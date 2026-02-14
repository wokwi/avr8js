// SPDX-License-Identifier: MIT
// Copyright (c) Uri Shaked and contributors

import { describe, expect, it } from 'vitest';
import { CPU } from '../cpu/cpu';
import { AVRIOPort } from './gpio';
import { ATtinyTimer1, attinyTimer1Config } from './timer-attiny';

const attinyPortB = {
  PIN: 0x36,
  DDR: 0x37,
  PORT: 0x38,
  externalInterrupts: [],
};

const TCCR1 = attinyTimer1Config.TCCR1;
const TCNT1 = attinyTimer1Config.TCNT1;
const OCR1A = attinyTimer1Config.OCR1A;
const OCR1B = attinyTimer1Config.OCR1B;
const OCR1C = attinyTimer1Config.OCR1C;
const TIFR = attinyTimer1Config.TIFR;
const TIMSK = attinyTimer1Config.TIMSK;

const TOV1 = attinyTimer1Config.TOV1;
const OCF1A = attinyTimer1Config.OCF1A;
const OCF1B = attinyTimer1Config.OCF1B;
const OCIE1A = attinyTimer1Config.OCIE1A;

const CTC1 = 1 << 7;
const CS10 = 1;
const CS13 = 1 << 3;

const SREG = 95;

function createTimer() {
  const cpu = new CPU(new Uint16Array(0x1000));
  new AVRIOPort(cpu, attinyPortB);
  const timer = new ATtinyTimer1(cpu, attinyTimer1Config);
  return { cpu, timer };
}

describe('ATtiny Timer1', () => {
  it('should update timer every tick when prescaler is 1 (CS=1)', () => {
    const { cpu } = createTimer();
    cpu.writeData(TCCR1, CS10);
    cpu.cycles = 1;
    cpu.tick();
    cpu.cycles = 2;
    cpu.tick();
    expect(cpu.readData(TCNT1)).toEqual(1);
  });

  it('should update timer every 128 ticks when prescaler is 128 (CS=8)', () => {
    const { cpu } = createTimer();
    cpu.writeData(TCCR1, CS13);
    cpu.cycles = 1;
    cpu.tick();
    cpu.cycles = 1 + 128;
    cpu.tick();
    expect(cpu.readData(TCNT1)).toEqual(1);
  });

  it('should not update timer when disabled (CS=0)', () => {
    const { cpu } = createTimer();
    cpu.writeData(TCCR1, 0);
    cpu.cycles = 100000;
    cpu.tick();
    expect(cpu.readData(TCNT1)).toEqual(0);
  });

  describe('CTC mode', () => {
    it('should clear timer on OCR1C match when CTC1 is set', () => {
      const { cpu } = createTimer();
      cpu.writeData(OCR1C, 9);
      cpu.writeData(TCCR1, CTC1 | CS10);
      cpu.writeData(TCNT1, 8);
      cpu.cycles = 1;
      cpu.tick();
      cpu.cycles = 1 + 3;
      cpu.tick();
      expect(cpu.readData(TCNT1)).toEqual(1);
    });

    it('should set TOV1 when timer overflows past OCR1C', () => {
      const { cpu } = createTimer();
      cpu.writeData(OCR1C, 9);
      cpu.writeData(TCNT1, 9);
      cpu.writeData(TCCR1, CTC1 | CS10);
      cpu.cycles = 1;
      cpu.tick();
      cpu.cycles = 2;
      cpu.tick();
      expect(cpu.readData(TCNT1)).toEqual(0);
      expect(cpu.data[TIFR] & TOV1).toEqual(TOV1);
    });

    it('should set OCF1A when timer matches OCR1A', () => {
      const { cpu } = createTimer();
      cpu.writeData(OCR1C, 249);
      cpu.writeData(OCR1A, 5);
      cpu.writeData(TCCR1, CTC1 | CS10);
      cpu.writeData(TCNT1, 4);
      cpu.cycles = 1;
      cpu.tick();
      cpu.cycles = 3;
      cpu.tick();
      expect(cpu.data[TIFR] & OCF1A).toEqual(OCF1A);
    });

    it('should set OCF1B when timer matches OCR1B', () => {
      const { cpu } = createTimer();
      cpu.writeData(OCR1C, 249);
      cpu.writeData(OCR1B, 10);
      cpu.writeData(TCCR1, CTC1 | CS10);
      cpu.writeData(TCNT1, 9);
      cpu.cycles = 1;
      cpu.tick();
      cpu.cycles = 3;
      cpu.tick();
      expect(cpu.data[TIFR] & OCF1B).toEqual(OCF1B);
    });

    it('should fire COMPA interrupt when enabled', () => {
      const { cpu } = createTimer();
      cpu.writeData(OCR1C, 249);
      cpu.writeData(OCR1A, 0);
      cpu.writeData(TCCR1, CTC1 | CS10);
      cpu.writeData(TCNT1, 248);
      cpu.writeData(TIMSK, OCIE1A);
      cpu.data[SREG] = 0x80;
      cpu.cycles = 1;
      cpu.tick();
      cpu.cycles = 3;
      cpu.tick();
      expect(cpu.pc).toEqual(0x03);
    });

    it('should overflow after a full period with prescaler 128', () => {
      const { cpu } = createTimer();
      cpu.writeData(TCCR1, CTC1 | CS13);
      cpu.writeData(OCR1C, 249);
      cpu.writeData(TIMSK, OCIE1A);
      cpu.data[SREG] = 0x80;

      // Full timer period: 250 * 128 = 32000 cycles
      cpu.cycles = 1;
      cpu.tick();
      cpu.cycles = 32001;
      cpu.tick();

      expect(cpu.data[TIFR] & TOV1).not.toEqual(0);
    });
  });

  describe('clearing interrupt flags', () => {
    it('should clear TOV1 by writing 1 to TIFR', () => {
      const { cpu } = createTimer();
      cpu.writeData(OCR1C, 9);
      cpu.writeData(TCNT1, 9);
      cpu.writeData(TCCR1, CTC1 | CS10);
      cpu.cycles = 1;
      cpu.tick();
      cpu.cycles = 2;
      cpu.tick();
      expect(cpu.data[TIFR] & TOV1).toEqual(TOV1);
      cpu.writeData(TIFR, TOV1);
      expect(cpu.data[TIFR] & TOV1).toEqual(0);
    });
  });
});
