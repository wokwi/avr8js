import '@wokwi/elements';
import { LEDElement } from '@wokwi/elements';
import { ATmega328p, avrInstruction, createAVR, PinState } from 'avr8js';
import { buildHex } from './compile';
import { CPUPerformance } from './cpu-performance';
import { formatTime } from './format-time';
import './index.css';
import { loadHex } from './intelhex';
import { MicroTaskScheduler } from './task-scheduler';
import { EditorHistoryUtil } from './utils/editor-history.util';

let editor: any; // eslint-disable-line @typescript-eslint/no-explicit-any
const BLINK_CODE = `
// Green LED connected to LED_BUILTIN,
// Red LED connected to pin 12. Enjoy!

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  Serial.println("Blink");
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}`.trim();

// Load Editor
declare const window: any; // eslint-disable-line @typescript-eslint/no-explicit-any
declare const monaco: any; // eslint-disable-line @typescript-eslint/no-explicit-any
window.require.config({
  paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.21.2/min/vs' },
});
window.require(['vs/editor/editor.main'], () => {
  editor = monaco.editor.create(document.querySelector('.code-editor'), {
    value: EditorHistoryUtil.getValue() || BLINK_CODE,
    language: 'cpp',
    minimap: { enabled: false },
  });
});

// Set up LEDs
const led13 = document.querySelector<LEDElement>('wokwi-led[color=green]');
const led12 = document.querySelector<LEDElement>('wokwi-led[color=red]');

// Set up the task runner
const taskScheduler = new MicroTaskScheduler();

/* eslint-disable @typescript-eslint/no-use-before-define */
const runButton = document.querySelector('#run-button');
runButton.addEventListener('click', compileAndRun);
const stopButton = document.querySelector('#stop-button');
stopButton.addEventListener('click', stopCode);
const revertButton = document.querySelector('#revert-button');
revertButton.addEventListener('click', setBlinkSnippet);
const statusLabel = document.querySelector('#status-label');
const compilerOutputText = document.querySelector('#compiler-output-text');
const serialOutputText = document.querySelector('#serial-output-text');

function executeProgram(hex: string) {
  const { cpu, gpio, usart, clock } = createAVR(ATmega328p, {});
  loadHex(hex, cpu.progBytes);

  // Hook to PORTB register
  gpio.B.addListener(() => {
    led12.value = gpio.B.pinState(4) === PinState.High;
    led13.value = gpio.B.pinState(5) === PinState.High;
  });
  usart[0].onByteTransmit = (value) => {
    serialOutputText.textContent += String.fromCharCode(value);
  };

  const cpuPerf = new CPUPerformance(cpu, clock.frequency);
  const workUnitCycles = 500000;
  const runSimulation = () => {
    const cyclesToRun = cpu.cycles + workUnitCycles;
    while (cpu.cycles < cyclesToRun) {
      avrInstruction(cpu);
      cpu.tick();
    }

    const time = formatTime(clock.timeMillis / 1000);
    const speed = (cpuPerf.update() * 100).toFixed(0);
    statusLabel.textContent = `Simulation time: ${time} (${speed}%)`;

    taskScheduler.postTask(runSimulation);
  };

  taskScheduler.start();
  runSimulation();
}

async function compileAndRun() {
  led12.value = false;
  led13.value = false;

  storeUserSnippet();

  runButton.setAttribute('disabled', '1');
  revertButton.setAttribute('disabled', '1');

  serialOutputText.textContent = '';
  try {
    statusLabel.textContent = 'Compiling...';
    const result = await buildHex(editor.getModel().getValue());
    compilerOutputText.textContent = result.stderr || result.stdout;
    if (result.hex) {
      compilerOutputText.textContent += '\nProgram running...';
      stopButton.removeAttribute('disabled');
      executeProgram(result.hex);
    } else {
      runButton.removeAttribute('disabled');
    }
  } catch (err) {
    runButton.removeAttribute('disabled');
    revertButton.removeAttribute('disabled');
    alert('Failed: ' + err);
  } finally {
    statusLabel.textContent = '';
  }
}

function storeUserSnippet() {
  EditorHistoryUtil.clearSnippet();
  EditorHistoryUtil.storeSnippet(editor.getValue());
}

function stopCode() {
  stopButton.setAttribute('disabled', '1');
  runButton.removeAttribute('disabled');
  revertButton.removeAttribute('disabled');
  taskScheduler.stop();
}

function setBlinkSnippet() {
  editor.setValue(BLINK_CODE);
  EditorHistoryUtil.storeSnippet(editor.getValue());
}
