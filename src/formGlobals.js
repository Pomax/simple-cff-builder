var utils = require('./utils');
var convertOutline = utils.convertOutline;

"use strict";

module.exports = function(options) {

  // ensure we have all the necessary globals
  var glyphCode = "~".charCodeAt(0);
  var globals = {
      outline: options.outline || ""
    , charString: options.charString || false
    , vendorId: " =) "
    , fontFamily: options.fontFamily || "Custom"
    , subFamily: options.subFamily || "Regular"
    , fontName: options.fontName || "Custom Glyph Font"
    , postscriptName: options.postscriptName || "customfont"
    , fontVersion: options.fontVersion || "Version 1.0"
    , copyright: options.copyright || "License-free"
    , trademark: options.trademark || "Trademark-free"
    , license: options.license || "License-free"
    , glyphName: options.glyphName || "~"
    , glyphCode: glyphCode
    , quadSize: options.quadSize || 1024
    , label: options.label || false
    , identifier: options.identifier || "-"
    , minimal: options.minimal !== "undefined" ? options.minimal : false
    , compliant: options.compliant !== "undefined" ? options.compliant : true
    , letters: (function(globals, glyphCode) {
        var letters = ["~"];
        if(globals.label) {
          letters = [];
          globals.label.split('').forEach(function(l) {
            if(letters.indexOf(l) === -1) {
              letters.push(l);
            }
          });
          letters.push(String.fromCharCode(glyphCode));
          letters.sort();
        }
        return letters;
      }(options, glyphCode))
    , subroutines: options.subroutines,
    xMin: options.xMin || false,
    yMin: options.yMin || false,
    xMax: options.xMax || false,
    yMax: options.yMax || false
  };

  // Turn the SVG outline into a charstring,
  // and ensure correct bounding values.
  globals.charString = convertOutline(globals);

	return globals;
};