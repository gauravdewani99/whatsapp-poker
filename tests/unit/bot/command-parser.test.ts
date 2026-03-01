import { describe, it, expect } from 'vitest';
import { parseCommand } from '../../../src/bot/command-parser.js';

const SENDER = '1234@c.us';
const NAME = 'Alice';
const GROUP = 'group1@g.us';

describe('Command Parser', () => {
  it('parses !poker start with blinds', () => {
    const cmd = parseCommand('!poker start 100/200', SENDER, NAME, GROUP);
    expect(cmd).not.toBeNull();
    expect(cmd!.name).toBe('start');
    expect(cmd!.args).toEqual(['100/200']);
  });

  it('parses !poker join with amount', () => {
    const cmd = parseCommand('!poker join 5000', SENDER, NAME, GROUP);
    expect(cmd).not.toBeNull();
    expect(cmd!.name).toBe('join');
    expect(cmd!.args).toEqual(['5000']);
  });

  it('parses !poker deal', () => {
    const cmd = parseCommand('!poker deal', SENDER, NAME, GROUP);
    expect(cmd).not.toBeNull();
    expect(cmd!.name).toBe('deal');
  });

  it('parses !fold', () => {
    const cmd = parseCommand('!fold', SENDER, NAME, GROUP);
    expect(cmd!.name).toBe('fold');
  });

  it('parses !f as fold alias', () => {
    const cmd = parseCommand('!f', SENDER, NAME, GROUP);
    expect(cmd!.name).toBe('fold');
  });

  it('parses !check', () => {
    const cmd = parseCommand('!check', SENDER, NAME, GROUP);
    expect(cmd!.name).toBe('check');
  });

  it('parses !x as check alias', () => {
    const cmd = parseCommand('!x', SENDER, NAME, GROUP);
    expect(cmd!.name).toBe('check');
  });

  it('parses !call', () => {
    const cmd = parseCommand('!call', SENDER, NAME, GROUP);
    expect(cmd!.name).toBe('call');
  });

  it('parses !c as call alias', () => {
    const cmd = parseCommand('!c', SENDER, NAME, GROUP);
    expect(cmd!.name).toBe('call');
  });

  it('parses !raise with amount', () => {
    const cmd = parseCommand('!raise 500', SENDER, NAME, GROUP);
    expect(cmd!.name).toBe('raise');
    expect(cmd!.args).toEqual(['500']);
  });

  it('parses !r as raise alias', () => {
    const cmd = parseCommand('!r 500', SENDER, NAME, GROUP);
    expect(cmd!.name).toBe('raise');
    expect(cmd!.args).toEqual(['500']);
  });

  it('parses !all-in', () => {
    const cmd = parseCommand('!all-in', SENDER, NAME, GROUP);
    expect(cmd!.name).toBe('all-in');
  });

  it('parses !allin as alias', () => {
    const cmd = parseCommand('!allin', SENDER, NAME, GROUP);
    expect(cmd!.name).toBe('all-in');
  });

  it('parses !a as all-in alias', () => {
    const cmd = parseCommand('!a', SENDER, NAME, GROUP);
    expect(cmd!.name).toBe('all-in');
  });

  it('parses !status', () => {
    const cmd = parseCommand('!status', SENDER, NAME, GROUP);
    expect(cmd!.name).toBe('status');
  });

  it('parses !s as status alias', () => {
    const cmd = parseCommand('!s', SENDER, NAME, GROUP);
    expect(cmd!.name).toBe('status');
  });

  it('parses !balance', () => {
    const cmd = parseCommand('!balance', SENDER, NAME, GROUP);
    expect(cmd!.name).toBe('balance');
  });

  it('parses !help', () => {
    const cmd = parseCommand('!help', SENDER, NAME, GROUP);
    expect(cmd!.name).toBe('help');
  });

  it('returns null for non-command messages', () => {
    const cmd = parseCommand('Hello everyone!', SENDER, NAME, GROUP);
    expect(cmd).toBeNull();
  });

  it('returns null for unknown commands', () => {
    const cmd = parseCommand('!unknown stuff', SENDER, NAME, GROUP);
    expect(cmd).toBeNull();
  });

  it('is case insensitive', () => {
    const cmd = parseCommand('!POKER START 100/200', SENDER, NAME, GROUP);
    expect(cmd).not.toBeNull();
    expect(cmd!.name).toBe('start');
  });

  it('handles extra whitespace', () => {
    const cmd = parseCommand('  !poker start   100/200  ', SENDER, NAME, GROUP);
    expect(cmd).not.toBeNull();
    expect(cmd!.name).toBe('start');
    expect(cmd!.args).toEqual(['100/200']);
  });

  it('preserves sender info', () => {
    const cmd = parseCommand('!help', SENDER, NAME, GROUP);
    expect(cmd!.senderWaId).toBe(SENDER);
    expect(cmd!.senderName).toBe(NAME);
    expect(cmd!.groupId).toBe(GROUP);
  });
});
