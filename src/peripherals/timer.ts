/**
 * AVR-8 Timers
 * Part of AVR8js
 * Reference: http://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf
 *
 * Copyright (C) 2019, 2020, 2021 Uri Shaked
 */

import { AVRInterruptConfig, CPU } from '../cpu/cpu';
import { AVRIOPort, PinOverrideMode } from './gpio';

enum ExternalClockMode {
  FallingEdge = 6,
  RisingEdge = 7,
}

type u8 = number;
type u16 = number;

export interface TimerDividers {
  0: number;
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  6: number;
  7: number;
}

export interface AVRTimerConfig {
  bits: 8 | 16;
  dividers: TimerDividers;

  // Interrupt vectors
  captureInterrupt: u8;
  compAInterrupt: u8;
  compBInterrupt: u8; // Optional, 0 = unused
  compCInterrupt: u8; // Optional, 0 = unused
  ovfInterrupt: u8;

  // Register addresses
  TIFR: u8;
  OCRA: u8;
  OCRB: u8; // Optional, 0 = unused
  OCRC: u8; // Optional, 0 = unused
  ICR: u8;
  TCNT: u8;
  TCCRA: u8;
  TCCRB: u8; // Optional, 0 = unused
  TCCRC: u8; // Optional, 0 = unused
  TIMSK: u8;

  // TIFR bits
  TOV: u8;
  OCFA: u8;
  OCFB: u8; // Optional, if compBInterrupt != 0
  OCFC: u8; // Optional, if compCInterrupt != 0

  // TIMSK bits
  TOIE: u8;
  OCIEA: u8;
  OCIEB: u8; // Optional, if compBInterrupt != 0
  OCIEC: u8; // Optional, if compCInterrupt != 0

  // Output compare pins
  compPortA: u16;
  compPinA: u8;
  compPortB: u16; // Optional, 0 = unused
  compPinB: u8;
  compPortC: u16; // Optional, 0 = unused
  compPinC: u16;

  // External clock pin (optional, 0 = unused)
  externalClockPort: u16;
  externalClockPin: u8;
}

/* All the following types and constants are related to WGM (Waveform Generation Mode) bits: */
enum TimerMode {
  Normal,
  PWMPhaseCorrect,
  CTC,
  FastPWM,
  PWMPhaseFrequencyCorrect,
  Reserved,
}

enum TOVUpdateMode {
  Max,
  Top,
  Bottom,
}

enum OCRUpdateMode {
  Immediate,
  Top,
  Bottom,
}

const TopOCRA = 1;
const TopICR = 2;
type TimerTopValue = 0xff | 0x1ff | 0x3ff | 0xffff | typeof TopOCRA | typeof TopICR;

type WGMConfig = [TimerMode, TimerTopValue, OCRUpdateMode, TOVUpdateMode, number];

// Enable Toggle mode for OCxA in PWM Wave Generation mode
const OCToggle = 1;

const { Normal, PWMPhaseCorrect, CTC, FastPWM, Reserved, PWMPhaseFrequencyCorrect } = TimerMode;

const wgmModes8Bit: WGMConfig[] = [
  /*0*/ [Normal, 0xff, OCRUpdateMode.Immediate, TOVUpdateMode.Max, 0],
  /*1*/ [PWMPhaseCorrect, 0xff, OCRUpdateMode.Top, TOVUpdateMode.Bottom, 0],
  /*2*/ [CTC, TopOCRA, OCRUpdateMode.Immediate, TOVUpdateMode.Max, 0],
  /*3*/ [FastPWM, 0xff, OCRUpdateMode.Bottom, TOVUpdateMode.Max, 0],
  /*4*/ [Reserved, 0xff, OCRUpdateMode.Immediate, TOVUpdateMode.Max, 0],
  /*5*/ [PWMPhaseCorrect, TopOCRA, OCRUpdateMode.Top, TOVUpdateMode.Bottom, OCToggle],
  /*6*/ [Reserved, 0xff, OCRUpdateMode.Immediate, TOVUpdateMode.Max, 0],
  /*7*/ [FastPWM, TopOCRA, OCRUpdateMode.Bottom, TOVUpdateMode.Top, OCToggle],
];

// Table 16-4 in the datasheet
const wgmModes16Bit: WGMConfig[] = [
  /*0 */ [Normal, 0xffff, OCRUpdateMode.Immediate, TOVUpdateMode.Max, 0],
  /*1 */ [PWMPhaseCorrect, 0x00ff, OCRUpdateMode.Top, TOVUpdateMode.Bottom, 0],
  /*2 */ [PWMPhaseCorrect, 0x01ff, OCRUpdateMode.Top, TOVUpdateMode.Bottom, 0],
  /*3 */ [PWMPhaseCorrect, 0x03ff, OCRUpdateMode.Top, TOVUpdateMode.Bottom, 0],
  /*4 */ [CTC, TopOCRA, OCRUpdateMode.Immediate, TOVUpdateMode.Max, 0],
  /*5 */ [FastPWM, 0x00ff, OCRUpdateMode.Bottom, TOVUpdateMode.Top, 0],
  /*6 */ [FastPWM, 0x01ff, OCRUpdateMode.Bottom, TOVUpdateMode.Top, 0],
  /*7 */ [FastPWM, 0x03ff, OCRUpdateMode.Bottom, TOVUpdateMode.Top, 0],
  /*8 */ [PWMPhaseFrequencyCorrect, TopICR, OCRUpdateMode.Bottom, TOVUpdateMode.Bottom, 0],
  /*9 */ [PWMPhaseFrequencyCorrect, TopOCRA, OCRUpdateMode.Bottom, TOVUpdateMode.Bottom, OCToggle],
  /*10*/ [PWMPhaseCorrect, TopICR, OCRUpdateMode.Top, TOVUpdateMode.Bottom, 0],
  /*11*/ [PWMPhaseCorrect, TopOCRA, OCRUpdateMode.Top, TOVUpdateMode.Bottom, OCToggle],
  /*12*/ [CTC, TopICR, OCRUpdateMode.Immediate, TOVUpdateMode.Max, 0],
  /*13*/ [Reserved, 0xffff, OCRUpdateMode.Immediate, TOVUpdateMode.Max, 0],
  /*14*/ [FastPWM, TopICR, OCRUpdateMode.Bottom, TOVUpdateMode.Top, OCToggle],
  /*15*/ [FastPWM, TopOCRA, OCRUpdateMode.Bottom, TOVUpdateMode.Top, OCToggle],
];

type CompBitsValue = 0 | 1 | 2 | 3;

function compToOverride(comp: CompBitsValue) {
  switch (comp) {
    case 1:
      return PinOverrideMode.Toggle;
    case 2:
      return PinOverrideMode.Clear;
    case 3:
      return PinOverrideMode.Set;
    default:
      return PinOverrideMode.Enable;
  }
}

// Force Output Compare (FOC) bits
const FOCA = 1 << 7;
const FOCB = 1 << 6;
const FOCC = 1 << 5;

export class AVRTimer {
  private readonly MAX = this.config.bits === 16 ? 0xffff : 0xff;
  private lastCycle = 0;
  private ocrA: u16 = 0;
  private nextOcrA: u16 = 0;
  private ocrB: u16 = 0;
  private nextOcrB: u16 = 0;
  private hasOCRB = this.config.OCRB > 0;
  private hasOCRC = this.config.OCRC > 0;
  private ocrC: u16 = 0;
  private nextOcrC: u16 = 0;
  private ocrUpdateMode = OCRUpdateMode.Immediate;
  private tovUpdateMode = TOVUpdateMode.Max;
  private icr: u16 = 0; // only for 16-bit timers
  private timerMode: TimerMode;
  private topValue: TimerTopValue;
  private tcnt: u16 = 0;
  private tcntNext: u16 = 0;
  private compA: CompBitsValue;
  private compB: CompBitsValue;
  private compC: CompBitsValue;
  private tcntUpdated = false;
  private updateDivider = false;
  private countingUp = true;
  private divider = 0;
  private externalClockPort?: AVRIOPort;
  private externalClockRisingEdge = false;

  // This is the temporary register used to access 16-bit registers (section 16.3 of the datasheet)
  private highByteTemp: u8 = 0;

  // Interrupts
  private OVF: AVRInterruptConfig = {
    address: this.config.ovfInterrupt,
    flagRegister: this.config.TIFR,
    flagMask: this.config.TOV,
    enableRegister: this.config.TIMSK,
    enableMask: this.config.TOIE,
  };
  private OCFA: AVRInterruptConfig = {
    address: this.config.compAInterrupt,
    flagRegister: this.config.TIFR,
    flagMask: this.config.OCFA,
    enableRegister: this.config.TIMSK,
    enableMask: this.config.OCIEA,
  };
  private OCFB: AVRInterruptConfig = {
    address: this.config.compBInterrupt,
    flagRegister: this.config.TIFR,
    flagMask: this.config.OCFB,
    enableRegister: this.config.TIMSK,
    enableMask: this.config.OCIEB,
  };
  private OCFC: AVRInterruptConfig = {
    address: this.config.compCInterrupt,
    flagRegister: this.config.TIFR,
    flagMask: this.config.OCFC,
    enableRegister: this.config.TIMSK,
    enableMask: this.config.OCIEC,
  };

  constructor(private cpu: CPU, private config: AVRTimerConfig) {
    this.updateWGMConfig();
    this.cpu.readHooks[config.TCNT] = (addr: u8) => {
      this.count(false);
      if (this.config.bits === 16) {
        this.cpu.data[addr + 1] = this.tcnt >> 8;
      }
      return (this.cpu.data[addr] = this.tcnt & 0xff);
    };

    this.cpu.writeHooks[config.TCNT] = (value: u8) => {
      this.tcntNext = (this.highByteTemp << 8) | value;
      this.countingUp = true;
      this.tcntUpdated = true;
      this.cpu.updateClockEvent(this.count, 0);
      if (this.divider) {
        this.timerUpdated(this.tcntNext, this.tcntNext);
      }
    };
    this.cpu.writeHooks[config.OCRA] = (value: u8) => {
      this.nextOcrA = (this.highByteTemp << 8) | value;
      if (this.ocrUpdateMode === OCRUpdateMode.Immediate) {
        this.ocrA = this.nextOcrA;
      }
    };
    if (this.hasOCRB) {
      this.cpu.writeHooks[config.OCRB] = (value: u8) => {
        this.nextOcrB = (this.highByteTemp << 8) | value;
        if (this.ocrUpdateMode === OCRUpdateMode.Immediate) {
          this.ocrB = this.nextOcrB;
        }
      };
    }
    if (this.hasOCRC) {
      this.cpu.writeHooks[config.OCRC] = (value: u8) => {
        this.nextOcrC = (this.highByteTemp << 8) | value;
        if (this.ocrUpdateMode === OCRUpdateMode.Immediate) {
          this.ocrC = this.nextOcrC;
        }
      };
    }
    if (this.config.bits === 16) {
      this.cpu.writeHooks[config.ICR] = (value: u8) => {
        this.icr = (this.highByteTemp << 8) | value;
      };
      const updateTempRegister = (value: u8) => {
        this.highByteTemp = value;
      };
      const updateOCRHighRegister = (value: u8, old: u8, addr: u16) => {
        this.highByteTemp = value & (this.ocrMask >> 8);
        cpu.data[addr] = this.highByteTemp;
        return true;
      };
      this.cpu.writeHooks[config.TCNT + 1] = updateTempRegister;
      this.cpu.writeHooks[config.OCRA + 1] = updateOCRHighRegister;
      this.cpu.writeHooks[config.OCRB + 1] = updateOCRHighRegister;
      if (this.hasOCRC) {
        this.cpu.writeHooks[config.OCRC + 1] = updateOCRHighRegister;
      }
      this.cpu.writeHooks[config.ICR + 1] = updateTempRegister;
    }
    cpu.writeHooks[config.TCCRA] = (value) => {
      this.cpu.data[config.TCCRA] = value;
      this.updateWGMConfig();
      return true;
    };
    if (config.TCCRB) {
      cpu.writeHooks[config.TCCRB] = (value) => {
        if (!config.TCCRC) {
          this.checkForceCompare(value);
          value &= ~(FOCA | FOCB);
        }
        this.cpu.data[config.TCCRB] = value;
        this.updateDivider = true;
        this.cpu.clearClockEvent(this.count);
        this.cpu.addClockEvent(this.count, 0);
        this.updateWGMConfig();
        return true;
      };
    }
    if (config.TCCRC) {
      cpu.writeHooks[config.TCCRC] = (value) => {
        this.checkForceCompare(value);
      };
    }
    cpu.writeHooks[config.TIFR] = (value) => {
      this.cpu.data[config.TIFR] = value;
      this.cpu.clearInterruptByFlag(this.OVF, value);
      this.cpu.clearInterruptByFlag(this.OCFA, value);
      this.cpu.clearInterruptByFlag(this.OCFB, value);
      return true;
    };
    cpu.writeHooks[config.TIMSK] = (value) => {
      this.cpu.updateInterruptEnable(this.OVF, value);
      this.cpu.updateInterruptEnable(this.OCFA, value);
      this.cpu.updateInterruptEnable(this.OCFB, value);
    };
  }

  reset() {
    this.divider = 0;
    this.lastCycle = 0;
    this.ocrA = 0;
    this.nextOcrA = 0;
    this.ocrB = 0;
    this.nextOcrB = 0;
    this.ocrC = 0;
    this.nextOcrC = 0;
    this.icr = 0;
    this.tcnt = 0;
    this.tcntNext = 0;
    this.tcntUpdated = false;
    this.countingUp = false;
    this.updateDivider = true;
  }

  get TCCRA() {
    return this.cpu.data[this.config.TCCRA];
  }

  get TCCRB() {
    return this.cpu.data[this.config.TCCRB];
  }

  get TIMSK() {
    return this.cpu.data[this.config.TIMSK];
  }

  get CS() {
    return (this.TCCRB & 0x7) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  }

  get WGM() {
    const mask = this.config.bits === 16 ? 0x18 : 0x8;
    return ((this.TCCRB & mask) >> 1) | (this.TCCRA & 0x3);
  }

  get TOP() {
    switch (this.topValue) {
      case TopOCRA:
        return this.ocrA;
      case TopICR:
        return this.icr;
      default:
        return this.topValue;
    }
  }

  get ocrMask() {
    switch (this.topValue) {
      case TopOCRA:
      case TopICR:
        return 0xffff;
      default:
        return this.topValue;
    }
  }

  /** Expose the raw value of TCNT, for use by the unit tests */
  get debugTCNT() {
    return this.tcnt;
  }

  private updateWGMConfig() {
    const { config, WGM } = this;
    const wgmModes = config.bits === 16 ? wgmModes16Bit : wgmModes8Bit;
    const TCCRA = this.cpu.data[config.TCCRA];
    const [timerMode, topValue, ocrUpdateMode, tovUpdateMode, flags] = wgmModes[WGM];
    this.timerMode = timerMode;
    this.topValue = topValue;
    this.ocrUpdateMode = ocrUpdateMode;
    this.tovUpdateMode = tovUpdateMode;

    const pwmMode =
      timerMode === FastPWM ||
      timerMode === PWMPhaseCorrect ||
      timerMode === PWMPhaseFrequencyCorrect;

    const prevCompA = this.compA;
    this.compA = ((TCCRA >> 6) & 0x3) as CompBitsValue;
    if (this.compA === 1 && pwmMode && !(flags & OCToggle)) {
      this.compA = 0;
    }
    if (!!prevCompA !== !!this.compA) {
      this.updateCompA(this.compA ? PinOverrideMode.Enable : PinOverrideMode.None);
    }

    if (this.hasOCRB) {
      const prevCompB = this.compB;
      this.compB = ((TCCRA >> 4) & 0x3) as CompBitsValue;
      if (this.compB === 1 && pwmMode) {
        this.compB = 0; // Reserved, according to the datasheet
      }
      if (!!prevCompB !== !!this.compB) {
        this.updateCompB(this.compB ? PinOverrideMode.Enable : PinOverrideMode.None);
      }
    }

    if (this.hasOCRC) {
      const prevCompC = this.compC;
      this.compC = ((TCCRA >> 2) & 0x3) as CompBitsValue;
      if (this.compC === 1 && pwmMode) {
        this.compC = 0; // Reserved, according to the datasheet
      }
      if (!!prevCompC !== !!this.compC) {
        this.updateCompC(this.compC ? PinOverrideMode.Enable : PinOverrideMode.None);
      }
    }
  }

  count = (reschedule = true, external = false) => {
    const { divider, lastCycle, cpu } = this;
    const { cycles } = cpu;
    const delta = cycles - lastCycle;
    if ((divider && delta >= divider) || external) {
      const counterDelta = external ? 1 : Math.floor(delta / divider);
      this.lastCycle += counterDelta * divider;
      const val = this.tcnt;
      const { timerMode, TOP } = this;
      const phasePwm = timerMode === PWMPhaseCorrect || timerMode === PWMPhaseFrequencyCorrect;
      const newVal = phasePwm
        ? this.phasePwmCount(val, counterDelta)
        : (val + counterDelta) % (TOP + 1);
      const overflow = val + counterDelta > TOP;
      // A CPU write overrides (has priority over) all counter clear or count operations.
      if (!this.tcntUpdated) {
        this.tcnt = newVal;
        if (!phasePwm) {
          this.timerUpdated(newVal, val);
        }
      }

      if (!phasePwm) {
        if (timerMode === FastPWM && overflow) {
          const { compA, compB } = this;
          if (compA) {
            this.updateCompPin(compA, 'A', true);
          }
          if (compB) {
            this.updateCompPin(compB, 'B', true);
          }
        }

        if (this.ocrUpdateMode == OCRUpdateMode.Bottom && overflow) {
          // OCRUpdateMode.Top only occurs in Phase Correct modes, handled by phasePwmCount()
          this.ocrA = this.nextOcrA;
          this.ocrB = this.nextOcrB;
          this.ocrC = this.nextOcrC;
        }

        // OCRUpdateMode.Bottom only occurs in Phase Correct modes, handled by phasePwmCount().
        // Thus we only handle TOVUpdateMode.Top or TOVUpdateMode.Max here.
        if (overflow && (this.tovUpdateMode == TOVUpdateMode.Top || TOP === this.MAX)) {
          cpu.setInterruptFlag(this.OVF);
        }
      }
    }
    if (this.tcntUpdated) {
      this.tcnt = this.tcntNext;
      this.tcntUpdated = false;
      if (
        (this.tcnt === 0 && this.ocrUpdateMode === OCRUpdateMode.Bottom) ||
        (this.tcnt === this.TOP && this.ocrUpdateMode === OCRUpdateMode.Top)
      ) {
        this.ocrA = this.nextOcrA;
        this.ocrB = this.nextOcrB;
        this.ocrC = this.nextOcrC;
      }
    }
    if (this.updateDivider) {
      const { CS } = this;
      const { externalClockPin } = this.config;
      const newDivider = this.config.dividers[CS];
      this.lastCycle = newDivider ? this.cpu.cycles : 0;
      this.updateDivider = false;
      this.divider = newDivider;
      if (this.config.externalClockPort && !this.externalClockPort) {
        this.externalClockPort = this.cpu.gpioByPort[this.config.externalClockPort];
      }
      if (this.externalClockPort) {
        this.externalClockPort.externalClockListeners[externalClockPin] = null;
      }
      if (newDivider) {
        cpu.addClockEvent(this.count, this.lastCycle + newDivider - cpu.cycles);
      } else if (
        this.externalClockPort &&
        (CS === ExternalClockMode.FallingEdge || CS === ExternalClockMode.RisingEdge)
      ) {
        this.externalClockPort.externalClockListeners[externalClockPin] =
          this.externalClockCallback;
        this.externalClockRisingEdge = CS === ExternalClockMode.RisingEdge;
      }
      return;
    }
    if (reschedule && divider) {
      cpu.addClockEvent(this.count, this.lastCycle + divider - cpu.cycles);
    }
  };

  private externalClockCallback = (value: boolean) => {
    if (value === this.externalClockRisingEdge) {
      this.count(false, true);
    }
  };

  private phasePwmCount(value: u16, delta: u8) {
    const { ocrA, ocrB, ocrC, hasOCRC, TOP, MAX, tcntUpdated } = this;
    if (!value && !TOP) {
      delta = 0;
      if (this.ocrUpdateMode === OCRUpdateMode.Top) {
        this.ocrA = this.nextOcrA;
        this.ocrB = this.nextOcrB;
        this.ocrC = this.nextOcrC;
      }
    }
    while (delta > 0) {
      if (this.countingUp) {
        value++;
        if (value === TOP && !tcntUpdated) {
          this.countingUp = false;
          if (this.ocrUpdateMode === OCRUpdateMode.Top) {
            this.ocrA = this.nextOcrA;
            this.ocrB = this.nextOcrB;
            this.ocrC = this.nextOcrC;
          }
        }
      } else {
        value--;
        if (!value && !tcntUpdated) {
          this.countingUp = true;
          this.cpu.setInterruptFlag(this.OVF);
          if (this.ocrUpdateMode === OCRUpdateMode.Bottom) {
            this.ocrA = this.nextOcrA;
            this.ocrB = this.nextOcrB;
            this.ocrC = this.nextOcrC;
          }
        }
      }
      if (!tcntUpdated) {
        if (value === ocrA) {
          this.cpu.setInterruptFlag(this.OCFA);
          if (this.compA) {
            this.updateCompPin(this.compA, 'A');
          }
        }
        if (value === ocrB) {
          this.cpu.setInterruptFlag(this.OCFB);
          if (this.compB) {
            this.updateCompPin(this.compB, 'B');
          }
        }
        if (hasOCRC && value === ocrC) {
          this.cpu.setInterruptFlag(this.OCFC);
          if (this.compC) {
            this.updateCompPin(this.compC, 'C');
          }
        }
      }
      delta--;
    }
    return value & MAX;
  }

  private timerUpdated(value: number, prevValue: number) {
    const { ocrA, ocrB, ocrC, hasOCRB, hasOCRC } = this;
    const overflow = prevValue > value;
    if (((prevValue < ocrA || overflow) && value >= ocrA) || (prevValue < ocrA && overflow)) {
      this.cpu.setInterruptFlag(this.OCFA);
      if (this.compA) {
        this.updateCompPin(this.compA, 'A');
      }
    }
    if (
      hasOCRB &&
      (((prevValue < ocrB || overflow) && value >= ocrB) || (prevValue < ocrB && overflow))
    ) {
      this.cpu.setInterruptFlag(this.OCFB);
      if (this.compB) {
        this.updateCompPin(this.compB, 'B');
      }
    }
    if (
      hasOCRC &&
      (((prevValue < ocrC || overflow) && value >= ocrC) || (prevValue < ocrC && overflow))
    ) {
      this.cpu.setInterruptFlag(this.OCFC);
      if (this.compC) {
        this.updateCompPin(this.compC, 'C');
      }
    }
  }

  private checkForceCompare(value: number) {
    if (
      this.timerMode == TimerMode.FastPWM ||
      this.timerMode == TimerMode.PWMPhaseCorrect ||
      this.timerMode == TimerMode.PWMPhaseFrequencyCorrect
    ) {
      // The FOCnA/FOCnB/FOCnC bits are only active when the WGMn3:0 bits specifies a non-PWM mode
      return;
    }
    if (value & FOCA) {
      this.updateCompPin(this.compA, 'A');
    }
    if (value & FOCB) {
      this.updateCompPin(this.compB, 'B');
    }
    if (this.config.compPortC && value & FOCC) {
      this.updateCompPin(this.compC, 'C');
    }
  }

  private updateCompPin(compValue: CompBitsValue, pinName: 'A' | 'B' | 'C', bottom = false) {
    let newValue: PinOverrideMode = PinOverrideMode.None;
    const invertingMode = compValue === 3;
    const isSet = this.countingUp === invertingMode;
    switch (this.timerMode) {
      case Normal:
      case CTC:
        newValue = compToOverride(compValue);
        break;

      case FastPWM:
        if (compValue === 1) {
          newValue = bottom ? PinOverrideMode.None : PinOverrideMode.Toggle;
        } else {
          newValue = invertingMode !== bottom ? PinOverrideMode.Set : PinOverrideMode.Clear;
        }
        break;

      case PWMPhaseCorrect:
      case PWMPhaseFrequencyCorrect:
        if (compValue === 1) {
          newValue = PinOverrideMode.Toggle;
        } else {
          newValue = isSet ? PinOverrideMode.Set : PinOverrideMode.Clear;
        }
        break;
    }

    if (newValue !== PinOverrideMode.None) {
      if (pinName === 'A') {
        this.updateCompA(newValue);
      } else if (pinName === 'B') {
        this.updateCompB(newValue);
      } else {
        this.updateCompC(newValue);
      }
    }
  }

  private updateCompA(value: PinOverrideMode) {
    const { compPortA, compPinA } = this.config;
    const port = this.cpu.gpioByPort[compPortA];
    port?.timerOverridePin(compPinA, value);
  }

  private updateCompB(value: PinOverrideMode) {
    const { compPortB, compPinB } = this.config;
    const port = this.cpu.gpioByPort[compPortB];
    port?.timerOverridePin(compPinB, value);
  }

  private updateCompC(value: PinOverrideMode) {
    const { compPortC, compPinC } = this.config;
    const port = this.cpu.gpioByPort[compPortC];
    port?.timerOverridePin(compPinC, value);
  }
}
