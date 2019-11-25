import { CPU } from './cpu';
import { AVRIOPort, portBConfig } from './gpio';

describe('GPIO', () => {
  it('should invoke the listeners when the port is written to', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const port = new AVRIOPort(cpu, portBConfig);
    const listener = jest.fn();
    port.addListener(listener);
    cpu.writeData(0x24, 0x0f); // DDRB <- 0x0f
    cpu.writeData(0x25, 0x55); // PORTB <- 0x55
    expect(listener).toHaveBeenCalledWith(0x05, 0);
    expect(cpu.data[0x23]).toEqual(0x5); // PINB should return port value
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
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
