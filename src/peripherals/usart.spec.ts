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
const UDRIE = 0x20;
const TXCIE = 0x40;
const TXC = 0x40;
const UDRE = 0x20;

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

  it('should invoke onByteTransmit when UDR0 is written to', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
    usart.onByteTransmit = jest.fn();
    cpu.writeData(UCSR0B, TXEN);
    cpu.writeData(UDR0, 0x61);
    expect(usart.onByteTransmit).toHaveBeenCalledWith(0x61);
  });

  it('should set UDRE and TXC flags after UDR0', () => {
    const cpu = new CPU(new Uint16Array(1024));
    new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
    cpu.writeData(UCSR0B, TXEN);
    cpu.writeData(UCSR0A, 0);
    cpu.writeData(UDR0, 0x61);
    expect(cpu.data[UCSR0A]).toEqual(TXC | UDRE);
  });

  describe('tick()', () => {
    it('should trigger data register empty interrupt if UDRE is set', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(UCSR0B, UDRIE | TXEN);
      cpu.writeData(0xc6, 0x61);
      cpu.data[SREG] = 0x80; // SREG: I-------
      usart.tick();
      expect(cpu.pc).toEqual(PC_INT_UDRE);
      expect(cpu.cycles).toEqual(2);
      expect(cpu.data[UCSR0A] & UDRE).toEqual(0);
    });

    it('should trigger data TX Complete interrupt if TXCIE is set', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(UCSR0B, TXCIE | TXEN);
      cpu.writeData(UDR0, 0x61);
      cpu.data[SREG] = 0x80; // SREG: I-------
      usart.tick();
      expect(cpu.pc).toEqual(PC_INT_TXC);
      expect(cpu.cycles).toEqual(2);
      expect(cpu.data[UCSR0A] & TXC).toEqual(0);
    });

    it('should not trigger data TX Complete interrupt if UDR was not written to', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(UCSR0B, TXCIE | TXEN);
      cpu.data[SREG] = 0x80; // SREG: I-------
      usart.tick();
      expect(cpu.pc).toEqual(0);
      expect(cpu.cycles).toEqual(0);
    });

    it('should not trigger any interrupt if interrupts are disabled', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(UCSR0B, UDRIE | TXEN);
      cpu.writeData(UDR0, 0x61);
      cpu.data[SREG] = 0; // SREG: 0 (disable interrupts)
      usart.tick();
      expect(cpu.pc).toEqual(0);
      expect(cpu.cycles).toEqual(0);
      expect(cpu.data[UCSR0A]).toEqual(TXC | UDRE);
    });
  });

  describe('onLineTransmit', () => {
    it('should call onLineTransmit with the current line buffer after every newline', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      usart.onLineTransmit = jest.fn();
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
      usart.onLineTransmit = jest.fn();
      cpu.writeData(UCSR0B, TXEN);
      cpu.writeData(UDR0, 0x48); // 'H'
      cpu.writeData(UDR0, 0x69); // 'i'
      expect(usart.onLineTransmit).not.toHaveBeenCalled();
    });

    it('should clear the line buffer after each call to onLineTransmit', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
      usart.onLineTransmit = jest.fn();
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
});
