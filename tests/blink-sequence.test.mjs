import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlinkSequence } from '../app/blink-sequence.ts';

test('two quick blinks speak once and never perform either selection', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const events = [];
  const input = createBlinkSequence(() => events.push('speak'));
  input.tap(() => events.push('first selection'));
  t.mock.timers.tick(200);
  input.tap(() => events.push('second selection'));
  t.mock.timers.tick(1000);
  assert.deepEqual(events, ['speak']);
});

test('slow blinks remain independent selections', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const events = [];
  const input = createBlinkSequence(() => events.push('speak'));
  input.tap(() => events.push('first'));
  t.mock.timers.tick(351);
  input.tap(() => events.push('second'));
  t.mock.timers.tick(351);
  assert.deepEqual(events, ['first', 'second']);
});

test('cancel on navigation, blur or frown prevents delayed selection', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const events = [];
  const input = createBlinkSequence(() => events.push('speak'));
  input.tap(() => events.push('selection'));
  input.cancel();
  t.mock.timers.tick(1000);
  assert.deepEqual(events, []);
});

test('changing gaze commits one pending selection without double speech', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const events = [];
  const input = createBlinkSequence(() => events.push('speak'));
  input.tap(() => events.push('first'));
  input.flush();
  input.tap(() => events.push('second'));
  t.mock.timers.tick(1000);
  assert.deepEqual(events, ['first', 'second']);
});
