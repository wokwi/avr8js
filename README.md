# AVR8js

This is a JavaScript library that implementats the AVR 8-bit architecture.

It's the heart- but not the whole body- of the Arduino simulator at [https://wokwi.com](https://wokwi.com).

[![Build Status](https://travis-ci.org/wokwi/avr8js.png?branch=master)](https://travis-ci.org/wokwi/avr8js)
[![NPM Version](https://img.shields.io/npm/v/avr8js)](https://www.npmjs.com/package/avr8js)
![License: MIT](https://img.shields.io/npm/l/avr8js)
![Types: TypeScript](https://img.shields.io/npm/types/avr8js)
[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/wokwi/avr8js)

## Example Applications Using `AVR8js`

* [Wokwi Arduino Simulator](https://wokwi.com) - Arduino simulator with a choice of hardware that can be wired up dynamically in your browser!
* [Wokwi Playgrounds](https://github.com/wokwi/wokwi-playgrounds) - pre-configured Arduino circuits with notes and goals. A starting point for an online lesson system.
* [avr8js-electron playground](https://github.com/arcostasi/avr8js-electron-playground) - a Downloadable Electron Arduino simulator app
* [AVR8js-Falstad](https://markmegarry.github.io/AVR8js-Falstad/) - combining the Falstad circuit simulator with AVR8js!
* [The Engineering Physics Department of Dawson College's Arduino Course](https://tawjaw.github.io/Arduino-Robot-Virtual-Lab/) - an introduction to Arduino with a focus on robotics

## How to Use This Library

This library only implements the AVR CPU core. 
You have to supply it pre-compiled machine code to run, and implement functional simulations of any external hardware. You will probably also want to add  audio/visual representations of external hardware being simulated.

A rough conceptual diagram:

```
Pre-Compiled machine code --> AVR8js <--> Glue code <--> external hardware functional simulation <--> simulation state display for the user
```
You may be interested in exploring the [wokwi-elements](https://github.com/wokwi/wokwi-elements) collection of web-components for visual representations of many common hardware components. (Note: these are visual only elements- you will need to add the appropriate functional simulation and glue code.)

### Walkthrough Video Tutorial

A step-by-step video tutorial showing how to build a simple Arduino simulator using AVR8js and React:

[![AVR8JS Walkthrough Video](https://i.imgur.com/3meSd1m.png)](https://youtu.be/fArqj-USmjA)

And a related [blog post](https://blog.wokwi.com/avr8js-simulate-arduino-in-javascript/).

### Unofficial examples

These examples show working examples of using `avr8js` in an application. Many of them also demonstrate how to use the `wokwi-elements` and include working examples of functional simulations of the components, and how to hook them up to `avr8js`.

* [Minimal Example](https://stackblitz.com/edit/avr8js-minimal?file=main.ts)
* [6 LEDs](https://stackblitz.com/edit/avr8js-6leds?file=index.ts)
* [LED PWM](https://stackblitz.com/edit/avr8js-pwm?file=index.ts)
* [Serial Monitor](https://stackblitz.com/edit/avr8js-serial?file=index.ts)
* [NeoPixel Matrix](https://stackblitz.com/edit/avr8js-ws2812?file=index.ts)
* [Arduino MEGA NeoPixel Matrix](https://stackblitz.com/edit/avr8js-mega-ws2812?file=index.ts)
* [Simon Game](https://stackblitz.com/edit/avr8js-simon-game?file=index.ts) - with pushbuttons and sound
* [XMAS LEDs](https://stackblitz.com/edit/avr8js-xmas-dafna?file=index.ts)
* [Assembly Code](https://stackblitz.com/edit/avr8js-asm?file=index.ts)
* [EEPROM persistence](https://stackblitz.com/edit/avr8js-eeprom-localstorage?file=eeprom-localstorage-backend.ts)

Note: they are all hosted outside of this repo.

## Running the demo project

The demo project allows you to edit Arduino code, compile it, and run it in the simulator.
It also simulates 2 LEDs connected to pins 12 and 13 (PB4 and PB5). 

To run the demo project, check out this repository, run `npm install` and then `npm start`.

## Which chips can be simulated?

The library focuses on simulating the *ATmega328p*, which is the MCU used by the Arduino Uno.

However, the code is built in a modular way, and is highly configurable, making it possible
to simulate many chips from the AVR8 family, such as the ATmega2560 and the ATtiny series:

* [ATtiny85 Simulation](https://avr8js-attiny85.stackblitz.io?file=index.ts)

Check out [issue 67](https://github.com/wokwi/avr8js/issues/67#issuecomment-728121667) and
[issue 73](https://github.com/wokwi/avr8js/issues/73#issuecomment-743740477) for more information.

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

Copyright (C) 2019, 2020, 2021 Uri Shaked. The code is released under the terms of the MIT license.
