var INDEX = require("./INDEX");
var dataBuilding = require("../../../utils").dataBuilding;

"use strict";

var encode = dataBuilding.encoder.CHARARRAY;

var CharStringIndex = function(letters, charstrings) {
  var self = this;
  INDEX.call(this);
  this.setName("CharStringIndex");

  // The .notdef character - for simplicity,
  // this has no outline at all.
  this.addItem(dataBuilding.encoder.OPERAND(14));

  // Real letters
  letters.forEach(function(letter, idx) {
    self.addItem(charstrings[letter]);
  });

  this.finalise();
}

CharStringIndex.prototype = Object.create(INDEX.prototype);

module.exports = CharStringIndex;
