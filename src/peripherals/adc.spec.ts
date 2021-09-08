import { CPU } from '../cpu/cpu';
import { asmProgram, TestProgramRunner } from '../utils/test-utils';
import { AVRADC, adcConfig, ADCMuxInputType } from './adc';

const R16 = 16;
const R17 = 17;

const ADMUX = 0x7c;
const REFS0 = 1 << 6;

const ADCSRA = 0x7a;
const ADEN = 1 << 7;
const ADSC = 1 << 6;
const ADPS0 = 1 << 0;
const ADPS1 = 1 << 1;
const ADPS2 = 1 << 2;

const ADCH = 0x79;
const ADCL = 0x78;

describe('ADC', () => {
  it('should successfuly perform an ADC conversion', () => {
    const { program } = asmProgram(`
    ; register addresses
    _REPLACE ADMUX, ${ADMUX}
    _REPLACE ADCSRA, ${ADCSRA}
    _REPLACE ADCH, ${ADCH}
    _REPLACE ADCL, ${ADCL}

    ; Configure mux - channel 0, reference: AVCC with external capacitor at AREF pin
    ldi r24, ${REFS0}
    sts ADMUX, r24

    ; Start conversion with 128 prescaler
    ldi r24, ${ADEN | ADSC | ADPS0 | ADPS1 | ADPS2}
    sts ADCSRA, r24

    ; Wait until conversion is complete
  waitComplete:
    lds r24, ${ADCSRA}
    andi r24, ${ADSC}
    brne waitComplete

    ; Read the result
    lds r16, ${ADCL}
    lds r17, ${ADCH}

    break
  `);
    const cpu = new CPU(program);
    const adc = new AVRADC(cpu, adcConfig);
    const runner = new TestProgramRunner(cpu);

    const adcReadSpy = jest.spyOn(adc, 'onADCRead');
    adc.channelValues[0] = 2.56; // should result in 2.56/5*1024 = 524

    // Setup
    runner.runInstructions(4);
    expect(adcReadSpy).toHaveBeenCalledWith({ channel: 0, type: ADCMuxInputType.SingleEnded });

    // Run the "waitComplete" loop for a few cycles
    runner.runInstructions(12);

    cpu.cycles += 128 * 25; // skip to the end of the conversion
    cpu.tick();

    // Now read the result
    runner.runInstructions(5);

    const low = cpu.data[R16];
    const high = cpu.data[R17];
    expect((high << 8) | low).toEqual(524); // 2.56 volts - see above
  });
});
