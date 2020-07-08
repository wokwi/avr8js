# AVR8js

JavaScript implementation of the AVR 8-bit architecture

[![Build Status](https://travis-ci.org/wokwi/avr8js.png?branch=master)](https://travis-ci.org/wokwi/avr8js)
[![NPM Version](https://img.shields.io/npm/v/avr8js)](https://www.npmjs.com/package/avr8js)
[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/wokwi/avr8js)

## Running the demo project

The demo project allows you to edit Arduino code, compile it, and run it in the simulator.
It also simulates 2 LEDs connected to pins 12 and 13 (PB4 and PB5). 

To run the demo project, check out this repository, run `npm install` and then `npm start`.

### Walkthrough Video Tutorial

A step-by-step video tutorial showing how to build a simple Arduino simulator using AVR8js and React:

[![AVR8JS Walkthrough Video](https://i.imgur.com/3meSd1m.png)](https://youtu.be/fArqj-USmjA)

### Unofficial Examples

* [Minimal Example](https://stackblitz.com/edit/avr8js-minimal?file=main.ts)
* [6 LEDs](https://stackblitz.com/edit/avr8js-6leds?file=index.ts)
* [LED PWM](https://stackblitz.com/edit/avr8js-pwm?file=index.ts)
* [Serial Monitor](https://stackblitz.com/edit/avr8js-serial?file=index.ts)
* [NeoPixel Matrix](https://stackblitz.com/edit/avr8js-ws2812?file=index.ts)
* [Arduino Mega NeoPixel Matrix](https://stackblitz.com/edit/avr8js-mega-ws2812?file=index.ts)
* [Simon Game](https://stackblitz.com/edit/avr8js-simon-game?file=index.ts) - with pushbuttons and sound
* [XMAS LEDs](https://stackblitz.com/edit/avr8js-xmas-dafna?file=index.ts)
* [Assembly Code](https://stackblitz.com/edit/avr8js-asm?file=index.ts)

## Running the tests

Run the tests once:

```
npm test
```

Run the tests of the files you modified since last commit (watch mode):

```
npm run test:watch
```

For more information, please check the [Contributing Guide](CONTRIBUTING.md).

## License

Copyright (C) 2019, 2020 Uri Shaked. The code is released under the terms of the MIT license.