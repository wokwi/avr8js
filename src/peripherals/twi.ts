import { CPU } from '../cpu/cpu';
import { avrInterrupt } from '../cpu/interrupt';
import { u8 } from '../types';

export interface TWIEventHandler {
  start(repeated: boolean): void;

  stop(): void;

  connectToSlave(addr: u8, write: boolean): void;

  writeByte(value: u8): void;

  readByte(ack: boolean): void;
}

export interface TWIConfig {
  twiInterrupt: u8;

  TWBR: u8;
  TWCR: u8;
  TWSR: u8;
  TWDR: u8;
  TWAR: u8;
  TWAMR: u8;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
// Register bits:
const TWCR_TWINT = 0x80; // TWI Interrupt Flag
const TWCR_TWEA = 0x40; // TWI Enable Acknowledge Bit
const TWCR_TWSTA = 0x20; // TWI START Condition Bit
const TWCR_TWSTO = 0x10; // TWI STOP Condition Bit
const TWCR_TWWC = 0x8; //TWI Write Collision Flag
const TWCR_TWEN = 0x4; //  TWI Enable Bit
const TWCR_TWIE = 0x1; // TWI Interrupt Enable
const TWSR_TWS_MASK = 0xf8; // TWI Status
const TWSR_TWPS1 = 0x2; // TWI Prescaler Bits
const TWSR_TWPS0 = 0x1; // TWI Prescaler Bits
const TWSR_TWPS_MASK = TWSR_TWPS1 | TWSR_TWPS0; // TWI Prescaler mask
const TWAR_TWA_MASK = 0xfe; //  TWI (Slave) Address Register
const TWAR_TWGCE = 0x1; // TWI General Call Recognition Enable Bit

const STATUS_BUS_ERROR = 0x0;
const STATUS_TWI_IDLE = 0xf8;
// Master states
const STATUS_START = 0x08;
const STATUS_REPEATED_START = 0x10;
const STATUS_SLAW_ACK = 0x18;
const STATUS_SLAW_NACK = 0x20;
const STATUS_DATA_SENT_ACK = 0x28;
const STATUS_DATA_SENT_NACK = 0x30;
const STATUS_DATA_LOST_ARBITRATION = 0x38;
const STATUS_SLAR_ACK = 0x40;
const STATUS_SLAR_NACK = 0x48;
const STATUS_DATA_RECEIVED_ACK = 0x50;
const STATUS_DATA_RECEIVED_NACK = 0x58;
// TODO: add slave states
/* eslint-enable @typescript-eslint/no-unused-vars */

export const twiConfig: TWIConfig = {
  twiInterrupt: 0x30,
  TWBR: 0xb8,
  TWSR: 0xb9,
  TWAR: 0xba,
  TWDR: 0xbb,
  TWCR: 0xbc,
  TWAMR: 0xbd,
};

// A simple TWI Event Handler that sends a NACK for all events
export class NoopTWIEventHandler implements TWIEventHandler {
  constructor(protected twi: AVRTWI) {}

  start() {
    this.twi.completeStart();
  }

  stop() {
    this.twi.completeStop();
  }

  connectToSlave() {
    this.twi.completeConnect(false);
  }

  writeByte() {
    this.twi.completeWrite(false);
  }

  readByte() {
    this.twi.completeRead(0xff);
  }
}

export class AVRTWI {
  public eventHandler: TWIEventHandler = new NoopTWIEventHandler(this);

  private nextTick: (() => void) | null = null;

  constructor(private cpu: CPU, private config: TWIConfig, private freqMHz: number) {
    this.updateStatus(STATUS_TWI_IDLE);
    this.cpu.writeHooks[config.TWCR] = (value) => {
      const clearInt = value & TWCR_TWINT;
      if (clearInt) {
        value &= ~TWCR_TWINT;
      }
      const { status } = this;
      if (clearInt && value & TWCR_TWEN) {
        const twdrValue = this.cpu.data[this.config.TWDR];
        this.nextTick = () => {
          if (value & TWCR_TWSTA) {
            this.eventHandler.start(status !== STATUS_TWI_IDLE);
          } else if (value & TWCR_TWSTO) {
            this.eventHandler.stop();
          } else if (status === STATUS_START) {
            this.eventHandler.connectToSlave(twdrValue >> 1, twdrValue & 0x1 ? false : true);
          } else if (status === STATUS_SLAW_ACK || status === STATUS_DATA_SENT_ACK) {
            this.eventHandler.writeByte(twdrValue);
          } else if (status === STATUS_SLAR_ACK || status === STATUS_DATA_RECEIVED_ACK) {
            const ack = !!(value & TWCR_TWEA);
            this.eventHandler.readByte(ack);
          }
        };
        this.cpu.data[config.TWCR] = value;
        return true;
      }
    };
  }

  tick() {
    if (this.nextTick) {
      this.nextTick();
      this.nextTick = null;
    }
    if (this.cpu.interruptsEnabled) {
      const { TWCR, twiInterrupt } = this.config;
      if (this.cpu.data[TWCR] & TWCR_TWIE && this.cpu.data[TWCR] & TWCR_TWINT) {
        avrInterrupt(this.cpu, twiInterrupt);
        this.cpu.data[TWCR] &= ~TWCR_TWINT;
      }
    }
  }

  get prescaler() {
    switch (this.cpu.data[this.config.TWSR] & TWSR_TWPS_MASK) {
      case 0:
        return 1;
      case 1:
        return 4;
      case 2:
        return 16;
      case 3:
        return 64;
    }
    // We should never get here:
    throw new Error('Invalid prescaler value!');
  }

  get sclFrequency() {
    return this.freqMHz / (16 + 2 * this.cpu.data[this.config.TWBR] * this.prescaler);
  }

  completeStart() {
    this.updateStatus(this.status === STATUS_TWI_IDLE ? STATUS_START : STATUS_REPEATED_START);
  }

  completeStop() {
    this.cpu.data[this.config.TWCR] &= ~TWCR_TWSTO;
    this.updateStatus(STATUS_TWI_IDLE);
  }

  completeConnect(ack: boolean) {
    if (this.cpu.data[this.config.TWDR] & 0x1) {
      this.updateStatus(ack ? STATUS_SLAR_ACK : STATUS_SLAR_NACK);
    } else {
      this.updateStatus(ack ? STATUS_SLAW_ACK : STATUS_SLAW_NACK);
    }
  }

  completeWrite(ack: boolean) {
    this.updateStatus(ack ? STATUS_DATA_SENT_ACK : STATUS_DATA_SENT_NACK);
  }

  completeRead(value: u8) {
    const ack = !!(this.cpu.data[this.config.TWCR] & TWCR_TWEA);
    this.cpu.data[this.config.TWDR] = value;
    this.updateStatus(ack ? STATUS_DATA_RECEIVED_ACK : STATUS_DATA_RECEIVED_NACK);
  }

  private get status() {
    return this.cpu.data[this.config.TWSR] & TWSR_TWS_MASK;
  }

  private updateStatus(value: u8) {
    const { TWCR, TWSR } = this.config;
    this.cpu.data[TWSR] = (this.cpu.data[TWSR] & ~TWSR_TWS_MASK) | value;
    this.cpu.data[TWCR] |= TWCR_TWINT;
  }
}
