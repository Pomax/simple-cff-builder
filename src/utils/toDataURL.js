var asChars = require("./asChars");
var toWOFF = require("./toWOFF");

module.exports = function toDataURL(type, font) {
   if (type === "woff") {
    var mime_woff = "application/font-woff";
    return "data:" + mime_woff + ";base64," + btoa(toWOFF(font).map(asChars).join(''));
   }
   var mime_otf = "font/opentype";
   return "data:" + mime_otf + ";base64," + btoa(font.toData().map(asChars).join(''));
};
