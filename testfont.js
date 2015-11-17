"use strict";

function buildFont() {
  var options = {
    xMin: 0,
    yMin: 0,
    xMax: 700,
    yMax: 700,
    label: "custom",
    minimal: false,
    subroutines: Type2Convert.getSubroutines()
  };

  options.charString = Type2Convert.toBytes([
    "   0    0 rmoveto",
    "   0  700 rlineto",
    " 700    0 rlineto",
    "   0 -700 rlineto",
    "-700    0 rlineto",

    " 100  100 rmoveto",
    " 500    0 rlineto",
    "   0  500 rlineto",
    "-500    0 rlineto",
    "   0 -500 rlineto",

    "endchar"
  ].join(" "));

  var font = SFNT.build(options);
  SFNT.utils.addStyleSheet(font, "customfont", "custom");
  SFNT.utils.buildTables(font.stub["CFF "]["global subroutines"], window, "#cffgsubr", false, false, false, true);
}

var schedule = ["sin", "cos", "rotate"];
var pending = schedule.length;

function fetch(url, onload, onerror) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, false);
  xhr.onload = function() {
    onload(xhr.response);
  };
  xhr.onerror = onerror;
  xhr.send(null);
}

function handleSheet(response) {
  var parts = response.split("\n")
                      .map(function(f) { return f.replace(/\/\/.*$/,'').trim(); })
                      .filter(function(f) { return !!f; })
                      .join(" ")
                      .split(":")
                      .map(function(f) { return f.trim(); });
  var name = parts[0];
    var bytes = Type2Convert.toBytes(parts[1]);
    Type2Convert.bindSubroutine(name, bytes);
    pending--;
    if (pending===0) {
      buildFont();
    }
}

schedule.forEach(function(thing) {
  fetch('./subroutines/program.'+thing+'.type2', handleSheet);
});
