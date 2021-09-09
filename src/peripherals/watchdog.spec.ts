/**
 * AVR8 Watchdog Timer Test Suite
 * Part of AVR8js
 *
 * Copyright (C) 2021 Uri Shaked
 */

import { AVRClock, clockConfig } from '..';
import { CPU } from '../cpu/cpu';
import { asmProgram, TestProgramRunner } from '../utils/test-utils';
import { AVRWatchdog, watchdogConfig } from './watchdog';

const R20 = 20;

const MCUSR = 0x54;
const WDRF = 1 << 3;

const WDTCSR = 0x60;
const WDP0 = 1 << 0;
const WDP1 = 1 << 1;
const WDP2 = 1 << 2;
const WDE = 1 << 3;
const WDCE = 1 << 4;
const WDP3 = 1 << 5;
const WDIE = 1 << 6;

const INT_WDT = 0xc;

describe('Watchdog', () => {
  it('should correctly calculate the prescaler from WDTCSR', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const clock = new AVRClock(cpu, 16e6, clockConfig);
    const watchdog = new AVRWatchdog(cpu, watchdogConfig, clock);
    cpu.writeData(WDTCSR, WDCE | WDE);
    cpu.writeData(WDTCSR, 0);
    expect(watchdog.prescaler).toEqual(2048);
    cpu.writeData(WDTCSR, WDP2 | WDP1 | WDP0);
    expect(watchdog.prescaler).toEqual(256 * 1024);
    cpu.writeData(WDTCSR, WDP3 | WDP0);
    expect(watchdog.prescaler).toEqual(1024 * 1024);
  });

  it('should not change the prescaler unless WDCE is set', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const clock = new AVRClock(cpu, 16e6, clockConfig);
    const watchdog = new AVRWatchdog(cpu, watchdogConfig, clock);
    cpu.writeData(WDTCSR, 0);
    expect(watchdog.prescaler).toEqual(2048);
    cpu.writeData(WDTCSR, WDP2 | WDP1 | WDP0);
    expect(watchdog.prescaler).toEqual(2048);

    cpu.writeData(WDTCSR, WDCE | WDE);
    cpu.cycles += 5; // WDCE should expire after 4 cycles
    cpu.writeData(WDTCSR, WDP2 | WDP1 | WDP0);
    expect(watchdog.prescaler).toEqual(2048);
  });

  it('should reset the CPU when the timer expires', () => {
    const { program } = asmProgram(`
    ; register addresses
    _REPLACE WDTCSR, ${WDTCSR}

    ; Setup watchdog
    ldi r16, ${WDE | WDCE}
    sts WDTCSR, r16
    ldi r16, ${WDE}
    sts WDTCSR, r16
    
    nop

    break
  `);
    const cpu = new CPU(program);
    const clock = new AVRClock(cpu, 16e6, clockConfig);
    const watchdog = new AVRWatchdog(cpu, watchdogConfig, clock);
    const runner = new TestProgramRunner(cpu);

    // Setup: enable watchdog timer
    runner.runInstructions(4);
    expect(watchdog.enabled).toBe(true);

    // Now we skip 8ms. Watchdog shouldn't fire, yet
    cpu.cycles += 16000 * 8;
    runner.runInstructions(1);

    // Now we skip an extra 8ms. Watchdog should fire and reset!
    cpu.cycles += 16000 * 8;
    cpu.tick();
    expect(cpu.pc).toEqual(0);
    expect(cpu.readData(MCUSR)).toEqual(WDRF);
  });

  it('should extend the watchdog timeout when executing a WDR instruction', () => {
    const { program } = asmProgram(`
    ; register addresses
    _REPLACE WDTCSR, ${WDTCSR}

    ; Setup watchdog
    ldi r16, ${WDE | WDCE}
    sts WDTCSR, r16
    ldi r16, ${WDE}
    sts WDTCSR, r16
    
    wdr
    nop

    break
  `);
    const cpu = new CPU(program);
    const clock = new AVRClock(cpu, 16e6, clockConfig);
    const watchdog = new AVRWatchdog(cpu, watchdogConfig, clock);
    const runner = new TestProgramRunner(cpu);

    // Setup: enable watchdog timer
    runner.runInstructions(4);
    expect(watchdog.enabled).toBe(true);

    // Now we skip 8ms. Watchdog shouldn't fire, yet
    cpu.cycles += 16000 * 8;
    runner.runInstructions(1);

    // Now we skip an extra 8ms. We extended the timeout with WDR, so watchdog won't fire yet
    cpu.cycles += 16000 * 8;
    runner.runInstructions(1);

    // Finally, another 8ms bring us to 16ms since last WDR, and watchdog should fire
    cpu.cycles += 16000 * 8;
    cpu.tick();
    expect(cpu.pc).toEqual(0);
  });

  it('should fire an interrupt when the watchdog expires and WDIE is set', () => {
    const { program } = asmProgram(`
    ; register addresses
    _REPLACE WDTCSR, ${WDTCSR}

    ; Setup watchdog
    ldi r16, ${WDE | WDCE}
    sts WDTCSR, r16
    ldi r16, ${WDE | WDIE}
    sts WDTCSR, r16
    
    nop
    sei

    break
  `);
    const cpu = new CPU(program);
    const clock = new AVRClock(cpu, 16e6, clockConfig);
    const watchdog = new AVRWatchdog(cpu, watchdogConfig, clock);
    const runner = new TestProgramRunner(cpu);

    // Setup: enable watchdog timer
    runner.runInstructions(4);
    expect(watchdog.enabled).toBe(true);

    // Now we skip 8ms. Watchdog shouldn't fire, yet
    cpu.cycles += 16000 * 8;
    runner.runInstructions(1);

    // Now we skip an extra 8ms. Watchdog should fire and jump to the interrupt handler
    cpu.cycles += 16000 * 8;
    runner.runInstructions(1);

    expect(cpu.pc).toEqual(INT_WDT);
    // The watchdog timer should also clean the WDIE bit, so next timeout will reset the MCU.
    expect(cpu.readData(WDTCSR) & WDIE).toEqual(0);
  });

  it('should not reset the CPU if the watchdog has been disabled', () => {
    const { program } = asmProgram(`
    ; register addresses
    _REPLACE WDTCSR, ${WDTCSR}

    ; Setup watchdog
    ldi r16, ${WDE | WDCE}
    sts WDTCSR, r16
    ldi r16, ${WDE}
    sts WDTCSR, r16
    
    ; disable watchdog
    ldi r16, ${WDE | WDCE}
    sts WDTCSR, r16
    ldi r16, 0
    sts WDTCSR, r16

    ldi r20, 55

    break
  `);
    const cpu = new CPU(program);
    const clock = new AVRClock(cpu, 16e6, clockConfig);
    const watchdog = new AVRWatchdog(cpu, watchdogConfig, clock);
    const runner = new TestProgramRunner(cpu);

    // Setup: enable watchdog timer
    runner.runInstructions(4);
    expect(watchdog.enabled).toBe(true);

    // Now we skip 8ms. Watchdog shouldn't fire, yet. We disable it.
    cpu.cycles += 16000 * 8;
    runner.runInstructions(4);

    // Now we skip an extra 20ms. Watchdog shouldn't reset!
    cpu.cycles += 16000 * 20;
    runner.runInstructions(1);
    expect(cpu.pc).not.toEqual(0);
    expect(cpu.data[R20]).toEqual(55); // assert that `ldi r20, 55` ran
  });
});
