// SPDX-License-Identifier: MIT
// Copyright (c) Uri Shaked and contributors

import { describe, expect, it, vi } from 'vitest';
import { CPU } from '../cpu/cpu';
import { asmProgram, TestProgramRunner } from '../utils/test-utils';
import { AVRSPI, spiConfig } from './spi';

const FREQ_16MHZ = 16e6;

// CPU registers
const R17 = 17;
const SREG = 95;

// SPI Registers
const SPCR = 0x4c;
const SPSR = 0x4d;
const SPDR = 0x4e;

// Register bit names
const SPR0 = 1;
const SPR1 = 2;
const CPOL = 4;
const CPHA = 8;
const MSTR = 0x10;
const DORD = 0x20;
const SPE = 0x40;
const SPIE = 0x80;
const WCOL = 0x40;
const SPIF = 0x80;
const SPI2X = 1;

describe('SPI', () => {
  it('should correctly calculate the frequency based on SPCR/SPST values', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const spi = new AVRSPI(cpu, spiConfig, FREQ_16MHZ);

    // Values in this test are based on Table 19-5 in the datasheet, page 177:
    // http://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf

    // Standard SPI speed:
    cpu.writeData(SPSR, 0);
    cpu.writeData(SPCR, 0);
    expect(spi.spiFrequency).toEqual(FREQ_16MHZ / 4);
    cpu.writeData(SPCR, SPR0);
    expect(spi.spiFrequency).toEqual(FREQ_16MHZ / 16);
    cpu.writeData(SPCR, SPR1);
    expect(spi.spiFrequency).toEqual(FREQ_16MHZ / 64);
    cpu.writeData(SPCR, SPR1 | SPR0);
    expect(spi.spiFrequency).toEqual(FREQ_16MHZ / 128);

    // Double SPI speed:
    cpu.writeData(SPSR, SPI2X);
    cpu.writeData(SPCR, 0);
    expect(spi.spiFrequency).toEqual(FREQ_16MHZ / 2);
    cpu.writeData(SPCR, SPR0);
    expect(spi.spiFrequency).toEqual(FREQ_16MHZ / 8);
    cpu.writeData(SPCR, SPR1);
    expect(spi.spiFrequency).toEqual(FREQ_16MHZ / 32);
    cpu.writeData(SPCR, SPR1 | SPR0);
    expect(spi.spiFrequency).toEqual(FREQ_16MHZ / 64);
  });

  it('should correctly report the data order (MSB/LSB first), based on SPCR value', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const spi = new AVRSPI(cpu, spiConfig, FREQ_16MHZ);

    cpu.writeData(SPCR, 0);
    expect(spi.dataOrder).toBe('msbFirst');

    cpu.writeData(SPCR, DORD);
    expect(spi.dataOrder).toBe('lsbFirst');
  });

  it('should correctly report the SPI mode, based on SPCR value', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const spi = new AVRSPI(cpu, spiConfig, FREQ_16MHZ);

    // Values in this test are based on Table 2 in the datasheet, page 174.
    cpu.writeData(SPCR, 0);
    expect(spi.spiMode).toBe(0);

    cpu.writeData(SPCR, CPHA);
    expect(spi.spiMode).toBe(1);

    cpu.writeData(SPCR, CPOL);
    expect(spi.spiMode).toBe(2);

    cpu.writeData(SPCR, CPOL | CPHA);
    expect(spi.spiMode).toBe(3);
  });

  it('should indicate slave/master operation, based on SPCR value', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const spi = new AVRSPI(cpu, spiConfig, FREQ_16MHZ);

    expect(spi.isMaster).toBe(false);

    cpu.writeData(SPCR, MSTR);
    expect(spi.isMaster).toBe(true);
  });

  it('should call the `onByteTransfer` callback when initiating an SPI trasfer by writing to SPDR', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const spi = new AVRSPI(cpu, spiConfig, FREQ_16MHZ);
    spi.onByte = vi.fn();

    cpu.writeData(SPCR, SPE | MSTR);
    cpu.writeData(SPDR, 0x8f);

    expect(spi.onByte).toHaveBeenCalledWith(0x8f);
  });

  it('should ignore SPDR writes when the SPE bit in SPCR is clear', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const spi = new AVRSPI(cpu, spiConfig, FREQ_16MHZ);
    spi.onByte = vi.fn();

    cpu.writeData(SPCR, MSTR);
    cpu.writeData(SPDR, 0x8f);

    expect(spi.onByte).not.toHaveBeenCalled();
  });

  it('should transmit a byte successfully (integration)', () => {
    // Based on code example from section 19.2 of the datasheet, page 172
    const { program } = asmProgram(`
      ; register addresses
      _REPLACE SPCR, ${SPCR - 0x20}
      _REPLACE SPDR, ${SPDR - 0x20}
      _REPLACE SPSR, ${SPSR - 0x20}
      _REPLACE DDR_SPI, 0x4 ; PORTB

      SPI_MasterInit:
        ; Set MOSI and SCK output, all others input
        LDI r17, 0x28
        OUT DDR_SPI, r17
    
        ; Enable SPI, Master, set clock rate fck/16
        LDI r17, 0x51   ; (1<<SPE)|(1<<MSTR)|(1<<SPR0)
        OUT SPCR, r17

      SPI_MasterTransmit:
        LDI r16, 0xb8 ; byte to transmit
        OUT SPDR, r16

      Wait_Transmit:
        IN r16, SPSR
        SBRS r16, 7
        RJMP Wait_Transmit
      
      ; Now read the result into r17
        IN r17, SPDR
        BREAK
    `);

    const cpu = new CPU(program);
    const spi = new AVRSPI(cpu, spiConfig, 16e6);

    let byteReceivedFromAsmCode: number | null = null;

    spi.onByte = (value) => {
      byteReceivedFromAsmCode = value;
      cpu.addClockEvent(() => spi.completeTransfer(0x5b), spi.transferCycles);
    };

    const runner = new TestProgramRunner(cpu, () => 0);
    runner.runToBreak();

    // 16 cycles per clock * 8 bits = 128
    expect(cpu.cycles).toBeGreaterThanOrEqual(128);

    expect(byteReceivedFromAsmCode).toEqual(0xb8);
    expect(cpu.data[R17]).toEqual(0x5b);
  });

  it('should set the WCOL bit in SPSR if writing to SPDR while SPI is already transmitting', () => {
    const cpu = new CPU(new Uint16Array(1024));
    new AVRSPI(cpu, spiConfig, FREQ_16MHZ);

    cpu.writeData(SPCR, SPE | MSTR);
    cpu.writeData(SPDR, 0x50);
    cpu.tick();
    expect(cpu.readData(SPSR) & WCOL).toEqual(0);

    cpu.writeData(SPDR, 0x51);
    expect(cpu.readData(SPSR) & WCOL).toEqual(WCOL);
  });

  it('should clear the SPIF bit and fire an interrupt when SPI transfer completes', () => {
    const cpu = new CPU(new Uint16Array(1024));
    new AVRSPI(cpu, spiConfig, FREQ_16MHZ);

    cpu.writeData(SPCR, SPE | SPIE | MSTR);
    cpu.writeData(SPDR, 0x50);
    cpu.data[SREG] = 0x80; // SREG: I-------

    // At this point, write shouldn't be complete yet
    cpu.cycles += 10;
    cpu.tick();
    expect(cpu.pc).toEqual(0);

    // 100 cycles later, it should (8 bits * 8 cycles per bit = 64).
    cpu.cycles += 100;
    cpu.tick();
    expect(cpu.data[SPSR] & SPIF).toEqual(0);
    expect(cpu.pc).toEqual(0x22); // SPI Ready interrupt
  });

  it('should fire a pending SPI interrupt when SPIE flag is set', () => {
    const cpu = new CPU(new Uint16Array(1024));
    new AVRSPI(cpu, spiConfig, FREQ_16MHZ);

    cpu.writeData(SPCR, SPE | MSTR);
    cpu.writeData(SPDR, 0x50);
    cpu.data[SREG] = 0x80; // SREG: I-------

    // Wait for transfer to complete (8 bits * 8 cycles per bit = 64).
    cpu.cycles += 64;
    cpu.tick();

    expect(cpu.data[SPSR] & SPIF).toEqual(SPIF);
    expect(cpu.pc).toEqual(0); // Interrupt not taken (yet)

    // Enable the interrupt (SPIE)
    cpu.writeData(SPCR, SPE | MSTR | SPIE);
    cpu.tick();
    expect(cpu.pc).toEqual(0x22); // SPI Ready interrupt
    expect(cpu.data[SPSR] & SPIF).toEqual(0);
  });

  it('should should only update SPDR when tranfer finishes (double buffering)', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const spi = new AVRSPI(cpu, spiConfig, FREQ_16MHZ);
    spi.onByte = () => {
      cpu.addClockEvent(() => spi.completeTransfer(0x88), spi.transferCycles);
    };

    cpu.writeData(SPCR, SPE | MSTR);
    cpu.writeData(SPDR, 0x8f);

    cpu.cycles = 10;
    cpu.tick();
    expect(cpu.readData(SPDR)).toEqual(0);

    cpu.cycles = 32; // 4 cycles per bit * 8 bits = 32
    cpu.tick();
    expect(cpu.readData(SPDR)).toEqual(0x88);
  });
});
