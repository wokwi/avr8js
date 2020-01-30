import { CPU } from './cpu';
import { AVRTWI, twiConfig } from './twi';

const FREQ_16MHZ = 16e6;

describe('TWI', () => {
  it('should correctly calculate the sclFrequency from TWBR', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const twi = new AVRTWI(cpu, twiConfig, FREQ_16MHZ);
    cpu.writeData(0xb8, 0x48); // TWBR <- 0x48
    cpu.writeData(0xb9, 0); // TWSR <- 0 (prescaler: 1)
    expect(twi.sclFrequency).toEqual(100000);
  });

  it('should take the prescaler into consideration when calculating sclFrequency', () => {
    const cpu = new CPU(new Uint16Array(1024));
    const twi = new AVRTWI(cpu, twiConfig, FREQ_16MHZ);
    cpu.writeData(0xb8, 0x03); // TWBR <- 0x03
    cpu.writeData(0xb9, 0x01); // TWSR <- 1 (prescaler: 4)
    expect(twi.sclFrequency).toEqual(400000);
  });
});
