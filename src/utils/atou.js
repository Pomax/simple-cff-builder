// This works mainly because the ANSI range 0x00-0xFF
// as the equivalent UTF16 code range 0x0000-0x00FF.

"use strict";
var nullByte = String.fromCharCode(0);

module.exports = function atou(v) {
  var a = v.split(''), o = [];
  a.forEach(function(v) { o.push(nullByte); o.push(v); });
  return o.join('');
};
