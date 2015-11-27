var utils = require("../../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;
var LigatureTable = require("./LigatureTable");

"use strict";

var LigatureSet = function(input) {
  this.tables = [];
  if(!this.parse(input)) {
    input = input || {};
    this.LigatureCount = 0;
    this.fill(input);
  }
};

LigatureSet.prototype = new struct("LigatureSet", [
    ["LigatureCount",   "USHORT",  "Number of Ligature tables in this set"]
  , ["LigatureOffsets", "LITERAL", "Array of USHORT offsets to Ligature tables, from beginning of the LigatureSet; assumed ordered by preference"]
  , ["Ligatures",       "LITERAL", ""]
]);

LigatureSet.prototype.addLigatureTable = function(options) {
  var table = new LigatureTable(options);
  this.tables.push(table);
  return table;
}

LigatureSet.prototype.finalise = function() {
  var ligatures = [],
      llen = 0,
      offsets = [];
  this.LigatureCount = this.tables.length;
// console.log("pre:", offsets.slice(), llen);
  this.tables.forEach(function(v,idx) {
    v.finalise();
    ligatures.push(v);
    offsets.push(llen);
// console.log("during:", offsets.slice(), llen);
    llen += v.sizeOf();
  });
// console.log("post:", offsets.slice(), llen);
  this.Ligatures = ligatures;
  offsets = offsets.map(function(v) {
    return v + 2 + 2*offsets.length;
  });
// console.log("mapped:", offsets.slice(), llen);
  var data = []
  offsets.forEach(function(v) {
    data = data.concat(dataBuilding.encoder.USHORT(v));
  });
  this.LigatureOffsets = data;
};

module.exports = LigatureSet;
