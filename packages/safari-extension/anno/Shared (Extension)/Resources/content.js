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
  removeEmpty: function removeEmpty(array2) {
    var ret = [];
    for (var i = 0; i < array2.length; i++) {
      if (array2[i]) {
        ret.push(array2[i]);
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
var getAnnolink = (url) => {
  let replacedURL = url;
  for (const [protocol, annoProtocol] of annoProtocolMap) {
    if (replacedURL.startsWith(protocol)) {
      replacedURL = replacedURL.replace(protocol, annoProtocol);
    }
  }
  return replacedURL;
};

// ../../node_modules/leven/index.js
var array = [];
var characterCodeCache = [];
function leven(first, second) {
  if (first === second) {
    return 0;
  }
  const swap = first;
  if (first.length > second.length) {
    first = second;
    second = swap;
  }
  let firstLength = first.length;
  let secondLength = second.length;
  while (firstLength > 0 && first.charCodeAt(~-firstLength) === second.charCodeAt(~-secondLength)) {
    firstLength--;
    secondLength--;
  }
  let start = 0;
  while (start < firstLength && first.charCodeAt(start) === second.charCodeAt(start)) {
    start++;
  }
  firstLength -= start;
  secondLength -= start;
  if (firstLength === 0) {
    return secondLength;
  }
  let bCharacterCode;
  let result;
  let temporary;
  let temporary2;
  let index = 0;
  let index2 = 0;
  while (index < firstLength) {
    characterCodeCache[index] = first.charCodeAt(start + index);
    array[index] = ++index;
  }
  while (index2 < secondLength) {
    bCharacterCode = second.charCodeAt(start + index2);
    temporary = index2++;
    result = index2;
    for (index = 0; index < firstLength; index++) {
      temporary2 = bCharacterCode === characterCodeCache[index] ? temporary : temporary + 1;
      temporary = array[index];
      result = array[index] = temporary > result ? temporary2 > result ? result + 1 : temporary2 : temporary2 > temporary ? temporary + 1 : temporary2;
    }
  }
  return result;
}

// ../../node_modules/text-quote-selector/dist/index.mjs
var contextLength = 32;
var getTextIndex = (root) => {
  const index = [];
  let text = "";
  const nodeIterator = document.createNodeIterator(root, NodeFilter.SHOW_TEXT);
  let node;
  while (node = nodeIterator.nextNode()) {
    if (!(node instanceof Text)) {
      throw new Error("node is not Text");
    }
    index.push([text.length, node]);
    text += node.textContent ?? "";
  }
  return { text, index };
};
var getTextRange = (range) => {
  const startNode = getRangePointNode({
    container: range.startContainer,
    offset: range.startOffset
  });
  const endNode = getRangePointNode({
    container: range.endContainer,
    offset: range.endOffset
  });
  const textNodes = [];
  const nodeIterator = document.createNodeIterator(range.commonAncestorContainer, NodeFilter.SHOW_ALL);
  let node;
  let isInRange = false;
  while (node = nodeIterator.nextNode()) {
    if (node === startNode) {
      isInRange = true;
    }
    if (isInRange && node instanceof Text) {
      textNodes.push(node);
    }
    if (node === endNode) {
      break;
    }
  }
  let startContainer;
  let startOffset = range.startOffset;
  startContainer = range.startContainer;
  if (!(startContainer instanceof Text)) {
    startContainer = textNodes.at(0);
    if (!startContainer) {
      throw new Error("startContainer not found");
    }
    startOffset = 0;
  }
  let endContainer;
  let endOffset = range.endOffset;
  endContainer = range.endContainer;
  if (!(endContainer instanceof Text)) {
    endContainer = textNodes.at(-1);
    if (!endContainer) {
      throw new Error("endContainer not found");
    }
    endOffset = (endContainer.textContent ?? "").length;
  }
  return {
    start: { textNode: startContainer, offset: startOffset },
    end: { textNode: endContainer, offset: endOffset }
  };
};
var quoteText = (textIndex, range) => {
  const { start, end } = getTextRange(range);
  const startIndex = textRangePointToIndex(textIndex, start);
  const endIndex = textRangePointToIndex(textIndex, end);
  return {
    exact: textIndex.text.slice(startIndex, endIndex),
    prefix: textIndex.text.slice(Math.max(startIndex - contextLength, 0), startIndex),
    suffix: textIndex.text.slice(endIndex, endIndex + contextLength)
  };
};
var textQuoteSelectorAll = (textIndex, { exact, prefix, suffix }) => {
  const exactMatchIndexes = [];
  let exactMatchIndex = -1;
  while ((exactMatchIndex = textIndex.text.indexOf(exact, exactMatchIndex + 1)) !== -1) {
    exactMatchIndexes.push(exactMatchIndex);
  }
  const matches = exactMatchIndexes.map((exactMatchIndex2) => {
    const exactMatchEndIndex = exactMatchIndex2 + exact.length;
    const prefixDistance = typeof prefix === "string" ? leven(textIndex.text.slice(Math.max(exactMatchIndex2 - contextLength, 0), exactMatchIndex2), prefix) : 0;
    const suffixDistance = typeof suffix === "string" ? leven(textIndex.text.slice(exactMatchEndIndex, exactMatchEndIndex + contextLength), suffix) : 0;
    const distance = prefixDistance + suffixDistance;
    return [exactMatchIndex2, distance];
  });
  return [...matches].sort(([, aDistance], [, bDistance]) => aDistance - bDistance).map(([startIndex, distance]) => {
    const start = indexToTextRangePoint(textIndex, {
      index: startIndex,
      isStart: true
    });
    const end = indexToTextRangePoint(textIndex, {
      index: startIndex + exact.length,
      isStart: false
    });
    const range = new Range();
    range.setStart(start.textNode, start.offset);
    range.setEnd(end.textNode, end.offset);
    return { range, distance };
  });
};
var textRangePointToIndex = (textIndex, { textNode, offset }) => {
  const record = textIndex.index.find(([, currentTextNode]) => currentTextNode === textNode);
  if (!record) {
    throw new Error("textNode not found in index");
  }
  const [index] = record;
  return index + offset;
};
var indexToTextRangePoint = (textIndex, { index, isStart }) => {
  let prev;
  for (const current of textIndex.index) {
    const [currentIndex] = current;
    if (isStart ? index < currentIndex : index <= currentIndex) {
      break;
    }
    prev = current;
  }
  if (!prev) {
    throw new Error("index out of range");
  }
  const [prevIndex, textNode] = prev;
  return {
    textNode,
    offset: index - prevIndex
  };
};
var getRangePointNode = ({ container, offset }) => container instanceof Text || container instanceof Comment || container instanceof CDATASection ? container : [...container.childNodes].at(offset) ?? container.nextSibling;

// ../text-quote-injection/src/index.ts
var getCanonicalURL = () => {
  const canonicalLinkElement = document.querySelector(
    'link[rel="canonical" i]'
  );
  const url = new URL(
    canonicalLinkElement instanceof HTMLLinkElement && canonicalLinkElement.href || location.href
  );
  url.hash = "";
  return String(url);
};
var injections = [];
var injectByTextQuote = (configs) => {
  const configIDs = configs.map(({ id }) => id);
  for (const { config, states } of injections) {
    if (configIDs.includes(config.id)) {
      continue;
    }
    for (const { cleanUp } of states) {
      cleanUp();
    }
  }
  injections = configs.map(
    (config) => injections.find((injection) => injection.config.id === config.id) ?? {
      config,
      states: []
    }
  );
  handle();
};
var handle = () => {
  mutationObserver.disconnect();
  try {
    let textIndex = getTextIndex(document.body);
    injections = injections.map((injection) => {
      const unchangedStates = injection.states.filter(
        ({ range, cleanUp, staticRange }) => {
          if (isEqualRange(range, staticRange)) {
            return true;
          }
          cleanUp();
          textIndex = getTextIndex(document.body);
          return false;
        }
      );
      const { nearestRanges, minDistance } = getNearestRanges(
        textIndex,
        injection.config.textQuoteSelector,
        Math.min(...unchangedStates.map(({ distance }) => distance))
      );
      return {
        ...injection,
        states: [
          ...unchangedStates,
          ...nearestRanges.flatMap((nearestRange) => {
            if (unchangedStates.some(
              (state) => isEqualRange(state.range, nearestRange)
            ))
              return [];
            const { range, cleanUp } = injection.config.inject(nearestRange);
            textIndex = getTextIndex(document.body);
            return [
              {
                range,
                cleanUp,
                staticRange: new StaticRange(range),
                distance: minDistance
              }
            ];
          })
        ]
      };
    });
  } finally {
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true
    });
  }
};
var mutationObserver = new MutationObserver(handle);
var getNearestRanges = (textIndex, textQuoteSelector, prevDistance) => {
  const ranges = textQuoteSelectorAll(textIndex, textQuoteSelector);
  const minDistance = Math.min(
    prevDistance,
    ranges.at(0)?.distance ?? Infinity
  );
  const nearestRanges = ranges.filter(({ range }) => {
    const ancestorHTMLElement = range.commonAncestorContainer instanceof HTMLElement ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    return !ancestorHTMLElement?.isContentEditable;
  }).flatMap(({ range, distance }) => distance <= minDistance ? [range] : []);
  return { nearestRanges, minDistance };
};
var isEqualRange = (a, b) => a.startContainer === b.startContainer && a.startOffset === b.startOffset && a.endContainer === b.endContainer && a.endOffset === b.endOffset;

// src/content.ts
var STYLE_ID = "anno-styles";
var SCROLL_TIMEOUT = 5e3;
var MAX_RETRY_ATTEMPTS = 3;
var RETRY_DELAY = 1e3;
var prevInjectionData;
var isHighlighted = false;
var prevURL;
async function withErrorHandling(operation, context, retries = 0) {
  try {
    return await operation();
  } catch (error) {
    const errorInfo = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : void 0,
      context: { operation: context, retries },
      timestamp: Date.now()
    };
    console.error(`[content] ${context} failed:`, errorInfo);
    const errorMessage = {
      type: "ERROR",
      error: errorInfo
    };
    try {
      await browser.runtime.sendMessage(errorMessage);
    } catch (sendError) {
      console.error("[content] Failed to report error to background:", sendError);
    }
    if (retries < MAX_RETRY_ATTEMPTS) {
      console.log(`[content] Retrying ${context} (${retries + 1}/${MAX_RETRY_ATTEMPTS})...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * (retries + 1)));
      return withErrorHandling(operation, context, retries + 1);
    }
    return null;
  }
}
function initializeStyles() {
  if (document.getElementById(STYLE_ID))
    return;
  const styleElement = document.createElement("style");
  styleElement.id = STYLE_ID;
  styleElement.textContent = `
    .anno {
      &.barmap {
        all: unset;
        position: fixed;
        width: 16px;
        border-top: 8px solid transparent;
        border-bottom: 8px solid transparent;
        background-clip: padding-box;
        cursor: pointer;
        opacity: 0.5;
        z-index: 2147483647;
        transition: opacity 0.2s ease;
        
        &:hover {
          opacity: 0.8;
        }
      }

      &.icon {
        all: revert;
        border: none;
        vertical-align: text-bottom;
      }

      &.marker {
        all: revert;
        transition: background-color 0.2s ease;
      }
    }
  `;
  document.head.appendChild(styleElement);
}
var mark = async () => {
  console.log("[content] mark() called");
  console.log("[content] prevInjectionData:", prevInjectionData);
  if (!prevInjectionData) {
    console.warn("[content] No injection data available for marking");
    prevInjectionData = {
      annoProjectName: "tkgshn-private",
      pageRecord: {}
    };
    console.log("[content] Created default injection data");
  }
  await withErrorHandling(async () => {
    const title = document.title || (/* @__PURE__ */ new Date()).toLocaleString();
    const headerLines = [];
    if (!prevInjectionData?.collaboratedPage) {
      const gyazoIDMatch = location.pathname.match(/^\/([0-9a-z]{32})$/);
      if (location.host.match(/^([0-9a-z\-]+\.)?gyazo.com$/) && gyazoIDMatch) {
        const response = await fetch(
          `/${encodeURIComponent(gyazoIDMatch[1])}.json`
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch gyazo.com: ${response.status}`);
        }
        const { desc, metadata, permalink_url } = await response.json();
        headerLines.push(
          ...[
            `[${permalink_url} ${permalink_url}]`,
            desc || void 0,
            metadata.url ? metadata.title ? `[${metadata.title} ${metadata.url}]` : `[${metadata.url}]` : metadata.title,
            metadata.exif_normalized?.latitude && `[N${metadata.exif_normalized.latitude},E${metadata.exif_normalized.longitude},Z17]`
          ].flatMap((data) => typeof data === "string" ? data.split("\n") : [])
        );
      } else {
        headerLines.push(`[${title} ${getCanonicalURL()}]`);
        const metaTags = {
          ogImage: document.querySelector('meta[property="og:image" i]'),
          description: document.querySelector('meta[name="description" i]'),
          ogDescription: document.querySelector('meta[property="og:description" i]'),
          keywords: document.querySelector('meta[name="keywords" i]')
        };
        const ogImageURL = metaTags.ogImage instanceof HTMLMetaElement ? metaTags.ogImage.content : null;
        if (ogImageURL) {
          headerLines.push(`[${ogImageURL}#.png]`);
        }
        const description = metaTags.ogDescription instanceof HTMLMetaElement && metaTags.ogDescription.content || metaTags.description instanceof HTMLMetaElement && metaTags.description.content;
        if (description) {
          headerLines.push(...description.split("\n").map((line) => `> ${line}`));
        }
        const keywords = metaTags.keywords instanceof HTMLMetaElement ? metaTags.keywords.content : null;
        if (keywords) {
          headerLines.push(keywords);
        }
      }
      const today = /* @__PURE__ */ new Date();
      const yyyy = today.getFullYear();
      const mm = today.getMonth() + 1;
      const dd = today.getDate();
      const dateBracket = `[${yyyy}/${mm}/${dd}]`;
      headerLines.push(dateBracket);
      headerLines.push("[public.icon]");
      headerLines.push(
        `#annopage [${decodeURI(getAnnolink(getCanonicalURL()))}]`,
        ""
      );
    }
    await write({
      annopageLink: prevInjectionData.collaboratedPage ?? {
        projectName: prevInjectionData.annoProjectName,
        title
      },
      headerLines,
      includesPrefix: true,
      includesSuffix: true,
      markerText: prevInjectionData?.collaboratedPage?.configs.at(-1)?.markerText || "\u{1F340}"
    });
  }, "Mark selection");
};
var write = async ({
  annopageLink,
  headerLines,
  includesPrefix,
  includesSuffix,
  markerText
}) => {
  const lines = [...headerLines];
  const selection = getSelection();
  const isSelected = selection && !selection.isCollapsed && selection.rangeCount >= 1;
  console.log("[content] write() - selection:", {
    isSelected,
    isCollapsed: selection?.isCollapsed,
    rangeCount: selection?.rangeCount,
    selectedText: isSelected ? selection.toString() : null
  });
  if (isSelected) {
    const range = selection.getRangeAt(0);
    const textQuoteSelector = quoteText(
      getTextIndex(document.body),
      range
    );
    lines.push(
      `[${markerText} ${getCanonicalURL()}#${[
        `e=${encodeForScrapboxReadableLink(textQuoteSelector.exact)}`,
        ...includesPrefix && textQuoteSelector.prefix ? [`p=${encodeForScrapboxReadableLink(textQuoteSelector.prefix)}`] : [],
        ...includesSuffix && textQuoteSelector.suffix ? [`s=${encodeForScrapboxReadableLink(textQuoteSelector.suffix)}`] : []
      ].join("&")}]`
    );
    lines.push(
      ...textQuoteSelector.exact.trim().replaceAll(/^ +/gm, "").replaceAll(/\n{2,}/g, "\n").split("\n").map((line) => `> ${line}`)
    );
  }
  const scrapboxUrl = `https://scrapbox.io/${encodeURIComponent(
    annopageLink.projectName
  )}/${encodeURIComponent(annopageLink.title)}?${new URLSearchParams({
    body: lines.join("\n"),
    followRename: "true"
  })}`;
  console.log("[content] Opening Scrapbox URL:", scrapboxUrl);
  const openMessage = {
    type: "OPEN_TAB",
    url: scrapboxUrl
  };
  await browser.runtime.sendMessage(openMessage);
  await new Promise((resolve) => setTimeout(resolve, SCROLL_TIMEOUT));
  prevURL = void 0;
  handleDocumentChange();
};
browser.runtime.onMessage.addListener(
  async (message) => {
    console.log("[content] Received message:", message.type);
    switch (message.type) {
      case "MARK_SELECTION":
        await mark();
        break;
      case "INJECT_ANNOTATIONS":
        await withErrorHandling(async () => {
          const configs = Object.values(
            message.data.pageRecord
          ).flatMap(({ configs: configs2 }) => configs2);
          injectByTextQuote(
            configs.map((config) => ({
              id: JSON.stringify(config),
              textQuoteSelector: config.textQuoteSelector,
              inject: (range) => createAnnotation(range, config)
            }))
          );
          prevInjectionData = message.data;
        }, "Inject annotations");
        break;
      case "CLEAR_ANNOTATIONS":
        clearAnnotations();
        prevInjectionData = void 0;
        break;
      case "UPDATE_SETTINGS":
        console.log("[content] Settings updated:", message.settings);
        break;
      default:
        console.warn("[content] Unknown message type:", message.type);
    }
    if (message.type === "GET_ANNOTATION_COUNT") {
      const annotations = document.querySelectorAll(".anno.marker");
      return { count: annotations.length };
    }
  }
);
function createAnnotation(range, config) {
  const textRange = getTextRange(range);
  const splittedStartTextNode = textRange.start.textNode.splitText(
    textRange.start.offset
  );
  const end = textRange.start.textNode === textRange.end.textNode ? {
    textNode: splittedStartTextNode,
    offset: textRange.end.offset - textRange.start.offset
  } : textRange.end;
  end.textNode.splitText(end.offset);
  const splittedRange = new Range();
  splittedRange.setStart(splittedStartTextNode, 0);
  splittedRange.setEnd(end.textNode, end.offset);
  const textNodes = [];
  const nodeIterator = document.createNodeIterator(
    splittedRange.commonAncestorContainer,
    NodeFilter.SHOW_TEXT
  );
  let currentNode;
  let isInRange = false;
  while (currentNode = nodeIterator.nextNode()) {
    if (currentNode === splittedRange.startContainer) {
      isInRange = true;
    }
    if (isInRange && currentNode instanceof Text) {
      textNodes.push(currentNode);
    }
    if (currentNode === splittedRange.endContainer) {
      break;
    }
  }
  const colorMap = /* @__PURE__ */ new Map([
    ["\u{1F7E5}", "hsl(0 100% 87.5%)"],
    ["\u{1F7E7}", "hsl(40 100% 87.5%)"],
    ["\u{1F7E8}", "hsl(60 100% 87.5%)"],
    ["\u{1F7E9}", "hsl(120 100% 87.5%)"],
    ["\u{1F7E6}", "hsl(240 100% 87.5%)"],
    ["\u{1F7EA}", "hsl(300 100% 87.5%)"],
    ["\u{1F7EB}", "hsl(0 25% 75%)"],
    ["\u2B1B", "hsl(0 0% 75%)"],
    ["\u2B1C", "transparent"]
  ]);
  const color = colorMap.get(config.markerText) ?? "hsl(120 50% 85%)";
  const markElements = textNodes.map((textNode) => {
    const markElement = document.createElement("mark");
    markElement.classList.add("anno", "marker");
    markElement.style.backgroundColor = color;
    textNode.after(markElement);
    markElement.append(textNode);
    return markElement;
  });
  const iframeElements = config.iframes.map((iframe) => {
    const iframeElement = document.createElement("iframe");
    iframeElement.src = iframe.url;
    iframeElement.sandbox.add(
      "allow-popups",
      "allow-popups-to-escape-sandbox",
      "allow-scripts"
    );
    iframeElement.classList.add("anno", "icon");
    iframeElement.style.width = `${iframe.width}px`;
    iframeElement.style.height = `${iframe.height}px`;
    return iframeElement;
  });
  markElements.at(-1)?.after(...iframeElements);
  let ancestorElement = splittedRange.commonAncestorContainer instanceof Element ? splittedRange.commonAncestorContainer : splittedRange.commonAncestorContainer.parentElement;
  while (ancestorElement) {
    if (!ancestorElement.scrollTop) {
      ancestorElement.scrollTop = 1;
    }
    if (ancestorElement.scrollTop && ancestorElement.scrollHeight > ancestorElement.clientHeight && getComputedStyle(ancestorElement).overflowY !== "hidden") {
      break;
    }
    ancestorElement = ancestorElement.parentElement;
  }
  const scrollableAncestorElement = ancestorElement ?? document.documentElement;
  const barmapElement = document.createElement("button");
  barmapElement.classList.add("anno", "barmap");
  barmapElement.style.backgroundColor = color;
  barmapElement.setAttribute("aria-label", "Scroll to annotation");
  const nextRange = new Range();
  const firstTextNode = textNodes[0];
  const lastTextNode = textNodes[textNodes.length - 1];
  if (firstTextNode) {
    nextRange.setStart(firstTextNode, 0);
  }
  if (lastTextNode) {
    nextRange.setEnd(lastTextNode, lastTextNode.textContent?.length ?? 0);
  }
  barmapElement.addEventListener("click", () => {
    const { exact, prefix, suffix } = quoteText(
      getTextIndex(document.body),
      nextRange
    );
    const url = new URL(location.href);
    url.hash = `#${[
      `e=${encodeForScrapboxReadableLink(exact)}`,
      ...prefix ? [`p=${encodeForScrapboxReadableLink(prefix)}`] : [],
      ...suffix ? [`s=${encodeForScrapboxReadableLink(suffix)}`] : []
    ].join("&")}`;
    history.pushState(null, "", url);
    prevURL = void 0;
    handleDocumentChange();
  });
  document.body.append(barmapElement);
  const handleResize = () => {
    const elements = [...markElements, ...iframeElements];
    const isVisible = elements.some((element) => element.offsetParent);
    if (!isVisible) {
      barmapElement.style.display = "none";
      return;
    }
    const scrollableAncestorDOMRect = scrollableAncestorElement === document.documentElement ? new DOMRect() : scrollableAncestorElement.getBoundingClientRect();
    const domRects = elements.map(
      (element) => element.getBoundingClientRect()
    );
    const top = Math.min(...domRects.map((domRect) => domRect.top));
    const bottom = Math.max(...domRects.map((domRect) => domRect.bottom));
    const clientTop = (scrollableAncestorElement.scrollTop + (top - scrollableAncestorDOMRect.top)) / scrollableAncestorElement.scrollHeight * scrollableAncestorElement.clientHeight;
    const clientBottom = (scrollableAncestorElement.scrollTop + (bottom - scrollableAncestorDOMRect.top)) / scrollableAncestorElement.scrollHeight * scrollableAncestorElement.clientHeight;
    barmapElement.style.display = "block";
    barmapElement.style.left = `${scrollableAncestorDOMRect.left + scrollableAncestorElement.clientWidth - 16}px`;
    barmapElement.style.top = `${scrollableAncestorDOMRect.top + clientTop - 16}px`;
    barmapElement.style.height = `${Math.max(
      clientBottom - clientTop,
      4
    )}px`;
  };
  const resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(document.body);
  handleResize();
  return {
    range: nextRange,
    cleanUp: () => {
      resizeObserver.disconnect();
      markElements.forEach((markElement) => {
        markElement.after(...markElement.childNodes);
        markElement.remove();
      });
      iframeElements.forEach((iframeElement) => {
        iframeElement.remove();
      });
      barmapElement.remove();
    }
  };
}
function clearAnnotations() {
  document.querySelectorAll(".anno").forEach((element) => {
    if (element.classList.contains("marker")) {
      element.after(...element.childNodes);
    }
    element.remove();
  });
}
var highlight = () => {
  if (isHighlighted)
    return;
  let searchParams;
  try {
    searchParams = new URLSearchParams(location.hash.slice(1));
  } catch {
    return;
  }
  const exact = searchParams.get("e");
  if (!exact)
    return;
  const selection = getSelection();
  if (!selection)
    return;
  const results = textQuoteSelectorAll(getTextIndex(document.body), {
    exact,
    prefix: searchParams.get("p") ?? void 0,
    suffix: searchParams.get("s") ?? void 0
  });
  const range = results[0]?.range;
  if (!range)
    return;
  selection.removeAllRanges();
  selection.addRange(range);
  const startElement = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
  startElement?.scrollIntoView({ block: "center", behavior: "smooth" });
  isHighlighted = true;
};
var checkURLChange = () => {
  if (prevURL !== location.href) {
    const urlChangeMessage = {
      type: "URL_CHANGED",
      url: getCanonicalURL(),
      prevInjectionData
    };
    withErrorHandling(
      () => browser.runtime.sendMessage(urlChangeMessage),
      "Send URL change"
    );
    isHighlighted = false;
  }
  prevURL = location.href;
};
var handleDocumentChange = () => {
  checkURLChange();
  highlight();
};
var mutationObserver2 = new MutationObserver(handleDocumentChange);
function initialize() {
  console.log("[content] Initializing anno content script...");
  console.log("[content] Current URL:", window.location.href);
  console.log("[content] Browser API available:", typeof browser !== "undefined");
  initializeStyles();
  handleDocumentChange();
  mutationObserver2.observe(document, {
    subtree: true,
    childList: true,
    characterData: true
  });
  const pageLoadedMessage = {
    type: "PAGE_LOADED",
    url: getCanonicalURL()
  };
  withErrorHandling(
    () => browser.runtime.sendMessage(pageLoadedMessage),
    "Send page loaded"
  );
  console.log("[content] Initialization complete");
}
document.body.addEventListener("pointerdown", async (event) => {
  const selection = getSelection();
  const selectedElement = document.elementFromPoint(
    event.clientX,
    event.clientY
  );
  if (!(event.ctrlKey || event.metaKey) || !event.altKey || !selection || !selectedElement) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const range = new Range();
  range.selectNode(selectedElement);
  selection.removeAllRanges();
  selection.addRange(range);
  await mark();
});
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
//# sourceMappingURL=content.js.map
