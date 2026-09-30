import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVault, unlockVault, encryptVault, decryptVault, emptyVault, passwordStrength } from '../src/lib/vault.js';

test('vault create / unlock / re-encrypt with fresh IV', async () => {
  const data = emptyVault(); data.seeds.push({ id: 's1', name: 'Main', mnemonic: 'abandon '.repeat(11) + 'about' });
  const { blob, keyRaw } = await createVault('correct horse battery', data);
  assert.equal(blob.v, 1); assert.ok(!JSON.stringify(blob).includes('abandon'));
  const u = await unlockVault('correct horse battery', blob);
  assert.equal(u.data.seeds[0].name, 'Main');
  await assert.rejects(unlockVault('wrong password', blob));
  const blob2 = await encryptVault(keyRaw, u.data, u.salt);
  assert.notEqual(blob2.iv, blob.iv);
  assert.equal((await decryptVault(keyRaw, blob2)).seeds[0].mnemonic.trim().split(' ').length, 12);
});

test('password strength', () => {
  assert.ok(passwordStrength('aaaaaaaaaaaa') <= 1);
  assert.ok(passwordStrength('Tr0ub4dor&3xyz') >= 3);
});
