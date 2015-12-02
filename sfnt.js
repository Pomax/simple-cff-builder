(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.SFNT = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

var SFNT = require('./SFNT/SFNT');
var formGlobals = require('./formGlobals');
var utils = require('./utils');
var asChars = utils.asChars;
var asGlyphIDs = utils.asGlyphIDs;
var addLabelSubstitution = require("./utils/addLabelSubstitution");

module.exports = {
  utils: utils,

  build: function (options) {
    var sfnt = new SFNT();
    var font = sfnt.stub;
    var globals = formGlobals(options);

    /**
     * Font header
     */
    font.head = new font.head({
      unitsPerEM: globals.quadSize,
      xMin: globals.xMin,
      yMin: globals.yMin,
      xMax: globals.xMax,
      yMax: globals.yMax,
    });


    /**
     * Horizontal metrics header table
     */
    font.hhea = new font.hhea({
      Ascender: globals.quadSize + globals.yMin,
      Descender: -(globals.quadSize - globals.yMax),
      advanceWidthMax: globals.xMax - globals.xMin,
      xMaxExtent: globals.xMax - globals.xMin,
      numberOfHMetrics: globals.letters ? 1 + globals.letters.length : 2
    });


    /**
     * Horizontal metrics table
     */
    font.hmtx = new font.hmtx(globals, font.hhea.numberOfHMetrics);


    /**
     * Max profiles - CFF does not use these, which we indicate by
     * using a table version 0.5
     */
    font.maxp = new font.maxp({
      version: 0x00005000,
      numGlyphs: globals.letters ? 1 + globals.letters.length : 2
    });


    /**
     * The name table
     *
     * - to have a font be windows installable, we need strings 1, 2, 3, and 6.
     * - to have a font be OSX installable, we need strings 1, 2, 3, 4, 5, and 6.
     * - to have a font be webfont-usable, we just need strings 1 and 2.
     *
     * (OTS may be patched at some point to not even check the name table at
     *  all, at which point we don't have to bother generating it for webfonts)
     */
    font.name = new font.name(globals);


    /**
     * The OS/2 table
     */
    font["OS/2"] = new font["OS/2"]({
      // we use version 3, so we can pass Microsoft's "Font Validator"
      version: 0x0003,
      // we implement part of the basic latin unicode block
      // FIXME: this should be based on the globals.letters list
      ulUnicodeRange1: 0x00000001,
      achVendID: globals.vendorId,
      usFirstCharIndex: globals.label ? globals.letters[0].charCodeAt(0) : globals.glyphCode,
      usLastCharIndex: globals.glyphCode,
      // vertical metrics: see http://typophile.com/node/13081 for how the hell these work.
      // (short version: they don't, it's an amazing mess)
      sTypoAscender: globals.yMax,
      sTypoDescender: globals.yMin,
      sTypoLineGap: globals.quadSize - globals.yMax + globals.yMin,
      usWinAscent: globals.quadSize + globals.yMin,
      usWinDescent: (globals.quadSize - globals.yMax),
      // we implement part of the latin1 codepage
      // FIXME: this should also be based on the globals.letters list
      ulCodePageRange1: 0x00000001,
      // we have no break char, but we must point to a "not .notdef" glyphid to
      // validate as "legal font". Normally this would be the 'space' glyphid.
      usBreakChar: globals.glyphCode,
      // We have plain + ligature use, therefore the max length of
      // all contexts are simply the length of our substitution label,
      // if we have one, or otherwise zero.
      usMaxContext: globals.substitutions !== false ? Object.keys(globals.substitutions).length : 0
    });


    /**
     * The post table -- this table should not be necessary for
     * webfonts, but for now must be included for the font to be legal.
     */
    font.post = new font.post();


    /**
     * The character map for this font, using a cmap
     * format 4 subtable for our implemented glyphs.
     */
    font.cmap = new font.cmap({ version: 0 });
    font.cmap.addTable({ format: 4, letters: globals.letters });
    font.cmap.finalise();


    /**
     * The CFF table for this font. This is, ironically,
     * the actual font, rather than a million different
     * bits of metadata *about* the font and its glyphs.
     *
     * It's also the most complex bit (closely followed
     * by the GSUB table for ligature substitution), which
     * is why the CFF table isn't actually a struct, but
     * a somewhat different bytecode generator.
     *
     * It works, it just works a little different from
     * everything else.
     */
    font["CFF "] = new font["CFF "](globals);


    /**
     * Finally, if there were  "substitutions", we need some GSUB
     * magic. Note: this stuff is complex. Like, properly, which
     * is why it's wrapped by a function, rather than being a simple
     * few constructor options. Seriously, GSUB is voodoo black magic.
     */
    if(globals.substitutions) {
      font.GSUB = new font.GSUB(globals);
      addLabelSubstitution(font, globals);
    }

    // we're done.
    return sfnt;
  }
};

},{"./SFNT/SFNT":3,"./formGlobals":62,"./utils":76,"./utils/addLabelSubstitution":64}],2:[function(require,module,exports){
var struct = require("../utils").struct;

"use strict";

var DirectoryEntry = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

DirectoryEntry.prototype = new struct("DirectoryEntry", [
    ["tag",      "CHARARRAY", "4-byte identifier"]
  , ["checkSum", "ULONG", "sum-as-ULONGs for this table"]
  , ["offset",   "ULONG", "offset to this table from the beginning of the file"]
  , ["length",   "ULONG", "length of the table (without padding) in bytes"]
]);

module.exports = DirectoryEntry;

},{"../utils":76}],3:[function(require,module,exports){
var tables = require("./tables");
var SFNTHeader = require("./SFNTHeader");
var DirectoryEntry = require("./DirectoryEntry");

var utils = require('../utils');
var dataBuilding = utils.dataBuilding;
var Mapper = utils.Mapper;
var nodeBuilder = utils.nodeBuilder;

"use strict";

var header = SFNTHeader("CFF");

var SFNT = function(type) {
  this.stub = {
    BASE:   tables.BASE,
    "CFF ": tables.CFF,
    GDEF:   tables.GDEF,
    GPOS:   tables.GPOS,
    GSUB:   tables.GSUB,
    JSTF:   tables.JSTF,
    "OS/2": tables.OS_2,
    cmap:   tables.cmap,
    head:   tables.head,
    hhea:   tables.hhea,
    hmtx:   tables.hmtx,
    maxp:   tables.maxp,
    name:   tables.name,
    post:   tables.post
  };
  this.header = new header();
  this.fontStructs = false;
};

SFNT.prototype = {
  toString: function() {
    return JSON.stringify(this.toJSON(), false, 2);
  },
  toJSON: function() {
    var self = this,
        obj = {};
    Object.keys(this.stub).forEach(function(tag) {
      if(self.stub[tag].toJSON) {
        obj[tag] = self.stub[tag].toJSON();
      }
    });
    return obj;
  },
  toHTML: function() {
    if(!this.fontStructs) {
      this.toData();
    }

    var self = this,
        obj = nodeBuilder.create("div"),
        font = this.stub,
        directory = this.fontStructs.directory,
        keys;
    obj.setAttribute("class", "SFNT");

    obj.appendChild(this.header.toHTML());

    var dHTML = nodeBuilder.create("div");
    dHTML.setAttribute("class", "Directory");
    keys = Object.keys(directory),
    keys.forEach(function(tag) {
      dHTML.appendChild(directory[tag].toHTML());
    });
    obj.appendChild(dHTML);

    var tHTML = nodeBuilder.create("div");
    tHTML.setAttribute("class", "Tables");
    keys = Object.keys(font),
    keys.forEach(function(tag) {
      if (font[tag].toHTML) {
        tHTML.appendChild(font[tag].toHTML());
      }
    });
    obj.appendChild(tHTML);

    return obj;
  },
  toDataURL: function() {
    return utils.toDataURL("font", this);
  },
  toData: function() {
    var self = this,
        tags = {},
        dataBlocks = {};

    // form data blocks and table directory
    Object.keys(this.stub).forEach(function(tag) {
      if(self.stub[tag].toData) {
        var tagStruct = new DirectoryEntry();
        tags[tag] = tagStruct;
        tagStruct.tag = tag;
        dataBlocks[tag] = self.stub[tag].toData();
        tagStruct.length = dataBlocks[tag].length;
        while(dataBlocks[tag].length % 4 !== 0) { dataBlocks[tag].push(0); }
        tagStruct.checkSum = dataBuilding.computeChecksum(dataBlocks[tag]);
        // offset is computed when we actually fix the block locations in the file
      }
    });

    var header = this.header;
    header.version = "OTTO";

    // fill in the header values that are based on the number of tables
    var log2 = function(v) { return (Math.log(v) / Math.log(2)) | 0; }
    var numTables = Object.keys(tags).length;
    header.numTables = numTables;
    var highestPowerOf2 = Math.pow(2, log2(numTables));
    var searchRange = 16 * highestPowerOf2;
    header.searchRange = searchRange;
    header.entrySelector = log2(highestPowerOf2);
    header.rangeShift = numTables * 16 - searchRange;
    var headerBlock = header.toData();

    // optimise table data block ordering, based on the
    // "Optimized Table Ordering" section on
    // http://www.microsoft.com/typography/otspec140/recom.htm
    var sorted = Object.keys(tags).sort(),
        offsets = {},
        block_offset = headerBlock.length + header.numTables * 16,
        dataBlock = [],
        preferred = (function getOptimizedTableOrder(sorted) {
          var preferred = ["head", "hhea", "maxp", "OS/2", "name", "cmap", "post", "CFF "],
              filtered = sorted.filter(function(v) {
                return preferred.indexOf(v) === -1;
              }),
              keys = preferred.concat(filtered);
          return keys;
        }(sorted));

    preferred.forEach(function(tag) {
      if(dataBlocks[tag]) {
        offsets[tag] = block_offset + dataBlock.length;
        dataBlock = dataBlock.concat(dataBlocks[tag]);
      }
    });

    // Then, finalise and write out the directory block:
    var directoryBlock = [];
    sorted.forEach(function(tag) {
      if(tags[tag]) {
        tags[tag].offset = offsets[tag];
        directoryBlock = directoryBlock.concat(tags[tag].toData());
      }
    });

    // And then assemble the final font data into one "file",
    // making sure the checkSumAdjustment value in the <head>
    // table is based on the final serialized font data.
    var font = headerBlock.concat(directoryBlock).concat(dataBlock);
    var checksum = dataBuilding.computeChecksum(font);
    var checkSumAdjustment = 0xB1B0AFBA - checksum;
    this.stub.head.checkSumAdjustment = checkSumAdjustment;

    // the data layout in this font can now be properly mapped,
    // if the user wants to call the getMappings() function.
    this.fontStructs = {
      header: header,
      directoryOrder: sorted,
      directory: tags,
      tableOrder: preferred
    };

    // return the font with the correct checksumadjustment.
    return font.slice(0, offsets["head"] + 8)
               .concat(dataBuilding.encoder.ULONG(checkSumAdjustment))
               .concat(font.slice(offsets["head"] + 12));
  },
  getMapper: function() {
    if(this.fontStructs === false) return false;
    var mapper = new Mapper();
    var self = this;
    var offset = 0, mark = 0;

    this.fontStructs.header.toData(offset, mapper);
    offset = mapper.last().end;
    mapper.addMapping(mark, {
      name: "SFNT header",
      length: offset - mark,
      structure: self.fontStructs.header.toJSON()
    });

    this.fontStructs.directoryOrder.forEach(function(tag) {
      mark = offset
      self.fontStructs.directory[tag].toData(offset, mapper);
      offset = mapper.last().end;
      mapper.addMapping(mark, {
        name: tag + " directory",
        length: offset - mark,
        structure: self.fontStructs.directory[tag].toJSON()
      });
    });

    this.fontStructs.tableOrder.forEach(function(tag) {
      mark = offset;
      self.stub[tag].toData(offset, mapper);
      offset = mapper.last().end;
      mapper.addMapping(mark, {
        name: tag + " table",
        length: offset - mark,
        structure: self.stub[tag].toJSON()
      });
      while(offset % 4 !== 0) { offset++; }
    });

    mapper.sort();
    return mapper;
  }
};

module.exports = SFNT;

},{"../utils":76,"./DirectoryEntry":2,"./SFNTHeader":4,"./tables":5}],4:[function(require,module,exports){
var struct = require("../utils").struct;

"use strict";

module.exports = function(type) {

  var SFNTHeader = function(input) {
    if(!this.parse(input)) {
      input = input || {};
      this.fill(input);
    }
  };

  SFNTHeader.prototype = new struct("SFNT header", [
      ["version", type === "CFF" ? "CHARARRAY" : "FIXED", "either 0x0001000 for TTF, or 'OTTO' for CFF"]
    , ["numTables",     "USHORT", "number of tables in this font"]
    , ["searchRange",   "USHORT", "(Maximum power of 2 <= numTables) x 16"]
    , ["entrySelector", "USHORT", "Log2(maximum power of 2 <= numTables)"]
    , ["rangeShift",    "USHORT", "NumTables x 16-searchRange"]
  ]);

  return SFNTHeader;
};

},{"../utils":76}],5:[function(require,module,exports){
"use strict";

module.exports = {
  CFF:  require("./tables/CFF_"),
  cmap: require("./tables/cmap"),
  head: require("./tables/head"),
  hhea: require("./tables/hhea"),
  hmtx: require("./tables/hmtx"),
  maxp: require("./tables/maxp"),
  name: require("./tables/name"),
  OS_2: require("./tables/OS_2"),
  post: require("./tables/post"),
  GSUB: require("./tables/GSUB"),
  GPOS: require("./tables/GPOS"),
  GDEF: require("./tables/GDEF"),
  JSTF: require("./tables/JSTF"),
  BASE: require("./tables/BASE")
};

},{"./tables/BASE":6,"./tables/CFF_":7,"./tables/GDEF":8,"./tables/GPOS":9,"./tables/GSUB":10,"./tables/JSTF":11,"./tables/OS_2":12,"./tables/cmap":24,"./tables/head":52,"./tables/hhea":53,"./tables/hmtx":54,"./tables/maxp":56,"./tables/name":57,"./tables/post":61}],6:[function(require,module,exports){
var utils = require("../../utils");
var struct = utils.struct;

"use strict";

var BASE = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

BASE.prototype = new struct("BASE table", [
  //...
]);

module.exports = BASE;

},{"../../utils":76}],7:[function(require,module,exports){
var utils = require("../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;
var asHex = utils.asHex;
var CFFHeader = require("./cff/CFFHeader");
var NameIndex = require("./cff/NameIndex");
var StringIndex = require("./cff/StringIndex");
var TopDictIndex = require("./cff/TopDictIndex");
var SubroutineIndex = require("./cff/SubroutineIndex");
var Charset = require("./cff/Charset");
var Encoding = require("./cff/Encoding");
var CharStringIndex = require("./cff/CharStringIndex");
var PrivateDict = require("./cff/PrivateDict");

"use strict";


// Hook up the charset, encoding, charstrings and private dict offsets.
// we need to do this iteratively because setting their values may change
// the sizeOf for the top dict, and thus the offsets *after* the top dict.
// Hurray.
function fixTopDictIndexOffsets(baseSize, topDictIndex, charset, encoding, charStringIndex, privateDict) {
  var ch_off, en_off, cs_off, pd_off, o_ch_off, o_en_off, o_cs_off, o_pd_off, base, pd_size = privateDict.sizeOf();
  // "old" values
  o_ch_off = o_en_off = o_cs_off = o_pd_off = -1;
  // "current" values
  ch_off = en_off = cs_off = pd_off = 0;
  while(ch_off !== o_ch_off && en_off !== o_en_off && cs_off !== o_cs_off && pd_off !== o_pd_off) {
    o_ch_off = ch_off; o_en_off = en_off; o_cs_off = cs_off; o_pd_off = pd_off;
    base = baseSize + topDictIndex.sizeOf();
    ch_off = base;
    en_off = ch_off + charset.sizeOf();
    cs_off = en_off + encoding.sizeOf();
    pd_off = cs_off + charStringIndex.sizeOf();
    topDictIndex.set("charset", ch_off);
    topDictIndex.set("Encoding", en_off);
    topDictIndex.set("CharStrings", cs_off);
    topDictIndex.set("Private", [pd_size, pd_off]);
    topDictIndex.finalise();
  }
}


var CFF = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);

    this.header = new CFFHeader({
      major: 1,
      minor: 0,
      offSize: 1
    });

    var nameIndex = new NameIndex([
      input.postscriptName
    ]);
    this["name index"] = nameIndex;

    // because the top dict needs to know about string index values,
    // as well as offsets to other bits of the CFF, it gets declared
    // last, despite technicaly "living" here in terms of CFF byte layout.

    var stringIndex = new StringIndex([
      input.fontVersion,
      input.fontName,
      input.fontFamily
    ].concat(input.letters));
    this["string index"] = stringIndex;

    // we break up the charstring such that the initial rmoveto
    // and associated coordinates are bound as a global subroutine
    var globalSubroutines = new SubroutineIndex();
    this["global subroutines"] = globalSubroutines;

    // bind user-supplied global subroutines, if we have them.
    if (input.subroutines) {
      var routines = Object.keys(input.subroutines);
      routines.forEach(function(name, pos) {
        var code = input.subroutines[name];
        globalSubroutines.addItem(code);
      });
    }

    var charset = new Charset(stringIndex, input);
    this["charset"] = charset;

    var encoding = new Encoding(input);
    this["encoding"] = encoding;

    var charStringIndex = new CharStringIndex(input.letters, input.charstrings);
    this["charstring index"] = charStringIndex;

    var privateDict = new PrivateDict({
        "BlueValues":  [0, 0]
      , "FamilyBlues": [0, 0]
      , "StdHW": 10
      , "StdVW": 10
      , "defaultWidthX": input.xMax
      , "nominalWidthX": input.xMax
    });
    this["private dict"] = privateDict;

    var topDictIndex = new TopDictIndex({
        "version":     stringIndex.getStringId(input.fontVersion)
      , "FullName":    stringIndex.getStringId(input.fontName)
      , "FamilyName":  stringIndex.getStringId(input.fontFamily)
      , "Weight":      389     // CFF-predefined string "Roman"
      , "UniqueID":    1       // really this just has to be 'anything'
      , "FontBBox":    [input.xMin, input.yMin, input.xMax, input.yMax]
      , "charset":     0       // placeholder for offset to charset block, from the beginning of the CFF file
      , "Encoding":    0       //          "   "            encoding block               "    "
      , "CharStrings": 0       //          "   "            charstrings block            "    "
      , "Private":     [0, 0]  // sizeof,  "   "            private dict block           "    "
    });
    this["top dict index"] = topDictIndex;

    var baseSize = this.header.sizeOf() + nameIndex.sizeOf() + stringIndex.sizeOf() + globalSubroutines.sizeOf();
    fixTopDictIndexOffsets(baseSize, topDictIndex, charset, encoding, charStringIndex, privateDict);
  }
};

CFF.prototype = new struct("CFF ", [
    ["header",             "LITERAL", "the CFF header"]
  , ["name index",         "LITERAL", "the name index for this font"]
  , ["top dict index",     "LITERAL", "the global font dict"]
  , ["string index",       "LITERAL", "the strings used in this font (there are 390 by-spec strings already)"]
  , ["global subroutines", "LITERAL", "the global subroutines that all charstrings can use"]
  , ["charset",            "LITERAL", "the font's character set"]
  , ["encoding",           "LITERAL", "the encoding information for this font"]
  , ["charstring index",   "LITERAL", "the charstring definition for all encoded glyphs"]
  , ["private dict",       "LITERAL", "the private dicts; each dict maps a partial font."]
]);

module.exports = CFF;

},{"../../utils":76,"./cff/CFFHeader":13,"./cff/CharStringIndex":14,"./cff/Charset":15,"./cff/Encoding":17,"./cff/NameIndex":19,"./cff/PrivateDict":20,"./cff/StringIndex":21,"./cff/SubroutineIndex":22,"./cff/TopDictIndex":23}],8:[function(require,module,exports){
var utils = require("../../utils");
var struct = utils.struct;

"use strict";

var GDEF = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

GDEF.prototype = new struct("GDEF table", [
  //...
]);

module.exports = GDEF;

},{"../../utils":76}],9:[function(require,module,exports){
var utils = require("../../utils");
var struct = utils.struct;

"use strict";

var GPOS = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

GPOS.prototype = new struct("GPOS table", [
  //...
]);

module.exports = GPOS;

},{"../../utils":76}],10:[function(require,module,exports){
var utils = require("../../utils");
var struct = utils.struct;
var ScriptList = require("./common/ScriptList");
var FeatureList = require("./common/FeatureList");
var LookupList = require("./common/LookupList");
var LangSysTable = require("./common/LangSysTable");

"use strict";

var GSUB = function(input) {
  this.scripts  = new ScriptList();
  this.features = new FeatureList();
  this.lookups  = new LookupList();

  if(!this.parse(input)) {
    input = input || {};
    input.version = input.version || 0x00010000;
    input.ScriptListOffset = 10; // scriptlist starts immediately after the GSUB header
    this.fill(input);
  }
};

GSUB.prototype = new struct("GSUB table", [
    // GSUB header is four fields
    ["version",           "FIXED",  "Version of the GSUB table; initially set to 0x00010000"]
  , ["ScriptListOffset",  "OFFSET", "Offset to ScriptList table, from beginning of GSUB table"]
  , ["FeatureListOffset", "OFFSET", "Offset to FeatureList table, from beginning of GSUB table"]
  , ["LookupListOffset",  "OFFSET", "Offset to LookupList table, from beginning of GSUB table"]
    // and then the actual data
  , ["ScriptList",        "LITERAL", "the ScriptList object for this table"]
  , ["FeatureList",       "LITERAL", "the FeatureList object for this table"]
  , ["LookupList",        "LITERAL", "the LookupList object for this table"]
]);

GSUB.prototype.addScript = function(options) {
  return this.scripts.addScript(options)
};

GSUB.prototype.addFeature = function(options) {
  return this.features.addFeature(options);
};

GSUB.prototype.addLookup = function(options) {
  return this.lookups.addLookup(options);
};

GSUB.prototype.makeLangSys = function(options) {
  return new LangSysTable(options);
}

// finalise in reverse order: first the lookup list,
// then the feature list, then the script list.
GSUB.prototype.finalise = function() {
  this.lookups.finalise();
  this.LookupList = this.lookups;
  this.features.finalise();
  this.FeatureList = this.features;
  this.scripts.finalise();
  this.ScriptList  = this.scripts;
  this.FeatureListOffset = this.ScriptListOffset + this.ScriptList.toData().length;
  this.LookupListOffset = this.FeatureListOffset + this.FeatureList.toData().length;
}

module.exports = GSUB;

},{"../../utils":76,"./common/FeatureList":39,"./common/LangSysTable":46,"./common/LookupList":47,"./common/ScriptList":49}],11:[function(require,module,exports){
var utils = require("../../utils");
var struct = utils.struct;

"use strict";

var JSTF = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

JSTF.prototype = new struct("JSTF table", [
  //...
]);

module.exports = JSTF;

},{"../../utils":76}],12:[function(require,module,exports){
var utils = require("../../utils");
var struct = utils.struct;

"use strict";

var OS_2 = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.xAvgCharWidth = input.xAvgCharWidth || 0;
    input.usWeightClass = input.usWeightClass || 400;
    input.usWidthClass = input.usWidthClass || 1;
    // standard font = font classification 0 ("Regular")
    input.sFamilyClass= input.sFamilyClass || 0;
    input.fsType = input.fsType || 0;
    // font selection flag: bit 6 (lsb=0) is high, to indicate 'regular font'
    input.fsSelection = input.fsSelection || 0x0040;
    // we don't really care about the sub/super/strikeout values:
    input.ySubscriptXSize = input.ySubscriptXSize || 0;
    input.ySubscriptYSize = input.ySubscriptYSize || 0;
    input.ySubscriptXOffset = input.ySubscriptXOffset || 0;
    input.ySubscriptYOffset = input.ySubscriptYOffset || 0;
    input.ySuperscriptXSize = input.ySuperscriptXSize || 0;
    input.ySuperscriptYSize = input.ySuperscriptYSize || 0;
    input.ySuperscriptXOffset = input.ySuperscriptXOffset || 0;
    input.ySuperscriptYOffset = input.ySuperscriptYOffset || 0;
    input.yStrikeoutSize = input.yStrikeoutSize || 0;
    input.yStrikeoutPosition = input.yStrikeoutPosition || 0;
    // Oh look! A trademarked classification system the bytes
    // for which cannot be legally set unless you pay HP.
    // Why this is part of the OS/2 table instead of its own
    // proprietary table I will likely never truly know.
    input.bFamilyType = input.bFamilyType || 0;
    input.bSerifStyle = input.bSerifStyle || 0;
    input.bWeight = input.bWeight || 0;
    input.bProportion = input.bProportion || 0;
    input.bContrast = input.bContrast || 0;
    input.bStrokeVariation = input.bStrokeVariation || 0;
    input.bArmStyle = input.bArmStyle || 0;
    input.bLetterform = input.bLetterform || 0;
    input.bMidline = input.bMidline || 0;
    input.bXHeight = input.bXHeight || 0;
    input.ulUnicodeRange1 = input.ulUnicodeRange1 || 0;
    input.ulUnicodeRange2 = input.ulUnicodeRange2 || 0;
    input.ulUnicodeRange3 = input.ulUnicodeRange3 || 0;
    input.ulUnicodeRange4 = input.ulUnicodeRange4 || 0;
    input.ulCodePageRange1 = input.ulCodePageRange1 || 0;
    input.ulCodePageRange2 = input.ulCodePageRange2 || 0;
    // We don't care all too much about the next 5 values, but they're
    // required for an OS/2 version 2, 3, or 4 table.
    input.sxHeight = input.sxHeight || 0;
    input.sCapHeight = input.sCapHeight ||  0;
    input.usDefaultChar = input.usDefaultChar || 0;
    this.fill(input);
    if(input.version < 2) {
     this.unset(["sxHeight","sCapHeight","usDefaultChar","usBreakChar","usMaxContext"]);
    }
  }
};

OS_2.prototype = new struct("OS/2 table", [
  ["version",             "USHORT",    "OS/2 table version"]
, ["xAvgCharWidth",       "SHORT",     "xAvgCharWidth"]
, ["usWeightClass",       "USHORT",    "usWeightClass"]
, ["usWidthClass",        "USHORT",    "usWidthClass"]
, ["fsType",              "USHORT",    "this value defines embedding/install properties. 0 = no restrictions"]
, ["ySubscriptXSize",     "SHORT",     ""]
, ["ySubscriptYSize",     "SHORT",     ""]
, ["ySubscriptXOffset",   "SHORT",     ""]
, ["ySubscriptYOffset",   "SHORT",     ""]
, ["ySuperscriptXSize",   "SHORT",     ""]
, ["ySuperscriptYSize",   "SHORT",     ""]
, ["ySuperscriptXOffset", "SHORT",     ""]
, ["ySuperscriptYOffset", "SHORT",     ""]
, ["yStrikeoutSize",      "SHORT",     ""]
, ["yStrikeoutPosition",  "SHORT",     ""]
, ["sFamilyClass",        "SHORT",     "a standard font has font classification 0 (meaning subfamily 'Regular')"]
, ["bFamilyType",         "BYTE",      ""] // panose classification, byte 1
, ["bSerifStyle",         "BYTE",      ""] // panose classification, byte 2
, ["bWeight",             "BYTE",      ""] // panose classification, byte 3
, ["bProportion",         "BYTE",      ""] // panose classification, byte 4
, ["bContrast",           "BYTE",      ""] // panose classification, byte 5
, ["bStrokeVariation",    "BYTE",      ""] // panose classification, byte 6
, ["bArmStyle",           "BYTE",      ""] // panose classification, byte 7
, ["bLetterform",         "BYTE",      ""] // panose classification, byte 8
, ["bMidline",            "BYTE",      ""] // panose classification, byte 9
, ["bXHeight",            "BYTE",      ""] // panose classification, byte 10
, ["ulUnicodeRange1",     "ULONG",     ""]
, ["ulUnicodeRange2",     "ULONG",     ""]
, ["ulUnicodeRange3",     "ULONG",     ""]
, ["ulUnicodeRange4",     "ULONG",     ""]
, ["achVendID",           "CHARARRAY", "vendor id (http://www.microsoft.com/typography/links/vendorlist.aspx for the 'real' list)"]
, ["fsSelection",         "USHORT",    "font selection flag: bit 6 (lsb=0) is high, to indicate 'regular font'."]
, ["usFirstCharIndex",    "USHORT",    "first character to be in this font."]
, ["usLastCharIndex",     "USHORT",    "last character to be in this font."]
  // for information on how to set the vertical metrics for a font, see
  // http://typophile.com/node/13081 for how the hell these work (it's quite amazing)
, ["sTypoAscender",       "SHORT",     "typographic ascender"]
, ["sTypoDescender",      "SHORT",     "typographic descender"]
, ["sTypoLineGap",        "SHORT",     "line gap"]
, ["usWinAscent",         "USHORT",    "usWinAscent"]
, ["usWinDescent",        "USHORT",    "usWinDescent"]
, ["ulCodePageRange1",    "ULONG",     ""]
, ["ulCodePageRange2",    "ULONG",     ""]
  // By using the following five records, this becomes an OS/2 version 2, 3, or 4 table, rather than version 1 ---
, ["sxHeight",            "SHORT",     ""]
, ["sCapHeight",          "SHORT",     ""]
, ["usDefaultChar",       "USHORT",    ""]
, ["usBreakChar",         "USHORT",    ""]
, ["usMaxContext",        "USHORT",    ""]
]);

module.exports = OS_2;

},{"../../utils":76}],13:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;

"use strict";

var CFFHeader = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.length = 4;
    this.fill(input);
    this.setName("CFFHeader");
  }
}

CFFHeader.prototype = new struct("CFF header", [
    ["major",   "Card8",   "major version"]
  , ["minor",   "Card8",   "minor version"]
  , ["length",  "Card8",   "header length in bytes"]
  , ["offSize", "OffSize", "how many bytes for an offset value?"]
]);

module.exports = CFFHeader;

},{"../../../utils":76}],14:[function(require,module,exports){
var INDEX = require("./INDEX");
var dataBuilding = require("../../../utils").dataBuilding;

"use strict";

var encode = dataBuilding.encoder.CHARARRAY;

var CharStringIndex = function(letters, charstrings) {
  var self = this;
  INDEX.call(this);
  this.setName("CharStringIndex");

  // The .notdef character - for simplicity,
  // this has no outline at all.
  this.addItem(dataBuilding.encoder.OPERAND(14));

  // Real letters
  letters.forEach(function(letter, idx) {
    self.addItem(charstrings[letter]);
  });

  this.finalise();
}

CharStringIndex.prototype = Object.create(INDEX.prototype);

module.exports = CharStringIndex;

},{"../../../utils":76,"./INDEX":18}],15:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;

"use strict";

// FIXME: technically this is only the format0 charset object

var Charset = function(stringIndex, input) {
  var glyphs = [];
  if(!this.parse(input)) {
    input = input || {};
    input.format = 0;
    input.letters = input.letters || [];
    this.fill(input);
    input.letters.forEach(function(letter) {
      var sid = stringIndex.getStringId(letter);
      var SID = dataBuilding.encoder.USHORT(sid);
      glyphs = glyphs.concat(SID);
    });
    this.glyphs = glyphs;
    this.setName("Charset");
  }
};

Charset.prototype = new struct("CFF charset", [
    ["format", "BYTE", ""]
  , ["glyphs", "LITERAL", "actually a USHORT[]."]
]);

module.exports =  Charset;

},{"../../../utils":76}],16:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;

"use strict";

var dictionaryStructure = dataBuilding.encoder.types.map(function(record) {
  return [record, "CFF." + record, record];
});

var DICT = function(input) {
	if(!this.parse(input)) {
    input = input || {};
    this.usedFields = Object.keys(input);
    this.fill(input);
    this.finalise();
	}
};

DICT.prototype = new struct("CFF DICT", dictionaryStructure);

DICT.prototype.finalise = function() {
  this.use(this.usedFields);
}

module.exports = DICT;

},{"../../../utils":76}],17:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;

"use strict";

// FIXME: technically this is only the format1 Encoding object

var Encoding = function(input) {
  var codes = [];
  if(!this.parse(input)) {
    input = input || {};
    input.format = 0;
    var codes = input.letters.map(function(v,idx) {
      return idx+1;
    });
    input.nCodes = codes.length;
    input.codes = codes;
    this.fill(input);
    this.setName("Encoding");
  }
};

Encoding.prototype = new struct("CFF Encoding", [
    ["format", "BYTE",    "encoding format"]
  , ["nCodes", "BYTE",    "..."]
  , ["codes",  "LITERAL", ""]
]);

module.exports = Encoding;

},{"../../../utils":76}],18:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;

"use strict";

var INDEX = function(input) {
  this.items = [];
  if(!this.parse(input)) {
    input = input || {};
    input.count = 0;
    this.fill(input);
  }
}

INDEX.prototype = new struct("CFF INDEX", [
    ["count",   "Card16",  "number of stored items"]
  , ["offSize", "OffSize", "how many bytes do offset values use in this index"]
  , ["offset",  "LITERAL", "depending on offSize, this is actually BYTE[], USHORT[], UINT24[] or ULONG[]. Note that offsets are relative to the byte *before* the data block, so the first offset is (almost always) 1, not 0."]
  , ["data",    "LITERAL", "the data block for this index"]
]);

INDEX.prototype.addItem = function(item) {
  this.items.push(item);
  this.count++;
  this.finalise();
};

INDEX.prototype.toJSON = function() {
  if(this.count === 0) {
    return { count: 0 };
  }
  return struct.prototype.toJSON.call(this);
};

INDEX.prototype.toHTML = function() {
  if(this.count === 0) {
    this.unset(["offSize", "offset", "data"]);
  }
  return struct.prototype.toHTML.call(this);
};

INDEX.prototype.toData = function(offset, mapper) {
  if(this.count === 0) {
    return [0,0];
  }
  return struct.prototype.toData.call(this, offset, mapper);
};

INDEX.prototype.sizeOf = function(fieldName) {
  if(this.count === 0) {
    return 2;
  }
  return struct.prototype.sizeOf.call(this, fieldName);
};

INDEX.prototype.finalise = function() {
  var self = this;

  if(this.count === 0) {
    return;
  }

  var data = [];
  this.items.forEach(function(item) {
    if (item.toData) {
      data = data.concat(item.toData());
    }
    else if(item instanceof Array) {
      data = data.concat(item);
    }
    else {
      data.push(item);
    }
  });
  this.data = data;
  var len = Math.max(1, data.length);

  var offSize = (1 + Math.floor(Math.log(len)/Math.log(2)) / 8) | 0,
      encode = dataBuilding.encoder.OffsetX[offSize],
      offset = 1,
      offsets = [],
      val = false;

  this.offSize = offSize;
  this.items.forEach(function(v) {
    val = encode(offset);
    offset += (v.toData ? v.toData() : v).length;
    offsets = offsets.concat(val);
  });
  offsets = offsets.concat(encode(offset));
  this.offset = offsets;
};

module.exports = INDEX;

},{"../../../utils":76}],19:[function(require,module,exports){
var INDEX = require("./INDEX");
var utils = require("../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;

"use strict";

var encode = dataBuilding.encoder.CHARARRAY;

var NameIndex = function(names) {
  INDEX.call(this);
  var self = this;
  names.forEach(function(name) {
    self.addItem(encode(name));
  });
  this.setName("NameIndex");
}

NameIndex.prototype = Object.create(INDEX.prototype);

module.exports = NameIndex;

},{"../../../utils":76,"./INDEX":18}],20:[function(require,module,exports){
var DICT = require("./DICT");

"use strict";

var PrivateDict = function(input) {
	DICT.call(this, input);
this.setName("PrivateDict");
}

PrivateDict.prototype = Object.create(DICT.prototype);

module.exports = PrivateDict;

},{"./DICT":16}],21:[function(require,module,exports){
var INDEX = require("./INDEX");
var utils = require("../../../utils");
var dataBuilding = utils.dataBuilding;

"use strict";

var encode = dataBuilding.encoder.CHARARRAY;

var StringIndex = function(names) {
  INDEX.call(this);
  this.setName("StringIndex");
  var self = this;
  names.forEach(function(name) {
    self.addItem(encode(name));
  });
  this.strings = names;
}

StringIndex.prototype = Object.create(INDEX.prototype);

// there are 390 predefined strings in CFF, so custom strings
// start at index 391, rather than index 0!
StringIndex.prototype.getStringId = function(string) {
  return 391 + this.strings.indexOf(string);
};

module.exports = StringIndex;

},{"../../../utils":76,"./INDEX":18}],22:[function(require,module,exports){
var INDEX = require("./INDEX");
var utils = require("../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;

"use strict";

var SubroutineIndex = function(input) {
  INDEX.call(this, input);
  this.setName("SubroutineIndex");
};

SubroutineIndex.prototype = Object.create(INDEX.prototype);

module.exports = SubroutineIndex;

},{"../../../utils":76,"./INDEX":18}],23:[function(require,module,exports){
var INDEX = require("./INDEX");
var DICT = require("./DICT");

"use strict";

var TopDictIndex = function(input) {
  INDEX.call(this);
  this.setName("TopDictIndex");
  this.topdict = new DICT(input);
  this.addItem(this.topdict);
}

TopDictIndex.prototype = Object.create(INDEX.prototype);

// used for setting the various offset values after all the data has been bound for the CFF table
TopDictIndex.prototype.set = function(field, v) {
	this.topdict[field] = v;
}

module.exports = TopDictIndex;

},{"./DICT":16,"./INDEX":18}],24:[function(require,module,exports){
var utils = require("../../utils");
var struct = utils.struct;
var EncodingRecord = require("./cmaps/EncodingRecord");
var subtables = require("./cmaps/subtables");

"use strict";

var cmap = function(input) {
  this.tables = [];
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
    this.numTables = 0;
  }
};

cmap.prototype = new struct("cmap table", [
    ["version", "USHORT", "cmap table version"]
  , ["numTables", "USHORT", "number of subtables"]
  , ["encodingRecords", "LITERAL", "array[numTables] of encoding records"]
  , ["subTables", "LITERAL", "the set of character map subtables"]
]);

cmap.prototype.addTable = function(options) {
  var subtable = new subtables[options.format](options);
  this.tables.push(subtable);
  this.numTables = this.numTables + 1;
};

cmap.prototype.finalise = function() {
  var encodingrecords = [];
  var offset = 4 + (this.numTables * 8); // sizeOf(EncodingRecord) is 8
  for(var i=0; i<this.numTables; i++) {
    encodingrecords.push(new EncodingRecord({
      platformID: 3,   // Windows
      encodingID: 1,   // Unicode BMP (UCS-2)
      offset: offset
    }));
    offset += this.tables[i].length;
  }
  this.subTables = this.tables;
  this.encodingRecords = encodingrecords;
};

module.exports = cmap;

},{"../../utils":76,"./cmaps/EncodingRecord":25,"./cmaps/subtables":37}],25:[function(require,module,exports){
var struct = require("../../../utils").struct;

"use strict";

var EncodingRecord = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

EncodingRecord.prototype = new struct("EncodingRecord", [
   ["platformID", "USHORT", "Platform ID"]
 , ["encodingID", "USHORT", "Platform-specific encoding ID"]
 , ["offset",     "ULONG",  "Byte offset from beginning of table to the subtable for this encoding"]
]);

module.exports = EncodingRecord;

},{"../../../utils":76}],26:[function(require,module,exports){
var struct = require("../../../utils").struct;

"use strict";

var format0 = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.format = 0;
    this.fill(input);
  }
};

format0.prototype = new struct("cmap format 0", [
  ["format", "USHORT", "subtable format"]
]);

module.exports = format0;

},{"../../../utils":76}],27:[function(require,module,exports){
var struct = require("../../../utils").struct;

"use strict";

var format10 = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.format = 10;
    this.fill(input);
  }
};

format10.prototype = new struct("cmap format 10", [
  ["format", "USHORT", "subtable format"]
]);

module.exports = format10;

},{"../../../utils":76}],28:[function(require,module,exports){
var struct = require("../../../utils").struct;

"use strict";

var format12 = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.format = 12;
    this.fill(input);
  }
};

format12.prototype = new struct("cmap format 12", [
  ["format", "USHORT", "subtable format"]
]);

module.exports = format12;

},{"../../../utils":76}],29:[function(require,module,exports){
var struct = require("../../../utils").struct;

"use strict";

var format13 = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.format = 13;
    this.fill(input);
  }
};

format13.prototype = new struct("cmap format 13", [
  ["format", "USHORT", "subtable format"]
]);

module.exports = format13;

},{"../../../utils":76}],30:[function(require,module,exports){
var struct = require("../../../utils").struct;

"use strict";

var format14 = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.format = 14;
    this.fill(input);
  }
};

format14.prototype = new struct("cmap format 14", [
	["format", "USHORT", "subtable format"]
]);

module.exports = format14;

},{"../../../utils":76}],31:[function(require,module,exports){
var struct = require("../../../utils").struct;

"use strict";

var format2 = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.format = 2;
    this.fill(input);
  }
};

format2.prototype = new struct("cmap format 2", [
  ["format", "USHORT", "subtable format"]
]);

module.exports = format2;

},{"../../../utils":76}],32:[function(require,module,exports){
var struct = require("../../../utils").struct;
var Segments  = require("./format4/Segments");

"use strict";

var format4 = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.language = 0;
    this.fill(input);
    this.build(input);
  }
};

format4.prototype = new struct("cmap format 4", [
  ["format",   "USHORT", "format 4 subtable"]
, ["length",   "USHORT", "table length in bytes"]
, ["language", "USHORT", "language"]
  // The following four values all derive from an implicitly
  // encoded value called "segCount", representing the number
  // of segments that this subtable format 4 cmap has.
  // Silly as it may seem, these values must be 100% correct,
  // and cannot, in any way, be omitted. This is a bit silly.
, ["segCountX2",    "USHORT", "2x segment count"]
, ["searchRange",   "USHORT", "search range: 2 * (2^floor(log2(segCount)))"]
, ["entrySelector", "USHORT", "entry selector: log2(searchRange/2)"]
, ["rangeShift",    "USHORT", "range shift: 2x segment count - search range"]
, ["endCount",      "LITERAL",  "the endcounts for each segment in this subtable"]
, ["reservedPad",   "PADDING2", "a 'reserve padding' value"]
, ["startCount",    "LITERAL",  "the startcounts for each segment in this subtable"]
, ["idDelta",       "LITERAL", ""]
, ["idRangeOffset", "LITERAL", ""]
, ["glyphIdArray",  "LITERAL", ""]
]);

/**
 * Build the segment-based subtable
 */
format4.prototype.build = function(options) {
  // first, form the basic segments
  var segments = new Segments();
  var codes = options.letters.map(function(l) { return l.charCodeAt(0); });
  codes.forEach(function(code) { segments.addSegment(code); })
  segments.finalise();

  // Now we can record the segCount administrative values
  var segCount = segments.data.length;
  this.segCountX2 = segCount * 2;
  this.searchRange = 2 * Math.pow(2, Math.floor(Math.log(segCount)/Math.log(2)));
  this.entrySelector = Math.log(this.searchRange/2)/Math.log(2);
  this.rangeShift = this.segCountX2 - this.searchRange;

  // then we can form the parallel segment data arrays
  var endCount = [],
      startCount = [],
      idDelta = [],
      idRangeOffset = [],
      glyphIdArray = [];

  segments.data.forEach(function(segment) {
    endCount = endCount.concat(segment.values["end"]);
    startCount = startCount.concat(segment.values["start"]);
    idDelta = idDelta.concat(segment.values["delta"]);
    idRangeOffset = idRangeOffset.concat(segment.values["offset"]);
    if(segment.values["glyphId"]) {
      glyphIdArray = glyphIdArray.concat(segment.values["glyphId"]);
    }
  });

  // and finally we can bind the parallel segment data arrays
  this.endCount = endCount;
  this.startCount = startCount;
  this.idDelta = idDelta;
  this.idRangeOffset = idRangeOffset;
  this.glyphIdArray = glyphIdArray;

  // set up the toString, toJSON, and toData functions.
  // FIXME: this shouldn't be necessary with properly written code.
  var names = ["endCount", "startCount", "idDelta", "idRangeOffset", "glyphIdArray"];
  [endCount, startCount, idDelta, idRangeOffset, glyphIdArray].forEach(function(arr,idx) {
    arr.toData = function(offset, mapper) {
      if(mapper) {
        offset = offset || 0;
        mapper.addMapping(offset, {
          name: "cmap format4:"+names[idx],
          length: arr.length
        });
      }
      return arr;
    };
    arr.toJSON = function() { return { data: arr.slice() }; };
    arr.toString = function() { return JSON.stringify(arr, false, 2); };
  });

  // And record the size of this subtable
  var fixed = 14 + 2,
      variable = endCount.length + startCount.length + idDelta.length + idRangeOffset.length + glyphIdArray.length;
  this.length = fixed + variable;
};

module.exports = format4;

},{"../../../utils":76,"./format4/Segments":36}],33:[function(require,module,exports){
var struct = require("../../../utils").struct;

"use strict";

var format6 = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.format = 6;
    this.fill(input);
  }
};

format6.prototype = new struct("cmap format 6", [
  ["format", "USHORT", "subtable format"]
]);

module.exports = format6;

},{"../../../utils":76}],34:[function(require,module,exports){
var struct = require("../../../utils").struct;

"use strict";

var format8 = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.format = 8;
    this.fill(input);
  }
};

format8.prototype = new struct("cmap format 8", [
  ["format", "USHORT", "subtable format"]
]);

module.exports = format8;

},{"../../../utils":76}],35:[function(require,module,exports){
var struct = require("../../../../utils").struct;

"use strict";

var Segment = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

Segment.prototype = new struct("Segment", [
	  ["end",     "USHORT", "end code for this segment"]
	, ["start",   "USHORT", "start code for this segment"]
	, ["delta",   "SHORT",  "delta to ensure continuous sequence wrt previous segments"]
	, ["offset",  "USHORT", "Offsets into glyphIdArray"]
	, ["glyphId", "USHORT", "Glyph index"]
]);

module.exports = Segment;

},{"../../../../utils":76}],36:[function(require,module,exports){
var utils = require("../../../../utils");
var dataBuilding = utils.dataBuilding;
var Segment = require("./Segment");

"use strict";
var encoder = dataBuilding.encoder;
var terminator = encoder.USHORT(0xFFFF);

var Segments = function() {
	this.data = [];
};

Segments.prototype = {
  addSegment: function(code) {
    var idx = this.data.length + 1;
    this.data.push(new Segment({
      end: code,
      start: code,
      delta: -(code - idx),
      offset: 0,
      glyphId: idx
    }));
  },
  finalise: function() {
    var terminator = new Segment({
      end: 0xFFFF,
      start: 0xFFFF,
      delta: 1,
      offset: 0
    });
    terminator.unset(["glyphId"]);
    this.data.push(terminator);
  }
};

module.exports = Segments;

},{"../../../../utils":76,"./Segment":35}],37:[function(require,module,exports){
module.exports = {
  0: require("./format.0.js"),
  2: require("./format.2.js"),
  4: require("./format.4.js"),
  6: require("./format.6.js"),
  8: require("./format.8.js"),
  10: require("./format.10.js"),
  12: require("./format.12.js"),
  13: require("./format.13.js"),
  14: require("./format.14.js")
};

},{"./format.0.js":26,"./format.10.js":27,"./format.12.js":28,"./format.13.js":29,"./format.14.js":30,"./format.2.js":31,"./format.4.js":32,"./format.6.js":33,"./format.8.js":34}],38:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;

"use strict";

/**
 * Format 1 encodes an, effectively, unordered list of glyphs
 */

var CoverageFormat1 = function(input) {
  if(!this.parse(glyphs)) {
    input = {
      CoverageFormat: 1,
      GlyphCount: input.length,
      GlyphArray: input.map(function(v) { return dataBuilding.encoder.GlyphID(v); })
    };
    this.fill(input);
  }
};

CoverageFormat1.prototype = new struct("Coverage format 1", [
    ["CoverageFormat", "USHORT",  "format 1"]
  , ["GlyphCount",     "USHORT",  "number of glyphs"]
  , ["GlyphArray",     "LITERAL", "array of glyphs covered by this table"]
]);



/**
 * Format 2 encodes sequential ranges of glyphs,
 * using range records.
 */

var RangeRecord = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.CoverageFormat = 2;
    this.fill(input);
  }
};

RangeRecord.prototype = new struct("RangeRecord", [
    ["Start",              "GlyphID", "First GlyphID in the range"]
  , ["End",                "GlyphID", "Last GlyphID in the range"]
  , ["StartCoverageIndex", "USHORT",  "Coverage Index of first GlyphID in range"]
]);

var CoverageFormat2 = function(input) {
  if(!this.parse(input)) {
    input = {
      CoverageFormat: 2,
      RangeCount: input.length,
      RangeRecords: input.map(function(glyph, idx) {
                      return new RangeRecord({
                        Start: glyph,
                        End: glyph,
                        StartCoverageIndex: idx
                      });
                    })
    }
    this.fill(input);
  }
};

CoverageFormat2.prototype = new struct("Coverage format 2", [
    ["CoverageFormat", "USHORT",  "format 1"]
  , ["RangeCount",     "USHORT",  "number of ranges"]
  , ["RangeRecords",   "LITERAL", "array of range records covered by this table"]
]);


// return a selection object based on the format
module.exports = {
  "1": CoverageFormat1,
  "2": CoverageFormat2
};

},{"../../../utils":76}],39:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;
var FeatureRecord = require("./FeatureRecord");
var FeatureTable = require("./FeatureTable");

"use strict";

var FeatureList = function(input) {
  this.pairs = [];
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

FeatureList.prototype = new struct("FeatureList", [
    ["FeatureCount",    "USHORT", "Number of features in this feature list"]
  , ["FeatureRecords",  "LITERAL", "Array of FeatureRecords; zero-based (first feature has FeatureIndex = 0), listed alphabetically by FeatureTag"]
  , ["FeatureTables",   "LITERAL", "the list of feature tables"]
]);

FeatureList.prototype.addFeature = function(options) {
  var featureRecord = new FeatureRecord({
    FeatureTag: options.FeatureTag
  });
  delete options.FeatureTag;
  var featureTable = new FeatureTable(options);
  this.pairs.push({
    record: featureRecord,
    table: featureTable,
    finalise: function(featureCount, idx, offset) {
      this.table.finalise(idx);
      this.record.Offset = 2 + featureCount * 6 + offset;
    }
  });
  return featureTable;
};

FeatureList.prototype.finalise = function() {
  var count = this.pairs.length;
  this.FeatureCount = count;
  this.pairs.sort(function(a,b) {
    return a.record.FeatureTag < b.record.FeatureTag ? -1 : 1;
  });
  var records = [],
      tables = [],
      offset = 0;
  this.pairs.forEach(function(p, idx) {
    p.finalise(count, idx, offset);
    records.push(p.record);
    tables.push(p.table);
    // FIXME: use a sizeOf
    offset += p.table.toData().length;
  });
  this.FeatureRecords = records;
  this.FeatureTables = tables;
};

module.exports = FeatureList;

},{"../../../utils":76,"./FeatureRecord":40,"./FeatureTable":41}],40:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;

"use strict";

var FeatureRecord = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

FeatureRecord.prototype = new struct("FeatureRecord", [
    ["FeatureTag", "CHARARRAY", "The feature name (4 characters)"]
  , ["Offset",     "OFFSET", "Offset to Feature table, from beginning of FeatureList"]
]);

module.exports = FeatureRecord;

},{"../../../utils":76}],41:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;

"use strict";

var FeatureTable = function(input) {
  this.lookups = [];
  if(!this.parse(input)) {
    input = input || {};
    this.lookups = input.lookups;
    delete input.lookups;
    this.fill(input);
  }
};

FeatureTable.prototype = new struct("FeatureTable", [
    ["FeatureParams", "PADDING2", "reserved"]
  , ["LookupCount",   "USHORT",   "The number of lookups used in this feature"]
  , ["LookupListIndex", "LITERAL", "USHORT[lookupcount] of indices in the lookup list"]
]);

FeatureTable.prototype.finalise = function(idx) {
  this.LookupCount = this.lookups.length;
  var data = []
  this.lookups.forEach(function(v){
    data = data.concat(dataBuilding.encoder.OFFSET(v.lookupListIndex));
  });
  this.LookupListIndex = data;
  this.featureListIndex = idx;
};

module.exports = FeatureTable;

},{"../../../utils":76}],42:[function(require,module,exports){
var utils = require("../../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;
var LigatureTable = require("./LigatureTable");

"use strict";

var LigatureSet = function(input) {
  this.tables = [];
  if(!this.parse(input)) {
    input = input || {};
    this.LigatureCount = 0;
    this.fill(input);
  }
};

LigatureSet.prototype = new struct("LigatureSet", [
    ["LigatureCount",   "USHORT",  "Number of Ligature tables in this set"]
  , ["LigatureOffsets", "LITERAL", "Array of USHORT offsets to Ligature tables, from beginning of the LigatureSet; assumed ordered by preference"]
  , ["Ligatures",       "LITERAL", ""]
]);

LigatureSet.prototype.addLigatureTable = function(options) {
  var table = new LigatureTable(options);
  this.tables.push(table);
  return table;
}

LigatureSet.prototype.finalise = function() {
  var ligatures = [],
      llen = 0,
      offsets = [];
  this.LigatureCount = this.tables.length;
// console.log("pre:", offsets.slice(), llen);
  this.tables.forEach(function(v,idx) {
    v.finalise();
    ligatures.push(v);
    offsets.push(llen);
// console.log("during:", offsets.slice(), llen);
    llen += v.sizeOf();
  });
// console.log("post:", offsets.slice(), llen);
  this.Ligatures = ligatures;
  offsets = offsets.map(function(v) {
    return v + 2 + 2*offsets.length;
  });
// console.log("mapped:", offsets.slice(), llen);
  var data = []
  offsets.forEach(function(v) {
    data = data.concat(dataBuilding.encoder.USHORT(v));
  });
  this.LigatureOffsets = data;
};

module.exports = LigatureSet;

},{"../../../../utils":76,"./LigatureTable":43}],43:[function(require,module,exports){
var utils = require("../../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;

"use strict";

var LigatureTable = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.Components = input.Components || [];
    input.CompCount = 1 + input.Components.length;
    this.fill(input);
  }
};

LigatureTable.prototype = new struct("LigatureTable", [
    ["LigGlyph",   "GlyphID",  "our target 'to show' ligature glyph"]
  , ["CompCount",  "USHORT",   "Number of components (=glyphs) involved in this ligature"]
  , ["Components", "LITERAL",  "GlyphID[compcount-1], list all the component glyphids in sequence, except for the first (which comes from the coverage table)"]
]);

LigatureTable.prototype.finalise = function() {
  var data = [];
  this.Components.forEach(function(v) {
    data = data.concat(dataBuilding.encoder.GlyphID(v));
  });
  this.Components = data;
};

module.exports = LigatureTable;

},{"../../../../utils":76}],44:[function(require,module,exports){
var utils = require("../../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;
var CoverageFormat = require("../CoverageFormat");
var LigatureSet = require("./LigatureSet");

"use strict";

var LookupType4 = function(input) {
  this.coveragetables = [];
  this.ligaturesets = [];
  if(!this.parse(input)) {
    input = input || {};
    input.SubstFormat = 1;
    this.fill(input);
  }
};

LookupType4.prototype = new struct("GSUB Lookup type 4", [
    ["SubstFormat",        "USHORT",  "lookup type 4 must be format 1"]
  , ["CoverageOffset",     "OFFSET",  "Offset to Coverage table, from beginning of Substitution table"]
  , ["LigSetCount",        "USHORT",  "Number of ligature sets"]
  , ["LigatureSetOffsets", "LITERAL", "Array of offsets to LigatureSet tables, from beginning of Substitution table; assumed ordered by Coverage Index"]
    // coverage data
  , ["CoverageTables",     "LITERAL", ""]
  , ["LigatureSetTables",  "LITERAL", ""]
]);

LookupType4.prototype.addCoverage = function(glyphs) {
  var format = 2;
  var coverageformat = new CoverageFormat[format](glyphs);
  this.coveragetables.push(coverageformat);
  return coverageformat;
};

LookupType4.prototype.addLigatureSet = function(options) {
  var ligatureset = new LigatureSet(options);
  this.ligaturesets.push(ligatureset);
  return ligatureset;
};

LookupType4.prototype.finalise = function() {
  this.LigSetCount = this.ligaturesets.length;
  this.CoverageOffset = 6 + 2 * this.LigSetCount;
  var coverage = [];
  this.coveragetables.forEach(function(v){
    coverage.push(v);
  });
  this.CoverageTables = coverage;

  var offset = this.CoverageOffset + coverage.toData().length;
  var offsets = [];

  var ligaturesets = [];
  this.ligaturesets.forEach(function(v) {
    v.finalise();
    ligaturesets.push(v);
    offsets = offsets.concat(dataBuilding.encoder.USHORT(offset));
    offset += v.toData().length;
  });
  this.LigatureSetTables = ligaturesets;
  this.LigatureSetOffsets = offsets;
};

module.exports = LookupType4;

},{"../../../../utils":76,"../CoverageFormat":38,"./LigatureSet":42}],45:[function(require,module,exports){
module.exports = {
 	"4": require("./LookupType4")
};

},{"./LookupType4":44}],46:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;

"use strict";

var LangSysTable = function(input) {
  this.features = [];
  if(!this.parse(input)) {
    input = input || {};
    input.ReqFeatureIndex = input.ReqFeatureIndex || 0xFFFF;
    var features = input.features;
    delete input.features;
    this.fill(input);
    if(features) {
      this.features = features;
      this.FeatureCount = features.length;
    }
  }
};

LangSysTable.prototype = new struct("LangSysTable", [
    ["LookupOrder",     "PADDING2",  "reserved value. Because why not"]
  , ["ReqFeatureIndex", "USHORT",  "the one required feature that must always be enabled, or 0xFFFF if there are none"]
  , ["FeatureCount",    "USHORT",  "Number of FeatureIndex values for this language system, excluding the required one"]
  , ["FeatureIndex",    "LITERAL", "The indices of all the features that should be used, from the feature list (USHORT[featurecount])"]
]);

LangSysTable.prototype.finalise = function() {
  var data = [];
  this.features.forEach(function(_,i) {
    data = data.concat(dataBuilding.encoder.USHORT(i));
  });
  this.FeatureIndex = data;
};

module.exports = LangSysTable;

},{"../../../utils":76}],47:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;
var LookupTable = require("./LookupTable");

"use strict";

var LookupList = function(input) {
  this.tables = [];
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

LookupList.prototype = new struct("LookupList", [
    ["LookupCount",  "USHORT",  "number of lookups in the list"]
  , ["LookupOffsets", "LITERAL", "Array of offsets to the Lookup tables, from beginning of LookupList"]
  , ["LookupTables", "LITERAL", "the list of lookups"]
]);

LookupList.prototype.addLookup = function(options) {
  var table = new LookupTable(options);
  this.tables.push(table);
  return table;
}

LookupList.prototype.finalise = function() {
  this.LookupCount = this.tables.length;
  var lookuptables = [];
  var offsets = [];
  var offset = 2 + this.tables.length * 2; // USHORT values
  this.tables.forEach(function(t,idx) {
    offsets = offsets.concat(dataBuilding.encoder.USHORT(offset));
    t.finalise(idx);
    lookuptables.push(t);
    offset += t.toData().length;
  });
  this.LookupOffsets = offsets;
  this.LookupTables = lookuptables;
}

module.exports = LookupList;

},{"../../../utils":76,"./LookupTable":48}],48:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;
var dataBuilding = utils.dataBuilding;
var lookups = require("./GSUB/lookups");

"use strict";

var LookupTable = function(input) {
  this.tables = [];
  if(!this.parse(input)) {
    input = input || {};
    input.LookupFlag = input.LookupFlag || 0;
    this.fill(input);
    // check the UseMarkFilteringSet bit in the lookup flags:
    if((this.LookupFlag & 0x0010) !== 0x0010) {
      this.unset(["MarkFilteringSet"]);
    }
  }
};

LookupTable.prototype = new struct("LookupTable", [
    ["LookupType",       "USHORT",  "defined in the GSUB and GPOS tables"]
  , ["LookupFlag",       "USHORT",  "lookup qualifiers (see 'LookupFlag bit enumeration' in the 'Common Table Formats' docs)"]
  , ["SubTableCount",    "USHORT",  "the number of subtables (=actual lookup objects) for this lookup"]
  , ["SubtableOffsets",  "LITERAL", "Array of offsets to SubTables-from beginning of Lookup table"]
  , ["MarkFilteringSet", "USHORT",  "Index (base 0) into GDEF mark glyph sets structure. This field is only present if bit UseMarkFilteringSet of lookup flags is set."]
  , ["SubTables",        "LITERAL", "the array of subtables"]
]);

LookupTable.prototype.addSubTable = function(options) {
  var subtable = new lookups[this.LookupType](options);
  this.tables.push(subtable);
  return subtable;
}

LookupTable.prototype.finalise = function(idx) {
  this.SubTableCount = this.tables.length;
  var subtables = [];
  var offsets = [];
  var offset = 6 + this.tables.length * 2; // USHORT offsets
  this.tables.forEach(function(v) {
    v.finalise()
    subtables.push(v);
    offsets = offsets.concat(dataBuilding.encoder.USHORT(offset));
    offset += v.toData().length;
  });
  this.SubtableOffsets = offsets;
  this.SubTables = subtables;
  this.lookupListIndex = idx;
}

module.exports = LookupTable;

},{"../../../utils":76,"./GSUB/lookups":45}],49:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;
var ScriptRecord = require("./ScriptRecord");
var ScriptTable = require("./ScriptTable");

"use strict";

var ScriptList = function(input) {
  this.pairs = [];
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

ScriptList.prototype = new struct("ScriptList", [
    ["ScriptCount",   "USHORT",  "Number of ScriptRecords"]
  , ["ScriptRecords", "LITERAL", "Array of ScriptRecords, listed alphabetically by ScriptTag"]
  , ["ScriptTables",  "LITERAL", "The ScriptTables in this script list"]
]);

ScriptList.prototype.addScript = function(options) {
  var scriptRecord = new ScriptRecord({
    ScriptTag: options.ScriptTag ? options.ScriptTag : "DFLT"
  });
  delete options.ScriptTag;

  var scriptTable = new ScriptTable(options);
  this.pairs.push({
    record: scriptRecord,
    table: scriptTable,
    finalise: function(scriptCount, offset) {
      this.table.finalise();
      this.record.Offset = 2 + scriptCount * 6 + offset;
    }
  });
  return scriptTable;
};

// Do we already have a table pointing to the same langsys data?
// If we do, we don't want to encode it a second (or third etc) time.
var alreadyReferenced = function(tables, table) {
  var todata = function(v) { return v.toData(); };
  var collapse = function (arr) { return arr.map(todata).join(''); };
  var i, a, b;
  for(var i=0, last=tables.length; i<last; i++) {
    a = collapse(tables[i].langsystables);
    b = collapse(table.langsystables);
    if(a == b) return true;
  }
  return false;
}

ScriptList.prototype.finalise = function() {
  var count = this.pairs.length;
  this.ScriptCount = count;
  this.pairs.sort(function(a,b) {
    return a.record.ScriptTag < b.record.ScriptTag ? -1 : 1;
  });
  var records = [],
      tables = [],
      oldoffset = 0,
      offset = 0;
  this.pairs.forEach(function(p, idx) {
    if(alreadyReferenced(tables, p.table)) {
      p.finalise(count, oldoffset);
      records.push(p.record);
      return;
    }
    oldoffset = offset;
    p.finalise(count, offset);
    records.push(p.record);
    tables.push(p.table);
    // FIXME: use a sizeOf
    offset += p.table.toData().length;
  });
  this.ScriptRecords = records;
  this.ScriptTables = tables;
};

module.exports = ScriptList;

},{"../../../utils":76,"./ScriptRecord":50,"./ScriptTable":51}],50:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;

"use strict";

var ScriptRecord = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.ScriptTag = input.ScriptTag || "DFLT";
    this.fill(input);
  }
};

ScriptRecord.prototype = new struct("ScriptRecord", [
    ["ScriptTag", "CHARARRAY", "script name ('DFLT' for the default script)"]
  , ["Offset",    "OFFSET",    "Offset to the associated ScriptTable (offset from the start of the ScriptList)"]
]);

module.exports = ScriptRecord;

},{"../../../utils":76}],51:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;

"use strict";

var ScriptTable = function(input) {
  this.langsystables = [];
  if(!this.parse(input)) {
    input = input || {};
    input.defaultLangSys = 4;
    var langsystables = input.LangSysTables;
    delete input.LangSysTables;
    this.fill(input);
    if(langsystables) {
      this.langsystables = langsystables;
    }
  }
};

ScriptTable.prototype = new struct("ScriptTable", [
    ["defaultLangSys", "OFFSET",  "the langsys record to use in absence of a specific language, from start of script table"]
  , ["LangSysCount",   "USHORT",  "how many language systam tables are used?"]
  , ["LangSysTables",  "LITERAL", "the collection of LangSys objects"]
]);

ScriptTable.prototype.finalise = function(lookups) {
  this.LangSysCount = this.langsystables.length - 1; // offset for DFLT
  var data = [];
  this.langsystables.forEach(function(v, idx){
    v.finalise();
    data.push(v);
  });
  this.LangSysTables = data;
};

module.exports = ScriptTable;

},{"../../../utils":76}],52:[function(require,module,exports){
var utils = require("../../utils");
var struct = utils.struct;

"use strict";

var head = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.version = input.version || 0x00010000;
    input.fontRevision = input.fontRevision || 0x00010000;
    input.checkSumAdjustment = input.checkSumAdjustment || 0;
    input.magicNumber =  0x5F0F3CF5;
    input.created = input.created || 0;
    input.modified = input.modified || 0;
    input.flags = input.flags || 0; // see http://www.microsoft.com/typography/otspec/head.htm, "flags" section
    input.macStyle = input.macStyle || 0;
    input.lowestRecPPEM = input.lowestRecPPEM || 8,
    // obsolete value: we force it to 2 as per spec
    input.fontDirectionHint = 2;
    // these two values do not apply to CFF fonts, yet are still necessary
    input.indexToLocFormat = input.indexToLocFormat || 0;
    input.glyphDataFormat = input.glyphDataFormat || 0;
    this.fill(input);
  }
};

head.prototype = new struct("head table", [
  ["version",            "FIXED",        "table version (should be 0x00010000)"]
, ["fontRevision",       "FIXED",        "font reversion number"]
, ["checkSumAdjustment", "ULONG",        "0xB1B0AFBA minus (ULONG sum of the entire font, computed with this value set to 0)"]
, ["magicNumber",        "ULONG",        "OpenType magic number, used to verify this is, in fact, an OpenType font. Must be 0x5F0F3CF5"]
, ["flags",              "USHORT",       "flags (see http://www.microsoft.com/typography/otspec/head.htm)"]
, ["unitsPerEM",         "USHORT",       "how big is our quad, in font units"]
, ["created",            "LONGDATETIME", "date created (seconds since 1904. often mistakenly seconds since 1970)"]
, ["modified",           "LONGDATETIME", "date modified (seconds since 1904. often mistakenly seconds since 1970)"]
, ["xMin",               "SHORT",        "global xMin"]
, ["yMin",               "SHORT",        "global yMin"]
, ["xMax",               "SHORT",        "global xMax"]
, ["yMax",               "SHORT",        "global yMax"]
, ["macStyle",           "USHORT",       "font style, according to old Apple mac rules"]
, ["lowestRecPPEM",      "USHORT",       "smallest readable size in pixels."]
, ["fontDirectionHint",  "SHORT",        "deprecated value (font direction hint). should be 0x0002"]
, ["indexToLocFormat",   "SHORT",        "offset datatype (0 means SHORT, 1 means LONG)"]
, ["glyphDataFormat",    "SHORT",        "glyph data format. default value = 0"]
]);

module.exports = head;

},{"../../utils":76}],53:[function(require,module,exports){
var utils = require("../../utils");
var struct = utils.struct;

"use strict";

var hhea = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.version = input.version || 0x00010000;
    input.LineGap = input.LineGap || 0;
    input.minLeftSideBearing = input.minLeftSideBearing || 0;
    input.minRightSideBearing = input.minRightSideBearing || 0;
    input.caretSlopeRise = input.caretSlopeRise || 0;
    input.caretSlopeRun = input.caretSlopeRun || 0;
    input.caretOffset = input.caretOffset || 0;
    input.metricDataFormat = input.metricDataFormat || 0;
    this.fill(input);
  }
};

hhea.prototype = new struct("hhea table", [
  ["version",             "FIXED",     "Table version (must be 0x00010000"]
, ["Ascender",            "FWORD",     "Typographic ascender"]
, ["Descender",           "FWORD",     "Typographic descender"]
, ["LineGap",             "FWORD",     "Typographic line gap"]
, ["advanceWidthMax",     "UFWORD",    "Maximum advance width value in 'hmtx' table."]
, ["minLeftSideBearing",  "FWORD",     "Minimum left sidebearing value in 'hmtx' table."]
, ["minRightSideBearing", "FWORD",     "Minimum right sidebearing value; calculated as Min(aw - lsb - (xMax - xMin))."]
, ["xMaxExtent",          "FWORD",     "Max(lsb + (xMax - xMin))"]
, ["caretSlopeRise",      "SHORT",     "Used to calculate the slope of the cursor (rise/run); 1 for vertical."]
, ["caretSlopeRun",       "SHORT",     "0 for vertical."]
, ["caretOffset",         "SHORT",     "The amount by which a slanted highlight on a glyph needs to be shifted to produce the best appearance. Set to 0 for non-slanted fonts"]
, ["_reserved1",          "PADDING2",  "reserved; must be 0"]
, ["_reserved2",          "PADDING2",  "reserved; must be 0"]
, ["_reserved3",          "PADDING2",  "reserved; must be 0"]
, ["_reserved4",          "PADDING2",  "reserved; must be 0"]
, ["metricDataFormat",    "SHORT",     "metricDataFormat, 0 for current format"]
, ["numberOfHMetrics",    "USHORT",    "number of hMetric entries."]
]);

module.exports = hhea;

},{"../../utils":76}],54:[function(require,module,exports){
var utils = require("../../utils");
var struct = utils.struct;
var LongHorMetric = require("./hmtx/LongHorMetric");

"use strict";

var hmtx = function(input, numberOfHMetrics) {
  if(!this.parse(input)) {
    this.fill({});
    this.build(input, numberOfHMetrics);
  }
};

hmtx.prototype = new struct("hmtx table", [
  ["hMetrics", "LITERAL", "the array of horizontal metrics for the glyphs in this font"]
]);

hmtx.prototype.createMetric = function(advanceWidth, lsb) {
  return new LongHorMetric({ advanceWidth: advanceWidth , lsb: lsb });
};

hmtx.prototype.build = function(globals, numberOfHMetrics) {
  var data = []
  var advanceWidth = globals.lsb + (globals.xMax - globals.xMin) + globals.rsb;
  var lsb = globals.lsb;
  for(var i=0; i < numberOfHMetrics - 1; i++) {
    // FIXME: retrieve these values from something linked to globals.charstrings, instead.
    data.push(this.createMetric(advanceWidth, lsb));
  }
  data.push(this.createMetric(advanceWidth, lsb));
  this.hMetrics = data;
};

module.exports = hmtx;

},{"../../utils":76,"./hmtx/LongHorMetric":55}],55:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;

"use strict";

/**
 * Name record constructor
 */
var LongHorMetric = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

/**
 *
 */
LongHorMetric.prototype = new struct("LongHorMetric", [
    ["advanceWidth", "USHORT", ""]
  , ["lsb",          "SHORT",  ""]
]);

module.exports = LongHorMetric;

},{"../../../utils":76}],56:[function(require,module,exports){
var utils = require("../../utils");
var struct = utils.struct;

"use strict";

var maxp = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
    if(input.version === 0x00005000) {
      var keep = ["version", "numGlyphs"];
      var remove = Object.keys(this.fields).filter(function(v) {
        return keep.indexOf(v) === -1;
      });
      this.unset(remove);
    }
  }
};

maxp.prototype = new struct("maxp table", [
  ["version",               "FIXED",  "table version. For CFF this must be 0.5, for TTF it must be 1.0"]
, ["numGlyphs",             "USHORT", "number of glyphs in the font"]
  // --- v0.5 only uses the previous two fields. 1.0 uses the rest as well ---
, ["maxPoints",             "USHORT", "Maximum points in a non-composite glyph"]
, ["maxContours",           "USHORT", "Maximum contours in a non-composite glyph"]
, ["maxCompositePoints",    "USHORT", "Maximum points in a composite glyph"]
, ["maxCompositeContours",  "USHORT", "Maximum contours in a composite glyph"]
, ["maxZones",              "USHORT", "1 if instructions do not use the twilight zone (Z0), or 2 if instructions do use Z0; should be set to 2 in most cases."]
, ["maxTwilightPoints",     "USHORT", "Maximum points used in Z0"]
, ["maxStorage",            "USHORT", "Number of Storage Area locations"]
, ["maxFunctionDefs",       "USHORT", "Number of FDEFs"]
, ["maxInstructionDefs",    "USHORT", "Number of IDEFs"]
, ["maxStackElements",      "USHORT", "Maximum stack depth (including Font and CVT programs, and glyph instructions"]
, ["maxSizeOfInstructions", "USHORT", "Maximum byte count for glyph instructions"]
, ["maxComponentElements",  "USHORT", "Maximum number of components referenced at “top level” for any composite glyph."]
, ["maxComponentDepth",     "USHORT", "Maximum levels of recursion; 1 for simple components."]
]);

module.exports = maxp;

},{"../../utils":76}],57:[function(require,module,exports){
/**
 * Name table
 */
var utils = require("../../utils");
var struct = utils.struct;
var atou = utils.atou;
var dataBuilding = utils.dataBuilding;
var NameRecords = require("./name/NameRecords");

// TEST: mac encoding 32 (uninterpreted) instead of 0 (Roman).
// TEST: no mac strings
// TEST: no windows strings
// TODO: make the headers controllable

"use strict";

/**
 * Name table constructor
 */
var name = function(input) {
  this.strings = {};
  if(!this.parse(input)) {
    input = input || {};
    input.format = input.format || 0;
    this.fill(input);
    this.setStrings(input);
  }
};

/**
 * Name table definition
 */
name.prototype = new struct("name table", [
  ["format",       "USHORT", "<name> table format"]
, ["count",        "USHORT", "Number of name records in this table"]
, ["stringOffset", "OFFSET", "offset to the string data, relative to the table start"]
, ["NameRecords",  "LITERAL", "The name record metadata"]
, ["StringData",   "LITERAL", "The actual strings that describe this font"]
]);

/**
 * Turn an array of strings into a table structure that
 * can be serialized to byte code.
 */
name.prototype.buildDataStructure = function(strings) {
  var nameRecords = new NameRecords();
  var strings = this.strings,
      string,
      ustring,
      recordID;
  Object.keys(strings).forEach(function(key) {
    recordID = parseInt(key, 10);
    // store for {macintosh / roman / english}
    string = strings[key];
    nameRecords.addRecord(recordID,  string, 1, 0, 0);
    // store for {windows / Unicode BMP (UCS-2) / US English}
    ustring = atou(string);
    nameRecords.addRecord(recordID, ustring, 3, 1, 0x0409);
  });
  nameRecords.finalise();
  return {
    nameRecords: nameRecords.records,
    nameRecordLength: nameRecords.offset,
    nameStrings: nameRecords.strings
  };
};

/**
 * add a string to the collection of strings, or
 * remove one by omitting its [string] parameter.
 */
name.prototype.set = function(id, string) {
  if(string !== undefined) { this.strings[""+id] = string; }
  else { delete this.strings[""+id]; }
};

/**
 * Set all strings based on the globals object
 */
name.prototype.setStrings = function(globals) {
  this.set(1, globals.fontFamily);
  this.set(2, globals.subFamily);
  if(!globals.minimal) {
    if(globals.copyright      !== undefined)  this.set( 0, globals.copyright);
    if(globals.identifier     !== undefined)  this.set( 3, globals.identifier);
    if(globals.fontName       !== undefined)  this.set( 4, globals.fontName);
    if(globals.fontVersion    !== undefined)  this.set( 5, globals.fontVersion);
    if(globals.postscriptName !== undefined)  this.set( 6, globals.postscriptName);
    if(globals.trademark      !== undefined)  this.set( 7, globals.trademark);
    if(globals.license        !== undefined)  this.set(13, globals.license);
    // NameID 19 is for the "preview text" in font preview utilities. Since we're
    // only implementing a single glyph, that's the entire preview string.
    this.set(19, globals.glyphName);
  }
  this.finalise();
}

/**
 * convert the current string collection
 * into a name table structure.
 */
name.prototype.finalise = function() {
  var data = this.buildDataStructure();
  this.count = data.nameRecords.length;
  this.NameRecords = data.nameRecords;
  this.StringData = data.nameStrings;
  this.stringOffset = this.offset("StringData");
};

module.exports = name;

},{"../../utils":76,"./name/NameRecords":59}],58:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;

"use strict";

/**
 * Name record constructor
 */
var NameRecord = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

/**
 * Name table definition
 */
NameRecord.prototype = new struct("NameRecord", [
    ["platform", "USHORT", "which platform?"]
  , ["encoding", "USHORT", "which platform-specific encoding?"]
  , ["language", "USHORT", "which platform-specific language"]
  , ["recordID", "USHORT", "See the 'Name IDs' section on http://www.microsoft.com/typography/otspec/name.htm for details"]
  , ["length",   "USHORT", "the length of this string"]
  , ["offset",   "USHORT", "offset for this string in the string heap"]
]);

module.exports = NameRecord;

},{"../../../utils":76}],59:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;
var NameRecord = require("./NameRecord");
var StringRecord = require("./StringRecord");

"use strict";

var NameRecords = function(input) {
  this.records = [];
  this.strings = [];
  this.offset = 0;

  this.strings.toJSON = function() {
    return this.map(function(r) {
      return r.values["string"].map(function(i) {
        return String.fromCharCode(i);
      }).join('');
   });
  };

  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

NameRecords.prototype = new struct("NameRecords", [
    ["Name Records", "LITERAL", "The list of name records for this font."]
  , ["Strings",      "LITERAL", "The strings used by the preceding name records."]
]);

NameRecords.prototype.addRecord = function(recordID, string, platform, encoding, language) {
  var len = string.length;
  var record = new NameRecord({
    platform: platform,
    encoding: encoding,
    language: language,
    recordID: recordID,
    length: len,
    offset: this.offset
  });
  this.records.push(record);
  this.strings.push(new StringRecord({ string: string }));
  this.offset += len;
};

// ensure the namerecords are sorted by platform,
// and that the offsets are corrected for the size of
// the namerecords in front of the string heap.
NameRecords.prototype.finalise = function() {
  this.records.sort(function(a,b) {
    var diff = a.platform - b.platform;
    if(diff !== 0) return diff;
    return a.recordID - b.recordID;
  });
  this["Name Records"] = this.records;
  this["Strings"] = this.strings;
};

module.exports = NameRecords;

},{"../../../utils":76,"./NameRecord":58,"./StringRecord":60}],60:[function(require,module,exports){
var utils = require("../../../utils");
var struct = utils.struct;
var atou = utils.atou;

"use strict";

/**
 * Name record constructor
 */
var StringRecord = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    this.fill(input);
  }
};

/**
 * Name table definition
 */
StringRecord.prototype = new struct("StringRecord", [
  ["string", "CHARARRAY", "The string to be encoded"]
]);

module.exports = StringRecord;

},{"../../../utils":76}],61:[function(require,module,exports){
var utils = require("../../utils");
var struct = utils.struct;

"use strict";

var post = function(input) {
  if(!this.parse(input)) {
    input = input || {};
    input.version = input.version || 0x00030000;
    input.italicAngle = input.italicAngle || 0;
    input.underlinePosition = input.underlinePosition || 0;
    input.underlineThickness = input.underlineThickness || 0;
    input.isFixedPitch = input.isFixedPitch || 1;
    input.minMemType42 = input.minMemType42 || 0;
    input.maxMemType42 = input.maxMemType42 || 0;
    input.minMemType1 = input.minMemType1 || 0;
    input.maxMemType1 = input.maxMemType1 || 0;
    this.fill(input);
  }
};

post.prototype = new struct("post table", [
  ["version",            "FIXED", "post table format"]
, ["italicAngle",        "FIXED", ""]
, ["underlinePosition",  "FWORD", ""]
, ["underlineThickness", "FWORD", ""]
, ["isFixedPitch",       "ULONG", ""]
, ["minMemType42",       "ULONG", ""]
, ["maxMemType42",       "ULONG", ""]
, ["minMemType1",        "ULONG", ""]
, ["maxMemType1",        "ULONG", ""]
]);

module.exports = post;

},{"../../utils":76}],62:[function(require,module,exports){
var utils = require('./utils');

"use strict";

module.exports = function(options) {
    console.log(options);

  var defaultQuad = 1024;

  var globals = {
      minimal: options.minimal !== "undefined" ? options.minimal : false
    , compliant: options.compliant !== "undefined" ? options.compliant : true

    // builder metadata
    , quadSize: options.quadSize || defaultQuad
    , identifier: options.identifier || "-"

    // GSUB magic?
    , substitutions: options.substitutions || false

    // Name table information
    , fontFamily: options.fontFamily || "Custom"
    , subFamily: options.subFamily || "Regular"
    , fontName: options.fontName || "Custom Glyph Font"
    , postscriptName: options.postscriptName || "customfont"
    , fontVersion: options.fontVersion || "Version 1.0"
    , copyright: options.copyright || "Free of copyright"
    , trademark: options.trademark || "Free of trademarks"
    , license: options.license || "License free"
    , vendorId: " =) "

    // cmap/charstring information
    , letters: Object.keys(options.charstrings || {}).sort()
    , charstrings: options.charstrings
    , subroutines: options.subroutines

    // font master bounding box
    , xMin: options.xMin || 0
    , yMin: options.yMin || 0
    , xMax: options.xMax || defaultQuad
    , yMax: options.yMax || defaultQuad

    // font default left/right side bearings
    , lsb: options.lsb || 0
    , rsb: options.rsb || 0
  };

  return globals;
};
},{"./utils":76}],63:[function(require,module,exports){
"use strict";

var Mapper = function() {
  this.mappings = [];
};

Mapper.prototype = {
  reset: function reset() {
    this.mappings = [];
  },
  addMapping: function addMapping(offset, options) {
    var mapping = {
      name: options.name || '',
      start: offset,
      end: offset + options.length,
      type: options.type || '',
      description: options.description || '',
      value: options.value !== undefined ? options.value instanceof Array ? "<structured>" : options.value : false,
      structure: options.structure || false
    };
    this.mappings.push(mapping);
    return mapping;
  },
  find: function(name) {
    return this.mappings.filter(function(m) {
      return m.name === name;
    })[0];
  },
  last: function() {
    return this.mappings[this.mappings.length-1];
  },
  sort: function() {
    this.mappings.sort(function(a,b) {
      // order by start offsets
      var diff = a.start - b.start;
      // but, if they're the same: the longest mapping comes first
      if(diff === 0) { return b.end - a.end; }
      return diff;
    });
  }
};

module.exports = Mapper;

},{}],64:[function(require,module,exports){
/**
 * Substitution tables are hilariously complex, due to OpenType's concept
 * of scripts, language systems, features, and lookups.
 *
 * Lookups and Features live on "heaps", with features being instructions
 * to transform one or more letters somehow, and lookups being specific
 * algorithms for performing those transforms.
 *
 * Features generally have a fixed list of lookups they might point to,
 * but (in part because there can be multiple features that do the same
 * thing, roughly) a lookup can be used by more than one feature. As
 * such, the feature:lookup relation is many-to-many.
 *
 * Scripts and language systems are a way to deal with the complexity
 * of the real world. A script models a particular writing system
 * (latin, arabic, japanese, etc, as well as the special "default")
 * and this writing system may or may not apply to more than one
 * language (latin, for instance, can be french, english, turkish,
 * vietnamese, and so on).
 *
 * As each of these language systems have different rules when it comes
 * to combining accents, forming ligatures, applying punctuation, and
 * more such things, different language systems have different feature
 * requirements, although some languages will share certain features.
 * (for instance, how to align basic punctuation like commas and full
 * stops).
 *
 * So, the language:feature relation, too, is manu-to-many.
 *
 * Finally, the script:language relation is one-to-many.
 *
 */
module.exports = function addLabelSubstitution(font, globals) {

    // step 1: add a ligature lookup. This takes a bit of work.
    //         Also note this is now just a "loose" lookup on
    //         the heap of lookups.


    // step 1a: in order to set up a "multiple letters become one letter"
    //          substitution, we need to create a GSUB "type 4" lookup, which
    //          models the "many-to-one substitution" effect.
    var lookup = font.GSUB.addLookup({ LookupType: 4 });
    var subtable = lookup.addSubTable();

    // step 1b: In order to define a substitution lookup, we need to
    //          list all the letters for which substitutions are going
    //          to be necessary. If we're going to substitute "fl" with
    //          something, as well as "etc" with something, this coverage
    //          list would be ['e', 'f'], for instance.
    var substitutions = Object.keys(globals.substitutions);

    // Construct the list of initial glyphs, which we need in order to know
    // how many LigatureSets we're building.
    var initials = substitutions.map(function(v) { return (v.split(','))[0]; });
    initials = initials.filter(function(e,pos) {
        return initials.indexOf(e) === pos;
    });

    // Then, construct the same list, but then as glyph IDs, which we need to
    // construct the coverage table:
    var initialIDs = initials.map(function(e) {
        // offset added to account for .notdef
        return globals.letters.indexOf(e) + 1;
    });
    subtable.addCoverage(initialIDs);

    // step 1c: Construct the LigatureSets that we're going to need to store
    //          all the substitution rules that share the same first glyph:
    ligatureSets = {};
    initials.sort().forEach(function(mark) {
        ligatureSets[mark] = subtable.addLigatureSet();
    });

    // step 1d: add the actual ligatures we'll be using to the set.
    substitutions.forEach(function(key) {
        var glyphs = key.split(',');

        // the start glyph, which identifies the LigatureSet
        var mark = glyphs[0];

        // the ligature set we need to work with for this substitution:
        var ligatureSet = ligatureSets[mark];

        // the single glyph we want to end up with:
        var target = globals.substitutions[key];

        //  Its corresponding glyph ID:
        var LigGlyph = globals.letters.indexOf(target) + 1; // offset to account for .notdef

        //  The sequence of glyphs that will trigger this substitution,
        //  *without* the first one, which is already specified in the
        //  coverage table, so we don't need to repeat it here:
        var Components = glyphs.slice(1).map(function(v) {
            return globals.letters.indexOf(v) + 1; // offset to account for .notdef
        });

        // The ligature table payload:
        var data = { LigGlyph: LigGlyph, Components: Components };

        // And finally, we can create this ligature's table entry
        ligatureSet.addLigatureTable(data);
    });

    // step 2: wrap this ligature lookup up in a ligature feature. Much like lookups,
    //         features are just "loose" entries on a heap of features.

    var feature = font.GSUB.addFeature({ FeatureTag: "liga", lookups: [lookup] });


    // step 3: Now we need to say which language systems this feature
    //         is actually used by. We just go with a single language
    //         system, because we only need one.

    var langSysTable = font.GSUB.makeLangSys({ features: [feature] });


    // step 4: Finally, we say which real world scripts our language system applies to.
    font.GSUB.addScript({ ScriptTag: "DFLT", LangSysTables: [langSysTable] });
    font.GSUB.addScript({ ScriptTag: "latn", LangSysTables: [langSysTable] });


    // Now, wasn't that fun? Step last: make all these bindings stick.
    font.GSUB.finalise();
};

},{}],65:[function(require,module,exports){
var getColor = require("./getColor");


// create a query selector based on a mapping region
function formQuery(mapping, o) {
  var qs = [];
  for(var s=mapping.start-o, e=mapping.end-o; s<e; s++) {
    qs.push(".c"+s);
  }
  return qs.join(",");
}

var curHighlight = false;

// highlight an element
var highlight = function(e, mapping, idx) {
  /*
  if(idx === 0 && curHighlight !== mapping && mapping.structure) {
    console.log( mapping.name );
    console.log( JSON.stringify(mapping.structure, false, 2) );
    curHighlight = mapping;
  }
  */

  e.style.background = color[idx];

  var name = mapping.name.replace(/\.+/g,'.').replace(/\.\[/g,'[');
  var value = mapping.value;
  if(value && value.replace) { value = value.replace(/\u0000/g,' 0x00 '); }
  var description = mapping.description;
  var dec = mapping.start+"-"+(mapping.end-1);
  var hex = mapping.start.toString(16).toUpperCase()+"-"+(mapping.end-1).toString(16).toUpperCase();
  e.title = [
      "field name: " + name
    , description? "explanation: " + description : ''
    , value !== undefined? "value: " + value : ''
    , "hex position: " + hex
    , "dec position: " + dec
  ].join("\n");
};

// cache the background color so we can restore it later
var cacheBackground = function(e) {
  e.setAttribute("data-background", e.style.background);
};

// restore an element's background color
var restore = function(e, last) {
  e.style.background = e.getAttribute("data-background");
  e.removeAttribute("title");
};

// set up event tracking
var setupEventTracking = function(e) {
  if(!e.eventListeners) {
    e.eventListeners = {
      evtNames: [],
      add: function(evtName, fn) {
        if(!this[evtName]) {
          var newlist = [];
          newlist.first = function() {
            return this[0];
          };
          newlist.last = function() {
            return this[this.length-1];
          };
          this[evtName] = newlist;
          this.evtNames.push(evtName);
        }
        e.addEventListener(evtName, fn, false);
        this[evtName].push(fn);
      },
      remove: function(evtName, fn) {
        e.removeEventListener(evtName, fn, false);
        this[evtName].splice(this[evtName].indexOf(fn),1);
        if(this[evtName].length === 0) {
          this.evtNames.splice(this.evtNames.indexOf(evtName),1);
        }
      },
      cleanup: function() {
        var el = this;
        ["mouseover", "mouseout"].forEach(function(evtName) {
          var list = el[evtName];
          list.sort(function(a,b) {
            a = a.mapping;
            b = b.mapping;
            return (b.end-b.start) - (a.end-a.start);
          });
          if(list.length > 2) {
            var first = list.first(),
               last =  list.last(),
               i, fn;
            for(i=list.length - 2; i > 0; i--) {
              fn = list[i];
              e.removeEventListener(evtName, fn);
              list.splice(i,1);
            }
          }
        });
      }
    };
    e.simulateEvent = function(eventName) {
      var list = e.eventListeners[eventName] || [];
      list.forEach(function(fn) {
        fn();
      });
    };
  }
};

// set up coloring for an element
var colorize = function(list, e, mapping) {
  setupEventTracking(e);
  cacheBackground(e);

  // add mouse-over handling
  var moverfn = function moverfn(evt) {
    for(var i=0, last=list.length; i<last; i++) {
      highlight(list[i], mapping, moverfn.idx);
    }
  };
  moverfn.mapping = mapping;
  e.eventListeners.add("mouseover", moverfn);
  moverfn.idx = e.eventListeners.mouseover.indexOf(moverfn);

  // add mouse-out handling
  var moutfn = function moutfn(evt) {
    list.forEach(function(e2) { restore(e2); });
  };
  moutfn.mapping = mapping;
  e.eventListeners.add("mouseout", moutfn);
};

/**
 * Add mappings to all class="c123" elements inside a specific container
 */
module.exports = function addMappings(container, mappings, globalOffset) {
  globalOffset = typeof globalOffset === "undefined" ? 0 : globalOffset;
  container = (typeof container === "string" ? document.querySelector(container) : container);
  mappings.forEach(function(mapping) {
    var query = formQuery(mapping, globalOffset);
    if(query) {
      var nodelist = container.querySelectorAll(query);
      var list = Array.prototype.slice.call(nodelist);
      var fn = function(e) {
        colorize(list, e, mapping);
      };
      list.forEach(fn);
    }
  });
};

},{"./getColor":75}],66:[function(require,module,exports){
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

},{"./toDataURL":81}],67:[function(require,module,exports){
module.exports = function asChars(v) { return String.fromCharCode(v); };

},{}],68:[function(require,module,exports){
var dataBuilding = require("./dataBuilding");
var GlyphID = dataBuilding.encoder.GlyphID;

module.exports = function asGlyphIDs(v) {
	return GlyphID(v.charCodeAt(0));
};

},{"./dataBuilding":74}],69:[function(require,module,exports){
module.exports = function asHex(v) {
    v = v.toString(16).toUpperCase();
    if(v.length === 1) { v = "0" + v; }
    return v;
  };

},{}],70:[function(require,module,exports){
module.exports = function asNumbers(v) { return v.charCodeAt(0); };

},{}],71:[function(require,module,exports){
// This works mainly because the ANSI range 0x00-0xFF
// as the equivalent UTF16 code range 0x0000-0x00FF.

"use strict";
var nullByte = String.fromCharCode(0);

module.exports = function atou(v) {
  var a = v.split(''), o = [];
  a.forEach(function(v) { o.push(nullByte); o.push(v); });
  return o.join('');
};

},{}],72:[function(require,module,exports){
var toWOFF = require("./toWOFF");
var asHex = require("./asHex");
var asChars = require("./asChars");

"use strict";

module.exports = function buildTables(font, context, selector, tableCaption, addDownloads, nohex, nochars) {

  // top element
  var top = document.querySelector(selector);
  var create = function(v) { return document.createElement(v); };

  // array to HTML table function
  function makeTable(data, limit) {
    limit = limit || 16;
    var tdCount = 0;
    var table = create("table");

    var toprow = create("tr");
    var cornercol = create("th");
    cornercol.style.border =  "none";
    toprow.appendChild(cornercol)
    for(var i=0; i< limit; i++) {
      var hcol = create("th");
      hcol.innerHTML = i.toString(16).toUpperCase();
      toprow.appendChild(hcol);
    }
    table.appendChild(toprow);

    for(var i=0, end = data.length; i*limit<end; i++) {
      var row = create("tr");
      var prefix = create("td");
      prefix.innerHTML = "0x" + ((i*16)|0).toString(16).toUpperCase();
      prefix.style.background = "rgba(100,180,220,0.3)";
      prefix.style.textAlign = "right";
      row.appendChild(prefix)

      var entries = data.slice(limit*i, limit*(i+1));
      var addColumn = function(entry, pos) {
        var column = create("td");
        column.classList.add("b");
        if(entry !== "—") { column.classList.add("p"+pos); }
        column.classList.add("c"+(tdCount++));
        column.innerHTML = entry;
        row.appendChild(column);
      };
      for(var j=0, last=Math.min(entries.length,limit); j<last; j++) {
        addColumn(entries[j], j+limit*i);
      }
      var len = 16 - entries.length;
      if(len>0) {
        (new Array(len+1)).join('—').split('').forEach(addColumn);
      }
      table.appendChild(row);
    }

    var bottomrow = create("tr");
    var cornercol = create("th");
    cornercol.style.border =  "none";
    bottomrow.appendChild(cornercol)
    for(var i=0; i< limit; i++) {
      var hcol = create("th");
      hcol.innerHTML = i.toString(16).toUpperCase();
      bottomrow.appendChild(hcol);
    }
    table.appendChild(bottomrow);

    return table;
  }

  function formTables(font, hexmap, charmap, tableCaption, addDownloads) {
    top.classList.add("tables");

    // data maps (binary visualisation)
    if (!nohex)   { top.appendChild(makeTable(hexmap)); }
    if (!nochars) { top.appendChild(makeTable(charmap)); }

    if (tableCaption) {
      var downloads = create("div");
      downloads.classList.add("downloads");

      var s = create("span");
      s.innerHTML = tableCaption;
      downloads.appendChild(s);

      if (addDownloads) {
        // plain .otf file
        var a = create("a");
        a.innerHTML = "download as opentype font";
        a.download = "customfont.otf";
        a.href = "data:application/octet-stream;base64," + btoa(charmap.join(''));
        downloads.appendChild(a);

        // wOFF wrapped version
        a = create("a");
        a.innerHTML = "download as WOFF version";
        a.download = "customfont.woff";
        a.href = "data:application/octet-stream;base64," + btoa(toWOFF(font).map(asChars).join(''));
        downloads.appendChild(a);
      }

      top.appendChild(downloads);
    }
  }

  var binary = font.toData();
  var hexmap = binary.map(asHex);
  var charmap = binary.map(asChars);
  formTables(font, hexmap, charmap, tableCaption, addDownloads);
};

},{"./asChars":67,"./asHex":69,"./toWOFF":82}],73:[function(require,module,exports){
var dataBuilding = require("./dataBuilding");

var NUMBER  = dataBuilding.encoder.NUMBER;
var OPERAND = dataBuilding.encoder.OPERAND;

module.exports = function convertOutline(options) {

  if(options.charString) {
    return options.charString;
  }

  var outline = options.outline;
  var sections = outline.match(/[MmLlCcZz]\s*([\-\d]+\s*)*/g).map(function(s){return s.trim()});
  var mx = 99999999, MX=-99999999, my=mx, MY=MX;
  var x=0, y=0, cx=false, cy=false, i=0, last=0;
  var charString = [];
  var terminated = false;

  var mark = function(x,y) {
    if(x < mx) { mx = x; }
    if(y < my) { my = y; }
    if(x > MX) { MX = x; }
    if(y > MY) { MY = y; }
  }

 sections.forEach(function(d) {
    var op = d.substring(0,1);
    var values = d.substring(1).trim().split(/\s+/).map(function(v) { return parseInt(v); });

    // first, make all sections relative coordinates (if absolute)
    if(op === op.toUpperCase()) {
      op = op.toLowerCase();
      if(op === 'm') {
        values[0] -= x; x += values[0];
        values[1] -= y; y += values[1];
        mark(x,y);
      }
      else if(op === 'l') {
        for(i=0, last=values.length; i<last; i+=2) {
          values[i+0] -= x; x += values[i+0];
          values[i+1] -= y; y += values[i+1];
          mark(x,y);
        }
      }
      else if(op === 'c') {
        for(i=0, last=values.length; i<last; i+=6) {
          cx = x + values[i+2];
          cy = y + values[i+3];
          values[i+0] -= x;
          values[i+1] -= y;
          values[i+2] -= x;
          values[i+3] -= y;
          values[i+4] -= x; x += values[i+4];
          values[i+5] -= y; y += values[i+5];
          mark(x,y);
        }
      }
    }

    // then convert the data to Type2 charstrings
    if(op === 'm') {
      charString = charString.concat( NUMBER(values[0]).concat(NUMBER(values[1])).concat(OPERAND(21)) );
    }
    else if(op === 'l') {
      for(i=0, last=values.length; i<last; i+=2) {
        charString = charString.concat( NUMBER(values[i]).concat(NUMBER(values[i+1])).concat(OPERAND(5)) );
      }
    }
    else if(op === 'c') {
      for(i=0, last=values.length; i<last; i+=6) {
        charString = charString.concat(
          NUMBER(values[i+0])
          .concat(NUMBER(values[i+1]))
          .concat(NUMBER(values[i+2]))
          .concat(NUMBER(values[i+3]))
          .concat(NUMBER(values[i+4]))
          .concat(NUMBER(values[i+5]))
          .concat(OPERAND(8))
        );
      }
    }
    else if(op === 'z') {
      charString = charString.concat(OPERAND(14));
      terminated = true;
    }
    else {
      // FIXME: add 's' and 'a' support
      throw "op "+op+" not supported at this time."
    }
  });

  if(!terminated) {
    charString = charString.concat(OPERAND(14));
  }

  // bounding box
  options.xMin = mx;
  options.yMin = my;
  options.xMax = MX;
  options.yMax = MY;

  // If the glyph is wider than the default width, we can note this
  // by recording [nominal - true] width as first charstring value.
  // Note: both default and nominal width are defined as options.xMax in this font.
  if(MX != options.xMax) { charString = NUMBER(options.xMax - MX).concat(charString); }

  // FIXME: can the above even fire? ever? O_o

  return charString;
};
},{"./dataBuilding":74}],74:[function(require,module,exports){
"use strict";

var sizeOf = {},
    encoder = {},
    decoder = {},
    builder = {
      sizeOf: sizeOf,
      encoder: encoder,
      decoder: decoder,
      computeChecksum: function(chunk) {
        while(chunk.length % 4 !== 0) { chunk.push(0); }
        var tally = 0;
        for(var i=0, last=chunk.length; i<last; i+=4) {
          tally += (chunk[i] << 24) + (chunk[i + 1] << 16) + (chunk[i + 2] << 8) + (chunk[i + 3]);
        }
        tally %= Math.pow(2,32);
        return tally;
      },
      // this function probably shouldn't exist...
      decodeULONG: function(input) {
        var b = input.split ? input.split('').map(function(c) { return c.charCodeAt(0); }) : input;
        var val = (b[0] << 24) + (b[1] << 16) + (b[2] << 8) + b[3];
        if (val < 0 ) { val += Math.pow(2,32); }
        return val;
      }
    };


(function() {
  for(var i=1; i<=4; i++) {
    (function setupPadding(size) {
      // this needs closure wrapped, because of that late binding for the encode.PADDING function.
      encoder["PADDING"+size] = function PADDING(v) { return (new Array(size+1)).join(0).split('').map(function(v) { return 0; }); };
      decoder["PADDING"+size] = function PADDING(v) { return 0; };
      sizeOf[ "PADDING"+size] = function(v) { return size; };
    }(i));
  }
}());


/***
 *
 * OpenType data types
 *
 ***/

encoder.BYTE = function BYTE(v) { return [v]; };
decoder.BYTE = function BYTE(v) { return v[0]; };
sizeOf.BYTE  = function() { return 1; };

encoder.CHAR = function CHAR(v) { return [v.charCodeAt(0)]; };
decoder.CHAR = function CHAR(v) { return String.fromCharCode(v[0]); };
sizeOf.CHAR  = function() { return 1; };

encoder.CHARARRAY = function CHARARRAY(v) { return v.split('').map(function(v) { return v.charCodeAt(0); }); };
decoder.CHARARRAY = function CHARARRAY(v) { return v.map(function(v) { return String.fromCharCode(v); }).join(''); };
sizeOf.CHARARRAY  = function(a) { return a.length; };

encoder.USHORT = function USHORT(v) { return [(v >> 8) & 0xFF, v & 0xFF]; };
decoder.USHORT = function USHORT(v) { return (v[0] << 8)  + v[1]; };
sizeOf.USHORT  = function() { return 2; };

encoder.SHORT = function SHORT(v)  {
  var limit = 32768;
  if(v >= limit) { v = -(2*limit - v); } // 2's complement
  return [(v >> 8) & 0xFF, v & 0xFF];
};
decoder.SHORT = function SHORT(v)  {
  var limit = 32768;
  var v = (v[0] <<8) + v[1];
  if(v > limit) { v -= 2*limit; }
  return v;
};
sizeOf.SHORT  = function() { return 2; };

encoder.UINT24 = function UINT24(v) { return [(v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF]; };
decoder.UINT24 = function UINT24(v) { return (v[0] << 16) + (v[1] << 8) + v[2]; };
sizeOf.UINT24  = function() { return 3; };

encoder.ULONG = function ULONG(v) { return [(v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF]; };
decoder.ULONG = function ULONG(v) { return (v[0] << 24) + (v[1] << 16) + (v[2] << 8) + v[3]; };
sizeOf.ULONG  = function() { return 4; };

encoder.LONG = function LONG(v)  {
  var limit = 2147483648;
  if(v >= limit) { v = -(2*limit - v); } // 2's complement
  return [(v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF];
};
decoder.LONG = function SHORT(v)  {
  var limit = 2147483648;
  var v = (v[0] << 24) + (v[1] << 16) + (v[2] <<8) + v[3];
  if(v > limit) { v -= 2*limit; }
  return v;
};
sizeOf.LONG  = function() { return 4; };

// This doesn't actually work in JS. Then again, these values that use
// this are irrelevant, too, so we just return a 64bit "zero"
encoder.LONGDATETIME = function LONGDATETIME(v) { return [0,0,0,0,0,0,0,0]; };
decoder.LONGDATETIME = function LONGDATETIME(v) { return 0; }
sizeOf.LONGDATETIME = function() { return 4; };


// aliased datatypes
encoder.FIXED  = encoder.ULONG;
decoder.FIXED  = decoder.ULONG;
sizeOf.FIXED   = sizeOf.ULONG;

encoder.FWORD  = encoder.SHORT;
decoder.FWORD  = decoder.SHORT;
sizeOf.FWORD   = sizeOf.SHORT;

encoder.UFWORD = encoder.USHORT;
decoder.UFWORD = decoder.USHORT;
sizeOf.UFWORD  = sizeOf.USHORT;

encoder.OFFSET = encoder.USHORT;
decoder.OFFSET = decoder.USHORT;
sizeOf.OFFSET  = sizeOf.USHORT;


/***
 *
 * CFF data types
 *
 ***/

encoder.NUMBER = function NUMBER(v) {
  if (-107 <= v && v <= 107) {
    return [v + 139];
  }
  if (108 <= v && v <= 1131) {
    var v2 = v - 108;
    var b0 = (v2 >> 8) & 0xFF,
        b1 = v2 - (b0 << 8);
    return [b0 + 247, b1];
  }
  if (-1131 <= v && v <= -108) {
    var v2 = -v - 108,
        b0 = (v2 >> 8) & 0xFF,
        b1 = v2 - (b0 << 8);
    return [b0 + 251, b1];
  }
  if (-32768 <= v && v <= 32767) {
    return [28, (v >> 8) & 0xFF, v & 0xFF];
  }
  return [29, (v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF];
};

decoder.NUMBER = function NUMBER(bytes) {
  var b0 = bytes.splice(0,1)[0];
  if(b0 === 28) {
    var b1 = bytes.splice(0,1)[0];
    var b2 = bytes.splice(0,1)[0];
    return (b1 << 8) | b2;
  }
  if(b0 === 29) {
    var b1 = bytes.splice(0,1)[0];
    var b2 = bytes.splice(0,1)[0];
    var b3 = bytes.splice(0,1)[0];
    var b4 = bytes.splice(0,1)[0];
    return (b1 << 8) | b2;
  }
  if(b0 >= 32 && b0 <= 246) {
    return b0 - 139;
  }
  if(b0 >= 247 && b0 <= 250) {
    var b1 = bytes.splice(0,1)[0];
    return ((b0-247) << 8) + b1 + 108;
  }
  if(b0 >= 251 && b0 <= 254) {
    var b1 = bytes.splice(0,1)[0];
    return -((b0-251) << 8) - b1 - 108;
  }
};

sizeOf.NUMBER = function(v) {
  return encoder.NUMBER(v).length;
};

encoder.OPERAND = function OPERAND(v1, v2) {
  var opcode = encoder.BYTE(v1);
  if(v2 !== undefined) { opcode.concat(BYTE(v2)); }
  return opcode;
};

encoder.DICTINSTRUCTION = function DICTINSTRUCTION(codes) {
  var data = [];
  codes.forEach(function(code) {
    data = data.concat(code);
  });
  return data;
};

/***
 *
 * Aliased data types
 *
 ***/

encoder.GlyphID = encoder.USHORT;
decoder.GlyphID = decoder.USHORT;
sizeOf.GlyphID  = sizeOf.USHORT;

encoder.Offset  = encoder.USHORT;
decoder.Offset  = decoder.USHORT;
sizeOf.Offset   = sizeOf.USHORT;

encoder.Card8   = encoder.BYTE;
decoder.Card8   = decoder.BYTE;
sizeOf.Card8    = sizeOf.BYTE;

encoder.Card16  = encoder.USHORT;
decoder.Card16  = decoder.USHORT;
sizeOf.Card16   = sizeOf.USHORT;

encoder.SID     = encoder.USHORT;
decoder.SID     = decoder.USHORT;
sizeOf.SID   = sizeOf.USHORT;

encoder.OffSize = encoder.BYTE;
decoder.OffSize = decoder.BYTE;
sizeOf.OffSize    = sizeOf.BYTE;

encoder.OffsetX = [undefined, encoder.BYTE, encoder.USHORT, encoder.UINT24, encoder.ULONG];
decoder.OffsetX = [undefined, decoder.BYTE, decoder.USHORT, decoder.UINT24, decoder.ULONG];
sizeOf.OffsetX  = [undefined, sizeOf.BYTE,  sizeOf.USHORT,  sizeOf.UINT24,  sizeOf.ULONG];

encoder.BOOLEAN = function(v) { return v ? [1] : [0]; };
decoder.BOOLEAN = function(v) { return !!v[0]; };
sizeOf.BOOLEAN  = function()  { return 1; };

encoder.NUMBERS = function(v) {
  var data = [];
  v.forEach(function(c) {
    data = data.concat(encoder.NUMBER(c));
  })
  return data;
};
decoder.NUMBERS = function(v) {
  var numbers = [];
  while(v.length > 0) {
    numbers.push(decoder.NUMBER(v));
  }
  return numbers;
};
sizeOf.NUMBERS  = function(v)  { return v.length; };

// type2 opcode encoding/decoding
(function(encoder, decoder, sizeOf) {
  var CFFtypes = [
    // Top dict values
    ["version",            "NUMBER",   [0]      ]
  , ["Notice",             "NUMBER",   [1]      ]
  , ["Copyright",          "NUMBER",   [12, 0]  ]
  , ["FullName",           "NUMBER",   [2]      ]
  , ["FamilyName",         "NUMBER",   [3]      ]
  , ["Weight",             "NUMBER",   [4]      ]
  , ["isFixedPitch",       "BOOLEAN",  [12, 1]  ]
  , ["ItalicAngle",        "NUMBER",   [12, 2]  ]
  , ["UnderlinePosition",  "NUMBER",   [12, 3]  ]
  , ["UnderlineThickness", "NUMBER",   [12, 4]  ]
  , ["PaintType",          "NUMBER",   [12, 5]  ]
  , ["CharstringType",     "NUMBER",   [12, 6]  ]
  , ["FontMatrix",         "NUMBERS",  [12, 7]  ]
  , ["UniqueID",           "NUMBER",   [13]     ]
  , ["FontBBox",           "NUMBERS",  [5]      ]
  , ["StrokeWidth",        "NUMBER",   [12, 8]  ]
  , ["XUID",               "NUMBERS",  [14]     ]
  , ["charset",            "NUMBER",   [15]     ]
  , ["Encoding",           "NUMBER",   [16]     ]
  , ["CharStrings",        "NUMBER",   [17]     ]
  , ["Private",            "NUMBERS",  [18]     ]
  , ["SyntheticBase",      "NUMBER",   [12, 20] ]
  , ["PostScript",         "NUMBER",   [12, 21] ]
  , ["BaseFontName",       "NUMBER"    [12, 22] ]
  , ["BaseFontBlend",      "NUMBER",   [12, 23] ]
    // CID font specific values
  , ["ROS",                "NUMBERS",  [12, 30] ]
  , ["CIDFontVersion",     "NUMBER",   [12, 31] ]
  , ["CIDFontRevision",    "NUMBER",   [12, 32] ]
  , ["CIDFontType",        "NUMBER",   [12, 33] ]
  , ["CIDCount",           "NUMBER",   [12, 34] ]
  , ["UIDBase",            "NUMBER",   [12, 35] ]
  , ["FDArray",            "NUMBER",   [12, 36] ]
  , ["FDSelect",           "NUMBER",   [12, 37] ]
  , ["FontName",           "NUMBER",   [12, 38] ]
    // Private dict values
  , ["BlueValues",         "NUMBERS",  [6]      ]
  , ["OtherBlues",         "NUMBERS",  [7]      ]
  , ["FamilyBlues",        "NUMBERS",  [8]      ]
  , ["FamilyOtherBlues",   "NUMBERS",  [9]      ]
  , ["BlueScale",          "NUMBER",   [12,  9] ]
  , ["BlueShift",          "NUMBER",   [12, 10] ]
  , ["BlueFuzz",           "NUMBER",   [12, 11] ]
  , ["StdHW",              "NUMBER",   [10]     ]
  , ["StdVW",              "NUMBER",   [11]     ]
  , ["StemSnapH",          "NUMBER",   [12, 12] ]
  , ["StemSnapV",          "NUMBER",   [12, 13] ]
  , ["ForceBold",          "BOOLEAN",  [12, 14] ]
  , ["LanguageGroup",      "NUMBER",   [12, 17] ]
  , ["ExpansionFactor",    "NUMBER",   [12, 18] ]
  , ["initialRandomSeed",  "NUMBER",   [12, 19] ]
  , ["Subrs",              "NUMBER",   [19]     ]
  , ["defaultWidthX",      "NUMBER",   [20]     ]
  , ["nominalWidthX",      "NUMBER",   [21]     ]
  ];

  encoder.CFF = {};
  decoder.CFF = {};
  sizeOf.CFF = {};

  CFFtypes.forEach(function(r) {
    encoder.CFF[r[0]] = function(v) {
      return encoder[r[1]](v).concat(r[2]);
    };
    decoder.CFF[r[0]] = function(v) {
      v.splice(-r[2].length, r[2].length);
      return decoder[r[1]](v);
    };
    sizeOf.CFF[r[0]] = function(v) {
      return sizeOf[r[1]](v) + r[2].length;
    };
  });

  encoder.types = CFFtypes.map(function(v) { return v[0]; });
  decoder.types = encoder.types;

}(encoder, decoder, sizeOf));

/**
 * Helper function for copying data regions
 */
encoder.LITERAL = function LITERAL(array) { return array; };
decoder.LITERAL = encoder.LITERAL;
sizeOf.LITERAL = function(v) { if(v.toData) return v.toData().length; return v.length; };


module.exports = builder;

},{}],75:[function(require,module,exports){
var s = 0.8;
var l = 0.8;

function hue2rgb(p, q, t) {
  if(t < 0) t += 1;
  if(t > 1) t -= 1;
  if(t < 1/6) return p + (q - p) * 6 * t;
  if(t < 1/2) return q;
  if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
  return p;
}

function tohex(v) {
  v = ((255*v)|0).toString(16);
  if(v.length === 1) v = "0" + v;
  return v;
}

function getColor(idx) {
  var h = (idx/10);
  var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  var p = 2 * l - q;
  var r = hue2rgb(p, q, h + 1/3);
  var g = hue2rgb(p, q, h);
  var b = hue2rgb(p, q, h - 1/3);
  return "#" + tohex(r) + tohex(g) + tohex(b);
};

var colors = [];
for(var i=0; i<255; i++) {
  colors.push(getColor(i));
}

module.exports = colors;

},{}],76:[function(require,module,exports){
module.exports = {
  addMappings: require("./addMappings"),
  addStyleSheet: require("./addStyleSheet"),
  asChars: require("./asChars"),	
  asGlyphIDs: require("./asGlyphIDs"),	
  asHex: require("./asHex"),	
  asNumbers: require("./asNumbers"),	
  atou: require("./atou"),	
  buildTables: require("./buildTables"),
  convertOutline: require("./convertOutline"),
  dataBuilding: require("./dataBuilding"),
  getColor: require("./getColor"),
  makeStructy: require("./makeStructy"),
  Mapper: require("./Mapper"),
  nodeBuilder: require("./nodeBuilder"),
  shimFname: require("./shimFname"),
  struct: require("./struct"),
  toWOFF: require("./toWOFF"),
  toDataURL: require("./toDataURL")
};

},{"./Mapper":63,"./addMappings":65,"./addStyleSheet":66,"./asChars":67,"./asGlyphIDs":68,"./asHex":69,"./asNumbers":70,"./atou":71,"./buildTables":72,"./convertOutline":73,"./dataBuilding":74,"./getColor":75,"./makeStructy":77,"./nodeBuilder":78,"./shimFname":79,"./struct":80,"./toDataURL":81,"./toWOFF":82}],77:[function(require,module,exports){
var nodeBuilder = require("./nodeBuilder");

module.exports = function makeStructy(name, array) {
  if(!name || !array) {
    throw "nope";
  }
  array.name = name;
  array.toJSON = function() {
    return this.map(function(r) {
      return r.toJSON();
    });
  };
  array.toHTML = function() {
    var self = this,
        obj = nodeBuilder.create("div");
    obj.setAttribute("class", this.name);
    // numeric data we'll just leave as numbers
    if (typeof this[0] === "number") {
      obj.innerHTML = this.join(',');
    } else {
      this.forEach(function(field) {
        if (field.toHTML) {
          obj.appendChild(field.toHTML());
        } else {
          var d = nodeBuilder.create("div");
          d.setAttribute("class", "value");
          d.innerHTML = field;
          obj.appendChild(d);
        }
      });
    }
    return obj;
  };
  array.toData = function(offset, mappings) {
    offset = offset || 0;
    var data = [], val;
    this.forEach(function(r) {
      if(!r.toData) {
        data.push(r);
        return;
      }
      val = r.toData(offset, mappings);
      data = data.concat(val);
      if(mappings) {
        mappings.addMapping(offset, {
          name: name,
          length: val.length,
          structure: r.toJSON()
        });
      }
      offset += val.length;
    });
    return data;
  };
  array.toString = function() {
    return JSON.stringify(this.toJSON(), false, 2);
  };
  return array;
};

},{"./nodeBuilder":78}],78:[function(require,module,exports){
var builder = {
  create: function(t) {
    return document.createElement(t);
  }
};

if(typeof document === "undefined") {
  builder = {
  	create: function(nodename) {
      return {
        localName: nodename.toLowerCase(),
        attributes: {},
        children: [],
        appendChild: function(child) {
          children.push(child);
        },
        setAttribute: function(name, value) {
          attributes[name] = value;
        },
        getAttribute: function(name) {
          return attributes[name];
        },
        toString: function() {
          var attr = this.attributes,
              keys = Object.keys(attr);
          return "<" + this.localName + (function() {
            var data = keys.map(function(a) {
              return a + '="' + attr[a] + '"';
            });
            return data.join(" ");
          }()) + ">" + children.map(function(v) {
            return v.toString();
          }).join('') + "</" + this.localName + ">";
        },
        valueOf: function() {
          return this.toString();
        }
      }
  	}
  };
}

module.exports = builder;

},{}],79:[function(require,module,exports){
/**
 * function naming shim for browsers that don't have Function.name
 */
module.exports = function shimIE() {
  "use strict";
	if (Function.prototype.name === undefined && Object.defineProperty !== undefined) {
    Object.defineProperty(Function.prototype, 'name', {
      get: function() {
        var funcNameRegex = /function\s+(.{1,})\s*\(/;
        var results = (funcNameRegex).exec((this).toString());
        return (results && results.length > 1) ? results[1] : "";
      },
      set: function(value) {}
    });
	}
};

},{}],80:[function(require,module,exports){
var dataBuilding = require("./dataBuilding");
var nodeBuilder = require("./nodeBuilder");
var makeStructy = require("./makeStructy");

"use strict";

var encoder = dataBuilding.encoder,
    decoder = dataBuilding.decoder,
    sizeOf  = dataBuilding.sizeOf;

var Struct = function(name, structData) {
  if(!structData) {
    structData = name;
    name = "";
  }
  this.name = name;
  this.definition = structData;
  // the real magic happens in .fill()
};

Struct.prototype = {
  setName: function(name) {
    this.name = name;
  },
  fill: function(values) {
    this.bindFields(this.definition);
    var self = this;
    if (values) {
      Object.keys(values).forEach(function(key) {
        if(self.fields[key]) {
          self[key] = values[key];
        }
      })
    }
  },
  bindFields: function(structData) {
    this.fields = {};
    this.values = {};
    this.descriptions = {};
    var self = this;
    structData.forEach(function(record) {
      (function(fieldName, fieldType, fieldDesc) {
        self.fields[fieldName] = fieldType;
        self.descriptions[fieldName] = fieldDesc;
        Object.defineProperty(self, fieldName, {
          // decode the stored value
          get: function() {
            if (self.values[fieldName] === undefined) {
              throw "Cannot find a value bound for " + fieldName;
            }
            var val = self.values[fieldName];
            if(fieldType.indexOf("CFF.") === 0) {
              if(val.slice) {
                // CFF.NUMBER will splice an array, so we need to make
                // sure we pass around copies of the internal values,
                // to prevent content wiping!
                val = val.slice();
              }
              return decoder.CFF[fieldType.replace("CFF.",'')](val);
            }
            return decoder[fieldType](val);
          },
          // store values so that they're already encoded correctly
          set: function(v) {
            if(fieldType.indexOf("CFF.") === 0) {
              self.values[fieldName] = encoder.CFF[fieldType.replace("CFF.",'')](v);
            } else {
              if(fieldType === "LITERAL" && !v.toData) {
                makeStructy(fieldName, v);
              }
              self.values[fieldName] = encoder[fieldType](v);
            }
          }
        });
        // ensure padding fields are always zero, rather than uninitialised
        if(fieldType === "PADDING1" || fieldType === "PADDING2" || fieldType === "PADDING3" || fieldType === "PADDING4") {
          self[fieldName] = 0;
        }
      }(record[0], record[1], record[2]));
    });
  },
  // only use the fields indicated
  use: function(fields) {
    var unused = Object.keys(this.fields).filter(function(f) {
      return fields.indexOf(f) === -1;
    });
    this.unset(unused);
  },
  // remove all the fields indicated
  unset: function(fields) {
    var self = this;
    fields.forEach(function(fieldName) {
      delete self.fields[fieldName];
      delete self.values[fieldName];
    });
  },
  offset: function(fieldName) {
    var offset = 0,
        names = Object.keys(this.fields);
    for(var i=0, last=names.length; i<last; i++) {
      var name = names[i];
      if (name === fieldName) {
        return offset;
      }
      offset += this.sizeOf(name);
    };
    return 0;
  },
  sizeOf: function(fieldName) {
    var self = this,
        size = 0,
        fields = fieldName ? [fieldName] : Object.keys(this.fields);
    fields.forEach(function(fieldName) {
      var val = self.values[fieldName] ? self[fieldName] : false;
      var fieldType = self.fields[fieldName];
      if(fieldType.indexOf("CFF.") === 0) {
        size += sizeOf.CFF[fieldType.replace("CFF.",'')](val);
      } else {
        size += sizeOf[self.fields[fieldName]](val);
      }
    });
    return size;
  },
  parse: function(data){
    this.values = {};
    if(!data) return false;
    if(typeof data !== "string" && !(data instanceof Int8Array)) return false;
    if(typeof data === "string") data = data.split('').map(function(v) { return v.charCodeAt(0); });
    // TODO: code goes here
  },
  finalise: function(){
    // a struct is considered final by default.
  },
  valueOf: function() {
    return this.toString();
  },
  toJSON: function() {
    var self = this,
        obj = {},
        keys = Object.keys(this.fields)
    keys.forEach(function(field) {
      var f = self[field];
      if(f instanceof Array) {
        if(f[0].toJSON) {
          obj[field] = f.toJSON();
        } else {
          obj[field] = f.slice();
        }
      }
      else if (f.toJSON) {
        obj[field] = f.toJSON();
      }
      else {
        obj[field] = f.toString();
      }
    });
    return obj;
  },
  toString: function() {
    return JSON.stringify(this.toJSON(), false, 2);
  },
  toHTML: function() {
    var self = this,
        obj = nodeBuilder.create("div"),
        keys = Object.keys(this.fields);
    obj.setAttribute("class", this.name);
    keys.forEach(function(field) {
      if (self[field].toHTML) {
        obj.appendChild(self[field].toHTML());
      } else {
        var d = nodeBuilder.create("div");
        d.setAttribute("class", field);
        d.setAttribute("data-type", self.fields[field]);
        d.innerHTML = self[field];
        obj.appendChild(d);
      }
    });
    return obj;
  },
  toData: function(offset, mapper) {
    offset = offset || 0;
    var self = this,
        data = [],
        val;
    Object.keys(this.fields).forEach(function(field) {
      if(self.fields[field] === "LITERAL") {
        if(self.values[field].toData) {
          val = self.values[field].toData(offset, mapper);
        }
        else {
          val = self.values[field];
        }
      }
      else {
        val = self.values[field];
      }

      if(mapper) {
        mapper.addMapping(offset, {
          length: val.length,
          name: (self.name ? self.name : '') + ":" + field,
          value: self[field],
          description: self.descriptions[field]
        });
      }
      offset += val.length;

      data = data.concat(val);
    });
    return data;
  }
};

module.exports = Struct;

},{"./dataBuilding":74,"./makeStructy":77,"./nodeBuilder":78}],81:[function(require,module,exports){
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

},{"./asChars":67,"./toWOFF":82}],82:[function(require,module,exports){
var struct = require("./struct");
var dataBuilding = require("./dataBuilding");

/**
 * repackage an SFNT block as WOFF
 */
module.exports = function toWOFF(font) {
  var data = font.toData();
  var numTables = font.header.numTables;

  var wOFFheader = function(input) {
    if(!this.parse(input)) {
      input = input || {};
      input.signature = "wOFF";
      input.majorVersion = 1;
      input.minorVersion = 0;
      input.metaOffset = 0;
      input.metaLength = 0;
      input.metaOrigLength = 0;
      input.privOffset = 0;
      input.privLength = 0;
      input.length = 0;
      this.fill(input);
    }
  };

  wOFFheader.prototype = new struct("wOFF format", [
      ["signature",      "CHARARRAY", "this has to be the string 'wOFF'..."]
    , ["flavour",        "CHARARRAY", "The sfnt version of the wrapped font"]
    , ["length",         "ULONG",     "Total size of the WOFF file (placeholder, we compute this later)."]
    , ["numTables",      "USHORT",    "Number of entries in the directory of font tables."]
    , ["reserved",       "PADDING2",  "this must be set to zero"]
    , ["totalSfntSize",  "ULONG",     "Total size needed for the uncompressed original font"]
    , ["majorVersion",   "USHORT",    "Major version of the WOFF file (1 in this case)."]
    , ["minorVersion",   "USHORT",    "Minor version of the WOFF file (0 in this case)."]
    , ["metaOffset",     "ULONG",     "Offset to metadata block, from beginning of WOFF file. We don't use one"]
    , ["metaLength",     "ULONG",     "Length of compressed metadata block. This is obviously 0"]
    , ["metaOrigLength", "ULONG",     "Uncompressed size of metadata block. Also 0, of course."]
    , ["privOffset",     "ULONG",     "Offset to private data block, from beginning of WOFF file. We don't use one"]
    , ["privLength",     "ULONG",     "Length of private data block. Also obviously 0"]
  ]);

  var woff_header = new wOFFheader({
    flavour: "OTTO",
    numTables: numTables,
    totalSfntSize: data.length
  });

  var woff_dictionary = [],
      woff_data = [],
      woffset = woff_header.length + numTables * 20,
      woff;

  var wOFFdictionaryEntry = function(input) {
    if(!this.parse(input)) {
      input = input || {};
      this.fill(input);
    }
  };
  wOFFdictionaryEntry.prototype = new struct("wOFF dictionary entry", [
      ["tag",          "LITERAL", "tag name"]
    , ["offset",       "ULONG",   "Offset to the data, from beginning of WOFF file"]
    , ["compLength",   "LITERAL", "length of the compressed data table"]
    , ["origLength",   "LITERAL", "length of the original uncompressed data table"]
    , ["origChecksum", "LITERAL", "orginal table checksum"]
  ]);

  // build the woff table directory by copying the sfnt table
  // directory entries and duplicating the length value: we
  // are allowed to form uncompressed WOFF files, and do so.
  for(var i=0, last=numTables, chunk, entry; i<last; i++) {
    chunk = data.slice(12+i*16, 12 + (i+1)*16);
    var entry = new wOFFdictionaryEntry({
      tag: chunk.slice(0,4),
      offset: woffset + woff_data.length,
      compLength:chunk.slice(12,16),
      origLength: chunk.slice(12,16),
      origChecksum: chunk.slice(4,8)
    });

    woff_dictionary = woff_dictionary.concat(entry.toData());
    var otf_offset = dataBuilding.decodeULONG(chunk.slice(8,12)),
        otf_length = dataBuilding.decodeULONG(chunk.slice(12,16)),
        table_data = data.slice(otf_offset, otf_offset+otf_length);
    woff_data = woff_data.concat(table_data);
    while(woff_data.length % 4 !== 0) { woff_data.push(0); }
  }

  // finalise the header by recording the correct length for the font
  // (note that changing the value won't change the number of bytes).
  woff = woff_header.toData().concat(woff_dictionary).concat(woff_data);
  woff_header.length = woff.length;

  // done. WOFF is thankfully fairly straight-forward
  return woff_header.toData().concat(woff_dictionary).concat(woff_data);
};

},{"./dataBuilding":74,"./struct":80}]},{},[1])(1)
});