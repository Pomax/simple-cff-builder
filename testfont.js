(function() {
  "use strict";

  var type2 = new Type2();
  var customFunctions = ["default"];
  var loader = new Loader(type2, customFunctions);

  function buildPlainFont(charstrings) {
    charstrings["alphabet"] = loader.charstring(["default"]);
    charstrings["rectangle"] = loader.charstring(["default"]);
    return charstrings;
  }

  function buildFont() {
    var subroutines = type2.getSubroutines();
    var charstrings = loader.getCharstrings(type2);
    var plain = buildPlainFont(charstrings);

    var substitutions = loader.getSubstitutions();
    var font = loader.buildFontObject(plain, subroutines, substitutions);

    // Show the OpenType GSUB table:
    SFNT.utils.buildTables(font.stub["GSUB"], window, "#gsub", false, false, false, true);

    // Build a CSS stylesheet that loads the font as base64-encoded WOFF resource:
    SFNT.utils.addStyleSheet(font, "customfont", "custom");

    // how big is this font?
    var binary = font.toData();
    var fsize = document.querySelector(".fsize");
    fsize.textContent = binary.length;
  }


  loader.handleSheets(buildFont);
}());
