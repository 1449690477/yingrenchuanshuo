import { describe, expect, it } from 'vitest';
import {
  guildMeritForContribution,
  guildStrongholdStage,
  isGuildDonationAmount,
} from '../guildStronghold';

describe('guild stronghold rules', () => {
  it('only exchanges newly improved remote-boss contribution for merit', () => {
    expect(guildMeritForContribution(0)).toBe(0);
    expect(guildMeritForContribution(1)).toBe(1);
    expect(guildMeritForContribution(200)).toBe(1);
    expect(guildMeritForContribution(201)).toBe(2);
    expect(guildMeritForContribution(1_000)).toBe(5);
  });

  it('rejects impossible client-provided contribution values', () => {
    expect(() => guildMeritForContribution(-1)).toThrow('0～1000');
    expect(() => guildMeritForContribution(1.5)).toThrow('0～1000');
  });

  it('derives the latest seasonal stronghold stage from total progress', () => {
    expect(guildStrongholdStage(0).id).toBe('camp');
    expect(guildStrongholdStage(12).id).toBe('lantern');
    expect(guildStrongholdStage(36).id).toBe('garden');
    expect(guildStrongholdStage(999).id).toBe('citadel');
  });

  it('only accepts explicit donation buttons', () => {
    expect(isGuildDonationAmount(1)).toBe(true);
    expect(isGuildDonationAmount(5)).toBe(true);
    expect(isGuildDonationAmount(10)).toBe(true);
    expect(isGuildDonationAmount(2)).toBe(false);
  });
});
