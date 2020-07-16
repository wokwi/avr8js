import { CPU } from '../cpu/cpu';
import { AVREEPROM, EEPROMMemoryBackend } from './eeprom';
import { asmProgram, TestProgramRunner } from '../utils/test-utils';

// EEPROM Registers
const EECR = 0x3f;
const EEDR = 0x40;
const EEARL = 0x41;
const EEARH = 0x42;
const SREG = 95;

// Register bit names
/* eslint-disable @typescript-eslint/no-unused-vars */
const EERE = 1;
const EEPE = 2;
const EEMPE = 4;
const EERIE = 8;
const EEPM0 = 16;
const EEPM1 = 32;
/* eslint-enable @typescript-eslint/no-unused-vars */

describe('EEPROM', () => {
  describe('Reading the EEPROM', () => {
    it('should return 0xff when reading from an empty location', () => {
      const cpu = new CPU(new Uint16Array(0x1000));
      const eeprom = new AVREEPROM(cpu, new EEPROMMemoryBackend(1024));
      cpu.writeData(EEARL, 0);
      cpu.writeData(EEARH, 0);
      cpu.writeData(EECR, EERE);
      eeprom.tick();
      expect(cpu.cycles).toEqual(4);
      expect(cpu.data[EEDR]).toEqual(0xff);
    });

    it('should return the value stored at the given EEPROM address', () => {
      const cpu = new CPU(new Uint16Array(0x1000));
      const eepromBackend = new EEPROMMemoryBackend(1024);
      const eeprom = new AVREEPROM(cpu, eepromBackend);
      eepromBackend.memory[0x250] = 0x42;
      cpu.writeData(EEARL, 0x50);
      cpu.writeData(EEARH, 0x2);
      cpu.writeData(EECR, EERE);
      eeprom.tick();
      expect(cpu.data[EEDR]).toEqual(0x42);
    });
  });

  describe('Writing to the EEPROM', () => {
    it('should write a byte to the given EEPROM address', () => {
      const cpu = new CPU(new Uint16Array(0x1000));
      const eepromBackend = new EEPROMMemoryBackend(1024);
      const eeprom = new AVREEPROM(cpu, eepromBackend);
      cpu.writeData(EEDR, 0x55);
      cpu.writeData(EEARL, 15);
      cpu.writeData(EEARH, 0);
      cpu.writeData(EECR, EEMPE);
      cpu.writeData(EECR, EEPE);
      eeprom.tick();
      expect(cpu.cycles).toEqual(2);
      expect(eepromBackend.memory[15]).toEqual(0x55);
      expect(cpu.data[EECR] & EEPE).toEqual(EEPE);
    });

    it('should not erase the memory when writing if EEPM1 is high', () => {
      // We subtract 0x20 to translate from RAM address space to I/O register space
      const { program } = asmProgram(`
        ; register addresses
        _REPLACE TWSR, ${EECR - 0x20}
        _REPLACE EEARL, ${EEARL - 0x20}
        _REPLACE EEDR, ${EEDR - 0x20}
        _REPLACE EECR, ${EECR - 0x20}

        LDI r16, 0x55
        OUT EEDR, r16
        LDI r16, 9
        OUT EEARL, r16
        SBI EECR, 5     ; EECR |= EEPM1
        SBI EECR, 2     ; EECR |= EEMPE
        SBI EECR, 1     ; EECR |= EEPE
      `);

      const cpu = new CPU(program);
      const eepromBackend = new EEPROMMemoryBackend(1024);
      const eeprom = new AVREEPROM(cpu, eepromBackend);
      eepromBackend.memory[9] = 0x0f; // high four bits are cleared

      const runner = new TestProgramRunner(cpu, eeprom);
      runner.runInstructions(program.length);

      // EEPROM was 0x0f, and our program wrote 0x55.
      // Since write (without erase) only clears bits, we expect 0x05 now.
      expect(eepromBackend.memory[9]).toEqual(0x05);
    });

    it('should clear the EEPE bit and fire an interrupt when write has been completed', () => {
      const cpu = new CPU(new Uint16Array(0x1000));
      const eepromBackend = new EEPROMMemoryBackend(1024);
      const eeprom = new AVREEPROM(cpu, eepromBackend);
      cpu.writeData(EEDR, 0x55);
      cpu.writeData(EEARL, 15);
      cpu.writeData(EEARH, 0);
      cpu.writeData(EECR, EEMPE | EERIE);
      cpu.data[SREG] = 0x80; // SREG: I-------
      cpu.writeData(EECR, EEPE);
      cpu.cycles += 1000;
      eeprom.tick();
      // At this point, write shouldn't be complete yet
      expect(cpu.data[EECR] & EEPE).toEqual(EEPE);
      expect(cpu.pc).toEqual(0);
      cpu.cycles += 10000000;
      // And now, 10 million cycles later, it should.
      eeprom.tick();
      expect(eepromBackend.memory[15]).toEqual(0x55);
      expect(cpu.data[EECR] & EEPE).toEqual(0);
      expect(cpu.pc).toEqual(0x2c); // EEPROM Ready interrupt
    });

    it('should skip the write if EEMPE is clear', () => {
      const cpu = new CPU(new Uint16Array(0x1000));
      const eepromBackend = new EEPROMMemoryBackend(1024);
      const eeprom = new AVREEPROM(cpu, eepromBackend);
      cpu.writeData(EEDR, 0x55);
      cpu.writeData(EEARL, 15);
      cpu.writeData(EEARH, 0);
      cpu.writeData(EECR, EEMPE);
      cpu.cycles = 8; // waiting for more than 4 cycles should clear EEMPE
      eeprom.tick();
      cpu.writeData(EECR, EEPE);
      eeprom.tick();
      // Ensure that nothing was written, and EEPE bit is clear
      expect(cpu.cycles).toEqual(8);
      expect(eepromBackend.memory[15]).toEqual(0xff);
      expect(cpu.data[EECR] & EEPE).toEqual(0);
    });

    it('should skip the write if another write is already in progress', () => {
      const cpu = new CPU(new Uint16Array(0x1000));
      const eepromBackend = new EEPROMMemoryBackend(1024);
      const eeprom = new AVREEPROM(cpu, eepromBackend);

      // Write 0x55 to address 15
      cpu.writeData(EEDR, 0x55);
      cpu.writeData(EEARL, 15);
      cpu.writeData(EEARH, 0);
      cpu.writeData(EECR, EEMPE);
      cpu.writeData(EECR, EEPE);
      eeprom.tick();
      expect(cpu.cycles).toEqual(2);

      // Write 0x66 to address 16 (first write is still in progress)
      cpu.writeData(EEDR, 0x66);
      cpu.writeData(EEARL, 16);
      cpu.writeData(EEARH, 0);
      cpu.writeData(EECR, EEMPE);
      cpu.writeData(EECR, EEPE);
      eeprom.tick();

      // Ensure that second write didn't happen
      expect(cpu.cycles).toEqual(2);
      expect(eepromBackend.memory[15]).toEqual(0x55);
      expect(eepromBackend.memory[16]).toEqual(0xff);
    });

    it('should write two bytes sucessfully', () => {
      const cpu = new CPU(new Uint16Array(0x1000));
      const eepromBackend = new EEPROMMemoryBackend(1024);
      const eeprom = new AVREEPROM(cpu, eepromBackend);

      // Write 0x55 to address 15
      cpu.writeData(EEDR, 0x55);
      cpu.writeData(EEARL, 15);
      cpu.writeData(EEARH, 0);
      cpu.writeData(EECR, EEMPE);
      cpu.writeData(EECR, EEPE);
      eeprom.tick();
      expect(cpu.cycles).toEqual(2);

      // wait long enough time for the first write to finish
      cpu.cycles += 10000000;
      eeprom.tick();

      // Write 0x66 to address 16
      cpu.writeData(EEDR, 0x66);
      cpu.writeData(EEARL, 16);
      cpu.writeData(EEARH, 0);
      cpu.writeData(EECR, EEMPE);
      cpu.writeData(EECR, EEPE);
      eeprom.tick();

      // Ensure both writes took place
      expect(cpu.cycles).toEqual(10000004);
      expect(eepromBackend.memory[15]).toEqual(0x55);
      expect(eepromBackend.memory[16]).toEqual(0x66);
    });
  });

  describe('EEPROM erase', () => {
    it('should only erase the memory when EEPM0 is high', () => {
      // We subtract 0x20 to translate from RAM address space to I/O register space
      const { program } = asmProgram(`
          ; register addresses
          _REPLACE TWSR, ${EECR - 0x20}
          _REPLACE EEARL, ${EEARL - 0x20}
          _REPLACE EEDR, ${EEDR - 0x20}
          _REPLACE EECR, ${EECR - 0x20}

          LDI r16, 0x55
          OUT EEDR, r16
          LDI r16, 9
          OUT EEARL, r16
          SBI EECR, 4     ; EECR |= EEPM0
          SBI EECR, 2     ; EECR |= EEMPE
          SBI EECR, 1     ; EECR |= EEPE
        `);

      const cpu = new CPU(program);
      const eepromBackend = new EEPROMMemoryBackend(1024);
      const eeprom = new AVREEPROM(cpu, eepromBackend);
      eepromBackend.memory[9] = 0x22;

      const runner = new TestProgramRunner(cpu, eeprom);
      runner.runInstructions(program.length);

      expect(eepromBackend.memory[9]).toEqual(0xff);
    });
  });
});
