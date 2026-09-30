import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Transcript, sr25519FromMiniSecret, sr25519Sign, sr25519Verify, sr25519HardDerive, junctionString } from '../src/lib/sr25519.js';
import { hexToBytes, bytesToHex, utf8 } from '../src/lib/bytes.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha512 } from '@noble/hashes/sha512';
import { mnemonicToEntropy } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

test('Merlin transcript test vector (equivalence_simple)', () => {
  const t = new Transcript('test protocol');
  t.appendMessage('some label', 'some data');
  const c = t.challengeBytes('challenge', 32);
  assert.equal(bytesToHex(c), 'd5a21972d0d5fe320c0d263fac7fffb8145aa640af6e9bca177c03c7efcf0615');
});

test('Alice mini secret → public key', () => {
  const k = sr25519FromMiniSecret(hexToBytes('e5be9a5092b81bca64be81d212e7f2f9eba183bb7a90954f7b76361f6edb5c0a'));
  assert.equal(bytesToHex(k.publicKey), 'd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d');
});

test('dev phrase → mini secret, //Alice hard derivation', () => {
  const phrase = 'bottom drive obey lake curtain smoke basket hold race lonely fit walk';
  const entropy = mnemonicToEntropy(phrase, wordlist);
  const mini = pbkdf2(sha512, entropy, utf8('mnemonic'), { c: 2048, dkLen: 64 }).slice(0, 32);
  assert.equal(bytesToHex(mini), 'fac7959dbfe72f052e5a0c3c8d6530f202b02fd8f9f5ca3580ec8deb7797479e');
  const root = sr25519FromMiniSecret(mini);
  assert.equal(bytesToHex(root.publicKey), '46ebddef8cd9bb167dc30878d7113b7e168e6f0646beffd77d69d39bad76b47a');
  const alice = sr25519HardDerive(mini, junctionString('Alice'));
  assert.equal(bytesToHex(alice), 'e5be9a5092b81bca64be81d212e7f2f9eba183bb7a90954f7b76361f6edb5c0a');
});

test('sign / verify round trip and tamper detection', () => {
  const k = sr25519FromMiniSecret(hexToBytes('e5be9a5092b81bca64be81d212e7f2f9eba183bb7a90954f7b76361f6edb5c0a'));
  const msg = utf8('this is a message');
  const sig = sr25519Sign(k, msg);
  assert.equal(sig.length, 64);
  assert.ok(sr25519Verify(k.publicKey, msg, sig));
  assert.ok(!sr25519Verify(k.publicKey, utf8('this is a messag3'), sig));
  const bad = sig.slice(); bad[3] ^= 1;
  assert.ok(!sr25519Verify(k.publicKey, msg, bad));
  assert.ok(!sr25519Verify(k.publicKey, msg, sig, 'other-context'));
});

