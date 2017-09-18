{assert} = require "chai"
{deepEqual, range, strictEqual} = assert

{JSUtils} = require "lib/utils/javascript"

describe "JSUtils", ->
  it "arrayIncludes()", ->
    {arrayIncludes} = JSUtils

    strictEqual arrayIncludes(["a", "b"], "a"), true
    strictEqual arrayIncludes(["a", "b"], "b"), true
    strictEqual arrayIncludes(["a", "b"], "c"), false

    strictEqual arrayIncludes([0], 0), true
    strictEqual arrayIncludes([0], "0"), false

  it "leftRotateArray()", ->
    {leftRotateArray} = JSUtils

    deepEqual leftRotateArray([1, 2, 3], 0), [1, 2, 3]
    deepEqual leftRotateArray([1, 2, 3], 1), [2, 3, 1]
    deepEqual leftRotateArray([1, 2, 3], 2), [3, 1, 2]
    deepEqual leftRotateArray([1, 2, 3], 3), [1, 2, 3]
    deepEqual leftRotateArray([1, 2, 3], 4), [2, 3, 1]

  it "test_range()", ->
    {range} = JSUtils

    deepEqual range(0), []
    deepEqual range(4), [0, 1, 2, 3]
    deepEqual range(6), [0, 1, 2, 3, 4, 5]
    deepEqual range(-1), []
