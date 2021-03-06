var utils = require("../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;

"use strict";

var FeatureTable = function(input) {
  this.lookups = [];
  if(!this.parse(input)) {
    input = input || {};
    this.lookups = input.lookups;
    delete input.lookups;
    this.fill(input);
  }
};

FeatureTable.prototype = new struct("FeatureTable", [
    ["FeatureParams", "PADDING2", "reserved"]
  , ["LookupCount",   "USHORT",   "The number of lookups used in this feature"]
  , ["LookupListIndex", "LITERAL", "USHORT[lookupcount] of indices in the lookup list"]
]);

FeatureTable.prototype.finalise = function(idx) {
  this.LookupCount = this.lookups.length;
  var data = []
  this.lookups.forEach(function(v){
    data = data.concat(dataBuilding.encoder.OFFSET(v.lookupListIndex));
  });
  this.LookupListIndex = data;
  this.featureListIndex = idx;
};

module.exports = FeatureTable;
