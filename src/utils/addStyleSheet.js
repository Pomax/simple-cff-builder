var toDataURL = require("./toDataURL");

module.exports = function addStyleSheet(font, fontFamily, className) {
  // set up the .otf and .woff rules
  fontFamily = fontFamily || "custom font";
  var dataurl_otf = toDataURL("font", font);
  var dataurl_woff = toDataURL("woff", font);
  var fontface = ["@font-face {\n  font-family: '" + fontFamily + "';"
                 , "  src: url('" +dataurl_otf+ "') format('opentype'),"
                 , "       url('" +dataurl_woff+ "') format('woff');"
                 , "}"].join("\n");

  // without this, Chrome and IE fail to render GSUB ligatures
  var cssClass = [""
    , "." + className + " {"
    , "  font-family: '" + fontFamily + "';"
    , "  -webkit-font-feature-settings: 'liga';"
    , "  -moz-font-feature-settings: 'liga=1';"
    , "  -moz-font-feature-settings: 'liga';"
    , "  -ms-font-feature-settings: 'liga' 1;"
    , "  -o-font-feature-settings: 'liga';"
    , "  font-feature-settings: 'liga';"
    , "}"].join("\n");
  fontface += cssClass;

  // inject stylesheet
  var sheet = document.createElement("style");
  sheet.innerHTML = fontface;
  document.head.appendChild(sheet);
};
