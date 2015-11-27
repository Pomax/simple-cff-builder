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
  // get the global subroutines, fixing the bias to its true value
  var globalSubroutines = Type2Convert.getSubroutines();

  /**
   * Let's support A through Z for now. Without outlines.
   */
  var cmap = {};
  var first = 0x41, last = 0x5A;
  for (var i=first; i<last; i++) {
    cmap[String.fromCharCode(i)] = charstring(["endchar"]);
  }

  /**
   * And let's add two ligatures, because we can.
   */
  cmap["a"] = charstring(["default"]);
  cmap["r"] = charstring(["default"]);

  var GSUB = {
    "A,B,C": "a",
    "R,E,C,T,A,N,G,L,E": "r"
  };

  var options = {
    xMin: 0,
    yMin: 0,
    xMax: 700,
    yMax: 700,
    charstrings: cmap,
    subroutines: globalSubroutines,
    substitutions: GSUB
  };

  var font = SFNT.build(options);

  // show the gsubs region in the CFF block
  SFNT.utils.buildTables(font.stub["CFF "]["global subroutines"], window, "#cffgsubr", false, false, false, true);

  // build CSS stylesheet
  SFNT.utils.addStyleSheet(font, "customfont", "custom");

  // add a download link for easy debugging
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
