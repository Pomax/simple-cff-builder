var utils = require("../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;

"use strict";

var dictionaryStructure = dataBuilding.encoder.types.map(function(record) {
  return [record, "CFF." + record, record];
});

var DICT = function(input) {
	if(!this.parse(input)) {
    input = input || {};
    this.usedFields = Object.keys(input);
    this.fill(input);
    this.finalise();
	}
};

DICT.prototype = new struct("CFF DICT", dictionaryStructure);

DICT.prototype.finalise = function() {
  this.use(this.usedFields);
}

module.exports = DICT;
