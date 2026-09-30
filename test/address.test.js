import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseAddress, display, zbcEncode, zbcDecode, parseTypedHex, multisigAddress, ss58Encode } from '../src/lib/address.js';
import { hexToBytes, bytesToHex } from '../src/lib/bytes.js';

const vectors = JSON.parse(readFileSync(new URL('./fixtures/addresses.json', import.meta.url))).vectors;
const keys = JSON.parse(readFileSync(new URL('./fixtures/keys.json', import.meta.url)));

test('45 address vectors parse and round-trip', () => {
  assert.equal(vectors.length, 45);
  for (const v of vectors) {
    const r = parseAddress(v.input, v.chain);
    if (!v.valid) { assert.equal(r, null, `should be invalid: ${JSON.stringify(v.input)}`); continue; }
    assert.ok(r, `should parse: ${JSON.stringify(v.input)}`);
    assert.equal(r.type, v.account_type, v.input);
    assert.equal(r.hex, v.address_bytes, v.input);
    // round trip: display form parses back to the same bytes
    const back = parseAddress(r.display);
    assert.ok(back, `display should parse: ${r.display}`);
    assert.equal(back.hex, v.address_bytes, `round trip ${v.input} → ${r.display}`);
    // the vector's display equals ours, except where zbc-cli shows a foreign 32-byte key in ZBC_ form
    if (v.display.startsWith('ZBC_') && r.type !== 0) assert.equal(zbcEncode(r.payload, 'ZBC'), v.display);
    else if (r.type === 4) assert.equal(r.display.toLowerCase().replace(/^0x/, ''), v.display.toLowerCase().replace(/^0x/, ''));
    else assert.equal(r.display, v.display, v.input);
  }
});

test('ZBC_ and ZNK_ text forms from keys.json', () => {
  for (const s of keys.seeds) {
    const pk = hexToBytes(s.public_key);
    assert.equal(zbcEncode(pk, 'ZBC'), s.address);
    assert.equal(zbcEncode(pk, 'ZNK'), s.node_address);
    assert.equal(bytesToHex(zbcDecode(s.node_address).payload), s.public_key);
    assert.equal(zbcDecode(s.node_address).prefix, 'ZNK');
  }
});

test('typed hex parsing', () => {
  const t = parseTypedHex('000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152');
  assert.equal(t.type, 0);
  assert.equal(t.display, 'ZBC_L2HLFDOM_VKKKTEXX_C2P2M6LG_EB6ZNKSV_356SJUWW_5QPVHDE7_EFJA3PEX');
  assert.equal(parseTypedHex('04000000d8da6bf26964af9d7eed9e03e53415d37aa96045').display, '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
  assert.equal(parseTypedHex('02000000'), null);
  assert.equal(parseTypedHex('0000'), null);
});

test('multisig address matches the reference vector', () => {
  const a = hexToBytes('000000005e8eb28dccaa94a992f7169fa67966207d96aa55df7d24d2d6ec1f538c9f2152');
  const b = hexToBytes('00000000d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737');
  assert.equal(bytesToHex(multisigAddress(1, 0n, [b, a])), 'a946e4262017149fc848c9748fae010d30f274533c299d84f256b50f242fbdea');
});

test('SS58 prefix 0 and 42 both decode to the same account', () => {
  const alice = hexToBytes('d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d');
  assert.equal(ss58Encode(alice, 0), '15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5');
  assert.equal(ss58Encode(alice, 42), '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
});
