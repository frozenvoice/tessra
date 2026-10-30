# Tessra 1.2.4

## Clearer script test failures

The 1.2.3 script isolation rework kept pass/fail results correct but reduced failure messages to generic text such as "Expected values to be strictly equal." 1.2.4 brings back the values:

- `pm.expect(1).to.equal(2)` → `Expected 1 to strictly equal 2.`
- `pm.expect({ a: 1 }).to.eql({ a: 2 })` → `Expected {"a":1} to deeply equal {"a":2}.`
- `.to.have.property('id', 2)` → `Property "id" expected 2, received 1.`
- `include`, `match`, `be.true`, `be.false`, and `be.ok` also show the received value.

Summaries are built inside the script realm, handle cyclic objects, BigInt, NaN, -0, functions, Map and Set, and are limited to 200 characters per value. The 1.2.3 isolation contract is unchanged.

The README and Marketplace demo video now autoplays muted and loops; its controls can unmute it.

No request schema, storage format, or script API changes.
