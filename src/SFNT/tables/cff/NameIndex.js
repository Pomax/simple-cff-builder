var INDEX = require("./INDEX");
var utils = require("../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;

"use strict";

var encode = dataBuilding.encoder.CHARARRAY;

var NameIndex = function(names) {
  INDEX.call(this);
  var self = this;
  names.forEach(function(name) {
    self.addItem(encode(name));
  });
  this.setName("NameIndex");
}

NameIndex.prototype = Object.create(INDEX.prototype);

module.exports = NameIndex;
