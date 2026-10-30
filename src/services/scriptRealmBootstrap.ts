/**
 * 스크립트 realm 안에서만 평가되는 bootstrap 소스다.
 *
 * 이 파일은 호스트 객체나 호스트 함수를 참조하지 않는다. 입력은 JSON 문자열,
 * 출력은 JSON 문자열로만 오가며, crypto 유틸리티도 realm 안의 순수 JavaScript
 * 구현을 사용한다. `vm`의 codeGeneration 차단과 함께 사용해야 한다.
 */

export function createScriptRealmBootstrap(serializedInput: string): string {
  return String.raw`(() => {
  'use strict';

  const jsonStringify = JSON.stringify.bind(JSON);
  const arrayIsArray = Array.isArray;
  const arrayMap = Array.prototype.map;
  const arrayPush = Array.prototype.push;
  const objectKeys = Object.keys;
  const objectHasOwn = Object.prototype.hasOwnProperty;
  const objectSetPrototypeOf = Object.setPrototypeOf;
  const jsonParse = JSON.parse.bind(JSON);
  const objectIs = Object.is;
  const objectGetPrototypeOf = Object.getPrototypeOf;
  const objectToString = Object.prototype.toString;
  const ownKeys = Reflect.ownKeys;
  const propertyIsEnumerable = Object.prototype.propertyIsEnumerable;
  const arrayBufferIsView = ArrayBuffer.isView;
  const dateGetTime = Date.prototype.getTime;
  const mapEntries = Map.prototype.entries;
  const setValues = Set.prototype.values;
  const Uint8ArrayCtor = Uint8Array;
  const WeakSetCtor = WeakSet;
  const numberIsFinite = Number.isFinite;
  const DateCtor = Date;
  const string = String;

  const input = jsonParse(${JSON.stringify(serializedInput)});

  // realm 내장 prototype 오염과 동적 문자열 코드 생성을 함께 차단한다.
  Object.freeze(Object.prototype);
  Object.freeze(Array.prototype);
  Object.freeze(Function.prototype);
  Object.freeze(RegExp.prototype);
  Object.freeze(Error.prototype);
  Object.freeze(String.prototype);
  Object.freeze(Number.prototype);
  Object.freeze(Boolean.prototype);
  Object.freeze(Promise.prototype);
  Object.freeze(JSON);
  Object.freeze(Math);
  Object.freeze(Date);

  // 스크립트가 prototype을 오염시켜도 출력 경계에 영향을 주지 않도록 한다.
  function nullObject() {
    const value = {};
    objectSetPrototypeOf(value, null);
    return value;
  }

  function primitiveText(value) {
    if (typeof value === 'string') { return value; }
    if (value === null || value === undefined) { return ''; }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return string(value);
    }
    return '';
  }

  function cloneKeyValue(value) {
    const result = nullObject();
    result.key = primitiveText(value && value.key);
    result.value = primitiveText(value && value.value);
    result.enabled = Boolean(value && value.enabled !== false);
    return result;
  }

  function cloneKeyValueList(values) {
    if (!arrayIsArray(values)) { return []; }
    return arrayMap.call(values, cloneKeyValue);
  }

  function cloneFormDataField(value) {
    const result = nullObject();
    result.id = primitiveText(value && value.id);
    result.key = primitiveText(value && value.key);
    result.value = primitiveText(value && value.value);
    result.enabled = value && value.enabled !== false;
    result.type = value && value.type === 'file' ? 'file' : 'text';
    return result;
  }

  function cloneFormDataList(values) {
    if (!arrayIsArray(values)) { return []; }
    return arrayMap.call(values, cloneFormDataField);
  }

  function cloneAuth(value) {
    const result = nullObject();
    result.type = primitiveText(value && value.type) || 'none';
    if (value && value.basic && typeof value.basic === 'object') {
      result.basic = nullObject();
      result.basic.username = primitiveText(value.basic.username);
      result.basic.password = primitiveText(value.basic.password);
    }
    if (value && value.bearer && typeof value.bearer === 'object') {
      result.bearer = nullObject();
      result.bearer.token = primitiveText(value.bearer.token);
    }
    if (value && value.apikey && typeof value.apikey === 'object') {
      result.apikey = nullObject();
      result.apikey.key = primitiveText(value.apikey.key);
      result.apikey.value = primitiveText(value.apikey.value);
      result.apikey.addTo = value.apikey.addTo === 'query' ? 'query' : 'header';
    }
    return result;
  }

  function cloneRequest(value) {
    const result = nullObject();
    result.method = primitiveText(value && value.method);
    result.url = primitiveText(value && value.url);
    result.headers = cloneKeyValueList(value && value.headers);
    result.params = cloneKeyValueList(value && value.params);
    result.body = primitiveText(value && value.body);
    result.bodyType = primitiveText(value && value.bodyType);
    result.formData = cloneFormDataList(value && value.formData);
    result.binaryFilePath = primitiveText(value && value.binaryFilePath);
    result.auth = cloneAuth(value && value.auth);
    return result;
  }

  function snapshotKeyValueList(values) {
    if (!arrayIsArray(values)) { return []; }
    const result = [];
    for (let index = 0; index < values.length; index += 1) {
      result.push(cloneKeyValue(values[index]));
    }
    return result;
  }

  function snapshotFormDataList(values) {
    if (!arrayIsArray(values)) { return []; }
    const result = [];
    for (let index = 0; index < values.length; index += 1) {
      result.push(cloneFormDataField(values[index]));
    }
    return result;
  }

  function snapshotAuth(value) {
    return cloneAuth(value);
  }

  function snapshotRequest(value) {
    const result = nullObject();
    result.method = primitiveText(value && value.method);
    result.url = primitiveText(value && value.url);
    result.headers = snapshotKeyValueList(value && value.headers);
    result.params = snapshotKeyValueList(value && value.params);
    result.body = primitiveText(value && value.body);
    result.bodyType = primitiveText(value && value.bodyType);
    result.formData = snapshotFormDataList(value && value.formData);
    result.binaryFilePath = primitiveText(value && value.binaryFilePath);
    result.auth = snapshotAuth(value && value.auth);
    return result;
  }

  function safeJson(value) {
    try {
      const result = jsonStringify(value);
      return result === undefined ? primitiveText(value) : result;
    } catch {
      return primitiveText(value);
    }
  }

  function safeLogValue(value) {
    if (typeof value === 'string') { return value; }
    if (value && typeof value.message === 'string') { return value.message; }
    const serialized = safeJson(value);
    return serialized || primitiveText(value);
  }

  // 실패 메시지용 값 요약. 순환·BigInt·특수 숫자를 안전하게 표기하고 길이를 제한한다.
  const DESCRIBE_LIMIT = 200;
  function describeValue(value) {
    let text;
    try {
      const type = typeof value;
      if (type === 'string') {
        text = jsonStringify(value);
      } else if (type === 'number') {
        text = objectIs(value, -0) ? '-0' : string(value);
      } else if (type === 'bigint') {
        text = string(value) + 'n';
      } else if (type === 'function') {
        text = '[Function' + (value.name ? ' ' + string(value.name) : '') + ']';
      } else if (value === null || type !== 'object') {
        text = string(value);
      } else {
        const tag = objectToString.call(value);
        if (tag === '[object Map]' || tag === '[object Set]') {
          text = tag.slice(8, -1) + '(' + string(value.size) + ')';
        } else if (tag === '[object Date]') {
          const time = dateGetTime.call(value);
          text = time === time ? 'Date(' + jsonStringify(new DateCtor(time)) + ')' : 'Date(Invalid)';
        } else if (tag === '[object RegExp]') {
          text = '/' + string(value.source) + '/' + string(value.flags);
        } else {
          const seen = new WeakSetCtor();
          text = jsonStringify(value, (key, item) => {
            if (typeof item === 'bigint') { return string(item) + 'n'; }
            if (typeof item === 'number' && !numberIsFinite(item)) { return string(item); }
            if (item && typeof item === 'object') {
              if (seen.has(item)) { return '[Circular]'; }
              seen.add(item);
            }
            return item;
          });
        }
      }
    } catch {
      text = undefined;
    }
    if (typeof text !== 'string') { text = '[unprintable value]'; }
    return text.length > DESCRIBE_LIMIT ? text.slice(0, DESCRIBE_LIMIT) + '…' : text;
  }

  function utilityText(value, label) {
    if (value === null || value === undefined) { return string(value); }
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean' || type === 'bigint') { return string(value); }
    throw new TypeError(label + ' expects a string, number, boolean, bigint, null, or undefined. Pass JSON.stringify(...) for objects.');
  }

  const state = { logs: [], tests: [] };
  const envEntries = [];

  function findEnvIndex(name) {
    const normalizedName = primitiveText(name);
    for (let index = 0; index < envEntries.length; index += 1) {
      if (envEntries[index].key === normalizedName) { return index; }
    }
    return -1;
  }

  function envGet(name) {
    const index = findEnvIndex(name);
    return index < 0 ? undefined : envEntries[index].value;
  }

  function envSet(name, value) {
    const normalizedName = primitiveText(name);
    const index = findEnvIndex(normalizedName);
    const serialized = typeof value === 'string' ? value : safeJson(value);
    const entry = nullObject();
    entry.key = normalizedName;
    entry.value = serialized;
    entry.enabled = index < 0 ? true : envEntries[index].enabled;
    if (index < 0) { arrayPush.call(envEntries, entry); } else { envEntries[index] = entry; }
  }

  function envUnset(name) {
    const index = findEnvIndex(primitiveText(name));
    if (index >= 0) { envEntries.splice(index, 1); }
  }

  function envToList() {
    return arrayMap.call(envEntries, (entry) => {
      const result = nullObject();
      result.key = entry.key;
      result.value = entry.value;
      result.enabled = entry.enabled;
      return result;
    });
  }

  const initialVariables = arrayIsArray(input.envVariables) ? input.envVariables : [];
  for (let index = 0; index < initialVariables.length; index += 1) {
    const variable = initialVariables[index];
    if (!variable || !variable.key) { continue; }
    const entry = nullObject();
    entry.key = primitiveText(variable.key);
    entry.value = primitiveText(variable.value);
    entry.enabled = variable.enabled !== false;
    arrayPush.call(envEntries, entry);
  }

  const envApi = nullObject();
  envApi.get = envGet;
  envApi.set = envSet;
  envApi.unset = envUnset;
  envApi.toObject = () => {
    const result = nullObject();
    for (let index = 0; index < envEntries.length; index += 1) {
      result[envEntries[index].key] = envEntries[index].value;
    }
    return result;
  };

  function addLog(level, values) {
    const messages = arrayMap.call(values, safeLogValue);
    const entry = nullObject();
    entry.level = level;
    entry.message = messages.join(' ');
    arrayPush.call(state.logs, entry);
  }

  const logger = nullObject();
  logger.log = (...values) => addLog('log', values);
  logger.warn = (...values) => addLog('warn', values);
  logger.error = (...values) => addLog('error', values);

  function deepEqual(left, right, leftPath = [], rightPath = []) {
    if (objectIs(left, right)) { return true; }
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object') { return false; }
    if (objectGetPrototypeOf(left) !== objectGetPrototypeOf(right)) { return false; }
    const tag = objectToString.call(left);
    if (tag !== objectToString.call(right)) { return false; }
    // 현재 재귀 경로만 추적해 순환을 종료하고, Map/Set의 실패한 후보 비교는 남기지 않는다.
    const leftIndex = leftPath.indexOf(left);
    const rightIndex = rightPath.indexOf(right);
    if (leftIndex >= 0 || rightIndex >= 0) { return leftIndex === rightIndex; }
    leftPath.push(left);
    rightPath.push(right);
    const compare = (a, b) => deepEqual(a, b, leftPath, rightPath);
    try {
      if (arrayIsArray(left)) {
        if (!arrayIsArray(right) || left.length !== right.length) { return false; }
      } else if (tag === '[object Date]') {
        if (dateGetTime.call(left) !== dateGetTime.call(right)) { return false; }
      } else if (tag === '[object RegExp]') {
        if (left.source !== right.source || left.flags !== right.flags || left.lastIndex !== right.lastIndex) { return false; }
      } else if (tag === '[object Map]' || tag === '[object Set]') {
        const isMap = tag === '[object Map]';
        const values = isMap ? mapEntries : setValues;
        const leftEntries = [...values.call(left)];
        const rightEntries = [...values.call(right)];
        if (leftEntries.length !== rightEntries.length) { return false; }
        const matched = new Array(rightEntries.length).fill(false);
        for (const entry of leftEntries) {
          const matchIndex = rightEntries.findIndex((candidate, index) => !matched[index] && (
            isMap ? compare(entry[0], candidate[0]) && compare(entry[1], candidate[1]) : compare(entry, candidate)
          ));
          if (matchIndex < 0) { return false; }
          matched[matchIndex] = true;
        }
      } else if (arrayBufferIsView(left) || tag === '[object ArrayBuffer]' || tag === '[object SharedArrayBuffer]') {
        if (left.byteLength !== right.byteLength) { return false; }
        const bytes = (value) => arrayBufferIsView(value)
          ? new Uint8ArrayCtor(value.buffer, value.byteOffset, value.byteLength)
          : new Uint8ArrayCtor(value);
        const leftBytes = bytes(left);
        const rightBytes = bytes(right);
        for (let index = 0; index < leftBytes.length; index += 1) {
          if (leftBytes[index] !== rightBytes[index]) { return false; }
        }
      } else if (tag === '[object Number]' || tag === '[object String]' || tag === '[object Boolean]' || tag === '[object BigInt]' || tag === '[object Symbol]') {
        const valueOf = { '[object Number]': Number.prototype.valueOf, '[object String]': String.prototype.valueOf,
          '[object Boolean]': Boolean.prototype.valueOf, '[object BigInt]': BigInt.prototype.valueOf, '[object Symbol]': Symbol.prototype.valueOf }[tag];
        if (!objectIs(valueOf.call(left), valueOf.call(right))) { return false; }
      } else if (tag === '[object Error]') {
        if (left.name !== right.name || left.message !== right.message) { return false; }
        for (const key of ['cause', 'errors']) {
          if (objectHasOwn.call(left, key) !== objectHasOwn.call(right, key) || !compare(left[key], right[key])) { return false; }
        }
      } else if (tag !== '[object Object]' && tag !== '[object Arguments]') {
        throw new TypeError('Deep equality does not support ' + tag + '.');
      }
      const keys = (value) => ownKeys(value).filter(key => propertyIsEnumerable.call(value, key));
      const leftKeys = keys(left);
      const rightKeys = keys(right);
      if (leftKeys.length !== rightKeys.length) { return false; }
      for (const key of leftKeys) {
        if (!propertyIsEnumerable.call(right, key) || !compare(left[key], right[key])) { return false; }
      }
      return true;
    } finally {
      leftPath.pop();
      rightPath.pop();
    }
  }

  function expectation(actual) {
    const api = nullObject();
    const to = nullObject();
    const be = nullObject();
    const have = nullObject();
    const assertInclude = (expected) => {
      if (typeof actual === 'string') {
        if (!actual.includes(string(expected))) { throw new Error('\"' + actual + '\" does not include \"' + string(expected) + '\".'); }
        return;
      }
      if (arrayIsArray(actual)) {
        if (!actual.includes(expected)) { throw new Error('Expected ' + describeValue(actual) + ' to include ' + describeValue(expected) + '.'); }
        return;
      }
      throw new Error('The include assertion only supports strings or arrays.');
    };
    to.equal = (expected) => { if (!objectIs(actual, expected)) { throw new Error('Expected ' + describeValue(actual) + ' to strictly equal ' + describeValue(expected) + '.'); } };
    to.eql = (expected) => { if (!deepEqual(actual, expected)) { throw new Error('Expected ' + describeValue(actual) + ' to deeply equal ' + describeValue(expected) + '.'); } };
    to.include = assertInclude;
    to.match = (pattern) => {
      if (typeof actual !== 'string' || !pattern || typeof pattern.test !== 'function' || !pattern.test(actual)) {
        throw new Error(describeValue(actual) + ' does not match ' + describeValue(pattern) + '.');
      }
    };
    to.have = have;
    to.be = be;
    have.property = function (name, expectedValue) {
      if (actual === null || typeof actual !== 'object' || !(name in actual)) { throw new Error('Property \"' + string(name) + '\" does not exist.'); }
      if (arguments.length >= 2 && !deepEqual(actual[name], expectedValue)) { throw new Error('Property \"' + string(name) + '\" expected ' + describeValue(expectedValue) + ', received ' + describeValue(actual[name]) + '.'); }
    };
    Object.defineProperty(be, 'true', { get: () => { if (actual !== true) { throw new Error('Expected true, received ' + describeValue(actual) + '.'); } return api; } });
    Object.defineProperty(be, 'false', { get: () => { if (actual !== false) { throw new Error('Expected false, received ' + describeValue(actual) + '.'); } return api; } });
    Object.defineProperty(be, 'ok', { get: () => { if (!actual) { throw new Error('Expected a truthy value, received ' + describeValue(actual) + '.'); } return api; } });
    api.to = to;
    return api;
  }

  function test(name, callback) {
    const result = nullObject();
    result.name = primitiveText(name);
    try {
      callback();
      result.passed = true;
    } catch (error) {
      result.passed = false;
      result.error = safeLogValue(error);
    }
    arrayPush.call(state.tests, result);
  }

  function utf8Bytes(value) {
    const text = primitiveText(value);
    const bytes = [];
    for (let index = 0; index < text.length; index += 1) {
      let codePoint = text.charCodeAt(index);
      if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
        const next = text.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + next - 0xdc00;
          index += 1;
        } else {
          codePoint = 0xfffd;
        }
      } else if (codePoint >= 0xdc00 && codePoint <= 0xdfff) {
        codePoint = 0xfffd;
      }
      if (codePoint <= 0x7f) { bytes.push(codePoint); }
      else if (codePoint <= 0x7ff) { bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f)); }
      else if (codePoint <= 0xffff) { bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f)); }
      else { bytes.push(0xf0 | (codePoint >> 18), 0x80 | ((codePoint >> 12) & 0x3f), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f)); }
    }
    return bytes;
  }

  function bytesToUtf8(bytes) {
    let result = '';
    for (let index = 0; index < bytes.length;) {
      const first = bytes[index++];
      let codePoint;
      let needed;
      if (first <= 0x7f) { codePoint = first; needed = 0; }
      else if (first >= 0xc2 && first <= 0xdf) { codePoint = first & 0x1f; needed = 1; }
      else if (first >= 0xe0 && first <= 0xef) { codePoint = first & 0x0f; needed = 2; }
      else if (first >= 0xf0 && first <= 0xf4) { codePoint = first & 0x07; needed = 3; }
      else { result += '\ufffd'; continue; }
      let valid = true;
      for (let part = 0; part < needed; part += 1) {
        const next = bytes[index];
        // 범위를 벗어난 바이트는 소비하지 않고 다음 문자로 다시 처리한다.
        const lower = part === 0 && first === 0xe0 ? 0xa0 : part === 0 && first === 0xf0 ? 0x90 : 0x80;
        const upper = part === 0 && first === 0xed ? 0x9f : part === 0 && first === 0xf4 ? 0x8f : 0xbf;
        if (next === undefined || next < lower || next > upper) { valid = false; break; }
        codePoint = (codePoint << 6) | (next & 0x3f);
        index += 1;
      }
      if (!valid) {
        result += '\ufffd';
      } else if (codePoint <= 0xffff) {
        result += string.fromCharCode(codePoint);
      } else {
        const adjusted = codePoint - 0x10000;
        result += string.fromCharCode(0xd800 + (adjusted >> 10), 0xdc00 + (adjusted & 0x3ff));
      }
    }
    return result;
  }

  const shaK = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  function rotateRight(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
  function sha256Bytes(inputBytes) {
    const bytes = inputBytes.slice();
    const bitLength = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) { bytes.push(0); }
    const highLength = Math.floor(bitLength / 0x100000000);
    bytes.push((highLength >>> 24) & 0xff, (highLength >>> 16) & 0xff, (highLength >>> 8) & 0xff, highLength & 0xff, (bitLength >>> 24) & 0xff, (bitLength >>> 16) & 0xff, (bitLength >>> 8) & 0xff, bitLength & 0xff);
    let h0 = 0x6a09e667; let h1 = 0xbb67ae85; let h2 = 0x3c6ef372; let h3 = 0xa54ff53a;
    let h4 = 0x510e527f; let h5 = 0x9b05688c; let h6 = 0x1f83d9ab; let h7 = 0x5be0cd19;
    for (let offset = 0; offset < bytes.length; offset += 64) {
      const words = new Array(64);
      for (let index = 0; index < 16; index += 1) {
        const position = offset + index * 4;
        words[index] = ((bytes[position] << 24) | (bytes[position + 1] << 16) | (bytes[position + 2] << 8) | bytes[position + 3]) >>> 0;
      }
      for (let index = 16; index < 64; index += 1) {
        const value = words[index - 15];
        const small0 = rotateRight(value, 7) ^ rotateRight(value, 18) ^ (value >>> 3);
        const previous = words[index - 2];
        const small1 = rotateRight(previous, 17) ^ rotateRight(previous, 19) ^ (previous >>> 10);
        words[index] = (words[index - 16] + small0 + words[index - 7] + small1) >>> 0;
      }
      let a = h0; let b = h1; let c = h2; let d = h3; let e = h4; let f = h5; let g = h6; let h = h7;
      for (let index = 0; index < 64; index += 1) {
        const big1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
        const choose = (e & f) ^ (~e & g);
        const temp1 = (h + big1 + choose + shaK[index] + words[index]) >>> 0;
        const big0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (big0 + majority) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    const words = [h0, h1, h2, h3, h4, h5, h6, h7];
    const result = [];
    for (let index = 0; index < words.length; index += 1) {
      result.push((words[index] >>> 24) & 0xff, (words[index] >>> 16) & 0xff, (words[index] >>> 8) & 0xff, words[index] & 0xff);
    }
    return result;
  }
  function hex(bytes) { return bytes.map((value) => value.toString(16).padStart(2, '0')).join(''); }
  function sha256(value) { return hex(sha256Bytes(utf8Bytes(utilityText(value, 'pm.crypto.sha256')))); }
  function hmacSha256(message, secret) {
    let key = utf8Bytes(utilityText(secret, 'pm.crypto.hmacSha256(secret)'));
    if (key.length > 64) { key = sha256Bytes(key); }
    while (key.length < 64) { key.push(0); }
    const outer = []; const inner = [];
    for (let index = 0; index < 64; index += 1) { outer.push(key[index] ^ 0x5c); inner.push(key[index] ^ 0x36); }
    return hex(sha256Bytes(outer.concat(sha256Bytes(inner.concat(utf8Bytes(utilityText(message, 'pm.crypto.hmacSha256(message)')))))));
  }

  const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function base64Encode(value) {
    const bytes = utf8Bytes(utilityText(value, 'pm.encoding.base64Encode')); let result = '';
    for (let index = 0; index < bytes.length; index += 3) {
      const first = bytes[index]; const second = bytes[index + 1]; const third = bytes[index + 2];
      result += base64Alphabet[first >> 2];
      result += base64Alphabet[((first & 3) << 4) | (second === undefined ? 0 : second >> 4)];
      result += second === undefined ? '=' : base64Alphabet[((second & 15) << 2) | (third === undefined ? 0 : third >> 6)];
      result += third === undefined ? '=' : base64Alphabet[third & 63];
    }
    return result;
  }
  function base64Decode(value) {
    const text = utilityText(value, 'pm.encoding.base64Decode').replace(/[ \t\r\n]/g, '');
    if (text.length === 0) { return ''; }
    if (text.length % 4 !== 0 || /[-_]/.test(text) || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) { throw new Error('Invalid Base64 input.'); }
    const firstPad = text.indexOf('=');
    if (firstPad >= 0 && text.slice(firstPad) !== '=' && text.slice(firstPad) !== '==') { throw new Error('Invalid Base64 input.'); }
    const bytes = [];
    for (let index = 0; index < text.length; index += 4) {
      const first = base64Alphabet.indexOf(text[index]); const second = base64Alphabet.indexOf(text[index + 1]);
      const third = text[index + 2] === '=' ? 0 : base64Alphabet.indexOf(text[index + 2]);
      const fourth = text[index + 3] === '=' ? 0 : base64Alphabet.indexOf(text[index + 3]);
      if (first < 0 || second < 0 || third < 0 || fourth < 0) { throw new Error('Invalid Base64 input.'); }
      bytes.push((first << 2) | (second >> 4));
      if (text[index + 2] !== '=') { bytes.push(((second & 15) << 4) | (third >> 2)); }
      if (text[index + 3] !== '=') { bytes.push(((third & 3) << 6) | fourth); }
    }
    return bytesToUtf8(bytes);
  }
  function uuidV4() {
    if (uuidPool.length === 0) { throw new Error('UUID utility pool exhausted for this script.'); }
    return uuidPool.shift();
  }

  const uuidPool = arrayIsArray(input.uuidPool) ? arrayMap.call(input.uuidPool, primitiveText) : [];
  const request = cloneRequest(input.request);
  const responseInput = input.response;
  const responseData = responseInput ? (() => {
    const value = nullObject();
    value.status = responseInput.status;
    value.statusText = primitiveText(responseInput.statusText);
    value.headers = nullObject();
    if (responseInput.headers && typeof responseInput.headers === 'object') {
      const headerNames = objectKeys(responseInput.headers);
      for (let index = 0; index < headerNames.length; index += 1) { value.headers[headerNames[index]] = primitiveText(responseInput.headers[headerNames[index]]); }
    }
    value.body = primitiveText(responseInput.body);
    return value;
  })() : undefined;
  const response = responseData ? (() => {
    const value = nullObject();
    value.status = responseData.status;
    value.statusText = responseData.statusText;
    value.headers = nullObject();
    const headerNames = objectKeys(responseData.headers);
    for (let index = 0; index < headerNames.length; index += 1) { value.headers[headerNames[index]] = responseData.headers[headerNames[index]]; }
    value.body = responseData.body;
    value.json = () => jsonParse(value.body);
    return value;
  })() : undefined;

  const pmResponse = responseData ? (() => {
    const value = nullObject();
    value.code = responseData.status;
    value.status = responseData.statusText;
    value.headers = nullObject();
    value.headers.get = (name) => {
      const lookup = primitiveText(name).toLowerCase();
      const names = objectKeys(responseData.headers);
      for (let index = 0; index < names.length; index += 1) { if (names[index].toLowerCase() === lookup) { return responseData.headers[names[index]]; } }
      return undefined;
    };
    value.text = () => responseData.body;
    value.json = () => jsonParse(responseData.body);
    value.to = nullObject(); value.to.have = nullObject();
    value.to.have.status = (expected) => { if (responseData.status !== expected) { throw new Error('Expected response status ' + string(expected) + ', received ' + string(responseData.status) + '.'); } };
    return value;
  })() : undefined;

  const utilityApi = nullObject();
  utilityApi.crypto = nullObject(); utilityApi.crypto.sha256 = sha256; utilityApi.crypto.hmacSha256 = hmacSha256;
  utilityApi.encoding = nullObject(); utilityApi.encoding.base64Encode = base64Encode; utilityApi.encoding.base64Decode = base64Decode;
  utilityApi.uuid = uuidV4; utilityApi.time = nullObject(); utilityApi.time.unix = () => Math.floor(Date.now() / 1000); utilityApi.time.unixMs = () => Date.now();

  const pm = nullObject();
  pm.request = request; pm.response = pmResponse; pm.environment = envApi; pm.variables = envApi; pm.test = test; pm.expect = expectation;
  pm.crypto = utilityApi.crypto; pm.encoding = utilityApi.encoding; pm.uuid = utilityApi.uuid; pm.time = utilityApi.time;
  const globals = { console: logger, request, response, env: envApi, test, expect: expectation, assert: (condition, message) => { if (!condition) { throw new Error(message || 'Assertion failed'); } }, pm };
  const globalNames = objectKeys(globals);
  for (let index = 0; index < globalNames.length; index += 1) {
    Object.defineProperty(globalThis, globalNames[index], { value: globals[globalNames[index]], writable: true, configurable: true, enumerable: true });
  }

  function snapshot() {
    const output = nullObject();
    output.request = snapshotRequest(request);
    output.envVariables = envToList();
    output.state = state;
    return jsonStringify(output);
  }

  let executionState = 'idle';
  let executionErrorMessage = '';
  function markExecutionStarted() { executionState = 'running'; }
  function captureExecutionError(error) {
    executionState = 'capturing';
    try {
      executionErrorMessage = safeLogValue(error);
      executionState = 'captured';
    } catch {
      executionErrorMessage = 'Unknown script error';
      executionState = 'captured';
    }
  }
  function markAwaitingMicrotasks() {
    if (executionState === 'running') { executionState = 'awaiting'; }
  }
  function readExecutionState() {
    const output = nullObject();
    output.state = executionState;
    output.message = executionErrorMessage;
    return jsonStringify(output);
  }
  Object.defineProperty(globalThis, '__tessraMarkExecutionStarted', { value: markExecutionStarted, writable: false, configurable: false, enumerable: false });
  Object.defineProperty(globalThis, '__tessraCaptureExecutionError', { value: captureExecutionError, writable: false, configurable: false, enumerable: false });
  Object.defineProperty(globalThis, '__tessraMarkAwaitingMicrotasks', { value: markAwaitingMicrotasks, writable: false, configurable: false, enumerable: false });
  Object.defineProperty(globalThis, '__tessraReadExecutionState', { value: readExecutionState, writable: false, configurable: false, enumerable: false });
  Object.defineProperty(globalThis, '__tessraSnapshot', { value: snapshot, writable: false, configurable: false, enumerable: false });
  delete globalThis.__tessraBootstrapInput;
})();`;
}
