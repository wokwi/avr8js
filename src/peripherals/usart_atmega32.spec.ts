import { CPU } from '../cpu/cpu';
import { AVRUSARTATmega32, usart0Config } from './usart_atmega32';

const FREQ_16MHZ = 16e6;

describe('ATmege32 USART', () => {
  describe('UBRRH AND UCSRC', () => {
    it('has has both registers equal in config', () => {
      expect(usart0Config.UBRRH).toEqual(usart0Config.UCSRC);
    });

    it('writes to fake UCSRC when URSEL is 1', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSARTATmega32(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(usart0Config.UCSRC, usart0Config.UCSRC_URSEL | 0x40);
      expect(usart.Ucsrc).toEqual(0x40);
      expect(usart.Ubrrh).toEqual(0);
    });

    it('writes to fake UBRRH when URSEL is 0', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const usart = new AVRUSARTATmega32(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(usart0Config.UCSRC, 0x40);
      expect(usart.Ucsrc).toEqual(0);
      expect(usart.Ubrrh).toEqual(0x40);
    });

    it('reads UBRRH and UCSRC sequentually', () => {
      const cpu = new CPU(new Uint16Array(1024));
      cpu.cycles = 100;
      const usart = new AVRUSARTATmega32(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(usart0Config.UCSRC, usart0Config.UCSRC_URSEL | 0x40);
      cpu.writeData(usart0Config.UCSRC, 0x0a);
      expect(cpu.readData(usart0Config.UCSRC)).toEqual(0x0a);
      cpu.cycles += 1;
      expect(cpu.readData(usart0Config.UCSRC)).toEqual(0x40);
    });

    it('resets the sequential read after multiple cycles', () => {
      const cpu = new CPU(new Uint16Array(1024));
      cpu.cycles = 100;
      const usart = new AVRUSARTATmega32(cpu, usart0Config, FREQ_16MHZ);
      cpu.writeData(usart0Config.UCSRC, usart0Config.UCSRC_URSEL | 0x40);
      cpu.writeData(usart0Config.UCSRC, 0x0a);
      expect(cpu.readData(usart0Config.UCSRC)).toEqual(0x0a);
      cpu.cycles += 1;
      cpu.cycles += 1;
      expect(cpu.readData(usart0Config.UCSRC)).toEqual(0x0a);
    });
  });
});
