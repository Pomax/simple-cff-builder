(function() {
  "use strict";

  var type2 = new Type2();

  var customFunctions = [
      "offset"
    , "sin"
    , "cos"
    , "rotate"
    , "move"
    , "line"
    , "rotable"
  ];

  var loader = new Loader(type2, customFunctions);

  function buildRotatedFont(angle, charstrings) {
    charstrings["alphabet"] = loader.charstring([angle, "rotable"]);
    charstrings["rectangle"] = loader.charstring([angle, "rotable"]);
    return charstrings;
  }

  function buildFont() {
    var subroutines = type2.getSubroutines();
    var charstrings = loader.getCharstrings(type2);
    var angle = 0.1;
    var rotated = buildRotatedFont(angle, charstrings);

    var substitutions = loader.getSubstitutions();
    var font = loader.buildFontObject(rotated, subroutines, substitutions);

    // Show the gsubrs region in the CFF block:
    SFNT.utils.buildTables(font.stub["CFF "]["global subroutines"], window, "#cffgsubr", false, false, false, true);

    // And add a download link for easy debugging, for good measure.
    var a = document.getElementById("download");
    a.href = font.toDataURL();
    a.download = "font.otf";
  }

  loader.handleSheets(buildFont);
}());
