function fetch(url, onload, onerror) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, false);
  xhr.overrideMimeType("text/plain; charset=x-user-defined");
  xhr.onload = function() { onload(xhr.response); };
  xhr.onerror = onerror;
  xhr.send(null);
}

var Loader = function(type2, customFunctions) {
  this.type2 = type2;
  this.customFunctions = customFunctions;
};

Loader.prototype = {
  handleSheet: function (response, onDone) {
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
    var bytes = this.type2.toBytes(parts[1]);
    this.type2.bindSubroutine(name, bytes);
    this.handleSheets(onDone);
  },


  handleSheets: function(onDone) {
    if (this.customFunctions.length === 0) {
      return onDone();
    }
    var thing = this.customFunctions.splice(0,1)[0];
    fetch('./subroutines/program.'+thing+'.type2', function(response) {
      this.handleSheet(response, onDone)
    }.bind(this));
  },

  charstring: function(arr) {
    return this.type2.toBytes(arr.join(" "));
  },


  getCharstrings: function() {
    var charstrings = {};
    var first = 0x41, last = 0x5A;
    for (var i=first; i<last; i++) {
      charstrings[String.fromCharCode(i)] = this.charstring(["endchar"]);
    }
    return charstrings;
  },

  getSubstitutions: function() {
    return {
      "A,B,C": "alphabet",
      "R,E,C,T,A,N,G,L,E": "rectangle"
    };
  },

  buildFontObject: function(charstrings, subroutines, substitutions) {
    // find out the font's global bounding box
    var type2 = this.type2;
    var dims = Object.keys(charstrings)
               .map(function(v) { return charstrings[v]; })
               .map(function(v) { return type2.getBounds(v, subroutines); });
        dims = dims.reduce(function(a,b) {
                 return {
                   xMin: a.xMin < b.xMin ? a.xMin : b.xMin,
                   yMin: a.yMin < b.yMin ? a.yMin : b.yMin,
                   xMax: a.xMax > b.xMax ? a.xMax : b.xMax,
                   yMax: a.yMax > b.yMax ? a.yMax : b.yMax
                 };
               }, dims[0]);

    // For now we hardcode the font's bbox, but we could also just
    // run through all the charstrings for that information, instead.
    var options = dims;
    options.rsb = 0;
    options.charstrings = charstrings;
    options.subroutines = subroutines;
    options.substitutions = substitutions;

    // Right: build that font!
    return SFNT.build(options);
  }
};
