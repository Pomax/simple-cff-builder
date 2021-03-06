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
