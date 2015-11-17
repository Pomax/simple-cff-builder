var utils = require("../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;

"use strict";

var LangSysTable = function(input) {
  this.features = [];
  if(!this.parse(input)) {
    input = input || {};
    input.ReqFeatureIndex = input.ReqFeatureIndex || 0xFFFF;
    var features = input.features;
    delete input.features;
    this.fill(input);
    if(features) {
      this.features = features;
      this.FeatureCount = features.length;
    }
  }
};

LangSysTable.prototype = new struct("LangSysTable", [
    ["LookupOrder",     "PADDING2",  "reserved value. Because why not"]
  , ["ReqFeatureIndex", "USHORT",  "the one required feature that must always be enabled, or 0xFFFF if there are none"]
  , ["FeatureCount",    "USHORT",  "Number of FeatureIndex values for this language system, excluding the required one"]
  , ["FeatureIndex",    "LITERAL", "The indices of all the features that should be used, from the feature list (USHORT[featurecount])"]
]);

LangSysTable.prototype.finalise = function() {
  var data = [];
  this.features.forEach(function(_,i) {
    data = data.concat(dataBuilding.encoder.USHORT(i));
  });
  this.FeatureIndex = data;
};

module.exports = LangSysTable;
