// SPDX-License-Identifier: MIT
// Copyright (c) Uri Shaked and contributors

import { describe, expect, it, vi } from 'vitest';
import { CPU } from '../cpu/cpu';
import { AVRUSART, usart0Config } from './usart';

const FREQ_16MHZ = 16e6;
const FREQ_11_0529MHZ = 11059200;

// CPU registers
const SREG = 95;

// USART0 Registers
const UCSR0A = 0xc0;
const UCSR0B = 0xc1;
const UCSR0C = 0xc2;
const UBRR0L = 0xc4;
const UBRR0H = 0xc5;
const UDR0 = 0xc6;

// Register bit names
const U2X0 = 2;
const TXEN = 8;
const RXEN = 16;
const UDRIE = 0x20;
const TXCIE = 0x40;
const RXC = 0x80;
const TXC = 0x40;
const UDRE = 0x20;
const USBS = 0x08;
const UPM0 = 0x10;
const UPM1 = 0x20;

// Interrupt address
const PC_INT_UDRE = 0x26;
const PC_INT_TXC = 0x28;
const UCSZ0 = 2;
const UCSZ1 = 4;
const UCSZ2 = 4;

describe('USART', () => {
  it('should correctly calculate the baudRate from UBRR', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const usart = new AVRUSART(cpu, usart0Config, FREQ_11_0529MHZ);
    cpu.writeData(UBRR0H, 0);
    cpu.writeData(UBRR0L, 5);
    expect(usart.baudRate).toEqual(115200);
  });

  it('should correctly calculate the baudRate from UBRR in double-speed mode', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
    cpu.writeData(UBRR0H, 3);
    cpu.writeData(UBRR0L, 64);
    cpu.writeData(UCSR0A, U2X0);
    expect(usart.baudRate).toEqual(2400);
  });

  it('should call onConfigurationChange when the baudRate changes', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
    const onConfigurationChange = vi.fn();
    usart.onConfigurationChange = onConfigurationChange;

    cpu.writeData(UBRR0H, 0);
    expect(onConfigurationChange).toHaveBeenCalled();

    onConfigurationChange.mockClear();
    cpu.writeData(UBRR0L, 5);
    expect(onConfigurationChange).toHaveBeenCalled();

    onConfigurationChange.mockClear();
    cpu.writeData(UCSR0A, U2X0);
    expect(onConfigurationChange).toHaveBeenCalled();
  });

  describe('bitsPerChar', () => {
    it('should return 5-bits per byte when UCSZ = 0', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(UCSR0C, 0);
      expect(usart.bitsPerChar).toEqual(5);
    });

    it('should return 6-bits per byte when UCSZ = 1', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(UCSR0C, UCSZ0);
      expect(usart.bitsPerChar).toEqual(6);
    });

    it('should return 7-bits per byte when UCSZ = 2', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(UCSR0C, UCSZ1);
      expect(usart.bitsPerChar).toEqual(7);
    });

    it('should return 8-bits per byte when UCSZ = 3', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(UCSR0C, UCSZ0 | UCSZ1);
      expect(usart.bitsPerChar).toEqual(8);
    });

    it('should return 9-bits per byte when UCSZ = 7', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(UCSR0C, UCSZ0 | UCSZ1);
      cpu.writeData(UCSR0B, UCSZ2);
      expect(usart.bitsPerChar).toEqual(9);
    });

    it('should call onConfigurationChange when bitsPerChar change', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      const onConfigurationChange = vi.fn();
      usart.onConfigurationChange = onConfigurationChange;

      cpu.writeData(UCSR0C, UCSZ0 | UCSZ1);
      expect(onConfigurationChange).toHaveBeenCalled();

      onConfigurationChange.mockClear();
      cpu.writeData(UCSR0B, UCSZ2);
      expect(onConfigurationChange).toHaveBeenCalled();

      onConfigurationChange.mockClear();
      cpu.writeData(UCSR0B, UCSZ2);
      expect(onConfigurationChange).not.toHaveBeenCalled();
    });
  });

  describe('stopBits', () => {
    it('should return 1 when USBS = 0', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      expect(usart.stopBits).toEqual(1);
    });

    it('should return 2 when USBS = 1', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(UCSR0C, USBS);
      expect(usart.stopBits).toEqual(2);
    });
  });

  describe('parityEnabled', () => {
    it('should return false when UPM1 = 0', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      expect(usart.parityEnabled).toEqual(false);
    });

    it('should return true when UPM1 = 1', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(UCSR0C, UPM1);
      expect(usart.parityEnabled).toEqual(true);
    });
  });

  describe('parityOdd', () => {
    it('should return false when UPM0 = 0', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      expect(usart.parityOdd).toEqual(false);
    });

    it('should return true when UPM0 = 1', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(UCSR0C, UPM0);
      expect(usart.parityOdd).toEqual(true);
    });
  });

  it('should invoke onByteTransmit when UDR0 is written to', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
    usart.onByteTransmit = vi.fn();
    cpu.writeData(UCSR0B, TXEN);
    cpu.writeData(UDR0, 0x61);
    expect(usart.onByteTransmit).toHaveBeenCalledWith(0x61);
  });

  describe('txEnable/rxEnable', () => {
    it('txEnable should equal true when the transitter is enabled', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      usart.onByteTransmit = vi.fn();
      expect(usart.txEnable).toEqual(false);
      cpu.writeData(UCSR0B, TXEN);
      expect(usart.txEnable).toEqual(true);
    });

    it('rxEnable should equal true when the transitter is enabled', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      usart.onByteTransmit = vi.fn();
      expect(usart.rxEnable).toEqual(false);
      cpu.writeData(UCSR0B, RXEN);
      expect(usart.rxEnable).toEqual(true);
    });
  });

  describe('tick()', () => {
    it('should trigger data register empty interrupt if UDRE is set', () => {
      const cpu = new CPU(new Uint16Array(1024));
      new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(UCSR0B, UDRIE | TXEN);
      cpu.data[SREG] = 0x80; // SREG: I-------
      cpu.tick();
      expect(cpu.pc).toEqual(PC_INT_UDRE);
      expect(cpu.cycles).toEqual(2);
      expect(cpu.data[UCSR0A] & UDRE).toEqual(0);
    });

    it('should trigger data TX Complete interrupt if TXCIE is set', () => {
      const cpu = new CPU(new Uint16Array(1024));
      new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(UCSR0B, TXCIE | TXEN);
      cpu.writeData(UDR0, 0x61);
      cpu.data[SREG] = 0x80; // SREG: I-------
      cpu.cycles = 1e6;
      cpu.tick();
      expect(cpu.pc).toEqual(PC_INT_TXC);
      expect(cpu.cycles).toEqual(1e6 + 2);
      expect(cpu.data[UCSR0A] & TXC).toEqual(0);
    });

    it('should not trigger data TX Complete interrupt if UDR was not written to', () => {
      const cpu = new CPU(new Uint16Array(1024));
      new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(UCSR0B, TXCIE | TXEN);
      cpu.data[SREG] = 0x80; // SREG: I-------
      cpu.tick();
      expect(cpu.pc).toEqual(0);
      expect(cpu.cycles).toEqual(0);
    });

    it('should not trigger any interrupt if interrupts are disabled', () => {
      const cpu = new CPU(new Uint16Array(1024));
      new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(UCSR0B, UDRIE | TXEN);
      cpu.writeData(UDR0, 0x61);
      cpu.data[SREG] = 0; // SREG: 0 (disable interrupts)
      cpu.cycles = 1e6;
      cpu.tick();
      expect(cpu.pc).toEqual(0);
      expect(cpu.cycles).toEqual(1e6);
      expect(cpu.data[UCSR0A]).toEqual(TXC | UDRE);
    });
  });

  describe('onLineTransmit', () => {
    it('should call onLineTransmit with the current line buffer after every newline', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      usart.onLineTransmit = vi.fn();
      cpu.writeData(UCSR0B, TXEN);
      cpu.writeData(UDR0, 0x48); // 'H'
      cpu.writeData(UDR0, 0x65); // 'e'
      cpu.writeData(UDR0, 0x6c); // 'l'
      cpu.writeData(UDR0, 0x6c); // 'l'
      cpu.writeData(UDR0, 0x6f); // 'o'
      cpu.writeData(UDR0, 0xa); // '\n'
      expect(usart.onLineTransmit).toHaveBeenCalledWith('Hello');
    });

    it('should not call onLineTransmit if no newline was received', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      usart.onLineTransmit = vi.fn();
      cpu.writeData(UCSR0B, TXEN);
      cpu.writeData(UDR0, 0x48); // 'H'
      cpu.writeData(UDR0, 0x69); // 'i'
      expect(usart.onLineTransmit).not.toHaveBeenCalled();
    });

    it('should clear the line buffer after each call to onLineTransmit', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      usart.onLineTransmit = vi.fn();
      cpu.writeData(UCSR0B, TXEN);
      cpu.writeData(UDR0, 0x48); // 'H'
      cpu.writeData(UDR0, 0x69); // 'i'
      cpu.writeData(UDR0, 0xa); // '\n'
      cpu.writeData(UDR0, 0x74); // 't'
      cpu.writeData(UDR0, 0x68); // 'h'
      cpu.writeData(UDR0, 0x65); // 'e'
      cpu.writeData(UDR0, 0x72); // 'r'
      cpu.writeData(UDR0, 0x65); // 'e'
      cpu.writeData(UDR0, 0xa); // '\n'
      expect(usart.onLineTransmit).toHaveBeenCalledWith('there');
    });
  });

  describe('writeByte', () => {
    it('should return false if called when RX is busy', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(UCSR0B, RXEN);
      cpu.writeData(UBRR0L, 103); // baud: 9600
      expect(usart.writeByte(10)).toEqual(true);
      expect(usart.writeByte(10)).toEqual(false);
      cpu.tick();
      expect(usart.writeByte(10)).toEqual(false);
    });
  });

  describe('Integration tests', () => {
    it('should set the TXC bit after ~1.04mS when baud rate set to 9600', () => {
      const cpu = new CPU(new Uint16Array(1024));
      new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(UCSR0B, TXEN);
      cpu.writeData(UBRR0L, 103); // baud: 9600
      cpu.writeData(UDR0, 0x48); // 'H'
      cpu.cycles += 16000; // 1ms
      cpu.tick();
      expect(cpu.data[UCSR0A] & TXC).toEqual(0);
      cpu.cycles += 800; // 0.05ms
      cpu.tick();
      expect(cpu.data[UCSR0A] & TXC).toEqual(TXC);
    });

    it('should be ready to recieve the next byte after ~1.04ms when baudrate set to 9600', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      const rxCompleteCallback = vi.fn();
      usart.onRxComplete = rxCompleteCallback;
      cpu.writeData(UCSR0B, RXEN);
      cpu.writeData(UBRR0L, 103); // baud: 9600
      expect(usart.writeByte(0x42)).toBe(true);
      cpu.cycles += 16000; // 1ms
      cpu.tick();
      expect(cpu.data[UCSR0A] & RXC).toEqual(0); // byte not received yet
      expect(usart.rxBusy).toBe(true);
      expect(rxCompleteCallback).not.toHaveBeenCalled();
      cpu.cycles += 800; // 0.05ms
      cpu.tick();
      expect(cpu.data[UCSR0A] & RXC).toEqual(RXC);
      expect(usart.rxBusy).toBe(false);
      expect(rxCompleteCallback).toHaveBeenCalled();
      expect(cpu.readData(UDR0)).toEqual(0x42);
      expect(cpu.readData(UDR0)).toEqual(0);
    });
  });
});
