var utils = require("../../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;

"use strict";

var LigatureTable = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.Components = input.Components || [];
    input.CompCount = 1 + input.Components.length;
    this.fill(input);
  }
};

LigatureTable.prototype = new struct("LigatureTable", [
    ["LigGlyph",   "GlyphID",  "our target 'to show' ligature glyph"]
  , ["CompCount",  "USHORT",   "Number of components (=glyphs) involved in this ligature"]
  , ["Components", "LITERAL",  "GlyphID[compcount-1], list all the component glyphids in sequence, except for the first (which comes from the coverage table)"]
]);

LigatureTable.prototype.finalise = function() {
  var data = [];
  this.Components.forEach(function(v) {
    data = data.concat(dataBuilding.encoder.GlyphID(v));
  });
  this.Components = data;
};

module.exports = LigatureTable;
