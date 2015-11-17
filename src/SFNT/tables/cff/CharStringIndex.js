var INDEX = require("./INDEX");
var dataBuilding = require("../../../utils").dataBuilding;

"use strict";

var encode = dataBuilding.encoder.CHARARRAY;

var CharStringIndex = function(letters, charString) {
  var self = this;
  INDEX.call(this);
  this.setName("CharStringIndex");
  // .notdef
  this.addItem(dataBuilding.encoder.OPERAND(14));
  // all letters except the "real" letters
  letters.forEach(function(letter, idx) {
    if(idx < letters.length - 1) {
      self.addItem(dataBuilding.encoder.OPERAND(14));
    }
  });
  // and then our true glyph
  this.addItem(charString);
  this.finalise();
}

CharStringIndex.prototype = Object.create(INDEX.prototype);

module.exports = CharStringIndex;
