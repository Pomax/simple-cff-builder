var DICT = require("./DICT");

"use strict";

var PrivateDict = function(input) {
	DICT.call(this, input);
this.setName("PrivateDict");
}

PrivateDict.prototype = Object.create(DICT.prototype);

module.exports = PrivateDict;
