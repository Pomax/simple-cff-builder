var dataBuilding = require("./dataBuilding");
var GlyphID = dataBuilding.encoder.GlyphID;

module.exports = function asGlyphIDs(v) {
	return GlyphID(v.charCodeAt(0));
};
