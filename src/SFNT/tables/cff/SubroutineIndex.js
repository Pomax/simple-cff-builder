var INDEX = require("./INDEX");
var utils = require("../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;

"use strict";

var SubroutineIndex = function(input) {
  INDEX.call(this, input);
  this.setName("SubroutineIndex");
};

SubroutineIndex.prototype = Object.create(INDEX.prototype);

module.exports = SubroutineIndex;
