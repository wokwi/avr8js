import { CPU } from '../cpu/cpu';
import { asmProgram, TestProgramRunner } from '../utils/test-utils';
import { AVRIOPort, portBConfig, PinState, portDConfig, PinOverrideMode } from './gpio';

// CPU registers
const SREG = 95;

// GPIO registers
const PINB = 0x23;
const DDRB = 0x24;
const PORTB = 0x25;
const PIND = 0x29;
const DDRD = 0x2a;
const PORTD = 0x2b;
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

  it('should only affect one pin when writing to PIN using SBI (issue #103)', () => {
    const { program } = asmProgram(`
    ; register addresses
    _REPLACE DDRD, ${DDRD - 0x20}
    _REPLACE PIND, ${PIND - 0x20}
    _REPLACE PORTD, ${PORTD - 0x20}

    ; Setup
    ldi r24, 0x48
    out DDRD, r24
    out PORTD, r24

    ; Now toggle pin 6 with SBI
    sbi PIND, 6

    break
  `);
    const cpu = new CPU(program);
    const portD = new AVRIOPort(cpu, portDConfig);
    const runner = new TestProgramRunner(cpu);

    const listener = jest.fn();
    portD.addListener(listener);

    // Setup: pins 6, 3 are output, set to HIGH
    runner.runInstructions(3);
    expect(listener).toHaveBeenCalledWith(0x48, 0x0);
    expect(cpu.data[PORTD]).toEqual(0x48);
    listener.mockReset();

    // Now we toggle pin 6
    runner.runInstructions(1);
    expect(listener).toHaveBeenCalledWith(0x08, 0x48);
    expect(cpu.data[PORTD]).toEqual(0x8);
  });

  it('should update the PIN register on output compare (OCR) match (issue #102)', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const port = new AVRIOPort(cpu, portBConfig);
    cpu.writeData(DDRB, 1 << 1);
    port.timerOverridePin(1, PinOverrideMode.Set);
    expect(port.pinState(1)).toBe(PinState.High);
    expect(cpu.data[PINB]).toBe(1 << 1);
    port.timerOverridePin(1, PinOverrideMode.Clear);
    expect(port.pinState(1)).toBe(PinState.Low);
    expect(cpu.data[PINB]).toBe(0);
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
      expect(listener).toHaveBeenCalledTimes(1);
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
