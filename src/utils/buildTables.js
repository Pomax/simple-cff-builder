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
