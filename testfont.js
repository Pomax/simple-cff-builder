"use strict";


/**
 * ...
 */
var customFunctions = [
    "default"
  , "sin"
  , "cos"
  , "rotate"
  , "move"
  , "line"
];


/**
 * A simple utility function for forming charstrings
 */
var charstring = function(arr) {
  return Type2Convert.toBytes(arr.join(" "));
}


/**
 * ...
 */
function buildFont() {
  // Get the global subroutines, fixing the bias to its true value.
  // This must be done before forming "real" charstrings for each letter.
  var subroutines = Type2Convert.getSubroutines();

  // Let's support A through Z for now. Without outlines.
  var charstrings = {};
  var first = 0x41, last = 0x5A;
  for (var i=first; i<last; i++) {
    charstrings[String.fromCharCode(i)] = charstring(["endchar"]);
  }

  // And let's add two ligatures, because we can.
  // First, the targets:
  charstrings["alphabet"] = charstring(["default"]);
  charstrings["rectangle"] = charstring(["default"]);

  // And then, the substitution rules:
  var substitutions = {
    "A,B,C": "alphabet",
    "R,E,C,T,A,N,G,L,E": "rectangle"
  };

  // For now we hardcode the font's bbox, but we could also just
  // run through all the charstrings for that information, instead.
  var options = {
    xMin:    0,
    yMin: -100,
    xMax:  730,
    yMax:  600,
    charstrings: charstrings,
    subroutines: subroutines,
    substitutions: substitutions
  };

  // Right: build that font!
  var font = SFNT.build(options);

  // Show the gsubrs region in the CFF block:
  SFNT.utils.buildTables(font.stub["CFF "]["global subroutines"], window, "#cffgsubr", false, false, false, true);

  // Show the OpenType GSUB table:
  SFNT.utils.buildTables(font.stub["GSUB"], window, "#gsub", false, false, false, true);

  // Build a CSS stylesheet that loads the font as base64-encoded WOFF resource:
  SFNT.utils.addStyleSheet(font, "customfont", "custom");

  // And add a download link for easy debugging, for good measure.
  var a = document.getElementById("download");
  a.href = font.toDataURL();
  a.download = "font.otf";
}


/**
 * ...
 */
function fetch(url, onload, onerror) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, false);
  xhr.overrideMimeType("text/plain; charset=x-user-defined");
  xhr.onload = function() { onload(xhr.response); };
  xhr.onerror = onerror;
  xhr.send(null);
}


/**
 * ...
 */
function handleSheet(response) {
  var parts = response.split("\n")
                      .map(function(f) {
                        return f.replace(/\/\/.*$/,'')
                                .replace(/#.*$/,'')
                                .trim();
                      })
                      .filter(function(f) { return !!f; })
                      .join(" ")
                      .split(":")
                      .map(function(f) { return f.trim(); });
  var name = parts[0];
  var bytes = Type2Convert.toBytes(parts[1]);
  Type2Convert.bindSubroutine(name, bytes);
  handleSheets();
}

/**
 * ...
 */
function handleSheets() {
  if (customFunctions.length === 0) return buildFont();
  var thing = customFunctions.splice(0,1)[0];
  fetch('./subroutines/program.'+thing+'.type2', handleSheet);
};

/**
 * ...
 */
handleSheets();
