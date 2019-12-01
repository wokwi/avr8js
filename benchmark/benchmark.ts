/**
 * MIT License
 *
 * Copyright (c) 2019 Miško Hevery
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Source: https://github.com/mhevery/AngularConnect-2019
 */

// tslint:disable

import { performance } from 'perf_hooks';

const MIN_SAMPLE_COUNT_NO_IMPROVEMENT = 100;
const MIN_SAMPLE_DURATION = 2;

const UNITS = ['ms', 'us', 'ns', 'ps'];
export interface Benchmark {
  (versionName: string): Profile;
  report(fn?: (report: string) => void): void;
}
export interface Profile {
  (): boolean;
  profileName: string;
  bestTime: number;
  iterationCount: number;
  sampleCount: number;
  noImprovementCount: number;
}

export function createBenchmark(benchmarkName: string): Benchmark {
  const profiles: Profile[] = [];

  const benchmark = function Benchmark(profileName: string): Profile {
    let iterationCounter: number = 0;
    let timestamp: number = 0;
    const profile: Profile = function Profile(): boolean {
      if (iterationCounter === 0) {
        let runAgain = false;
        // if we reached the end of the iteration count than we should decide what to do next.
        if (timestamp === 0) {
          // this is the first time we are executing
          iterationCounter = profile.iterationCount;
          runAgain = true;
          // console.log('profiling', profileName, '...');
        } else {
          profile.sampleCount++;
          // we came to an end of a sample, compute the time.
          const durationMs = performance.now() - timestamp;
          const iterationTimeMs = Math.max(durationMs / profile.iterationCount, 0);
          if (profile.bestTime > iterationTimeMs) {
            profile.bestTime = iterationTimeMs;
            profile.noImprovementCount = 0;
            runAgain = true;
          } else {
            runAgain = profile.noImprovementCount++ < MIN_SAMPLE_COUNT_NO_IMPROVEMENT;
          }
          if (durationMs < MIN_SAMPLE_DURATION) {
            // we have not ran for long enough so increase the iteration count.
            profile.iterationCount = Math.max(
              // As a sanity if duration_ms is 0 just double the count.
              profile.iterationCount << 1,
              // Otherwise try to guess how many iterations we have to do to get the right time.
              Math.round((MIN_SAMPLE_DURATION / durationMs) * profile.iterationCount)
            );
            profile.noImprovementCount = 0;
            runAgain = true;
          }
        }
        iterationCounter = profile.iterationCount;
        timestamp = performance.now();
        return runAgain;
      } else {
        // this is the common path and it needs te be quick!
        iterationCounter--;
        return true;
      }
    } as Profile;
    profile.profileName = profileName;
    profile.bestTime = Number.MAX_SAFE_INTEGER;
    profile.iterationCount = 1;
    profile.noImprovementCount = 0;
    profile.sampleCount = 0;
    profiles.push(profile);
    return profile;
  } as Benchmark;

  benchmark.report = function(fn?: (report: string) => void) {
    const fastest = profiles.reduce((previous: Profile, current: Profile) => {
      return previous.bestTime < current.bestTime ? previous : current;
    });
    let unitOffset = 0;
    let time = fastest.bestTime;
    while (time < 1 && time !== 0) {
      time = time * 1000;
      unitOffset++;
    }
    const unit: string = UNITS[unitOffset];
    (fn || console.log)(
      `Benchmark: ${benchmarkName}\n${profiles
        .map((profile: Profile) => {
          const time = (profile.bestTime * Math.pow(1000, unitOffset)).toFixed(3);
          const percent = (100 - (profile.bestTime / fastest.bestTime) * 100).toFixed(0);
          return '  ' + profile.profileName + ': ' + time + ' ' + unit + '(' + percent + '%)';
        })
        .join('\n')}`
    );
  };
  return benchmark;
}
