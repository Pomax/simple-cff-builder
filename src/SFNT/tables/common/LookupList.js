var utils = require("../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;
var LookupTable = require("./LookupTable");

"use strict";

var LookupList = function(input) {
  this.tables = [];
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

LookupList.prototype = new struct("LookupList", [
    ["LookupCount",  "USHORT",  "number of lookups in the list"]
  , ["LookupOffsets", "LITERAL", "Array of offsets to the Lookup tables, from beginning of LookupList"]
  , ["LookupTables", "LITERAL", "the list of lookups"]
]);

LookupList.prototype.addLookup = function(options) {
  var table = new LookupTable(options);
  this.tables.push(table);
  return table;
}

LookupList.prototype.finalise = function() {
  this.LookupCount = this.tables.length;
  var lookuptables = [];
  var offsets = [];
  var offset = 2 + this.tables.length * 2; // USHORT values
  this.tables.forEach(function(t,idx) {
    offsets = offsets.concat(dataBuilding.encoder.USHORT(offset));
    t.finalise(idx);
    lookuptables.push(t);
    offset += t.toData().length;
  });
  this.LookupOffsets = offsets;
  this.LookupTables = lookuptables;
}

module.exports = LookupList;
