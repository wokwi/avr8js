import { CPU } from '../cpu/cpu';
import { AVRIOPort, portBConfig, PinState, portDConfig } from './gpio';

// CPU registers
const SREG = 95;

// GPIO registers
const PINB = 0x23;
const DDRB = 0x24;
const PORTB = 0x25;
const EIFR = 0x3c;
const EIMSK = 0x3d;
const PCICR = 0x68;
const EICRA = 0x69;
const PCIFR = 0x3b;
const PCMSK0 = 0x6b;

// Register bit names
const INT0 = 0;
const ISC00 = 0;
const ISC01 = 1;
const PCIE0 = 0;
const PCINT3 = 3;

// Pin names
const PB0 = 0;
const PB1 = 1;
const PB3 = 3;
const PB4 = 4;
const PD2 = 2;

// Interrupt vector addresses
const PC_INT_INT0 = 2;
const PC_INT_PCINT0 = 6;

describe('GPIO', () => {
  it('should invoke the listeners when the port is written to', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const port = new AVRIOPort(cpu, portBConfig);
    const listener = jest.fn();
    cpu.writeData(DDRB, 0x0f);
    port.addListener(listener);
    cpu.writeData(PORTB, 0x55);
    expect(listener).toHaveBeenCalledWith(0x55, 0);
    expect(cpu.data[0x23]).toEqual(0x5); // PINB should return port value
  });

  it('should invoke the listeners when DDR changes (issue #28)', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const port = new AVRIOPort(cpu, portBConfig);
    const listener = jest.fn();
    cpu.writeData(PORTB, 0x55);
    port.addListener(listener);
    cpu.writeData(DDRB, 0xf0);
    expect(listener).toHaveBeenCalledWith(0x55, 0x55);
  });

  it('should invoke the listeners when pullup register enabled (issue #62)', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const port = new AVRIOPort(cpu, portBConfig);
    const listener = jest.fn();
    port.addListener(listener);
    cpu.writeData(PORTB, 0x55);
    expect(listener).toHaveBeenCalledWith(0x55, 0);
  });

  it('should toggle the pin when writing to the PIN register', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const port = new AVRIOPort(cpu, portBConfig);
    const listener = jest.fn();
    port.addListener(listener);
    cpu.writeData(DDRB, 0x0f);
    cpu.writeData(PORTB, 0x55);
    cpu.writeData(PINB, 0x01);
    expect(listener).toHaveBeenCalledWith(0x54, 0x55);
    expect(cpu.data[PINB]).toEqual(0x4); // PINB should return port value
  });

  describe('removeListener', () => {
    it('should remove the given listener', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      const listener = jest.fn();
      port.addListener(listener);
      cpu.writeData(DDRB, 0x0f);
      port.removeListener(listener);
      cpu.writeData(PORTB, 0x99);
      expect(listener).toBeCalledTimes(1);
    });
  });

  describe('pinState', () => {
    it('should return PinState.High when the pin set to output and HIGH', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      cpu.writeData(DDRB, 0x1);
      cpu.writeData(PORTB, 0x1);
      expect(port.pinState(PB0)).toEqual(PinState.High);
    });

    it('should return PinState.Low when the pin set to output and LOW', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      cpu.writeData(DDRB, 0x8);
      cpu.writeData(PORTB, 0xf7);
      expect(port.pinState(PB3)).toEqual(PinState.Low);
    });

    it('should return PinState.Input by default (reset state)', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      expect(port.pinState(PB1)).toEqual(PinState.Input);
    });

    it('should return PinState.InputPullUp when the pin is set to input with pullup', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      cpu.writeData(DDRB, 0);
      cpu.writeData(PORTB, 0x2);
      expect(port.pinState(PB1)).toEqual(PinState.InputPullUp);
    });

    it('should reflect the current port state when called inside a listener', () => {
      // Related issue: https://github.com/wokwi/avr8js/issues/9
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      const listener = jest.fn(() => {
        expect(port.pinState(PB0)).toBe(PinState.High);
      });
      expect(port.pinState(PB0)).toBe(PinState.Input);
      cpu.writeData(DDRB, 0x01);
      port.addListener(listener);
      cpu.writeData(PORTB, 0x01);
      expect(listener).toHaveBeenCalled();
    });

    it('should reflect the current port state when called inside a listener after DDR change', () => {
      // Related issue: https://github.com/wokwi/avr8js/issues/47
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      const listener = jest.fn(() => {
        expect(port.pinState(PB0)).toBe(PinState.Low);
      });
      expect(port.pinState(PB0)).toBe(PinState.Input);
      port.addListener(listener);
      cpu.writeData(DDRB, 0x01);
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('setPin', () => {
    it('should set the value of the given pin', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      cpu.writeData(DDRB, 0);
      port.setPin(PB4, true);
      expect(cpu.data[0x23]).toEqual(0x10);
      port.setPin(PB4, false);
      expect(cpu.data[0x23]).toEqual(0x0);
    });

    it('should only update PIN register when pin in Input mode', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      cpu.writeData(DDRB, 0x10);
      cpu.writeData(PORTB, 0x0);
      port.setPin(PB4, true);
      expect(cpu.data[PINB]).toEqual(0x0);
      cpu.writeData(DDRB, 0x0);
      expect(cpu.data[PINB]).toEqual(0x10);
    });
  });

  describe('External interrupt', () => {
    it('should generate INT0 interrupt on rising edge', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portDConfig);
      cpu.writeData(EIMSK, 1 << INT0);
      cpu.writeData(EICRA, (1 << ISC01) | (1 << ISC00));

      expect(cpu.data[EIFR]).toEqual(0);
      port.setPin(PD2, true);
      expect(cpu.data[EIFR]).toEqual(1 << INT0);

      cpu.data[SREG] = 0x80; // SREG: I------- (enable interrupts)
      cpu.tick();
      expect(cpu.pc).toEqual(PC_INT_INT0);
      expect(cpu.cycles).toEqual(2);
      expect(cpu.data[EIFR]).toEqual(0);

      port.setPin(PD2, false);
      expect(cpu.data[EIFR]).toEqual(0);
    });

    it('should generate INT0 interrupt on falling edge', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portDConfig);
      cpu.writeData(EIMSK, 1 << INT0);
      cpu.writeData(EICRA, 1 << ISC01);

      expect(cpu.data[EIFR]).toEqual(0);
      port.setPin(PD2, true);
      expect(cpu.data[EIFR]).toEqual(0);
      port.setPin(PD2, false);
      expect(cpu.data[EIFR]).toEqual(1 << INT0);

      cpu.data[SREG] = 0x80; // SREG: I------- (enable interrupts)
      cpu.tick();
      expect(cpu.pc).toEqual(PC_INT_INT0);
      expect(cpu.cycles).toEqual(2);
      expect(cpu.data[EIFR]).toEqual(0);
    });

    it('should generate INT0 interrupt on level change', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portDConfig);
      cpu.writeData(EIMSK, 1 << INT0);
      cpu.writeData(EICRA, 1 << ISC00);

      expect(cpu.data[EIFR]).toEqual(0);
      port.setPin(PD2, true);
      expect(cpu.data[EIFR]).toEqual(1 << INT0);
      cpu.writeData(EIFR, 1 << INT0);
      expect(cpu.data[EIFR]).toEqual(0);
      port.setPin(PD2, false);
      expect(cpu.data[EIFR]).toEqual(1 << INT0);
    });

    it('should a sticky INT0 interrupt while the pin level is low', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portDConfig);
      cpu.writeData(EIMSK, 1 << INT0);
      cpu.writeData(EICRA, 0);
      expect(cpu.data[EIFR]).toEqual(0);

      port.setPin(PD2, true);
      expect(cpu.data[EIFR]).toEqual(0);

      port.setPin(PD2, false);
      expect(cpu.data[EIFR]).toEqual(1 << INT0);

      // This is a sticky interrupt, verify we can't clear the flag:
      cpu.writeData(EIFR, 1 << INT0);
      expect(cpu.data[EIFR]).toEqual(1 << INT0);

      cpu.data[SREG] = 0x80; // SREG: I------- (enable interrupts)
      cpu.tick();
      expect(cpu.pc).toEqual(PC_INT_INT0);
      expect(cpu.cycles).toEqual(2);

      // Flag shouldn't be cleared, as the interrupt is sticky
      expect(cpu.data[EIFR]).toEqual(1 << INT0);

      // But it will be cleared as soon as the pin goes high.
      port.setPin(PD2, true);
      expect(cpu.data[EIFR]).toEqual(0);
    });
  });

  describe('Pin change interrupts (PCINT)', () => {
    it('should generate a pin change interrupt when PB3 (PCINT3) goes high', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      cpu.writeData(PCICR, 1 << PCIE0);
      cpu.writeData(PCMSK0, 1 << PCINT3);

      port.setPin(PB3, true);
      expect(cpu.data[PCIFR]).toEqual(1 << PCIE0);

      cpu.data[SREG] = 0x80; // SREG: I-------
      cpu.tick();
      expect(cpu.pc).toEqual(PC_INT_PCINT0);
      expect(cpu.cycles).toEqual(2);
      expect(cpu.data[PCIFR]).toEqual(0);
    });

    it('should generate a pin change interrupt when PB3 (PCINT3) goes low', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);

      port.setPin(PB3, true);
      cpu.writeData(PCICR, 1 << PCIE0);
      cpu.writeData(PCMSK0, 1 << PCINT3);
      expect(cpu.data[PCIFR]).toEqual(0);

      port.setPin(PB3, false);
      expect(cpu.data[PCIFR]).toEqual(1 << PCIE0);

      cpu.data[SREG] = 0x80; // SREG: I-------
      cpu.tick();
      expect(cpu.pc).toEqual(PC_INT_PCINT0);
      expect(cpu.cycles).toEqual(2);
      expect(cpu.data[PCIFR]).toEqual(0);
    });

    it('should clear the interrupt flag when writing to PCIFR', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      cpu.writeData(PCICR, 1 << PCIE0);
      cpu.writeData(PCMSK0, 1 << PCINT3);

      port.setPin(PB3, true);
      expect(cpu.data[PCIFR]).toEqual(1 << PCIE0);

      cpu.writeData(PCIFR, 1 << PCIE0);
      expect(cpu.data[PCIFR]).toEqual(0);
    });
  });
});
