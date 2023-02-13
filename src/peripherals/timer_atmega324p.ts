import { AVRTimerConfig } from './timer';
import {
  timer0Config as timer0Config328p,
  timer0Config as timer1Config328p,
  timer0Config as timer2Config328p,
} from './timer_atmega328p';

export const timer0Config: AVRTimerConfig = {
  ...timer0Config328p,
  captureInterrupt: 0, // Not applicable
  compAInterrupt: 0x20,
  compBInterrupt: 0x22,
  compCInterrupt: 0, // Not applicable
  ovfInterrupt: 0x24,
};

export const timer1Config: AVRTimerConfig = {
  ...timer1Config328p,
  captureInterrupt: 0x18,
  compAInterrupt: 0x1a,
  compBInterrupt: 0x1c,
  compCInterrupt: 0, // Not applicable
  ovfInterrupt: 0x1e,
};

export const timer2Config: AVRTimerConfig = {
  ...timer2Config328p,
  captureInterrupt: 0, // Not applicable
  compAInterrupt: 0x12,
  compBInterrupt: 0x14,
  compCInterrupt: 0, // Not applicable
  ovfInterrupt: 0x16,
};
