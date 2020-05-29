import { CPU } from '../cpu/cpu';
import { AVRIOPort, portBConfig, PinState } from './gpio';

describe('GPIO', () => {
  it('should invoke the listeners when the port is written to', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const port = new AVRIOPort(cpu, portBConfig);
    const listener = jest.fn();
    cpu.writeData(0x24, 0x0f); // DDRB <- 0x0f
    port.addListener(listener);
    cpu.writeData(0x25, 0x55); // PORTB <- 0x55
    expect(listener).toHaveBeenCalledWith(0x05, 0);
    expect(cpu.data[0x23]).toEqual(0x5); // PINB should return port value
  });

  it('should invoke the listeners when DDR changes (issue #28)', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const port = new AVRIOPort(cpu, portBConfig);
    const listener = jest.fn();
    cpu.writeData(0x25, 0x55); // PORTB <- 0x55
    port.addListener(listener);
    cpu.writeData(0x24, 0xf0); // DDRB <- 0xf0
    expect(listener).toHaveBeenCalledWith(0x50, 0);
  });

  it('should toggle the pin when writing to the PIN register', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const port = new AVRIOPort(cpu, portBConfig);
    const listener = jest.fn();
    port.addListener(listener);
    cpu.writeData(0x24, 0x0f); // DDRB <- 0x0f
    cpu.writeData(0x25, 0x55); // PORTB <- 0x55
    cpu.writeData(0x23, 0x01); // PINB <- 0x0f
    expect(listener).toHaveBeenCalledWith(0x04, 0x5);
    expect(cpu.data[0x23]).toEqual(0x4); // PINB should return port value
  });

  describe('removeListener', () => {
    it('should remove the given listener', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      const listener = jest.fn();
      port.addListener(listener);
      cpu.writeData(0x24, 0x0f); // DDRB <- 0x0f
      port.removeListener(listener);
      cpu.writeData(0x25, 0x99); // PORTB <- 0x99
      expect(listener).toBeCalledTimes(1);
    });
  });

  describe('pinState', () => {
    it('should return PinState.High when the pin set to output and HIGH', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      cpu.writeData(0x24, 0x1); // DDRB <- 0x1
      cpu.writeData(0x25, 0x1); // PORTB <- 0x1
      expect(port.pinState(0)).toEqual(PinState.High);
    });

    it('should return PinState.Low when the pin set to output and LOW', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      cpu.writeData(0x24, 0x8); // DDRB <- 0x8
      cpu.writeData(0x25, 0xf7); // PORTB <- 0xF7 (~8)
      expect(port.pinState(3)).toEqual(PinState.Low);
    });

    it('should return PinState.Input by default (reset state)', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      expect(port.pinState(1)).toEqual(PinState.Input);
    });

    it('should return PinState.InputPullUp when the pin is set to input with pullup', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      cpu.writeData(0x24, 0); // DDRB <- 0
      cpu.writeData(0x25, 0x2); // PORTB <- 0x2
      expect(port.pinState(1)).toEqual(PinState.InputPullUp);
    });

    it('should reflect the current port state when called inside a listener', () => {
      // Related issue: https://github.com/wokwi/avr8js/issues/9
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      const listener = jest.fn(() => {
        expect(port.pinState(0)).toBe(PinState.High);
      });
      expect(port.pinState(0)).toBe(PinState.Input);
      cpu.writeData(0x24, 0x01); // DDRB <- 0x01
      port.addListener(listener);
      cpu.writeData(0x25, 0x01); // PORTB <- 0x01
      expect(listener).toHaveBeenCalled();
    });

    it('should reflect the current port state when called inside a listener after DDR change', () => {
      // Related issue: https://github.com/wokwi/avr8js/issues/47
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      const listener = jest.fn(() => {
        expect(port.pinState(0)).toBe(PinState.Low);
      });
      expect(port.pinState(0)).toBe(PinState.Input);
      port.addListener(listener);
      cpu.writeData(0x24, 0x01); // DDRB <- 0x01
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('setPin', () => {
    it('should set the value of the given pin', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      cpu.writeData(0x24, 0); // DDRB <- 0
      port.setPin(4, true);
      expect(cpu.data[0x23]).toEqual(0x10);
      port.setPin(4, false);
      expect(cpu.data[0x23]).toEqual(0x0);
    });

    it('should only update PIN register when pin in Input mode', () => {
      const cpu = new CPU(new Uint16Array(1024));
      const port = new AVRIOPort(cpu, portBConfig);
      cpu.writeData(0x24, 0x10); // DDRB <- 0x10
      cpu.writeData(0x25, 0x0); // PORTB <- 0x0
      port.setPin(4, true);
      expect(cpu.data[0x23]).toEqual(0x0);
      cpu.writeData(0x24, 0x0); // DDRB <- 0x0
      expect(cpu.data[0x23]).toEqual(0x10);
    });
  });
});
