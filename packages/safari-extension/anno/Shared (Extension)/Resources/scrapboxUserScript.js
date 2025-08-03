// src/browser-polyfill.ts
var browser = (() => {
  if (typeof globalThis.browser !== "undefined") {
    const api = globalThis.browser;
    api._isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    api._isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    return api;
  }
  if (typeof globalThis.chrome !== "undefined" && globalThis.chrome.runtime) {
    const api = globalThis.chrome;
    api._isSafari = false;
    api._isIOS = false;
    return api;
  }
  console.error("No browser extension API found!");
  return {
    _isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
    _isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
    runtime: {
      onMessage: { addListener: () => {
      } },
      sendMessage: () => Promise.resolve(),
      getURL: (path) => path
    },
    storage: {
      sync: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve()
      },
      local: {
        get: () => Promise.resolve({}),
        set: () => Promise.resolve()
      }
    },
    action: {
      onClicked: { addListener: () => {
      } }
    },
    tabs: {
      sendMessage: () => Promise.resolve(),
      query: () => Promise.resolve([])
    }
  };
})();
if (typeof globalThis.browser === "undefined") {
  globalThis.browser = browser;
}
if (typeof globalThis.chrome === "undefined") {
  globalThis.chrome = browser;
}

// src/url.ts
var encodeForScrapboxReadableLink = (uriComponent) => {
  let encoded = encodeURIComponent(uriComponent);
  encoded = encoded.replaceAll("%20", "+");
  for (const match of uriComponent.matchAll(
    /[\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Han}]/gu
  )) {
    encoded = encoded.replace(encodeURIComponent(match[0]), match[0]);
  }
  return encoded;
};

// ../../node_modules/diff/lib/index.mjs
function Diff() {
}
Diff.prototype = {
  diff: function diff(oldString, newString) {
    var _options$timeout;
    var options = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : {};
    var callback = options.callback;
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    this.options = options;
    var self = this;
    function done(value) {
      if (callback) {
        setTimeout(function() {
          callback(void 0, value);
        }, 0);
        return true;
      } else {
        return value;
      }
    }
    oldString = this.castInput(oldString);
    newString = this.castInput(newString);
    oldString = this.removeEmpty(this.tokenize(oldString));
    newString = this.removeEmpty(this.tokenize(newString));
    var newLen = newString.length, oldLen = oldString.length;
    var editLength = 1;
    var maxEditLength = newLen + oldLen;
    if (options.maxEditLength) {
      maxEditLength = Math.min(maxEditLength, options.maxEditLength);
    }
    var maxExecutionTime = (_options$timeout = options.timeout) !== null && _options$timeout !== void 0 ? _options$timeout : Infinity;
    var abortAfterTimestamp = Date.now() + maxExecutionTime;
    var bestPath = [{
      oldPos: -1,
      lastComponent: void 0
    }];
    var newPos = this.extractCommon(bestPath[0], newString, oldString, 0);
    if (bestPath[0].oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
      return done([{
        value: this.join(newString),
        count: newString.length
      }]);
    }
    var minDiagonalToConsider = -Infinity, maxDiagonalToConsider = Infinity;
    function execEditLength() {
      for (var diagonalPath = Math.max(minDiagonalToConsider, -editLength); diagonalPath <= Math.min(maxDiagonalToConsider, editLength); diagonalPath += 2) {
        var basePath = void 0;
        var removePath = bestPath[diagonalPath - 1], addPath = bestPath[diagonalPath + 1];
        if (removePath) {
          bestPath[diagonalPath - 1] = void 0;
        }
        var canAdd = false;
        if (addPath) {
          var addPathNewPos = addPath.oldPos - diagonalPath;
          canAdd = addPath && 0 <= addPathNewPos && addPathNewPos < newLen;
        }
        var canRemove = removePath && removePath.oldPos + 1 < oldLen;
        if (!canAdd && !canRemove) {
          bestPath[diagonalPath] = void 0;
          continue;
        }
        if (!canRemove || canAdd && removePath.oldPos + 1 < addPath.oldPos) {
          basePath = self.addToPath(addPath, true, void 0, 0);
        } else {
          basePath = self.addToPath(removePath, void 0, true, 1);
        }
        newPos = self.extractCommon(basePath, newString, oldString, diagonalPath);
        if (basePath.oldPos + 1 >= oldLen && newPos + 1 >= newLen) {
          return done(buildValues(self, basePath.lastComponent, newString, oldString, self.useLongestToken));
        } else {
          bestPath[diagonalPath] = basePath;
          if (basePath.oldPos + 1 >= oldLen) {
            maxDiagonalToConsider = Math.min(maxDiagonalToConsider, diagonalPath - 1);
          }
          if (newPos + 1 >= newLen) {
            minDiagonalToConsider = Math.max(minDiagonalToConsider, diagonalPath + 1);
          }
        }
      }
      editLength++;
    }
    if (callback) {
      (function exec() {
        setTimeout(function() {
          if (editLength > maxEditLength || Date.now() > abortAfterTimestamp) {
            return callback();
          }
          if (!execEditLength()) {
            exec();
          }
        }, 0);
      })();
    } else {
      while (editLength <= maxEditLength && Date.now() <= abortAfterTimestamp) {
        var ret = execEditLength();
        if (ret) {
          return ret;
        }
      }
    }
  },
  addToPath: function addToPath(path, added, removed, oldPosInc) {
    var last = path.lastComponent;
    if (last && last.added === added && last.removed === removed) {
      return {
        oldPos: path.oldPos + oldPosInc,
        lastComponent: {
          count: last.count + 1,
          added,
          removed,
          previousComponent: last.previousComponent
        }
      };
    } else {
      return {
        oldPos: path.oldPos + oldPosInc,
        lastComponent: {
          count: 1,
          added,
          removed,
          previousComponent: last
        }
      };
    }
  },
  extractCommon: function extractCommon(basePath, newString, oldString, diagonalPath) {
    var newLen = newString.length, oldLen = oldString.length, oldPos = basePath.oldPos, newPos = oldPos - diagonalPath, commonCount = 0;
    while (newPos + 1 < newLen && oldPos + 1 < oldLen && this.equals(newString[newPos + 1], oldString[oldPos + 1])) {
      newPos++;
      oldPos++;
      commonCount++;
    }
    if (commonCount) {
      basePath.lastComponent = {
        count: commonCount,
        previousComponent: basePath.lastComponent
      };
    }
    basePath.oldPos = oldPos;
    return newPos;
  },
  equals: function equals(left, right) {
    if (this.options.comparator) {
      return this.options.comparator(left, right);
    } else {
      return left === right || this.options.ignoreCase && left.toLowerCase() === right.toLowerCase();
    }
  },
  removeEmpty: function removeEmpty(array) {
    var ret = [];
    for (var i = 0; i < array.length; i++) {
      if (array[i]) {
        ret.push(array[i]);
      }
    }
    return ret;
  },
  castInput: function castInput(value) {
    return value;
  },
  tokenize: function tokenize(value) {
    return value.split("");
  },
  join: function join(chars) {
    return chars.join("");
  }
};
function buildValues(diff2, lastComponent, newString, oldString, useLongestToken) {
  var components = [];
  var nextComponent;
  while (lastComponent) {
    components.push(lastComponent);
    nextComponent = lastComponent.previousComponent;
    delete lastComponent.previousComponent;
    lastComponent = nextComponent;
  }
  components.reverse();
  var componentPos = 0, componentLen = components.length, newPos = 0, oldPos = 0;
  for (; componentPos < componentLen; componentPos++) {
    var component = components[componentPos];
    if (!component.removed) {
      if (!component.added && useLongestToken) {
        var value = newString.slice(newPos, newPos + component.count);
        value = value.map(function(value2, i) {
          var oldValue = oldString[oldPos + i];
          return oldValue.length > value2.length ? oldValue : value2;
        });
        component.value = diff2.join(value);
      } else {
        component.value = diff2.join(newString.slice(newPos, newPos + component.count));
      }
      newPos += component.count;
      if (!component.added) {
        oldPos += component.count;
      }
    } else {
      component.value = diff2.join(oldString.slice(oldPos, oldPos + component.count));
      oldPos += component.count;
      if (componentPos && components[componentPos - 1].added) {
        var tmp = components[componentPos - 1];
        components[componentPos - 1] = components[componentPos];
        components[componentPos] = tmp;
      }
    }
  }
  var finalComponent = components[componentLen - 1];
  if (componentLen > 1 && typeof finalComponent.value === "string" && (finalComponent.added || finalComponent.removed) && diff2.equals("", finalComponent.value)) {
    components[componentLen - 2].value += finalComponent.value;
    components.pop();
  }
  return components;
}
var characterDiff = new Diff();
var extendedWordChars = /^[A-Za-z\xC0-\u02C6\u02C8-\u02D7\u02DE-\u02FF\u1E00-\u1EFF]+$/;
var reWhitespace = /\S/;
var wordDiff = new Diff();
wordDiff.equals = function(left, right) {
  if (this.options.ignoreCase) {
    left = left.toLowerCase();
    right = right.toLowerCase();
  }
  return left === right || this.options.ignoreWhitespace && !reWhitespace.test(left) && !reWhitespace.test(right);
};
wordDiff.tokenize = function(value) {
  var tokens = value.split(/([^\S\r\n]+|[()[\]{}'"\r\n]|\b)/);
  for (var i = 0; i < tokens.length - 1; i++) {
    if (!tokens[i + 1] && tokens[i + 2] && extendedWordChars.test(tokens[i]) && extendedWordChars.test(tokens[i + 2])) {
      tokens[i] += tokens[i + 2];
      tokens.splice(i + 1, 2);
      i--;
    }
  }
  return tokens;
};
var lineDiff = new Diff();
lineDiff.tokenize = function(value) {
  if (this.options.stripTrailingCr) {
    value = value.replace(/\r\n/g, "\n");
  }
  var retLines = [], linesAndNewlines = value.split(/(\n|\r\n)/);
  if (!linesAndNewlines[linesAndNewlines.length - 1]) {
    linesAndNewlines.pop();
  }
  for (var i = 0; i < linesAndNewlines.length; i++) {
    var line = linesAndNewlines[i];
    if (i % 2 && !this.options.newlineIsToken) {
      retLines[retLines.length - 1] += line;
    } else {
      if (this.options.ignoreWhitespace) {
        line = line.trim();
      }
      retLines.push(line);
    }
  }
  return retLines;
};
var sentenceDiff = new Diff();
sentenceDiff.tokenize = function(value) {
  return value.split(/(\S.+?[.!?])(?=\s+|$)/);
};
var cssDiff = new Diff();
cssDiff.tokenize = function(value) {
  return value.split(/([{}:;,]|\s+)/);
};
function _typeof(obj) {
  "@babel/helpers - typeof";
  if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
    _typeof = function(obj2) {
      return typeof obj2;
    };
  } else {
    _typeof = function(obj2) {
      return obj2 && typeof Symbol === "function" && obj2.constructor === Symbol && obj2 !== Symbol.prototype ? "symbol" : typeof obj2;
    };
  }
  return _typeof(obj);
}
var objectPrototypeToString = Object.prototype.toString;
var jsonDiff = new Diff();
jsonDiff.useLongestToken = true;
jsonDiff.tokenize = lineDiff.tokenize;
jsonDiff.castInput = function(value) {
  var _this$options = this.options, undefinedReplacement = _this$options.undefinedReplacement, _this$options$stringi = _this$options.stringifyReplacer, stringifyReplacer = _this$options$stringi === void 0 ? function(k, v) {
    return typeof v === "undefined" ? undefinedReplacement : v;
  } : _this$options$stringi;
  return typeof value === "string" ? value : JSON.stringify(canonicalize(value, null, null, stringifyReplacer), stringifyReplacer, "  ");
};
jsonDiff.equals = function(left, right) {
  return Diff.prototype.equals.call(jsonDiff, left.replace(/,([\r\n])/g, "$1"), right.replace(/,([\r\n])/g, "$1"));
};
function canonicalize(obj, stack, replacementStack, replacer, key) {
  stack = stack || [];
  replacementStack = replacementStack || [];
  if (replacer) {
    obj = replacer(key, obj);
  }
  var i;
  for (i = 0; i < stack.length; i += 1) {
    if (stack[i] === obj) {
      return replacementStack[i];
    }
  }
  var canonicalizedObj;
  if ("[object Array]" === objectPrototypeToString.call(obj)) {
    stack.push(obj);
    canonicalizedObj = new Array(obj.length);
    replacementStack.push(canonicalizedObj);
    for (i = 0; i < obj.length; i += 1) {
      canonicalizedObj[i] = canonicalize(obj[i], stack, replacementStack, replacer, key);
    }
    stack.pop();
    replacementStack.pop();
    return canonicalizedObj;
  }
  if (obj && obj.toJSON) {
    obj = obj.toJSON();
  }
  if (_typeof(obj) === "object" && obj !== null) {
    stack.push(obj);
    canonicalizedObj = {};
    replacementStack.push(canonicalizedObj);
    var sortedKeys = [], _key;
    for (_key in obj) {
      if (obj.hasOwnProperty(_key)) {
        sortedKeys.push(_key);
      }
    }
    sortedKeys.sort();
    for (i = 0; i < sortedKeys.length; i += 1) {
      _key = sortedKeys[i];
      canonicalizedObj[_key] = canonicalize(obj[_key], stack, replacementStack, replacer, _key);
    }
    stack.pop();
    replacementStack.pop();
  } else {
    canonicalizedObj = obj;
  }
  return canonicalizedObj;
}
var arrayDiff = new Diff();
arrayDiff.tokenize = function(value) {
  return value.slice();
};
arrayDiff.join = arrayDiff.removeEmpty = function(value) {
  return value;
};

// ../scrapbox-loader/src/index.ts
var annoProtocolMap = /* @__PURE__ */ new Map([
  ["http:", "anno:"],
  ["https:", "annos:"]
]);
var isAnnolink = (url) => [...annoProtocolMap].some(([, annoProtocol]) => url.startsWith(annoProtocol));

// src/scrapboxUserScript.ts
var EXTENSION_ID = "";
if (!EXTENSION_ID) {
  throw new Error("EXTENSION_ID is not defined");
}
var annoImageURL = "https://i.gyazo.com/1e3dbb79088aa1627d7e092481848df5.png";
var collaborateMenuTitle = "Collaborate with anno";
scrapbox.PageMenu.addMenu({
  title: collaborateMenuTitle,
  image: annoImageURL,
  onClick: () => {
    if (!collaborateMessage) {
      return;
    }
    browser.runtime.sendMessage(EXTENSION_ID, collaborateMessage);
  }
});
var disabledCollaborateMenuTitle = "Can't Collaborate with anno because this Scrapbox page has no annolinks. ";
scrapbox.PageMenu.addMenu({
  title: disabledCollaborateMenuTitle,
  image: annoImageURL,
  onClick: () => {
    open(
      "https://scrapbox.io/hata6502/Can't_Collaborate_with_anno_because_this_Scrapbox_page_has_no_annolinks"
    );
  }
});
var markWordMenuTitle = "Mark word by anno";
scrapbox.PageMenu.addMenu({
  title: markWordMenuTitle,
  image: "https://i.gyazo.com/2e9dc1b43de352164a90a6d284ce0175.png",
  onClick: () => {
    const word = prompt("Word");
    if (!word) {
      return;
    }
    location.search = `?${new URLSearchParams({
      body: `[\u{1F340} https://scrapbox.io/hata6502/anno_word_marker#e=${encodeForScrapboxReadableLink(
        word
      )}]
${word.split("\n").map((line) => `> ${line}`).join("\n")}`
    })}`;
  }
});
var styleElement = document.createElement("style");
document.head.append(styleElement);
var setStyle = ({ isCollaboratable }) => {
  styleElement.textContent = `
    #${CSS.escape(collaborateMenuTitle)} {
      ${isCollaboratable ? "" : "display: none;"}
    }

    #${CSS.escape(disabledCollaborateMenuTitle)} {
      filter: saturate(0%);
      ${isCollaboratable ? "display: none;" : ""}
    }

    #${CSS.escape(markWordMenuTitle)} {
      ${isCollaboratable ? "" : "display: none;"}
    }
  `;
};
setStyle({ isCollaboratable: false });
var collaborateMessage;
var checkCollaboratable = async () => {
  const pageTitle = scrapbox.Page.title;
  if (!pageTitle) {
    return;
  }
  const annolinks = [];
  JSON.stringify(
    // @ts-expect-error
    scrapbox.Page.lines,
    (_key, value) => {
      const annolink = extractAnnolink(value);
      if (annolink) {
        annolinks.push(annolink);
      }
      return value;
    }
  );
  const uniqueAnnolinks = [...new Set(annolinks)];
  collaborateMessage = {
    type: "collaborate",
    // @ts-expect-error
    projectName: scrapbox.Project.name,
    pageTitle,
    annolinks: uniqueAnnolinks
  };
  setStyle({ isCollaboratable: Boolean(uniqueAnnolinks.length) });
};
var extractAnnolink = (value) => {
  if (typeof value !== "object" || value === null) {
    return;
  }
  if (!("type" in value) || value.type !== "link") {
    return;
  }
  if (!("unit" in value) || typeof value.unit !== "object" || value.unit === null) {
    return;
  }
  const { unit } = value;
  if ("project" in unit) {
    return;
  }
  if (!("page" in unit) || typeof unit.page !== "string") {
    return;
  }
  const { page } = unit;
  if (!isAnnolink(page)) {
    return;
  }
  return page;
};
checkCollaboratable();
scrapbox.on("lines:changed", checkCollaboratable);
scrapbox.on("page:changed", checkCollaboratable);
//# sourceMappingURL=scrapboxUserScript.js.map
