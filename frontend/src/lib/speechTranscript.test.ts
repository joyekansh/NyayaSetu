import { describe, expect, it } from 'vitest';

import { appendCleanTranscript, cleanSpeechTranscript } from './speechTranscript';

describe('speech transcript cleanup', () => {
  it('removes mic-check filler and repeated interim words', () => {
    const noisy =
      'hello guys hello hello hello mike check mike check where at one hacked and look a regret okay where at one hacked and look a regret okay where at one hacked and';

    expect(cleanSpeechTranscript(noisy)).toBe(
      'Where at one hacked and look a regret okay where at one hacked and',
    );
  });

  it('does not append duplicate final chunks', () => {
    expect(appendCleanTranscript('My landlord locked the room', 'my landlord locked the room')).toBe(
      'My landlord locked the room',
    );
  });
});
