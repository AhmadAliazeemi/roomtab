const assert = require('node:assert/strict');
const merge = require('../vendor/deepmerge');

const malicious = JSON.parse('{"__proto__":{"isAdmin":true}}');

const nullPrototypeTarget = Object.create(null);
nullPrototypeTarget.safe = false;
const nullPrototypeResult = merge(nullPrototypeTarget, malicious);
assert.equal(Object.getPrototypeOf(nullPrototypeResult), Object.prototype);
assert.equal(nullPrototypeResult.isAdmin, undefined);
assert.equal(nullPrototypeResult.safe, false);

const nestedResult = merge(
  { session: null },
  JSON.parse('{"session":{"__proto__":{"isAdmin":true}}}')
);
assert.equal(Object.getPrototypeOf(nestedResult.session), Object.prototype);
assert.equal(nestedResult.session.isAdmin, undefined);

const targetWithOwnProto = JSON.parse('{"__proto__":{"isAdmin":true},"safe":true}');
const ownProtoResult = merge(targetWithOwnProto, { extra: true });
assert.equal(Object.getPrototypeOf(ownProtoResult), Object.prototype);
assert.equal(ownProtoResult.isAdmin, undefined);
assert.equal(Object.hasOwn(ownProtoResult, '__proto__'), false);
assert.equal(ownProtoResult.safe, true);
assert.equal(ownProtoResult.extra, true);

const arrayResult = merge(
  { list: [] },
  JSON.parse('{"list":[{"__proto__":{"isAdmin":true}}]}')
);
assert.equal(Object.getPrototypeOf(arrayResult.list[0]), Object.prototype);
assert.equal(arrayResult.list[0].isAdmin, undefined);

console.log('deepmerge security regression checks passed');
