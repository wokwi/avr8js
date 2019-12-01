import { CPU } from './cpu';
import { AVRUSART, usart0Config } from './usart';

const FREQ_16MHZ = 16e6;
const FREQ_11_0529MHZ = 11059200;

describe('USART', () => {
  it('should correctly calculate the baudRate from UBRR', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const usart = new AVRUSART(cpu, usart0Config, FREQ_11_0529MHZ);
    cpu.writeData(0xc5, 0); // UBRR0H <- 0
    cpu.writeData(0xc4, 5); // UBRR0L <- 5
    expect(usart.baudRate).toEqual(115200);
  });

  it('should correctly calculate the baudRate from UBRR in double-speed mode', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
    cpu.writeData(0xc5, 3); // UBRR0H <- 3
    cpu.writeData(0xc4, 64); // UBRR0L <- 64
    cpu.writeData(0xc0, 2); // UCSR0A: U2X0
    expect(usart.baudRate).toEqual(2400);
  });

  it('should return 5-bits per byte when UCSZ = 0', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
    cpu.writeData(0xc0, 0);
    expect(usart.bitsPerChar).toEqual(5);
  });

  it('should return 6-bits per byte when UCSZ = 1', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
    cpu.writeData(0xc0, 0x2);
    expect(usart.bitsPerChar).toEqual(6);
  });

  it('should return 7-bits per byte when UCSZ = 2', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
    cpu.writeData(0xc0, 0x4);
    expect(usart.bitsPerChar).toEqual(7);
  });

  it('should return 8-bits per byte when UCSZ = 3', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
    cpu.writeData(0xc0, 0x6);
    expect(usart.bitsPerChar).toEqual(8);
  });

  it('should return 9-bits per byte when UCSZ = 7', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const usart = new AVRUSART(cpu, usart0Config, FREQ_16MHZ);
    cpu.writeData(0xc0, 0x6);
    cpu.writeData(0xc1, 0x4);
    expect(usart.bitsPerChar).toEqual(9);
  });
});
