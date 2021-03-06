// Parses comments above variable declarations, function declarations,
// and object properties as docstrings and JSDoc-style type
// annotations.

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    return mod(require("../lib/infer"), require("../lib/tern"), require("acorn/util/walk"));
  if (typeof define == "function" && define.amd) // AMD
    return define(["../lib/infer", "../lib/tern", "acorn/util/walk"], mod);
  mod(tern, tern, acorn.walk);
})(function(infer, tern, walk) {
  "use strict";

  tern.registerPlugin("complete_strings", function(server, options) {
    server._completeStrings = { maxLen: options && options.maxLength || 15,
                                seen: Object.create(null) };
    server.on("reset", function() {
      server._completeStrings.seen = Object.create(null);
    });
    return {
      passes: {
        postParse: postParse,
        completion: complete
      }
    };
  });

  function postParse(ast) {
    var data = infer.cx().parent._completeStrings;
    walk.simple(ast, {
      Literal: function(node) {
        if (typeof node.value == "string" && node.value && node.value.length < data.maxLen)
          data.seen[node.value] = ast.sourceFile.name;
      }
    });
  }

  function complete(file, query) {
    var pos = tern.resolvePos(file, query.end);
    var lit = infer.findExpressionAround(file.ast, null, pos, file.scope, "Literal");
    if (!lit || typeof lit.node.value != "string") return;
    var before = lit.node.value.slice(0, pos - lit.node.start - 1);
    var matches = [], seen = infer.cx().parent._completeStrings.seen;
    for (var str in seen) if (str.length > before.length && str.indexOf(before) == 0) {
      if (query.types || query.docs || query.urls || query.origins) {
        var rec = {name: JSON.stringify(str), displayName: str};
        matches.push(rec);
        if (query.types) rec.type = "string";
        if (query.origins) rec.origin = seen[str];
      } else {
        matches.push(JSON.stringify(str));
      }
    }
    if (matches.length) return {
      start: tern.outputPos(query, file, lit.node.start),
      end: tern.outputPos(query, file, pos + (file.text.charAt(pos) == file.text.charAt(lit.node.start) ? 1 : 0)),
      isProperty: false,
      completions: matches
    };
  }
});
