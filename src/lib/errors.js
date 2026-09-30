// Provider error codes (spec §2.5).
export const ERR = {
  REJECTED: 4001, UNAUTHORIZED: 4100, UNSUPPORTED: 4200, BAD_REQUEST: 4300, NOT_HELD: 4404,
  NOT_SHARED: 4405, CANNOT_SIGN: 4406, LOCKED: 4900, WRONG_CHAIN: 4901, INTERNAL: 5000,
};
export const ERR_TEXT = {
  4001: 'User rejected', 4100: 'Origin not authorised (call zbc_requestAccounts first)', 4200: 'Method not supported',
  4300: 'Bytes do not decode, or the decoded transaction contradicts the request', 4404: 'Account not held by this signer',
  4405: 'Account held but not shared with this origin', 4406: 'Account cannot sign this', 4900: 'Signer locked',
  4901: 'Wrong chain: the page is on a different network than the signer', 5000: 'Internal error',
};
export class RpcError extends Error {
  constructor(code, message) { super(message || ERR_TEXT[code] || 'Error'); this.code = code; this.name = 'RpcError'; }
  toJSON() { return { code: this.code, message: this.message }; }
}
export function rpcError(code, message) { return new RpcError(code, message); }
export function asRpcError(e) {
  if (e instanceof RpcError) return e;
  if (e && e.code === 4300) return new RpcError(4300, e.message);
  return new RpcError(5000, (e && e.message) || String(e));
}
