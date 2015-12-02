var utils = require('./utils');

"use strict";

module.exports = function(options) {
    console.log(options);

  var defaultQuad = 1024;

  var globals = {
      minimal: options.minimal !== "undefined" ? options.minimal : false
    , compliant: options.compliant !== "undefined" ? options.compliant : true

    // builder metadata
    , quadSize: options.quadSize || defaultQuad
    , identifier: options.identifier || "-"

    // GSUB magic?
    , substitutions: options.substitutions || false

    // Name table information
    , fontFamily: options.fontFamily || "Custom"
    , subFamily: options.subFamily || "Regular"
    , fontName: options.fontName || "Custom Glyph Font"
    , postscriptName: options.postscriptName || "customfont"
    , fontVersion: options.fontVersion || "Version 1.0"
    , copyright: options.copyright || "Free of copyright"
    , trademark: options.trademark || "Free of trademarks"
    , license: options.license || "License free"
    , vendorId: " =) "

    // cmap/charstring information
    , letters: Object.keys(options.charstrings || {}).sort()
    , charstrings: options.charstrings
    , subroutines: options.subroutines

    // font master bounding box
    , xMin: options.xMin || 0
    , yMin: options.yMin || 0
    , xMax: options.xMax || defaultQuad
    , yMax: options.yMax || defaultQuad

    // font default left/right side bearings
    , lsb: options.lsb || 0
    , rsb: options.rsb || 0
  };

  return globals;
};