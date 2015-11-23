"use strict";

var customFunctions = [
    "sin"
  , "cos"
  , "rotate"
  , "move"
  , "line"
];

function buildFont() {
  var options = {
    xMin: -100,
    yMin: -100,
    xMax: 800,
    yMax: 800,
    glyphName: "A",
    label: false,
    minimal: false,
    subroutines: Type2Convert.getSubroutines()
  };

  options.charString = [].concat(
    Type2Convert.toBytes([
/*
      // rotation angle
      "0.15",
      // rotation origin
      "0 0",
*/

      // rotated 700/700 box
      "    0    0 rmoveto",
      "    0  700 rlineto",
      "  700    0 rlineto",
      "    0 -700 rlineto",
      " -700    0 rlineto",

      "  100  100 rmoveto",
      "  500    0 rlineto",
      "    0  500 rlineto",
      " -500    0 rlineto",
      "    0 -500 rlineto",
/*
      // cleanup angle and origin
      " drop drop drop",
*/
      "endchar"
    ].join(" "))
  );

  console.log(options.charString);

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

function fetch(url, onload, onerror) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, false);
  xhr.overrideMimeType("text/plain; charset=x-user-defined");
  xhr.onload = function() { onload(xhr.response); };
  xhr.onerror = onerror;
  xhr.send(null);
}

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

function handleSheets() {
  if (customFunctions.length === 0) return buildFont();
  var thing = customFunctions.splice(0,1)[0];
  fetch('./subroutines/program.'+thing+'.type2', handleSheet);
};

handleSheets();
