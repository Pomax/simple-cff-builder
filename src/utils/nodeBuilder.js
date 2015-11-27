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
