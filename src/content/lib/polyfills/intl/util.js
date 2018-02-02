/* eslint-disable */

// We use this a lot (and need it for proto-less objects)
export const hop = Object.prototype.hasOwnProperty;

// Naive defineProperty for compatibility
export const defineProperty = Object.defineProperty;

// Array.prototype.indexOf, as good as we need it to be
export const arrIndexOf = Array.prototype.indexOf || function (search) {
    /*jshint validthis:true */
    let t = this;
    if (!t.length)
        return -1;

    for (let i = arguments[1] || 0, max = t.length; i < max; i++) {
        if (t[i] === search)
            return i;
    }

    return -1;
};

// Create an object with the specified prototype (2nd arg required for Record)
export const objCreate = Object.create || function (proto, props) {
    let obj;

    function F() {}
    F.prototype = proto;
    obj = new F();

    for (let k in props) {
        if (hop.call(props, k))
            defineProperty(obj, k, props[k]);
    }

    return obj;
};

// Snapshot some (hopefully still) native built-ins
export const arrSlice  = Array.prototype.slice;
export const arrPush   = Array.prototype.push;
export const arrJoin   = Array.prototype.join;

// Helper functions
// ================

/**
 * An ordered list
 */
export function List() {
    defineProperty(this, 'length', { writable:true, value: 0 });

    if (arguments.length)
        arrPush.apply(this, arrSlice.call(arguments));
}
List.prototype = objCreate(null);

/**
 * Mimics ES5's abstract ToObject() function
 */
export function toObject (arg) {
    if (arg === null)
        throw new TypeError('Cannot convert null or undefined to object');

    if (typeof arg === 'object')
        return arg;
    return Object(arg);
}

export function toNumber (arg) {
    if (typeof arg === 'number')
        return arg;
    return Number(arg);
}
export function toInteger (arg) {
  let number = toNumber(arg);
  if (isNaN(number))
      return 0;
  if (number === +0 ||
      number === -0 ||
      number === +Infinity ||
      number === -Infinity)
      return number;
  if (number < 0)
      return Math.floor(Math.abs(number)) * -1;
  return Math.floor(Math.abs(number));
}

export function toLength (arg) {
  let len = toInteger(arg);
  if (len <= 0)
      return 0;
  if (len === Infinity)
      return Math.pow(2, 53) - 1;
  return Math.min(len, Math.pow(2, 53) - 1);
}
