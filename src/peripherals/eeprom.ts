import { AVRInterruptConfig, CPU } from '../cpu/cpu';
import { u16, u32, u8 } from '../types';

export interface EEPROMBackend {
  readMemory(addr: u16): u8;
  writeMemory(addr: u16, value: u8): void;
  eraseMemory(addr: u16): void;
}

export class EEPROMMemoryBackend implements EEPROMBackend {
  readonly memory: Uint8Array;

  constructor(size: u16) {
    this.memory = new Uint8Array(size);
    this.memory.fill(0xff);
  }

  readMemory(addr: u16) {
    return this.memory[addr];
  }

  writeMemory(addr: u16, value: u8) {
    this.memory[addr] &= value;
  }

  eraseMemory(addr: u16) {
    this.memory[addr] = 0xff;
  }
}

export interface AVREEPROMConfig {
  eepromReadyInterrupt: u8;

  EECR: u8;
  EEDR: u8;
  EEARL: u8;
  EEARH: u8;

  /** The amount of clock cycles erase takes */
  eraseCycles: u32;
  /** The amount of clock cycles a write takes */
  writeCycles: u32;
}

export const eepromConfig: AVREEPROMConfig = {
  eepromReadyInterrupt: 0x2c,
  EECR: 0x3f,
  EEDR: 0x40,
  EEARL: 0x41,
  EEARH: 0x42,
  eraseCycles: 28800, // 1.8ms at 16MHz
  writeCycles: 28800, // 1.8ms at 16MHz
};

const EERE = 1 << 0;
const EEPE = 1 << 1;
const EEMPE = 1 << 2;
const EERIE = 1 << 3;
const EEPM0 = 1 << 4;
const EEPM1 = 1 << 5;

export class AVREEPROM {
  /**
   * Used to keep track on the last write to EEMPE. From the datasheet:
   * The EEMPE bit determines whether setting EEPE to one causes the EEPROM to be written.
   * When EEMPE is set, setting EEPE within four clock cycles will write data to the EEPROM
   * at the selected address If EEMPE is zero, setting EEPE will have no effect.
   */
  private writeEnabledCycles = 0;

  private writeCompleteCycles = 0;

  // Interrupts
  private EER: AVRInterruptConfig = {
    address: this.config.eepromReadyInterrupt,
    flagRegister: this.config.EECR,
    flagMask: EEPE,
    enableRegister: this.config.EECR,
    enableMask: EERIE,
    constant: true,
  };

  constructor(
    private cpu: CPU,
    private backend: EEPROMBackend,
    private config: AVREEPROMConfig = eepromConfig
  ) {
    this.cpu.writeHooks[this.config.EECR] = (eecr) => {
      const { EEARH, EEARL, EECR, EEDR } = this.config;

      const addr = (this.cpu.data[EEARH] << 8) | this.cpu.data[EEARL];

      if (eecr & EERE) {
        this.cpu.clearInterrupt(this.EER);
      }

      if (eecr & EEMPE) {
        const eempeCycles = 4;
        this.writeEnabledCycles = this.cpu.cycles + eempeCycles;
        this.cpu.addClockEvent(() => {
          this.cpu.data[EECR] &= ~EEMPE;
        }, eempeCycles);
      }

      // Read
      if (eecr & EERE) {
        this.cpu.data[EEDR] = this.backend.readMemory(addr);
        // When the EEPROM is read, the CPU is halted for four cycles before the
        // next instruction is executed.
        this.cpu.cycles += 4;
        return true;
      }

      // Write
      if (eecr & EEPE) {
        //  If EEMPE is zero, setting EEPE will have no effect.
        if (this.cpu.cycles >= this.writeEnabledCycles) {
          return true;
        }
        // Check for write-in-progress
        if (this.cpu.cycles < this.writeCompleteCycles) {
          return true;
        }

        const eedr = this.cpu.data[EEDR];

        this.writeCompleteCycles = this.cpu.cycles;

        // Erase
        if (!(eecr & EEPM1)) {
          this.backend.eraseMemory(addr);
          this.writeCompleteCycles += this.config.eraseCycles;
        }
        // Write
        if (!(eecr & EEPM0)) {
          this.backend.writeMemory(addr, eedr);
          this.writeCompleteCycles += this.config.writeCycles;
        }

        this.cpu.data[EECR] |= EEPE;

        this.cpu.addClockEvent(() => {
          this.cpu.setInterruptFlag(this.EER);
        }, this.writeCompleteCycles - this.cpu.cycles);

        // When EEPE has been set, the CPU is halted for two cycles before the
        // next instruction is executed.
        this.cpu.cycles += 2;
        return true;
      }

      return false;
    };
  }
}
