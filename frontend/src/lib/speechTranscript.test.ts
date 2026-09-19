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

  it('replaces cumulative browser chunks instead of duplicating them', () => {
    let transcript = '';
    for (const chunk of ['Mera', 'Mera Mera Pati', 'Mera Mera Pati Roj', 'Mera Mera Pati Roj Sharab Pi']) {
      transcript = appendCleanTranscript(transcript, chunk);
    }
    expect(transcript).toBe('Mera Pati Roj Sharab Pi');
  });
});
