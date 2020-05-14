# AVR8js

JavaScript implementation of the AVR 8-bit architecture

[![Build Status](https://travis-ci.org/wokwi/avr8js.png?branch=master)](https://travis-ci.org/wokwi/avr8js)
[![NPM Version](https://img.shields.io/npm/v/avr8js)](https://www.npmjs.com/package/avr8js)

## Running the demo project

The demo project allows you to edit Arduino code, compile it, and run it in the simulator.
It also simulates 2 LEDs connected to pins 12 and 13 (PB4 and PB5). 

To run the demo project, check out this repository, run `npm install` and then `npm start`.

### Walkthrough Video Tutorial

A step-by-step video tutorial showing how to build a simple Arduino simulator using AVR8js and React:

[![AVR8JS Walkthrough Video](https://i.imgur.com/3meSd1m.png)](https://youtu.be/fArqj-USmjA)

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