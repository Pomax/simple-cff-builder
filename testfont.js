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
    // set up our initial [angle, ox, oy] values:
    " 3.14159, random, mul, 350 350",

    "   0    0 rotate() move()",
    "   0  700 rotate() line()",
    " 700    0 rotate() line()",
    "   0 -700 rotate() line()",
    "-700    0 rotate() line()",

    " 100  100 rotate() move()",
    " 500    0 rotate() line()",
    "   0  500 rotate() line()",
    "-500    0 rotate() line()",
    "   0 -500 rotate() line()",

    // clean up [angle, ox, oy]:
    " drop, drop, drop",

    "endchar"
  ].join(" "));

  var font = SFNT.build(options);
  SFNT.utils.addStyleSheet(font, "customfont", "custom");

  // show the gsubs region in the CFF block
  SFNT.utils.buildTables(font.stub["CFF "]["global subroutines"], window, "#cffgsubr", false, false, false, true);

  // add a download link for easy debugging
  var a = document.createElement("a");
  a.href = font.toDataURL();
  a.textContent = "download font as .otf";
  a.download = "font.otf";
  document.body.appendChild(a);
}

var schedule = ["sin", "cos", "rotate", "move", "line"];
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
