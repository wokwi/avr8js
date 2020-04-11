# Contributing to AVR8js

First of all, thank you for considering contributing to AVR8js! 
Please go over these guidelines to ensure that your contribution lands
successfully.

## How to Contribute

Before starting to work on a new feature, please 
[file an issue](https://github.com/wokwi/avr8js/issues/new)
to discuss the implementation. 

## Setting-up Your Environment

The source code is written in the [TypeScript](https://www.typescriptlang.org/) language, a typed
extension of JavaScript.

In addition, we use the following tools:
* [prettier](https://prettier.io/) to keep the code pretty
* [eslint](https://eslint.org/) to keep the code consistent and clean
* [editorconfig](https://editorconfig.org/) to keep indentation consistent across different editors
* [jest](https://jestjs.io/) for the unit tests

If you open this project with [Visual Studio Code](https://code.visualstudio.com/), you will be prompted
to install the [relevant extensions](.vscode/extensions.json) for these tools.

Finally, we recommend using [Wallaby.js](https://wallabyjs.com/) to run the tests automatically
as you write the code. It should work out of the box with this repo, without any extra configuration.
You can also run the tests manually, from the commandline (see below).

## Running the Demo Project

The demo project allows you to edit Arduino code, compile it, and run it in the simulator.
It also simulates 2 LEDs connected to pins 12 and 13 (PB4 and PB5). To run it, simply execute

```
npm start
```

Then go to http://localhost:1234/ to interact with the project.

The demo project is packaged using [parcel](https://parceljs.org/) and uses the 
[Monaco Editor](https://microsoft.github.io/monaco-editor/) for the interactive
code editor, and the [Wokwi Elements library](https://www.npmjs.com/package/@wokwi/elements)
for displaying the LEDs.

## Running The Tests

Run the tests once:

```
npm test
```

Run the tests of the files you modified since last commit (watch mode):

```
npm run test:watch
```

## Reference Material

The following datasheets can be useful when working on new AVR8js features
or fixing existing code:

* [ATmega48A/PA/88A/PA/168A/PA/328/P Datasheet](http://ww1.microchip.com/downloads/en/DeviceDoc/ATmega48A-PA-88A-PA-168A-PA-328-P-DS-DS40002061A.pdf)
* [The AVR Istruction Set Manual](http://ww1.microchip.com/downloads/en/devicedoc/atmel-0856-avr-instruction-set-manual.pdf)
* [ ATmega640/V-1280/V-1281/V-2560/V-2561/V Datasheet](https://ww1.microchip.com/downloads/en/devicedoc/atmel-2549-8-bit-avr-microcontroller-atmega640-1280-1281-2560-2561_datasheet.pdf)

## Coding Guidelines

Please make sure to follow these guidelines when contributing code:

1. You include a relevant test case. Ideally the test case would fail before
   your code changes, and pass after implementing the change.
2. Your commit messages should follow the [conventional commits 
   standard](https://www.conventionalcommits.org/), e.g.:
   `feat(instruction): implement EICALL, EIJMP`
3. The contributed code has to be compatible with the MIT license. If your
   work incoporates some third-party code, please make sure that their 
   license is compatible and that you credit appropriately.

Thank you!
