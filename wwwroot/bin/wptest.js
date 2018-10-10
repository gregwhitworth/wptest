// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
/// <reference path="mithril.d.ts" />
var d = document;
var w = window;
var $ = document.querySelector.bind(document);
var $$ = document.querySelectorAll.bind(document);
var eFP = document.elementFromPoint.bind(document);
var gCS = window.getComputedStyle.bind(window);
var gBCW = elm => elm.getBoundingClientRect().width;
var gBCH = elm => elm.getBoundingClientRect().height;
var gBCT = elm => elm.getBoundingClientRect().top;
var gBCL = elm => elm.getBoundingClientRect().left;
var gBCB = elm => elm.getBoundingClientRect().bottom;
var gBCR = elm => elm.getBoundingClientRect().right;
var rAF = window.requestAnimationFrame.bind(window);
var describe = function (elm) {
    return elm.nodeName + (elm.id ? `#${elm.id}` : '') + (elm.classList.length ? `.${elm.classList[0]}` : '');
};
var convertObjectToDescription = function (arg) {
    if (arg === null)
        return "null";
    if (arg === undefined)
        return "undefined";
    if (arg instanceof String)
        return arg; // only string objects can get through
    if (typeof arg == "number") { // we allow more than what json recognizes
        if (Number.isNaN(arg))
            return "Number.NaN";
        if (!Number.isFinite(arg) && arg >= 0)
            return "Number.POSITIVE_INFINITY";
        if (!Number.isFinite(arg) && arg <= 0)
            return "Number.NEGATIVE_INFINITY";
        return JSON.stringify(arg);
    }
    if (typeof arg == 'function') {
        try {
            return `${arg}`;
        }
        catch (ex) { }
        return '[object Function]';
    }
    var tag = '', str = '', jsn = '';
    try {
        tag = Object.prototype.toString.call(arg);
    }
    catch (ex) { }
    ;
    try {
        str = `${arg}`;
    }
    catch (ex) { }
    try {
        jsn = JSON.stringify(arg);
    }
    catch (ex) { }
    if (str == tag) {
        str = '';
    }
    if (tag == '[object Object]')
        tag = '';
    if (arg.cloneNode && 'outerHTML' in arg) {
        try {
            return arg.cloneNode(false).outerHTML + ' ' + jsn;
        }
        catch (ex) { }
    }
    if (tag && (typeof (arg) == 'object' || typeof (arg) == 'symbol')) {
        try {
            return [tag, str, jsn].filter(x => x).join(' ');
        }
        catch (ex) { }
    }
    if (jsn)
        return jsn;
    if (str)
        return str;
    if (tag)
        return tag;
    return "[object]";
};
var buildSelectorFor = function (elm) {
    var isValidPair = (selector, elm) => {
        var matches = elm.ownerDocument.querySelectorAll(selector);
        return (matches.length == 1) && (matches[0] === elm);
    };
    var isValid = (selector) => {
        return isValidPair(selector, elm);
    };
    var getPossibleAttributesFor = (elm) => [
        // #id
        ...getIdsOf(elm).map(a => [
            { selector: `#${escapeIdentForCSS(a)}`, slot: 'id' }
        ]),
        // tagname
        [
            { selector: getTagNameOf(elm), slot: 'tag' }
        ],
        // .class
        ...getClassesOf(elm).map(c => [
            { selector: `.${escapeIdentForCSS(c)}`, slot: 'class' }
        ]),
        // tagname|#id ... [attribute]
        ...getAttributesOf(elm).map(a => [
            elm.id ? { selector: `#${escapeIdentForCSS(a)}`, slot: 'id' } : { selector: getTagNameOf(elm), slot: 'tag' },
            { selector: `[${a}]`, slot: 'class' } // atributes should never be non-css, and some have att=value
        ]),
        // tagname ... :nth-of-type(<int>)
        [
            { selector: getTagNameOf(elm), slot: 'tag' },
            { selector: `:nth-of-type(${getNthTypeOf(elm)})`, slot: 'pseudo' }
        ],
    ];
    var buildSelectorFrom = (input) => {
        var tag = '';
        var ids = '';
        var cls = '';
        var pse = '';
        for (var ss of input) {
            for (var s of ss) {
                switch (s.slot) {
                    case 'tag': {
                        tag = tag || s.selector;
                        break;
                    }
                    case 'id': {
                        ids = ids || s.selector;
                        break;
                    }
                    case 'class': {
                        cls += s.selector;
                        break;
                    }
                    case 'pseudo': {
                        pse += s.selector;
                        break;
                    }
                }
            }
        }
        return tag + ids + cls + pse;
    };
    var escapeIdentForCSS = (item) => ((item.split('')).map(function (character) {
        if (character === ':') {
            return "\\" + (':'.charCodeAt(0).toString(16).toUpperCase()) + " ";
        }
        else if (/[ !"#$%&'()*+,.\/;<=>?@\[\\\]^`{|}~]/.test(character)) {
            return "\\" + character;
        }
        else {
            return encodeURIComponent(character).replace(/\%/g, '\\');
        }
    }).join(''));
    var getTagNameOf = (elm) => escapeIdentForCSS(elm.tagName.toLowerCase());
    var getNthTypeOf = (elm) => {
        var index = 0, cur = elm;
        do {
            if (cur.tagName == elm.tagName) {
                index++;
            }
        } while (cur = cur.previousElementSibling);
        return index;
    };
    var getIdsOf = (elm) => {
        return elm.id ? [elm.id] : [];
    };
    var getClassesOf = (elm) => {
        var result = [];
        for (var i = 0; i < elm.classList.length; i++) {
            result.push(elm.classList[i]);
        }
        return result;
    };
    var getAttributesOf = (elm) => {
        var result = [];
        for (var i = 0; i < elm.attributes.length; i++) {
            switch (elm.attributes[i].name.toLowerCase()) {
                case "id":
                case "class":
                case "style": break;
                case "name": if (/^[_-a-z0-9]+$/i.test(elm.getAttribute('name'))) {
                    result.push('name="' + elm.getAttribute('name') + '"');
                    break;
                }
                case "type": if (elm instanceof HTMLInputElement) {
                    result.push('type=' + elm.type);
                    break;
                }
                default: result.push(elm.attributes[i].name);
            }
        }
        return result;
    };
    var buildLocalSelectorFor = (elm, prelude) => {
        // let's try to build a selector using the element only
        var options = getPossibleAttributesFor(elm);
        if (isValid(prelude + buildSelectorFrom(options))) {
            // let's remove stuff from the end until we can't
            var cur_opts = options.slice(0);
            var sav_opts = options.slice(options.length);
            while (cur_opts.length > 1 || (cur_opts.length > 0 && sav_opts.length > 0)) {
                var dropped_option = cur_opts.pop();
                var new_opts = sav_opts.length ? cur_opts.concat(sav_opts) : cur_opts;
                if (!isValid(prelude + buildSelectorFrom(new_opts))) {
                    sav_opts.unshift(dropped_option);
                }
            }
            // build the minimal selector
            var new_opts = sav_opts.length ? cur_opts.concat(sav_opts) : cur_opts;
            let elementSelector = buildSelectorFrom(new_opts);
            // if we could not remove :nth-of-type and have no prelude, we might want to add a prelude about the parent
            let parent = elm.parentElement;
            if (!prelude && ~elementSelector.indexOf(':nth-of-type')) {
                if (parent) {
                    // this will help disambiguate things a bit
                    if (parent.id) {
                        prelude = `#${escapeIdentForCSS(parent.id)} > `;
                    }
                    else if (~(['HTML', 'BODY', 'HEAD', 'MAIN'].indexOf(parent.tagName))) {
                        prelude = `${escapeIdentForCSS(getTagNameOf(parent))} > `;
                    }
                    else if (parent.classList.length) {
                        prelude = `${escapeIdentForCSS(getTagNameOf(parent))}.${escapeIdentForCSS(parent.classList[0])} > `;
                    }
                    else {
                        prelude = `${escapeIdentForCSS(getTagNameOf(parent))} > `;
                    }
                    // maybe we can even remove the nth-of-type now?
                    let simplifiedElementSelector = elementSelector.replace(/:nth-of-type\(.*?\)/, '');
                    if (isValid(prelude + simplifiedElementSelector)) {
                        elementSelector = simplifiedElementSelector;
                    }
                }
            }
            return prelude + elementSelector;
        }
        else if (prelude) {
            // the given prelude is not valid
            return null;
        }
        else {
            // let's see if we can just reply :root
            if (!elm.parentElement) {
                return ':root';
            }
            // let's try to find an id parent which can narrow down to one element only
            let generalPrelude = '';
            let cur = elm.parentElement;
            while (cur = cur.parentElement) {
                if (cur.id) {
                    let r = buildLocalSelectorFor(elm, `#${escapeIdentForCSS(cur.id)} `);
                    if (r)
                        return r;
                    break;
                }
            }
            // let's try again but this time using a class
            cur = elm.parentElement;
            while (cur = cur.parentElement) {
                if (cur.classList.length) {
                    for (let ci = 0; ci < cur.classList.length; ci++) {
                        let r = buildLocalSelectorFor(elm, `.${escapeIdentForCSS(cur.classList[ci])} `);
                        if (r)
                            return r;
                    }
                }
            }
            // let's just append this selector to a unique selector to its parent
            //TODO: actually, we should filter based on whether we find the element uniquely instead, not its parent
            let parentSelector = buildSelectorFor(elm.parentElement);
            return buildLocalSelectorFor(elm, parentSelector + " > ");
        }
    };
    return buildLocalSelectorFor(elm, '');
};
function encodeHash(text) {
    return text.replace(/\u200B/g, "\u200B\u200B").replace(/#/g, "\u200Bⵌ").replace(/%/g, "\u200B℅").replace(/\r/g, "\u200Br").replace(/\n/g, "\u200Bn").replace(/\t/g, "\u200Bt");
}
function decodeHash(text) {
    return text.replace(/(?:%[a-f0-9]+)+/gim, function (t) { try {
        return decodeURIComponent(t);
    }
    catch (ex) {
        return t;
    } }).replace(/\u200Bt/g, "\t").replace(/\u200Bn/g, "\n").replace(/\u200Br/g, "\r").replace(/\u200B℅/g, "%").replace(/\u200Bⵌ/g, "#").replace(/\u200B\u200B/g, "\u200B");
}
/* fix for pad */
if (window.external && ('DoEvents' in window.external)) {
    history.replaceState = function () { };
    history.pushState = function () { };
}
/* fix for ie */
if (!Array.from) {
    Array.from = function from(src, mapFn) {
        var array = new Array(src.length);
        for (var i = 0; i < src.length; i++) {
            array[i] = mapFn ? mapFn(src[i]) : src[i];
        }
        return array;
    };
}
if (!Object.assign) {
    Object.assign = function assign(target, source) {
        for (var key in source) {
            target[key] = source[key];
        }
    };
}
if (!String.raw) {
    String.raw = function (callSite, ...substitutions) {
        let template = Array.from(callSite.raw);
        return template.map((chunk, i) => {
            if (callSite.raw.length <= i) {
                return chunk;
            }
            return substitutions[i - 1] ? substitutions[i - 1] + chunk : chunk;
        }).join('');
    };
}
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
/// <reference path="monaco.d.ts" />
/// <reference path="wptest-helpers.tsx" />
m.route.prefix('#');
var amountOfRedrawSuspenders = 0;
function suspendRedrawsOn(codeToRun) {
    // add one more suspender to the list
    amountOfRedrawSuspenders += 1;
    // remove the suspender on completion
    new Promise(codeToRun).then(redrawIfReady, redrawIfReady);
    function redrawIfReady() {
        if (--amountOfRedrawSuspenders == 0) {
            // actually redraw if all suspenders are cleared
            m.redraw();
        }
    }
}
function redrawIfReady() {
    if (amountOfRedrawSuspenders == 0) {
        m.redraw();
    }
}
m.prop = function (cv) {
    return function (nv) {
        if (arguments.length >= 1) {
            if (cv !== nv) {
                cv = nv;
                redrawIfReady();
            }
        }
        else {
            return cv;
        }
    };
};
m.prop2 = function (get, set) {
    return function (nv) {
        if (arguments.length >= 1) {
            set(nv);
        }
        else {
            return get(nv);
        }
    };
};
m.addProps = function (o) {
    var r = Object.create(o);
    for (let key in o) {
        if (Object.prototype.hasOwnProperty.call(o, key)) {
            Object.defineProperty(r, key, { get() { return o[key]; }, set(v) { o[key] = v; redrawIfReady(); } });
            r[key + '$'] = function (v) {
                if (arguments.length == 0) {
                    return o[key];
                }
                else {
                    o[key] = v;
                }
            };
        }
    }
    r.sourceModel = o;
    return r;
};
React = {
    createElement(t, a, ...children) {
        return typeof (t) == 'string' ? m(t, a, children) : m(t(), a, children);
    }
};
class Tag {
    constructor() {
        this.prototype = Object.prototype;
    }
    with(prototype) {
        this.prototype = prototype;
        return this;
    }
    from(view) {
        var jsTagImplementation = {
            __proto__: this.prototype,
            state: Object.create(null),
            view(n) {
                var output = view(n.attrs, n.children, this);
                if (output instanceof Array) {
                    // no single wrapper --> no attribute generation
                    var outputName = n.attrs['of'] || 'body';
                    iterateChildrenArray(output);
                }
                else if (output.tag) {
                    var outputName = output.attrs ? (output.attrs['as'] || output.tag) : output.tag;
                    output.children && iterateChildrenArray(output.children);
                    if (n.attrs && n.attrs['of']) {
                        output.attrs || (output.attrs = Object.create(null));
                        output.attrs['of'] = n.attrs['of'];
                    }
                }
                return output;
                //-------------------------------------------------------------
                function iterateChildrenArray(nodes) {
                    for (var child of nodes) {
                        if (child instanceof Array) {
                            iterateChildrenArray(child);
                        }
                        else if (typeof (child) == 'object') {
                            child.attrs = child.attrs || {};
                            if (!child.attrs['of']) {
                                child.attrs['of'] = outputName;
                            }
                            if (child.children) {
                                iterateChildrenArray(child.children);
                            }
                        }
                        else {
                            // text nodes do not need an attribute
                        }
                    }
                }
            }
        };
        return () => jsTagImplementation;
    }
}
function cachedCast(input$, convertInput) {
    var currentInp = undefined;
    var currentOut = undefined;
    return function () {
        var inp = input$();
        if (inp !== currentInp) {
            currentInp = inp;
            currentOut = convertInput(inp);
        }
        return currentOut;
    };
}
function cachedDualCast(input$, convertInput, convertOutput) {
    var currentInp = undefined;
    var currentOut = undefined;
    return function (v) {
        if (arguments.length >= 1) {
            if (currentOut !== v) {
                input$(convertOutput(v));
                return v;
            }
        }
        else {
            var inp = input$();
            if (inp !== currentInp) {
                currentOut = convertInput(inp);
            }
            return currentOut;
        }
    };
}
function bindTo(x, attr = "value") {
    return m.withAttr(attr, x);
}
function attributesOf(a) {
    var o = Object.create(null);
    for (var key of Object.getOwnPropertyNames(a)) {
        if (key[key.length - 1] != '$') {
            o[key] = a[key];
        }
    }
    return o;
}
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
///
/// This file contains the view model of the application
///
/// <reference path="lib/wptest-framework.tsx" />
/// <reference path="lib/model.d.ts" />
/** The iframe in which vm.run() writes */
var getOutputPane = function () {
    var outputPane = document.getElementById('outputPane');
    if (outputPane) {
        getOutputPane = function () { return outputPane; };
    }
    return outputPane;
};
/** The document representation of the output pane */
var getOutputPaneElement = function () {
    if (!getOutputPane()) {
        var parser = new DOMParser();
        var doc = parser.parseFromString('', 'text/html');
        return doc.documentElement;
    }
    return getOutputPane().contentDocument.documentElement;
};
function appendToConsole(logo, content) {
    var jsPaneConsoleOutput = window.jsPaneConsoleOutput;
    if (jsPaneConsoleOutput) {
        var textContent = convertObjectToDescription(content);
        var logoSpan = document.createElement("span");
        {
            logoSpan.textContent = `${logo} `;
        }
        var contentSpan = document.createElement("span");
        {
            contentSpan.textContent = textContent;
        }
        var entry = document.createElement("div");
        {
            entry.title = textContent;
            entry.appendChild(logoSpan);
            entry.appendChild(contentSpan);
            entry.setAttribute('data-logo', logo);
        }
        jsPaneConsoleOutput.appendChild(entry);
        jsPaneConsoleOutput.scrollTop = jsPaneConsoleOutput.scrollHeight;
    }
}
/** Converts the javascript code of watches to standard javascript */
function expandShorthandsIn(jsCode) {
    var describeCode = "(node => node.nodeName + (node.id ? '#' + node.id : '') + (node.classList.length ? '.' + node.classList[0] : ''))(";
    if ("ActiveXObject" in window) { /* ie hack */
        describeCode = "(function(node){ return node.nodeName + (node.id ? '#' + node.id : '') + (node.classList.length ? '.' + node.classList[0] : '') })(";
    }
    return (jsCode
        .replace(/^\$\$\(/g, 'document.querySelectorAll(')
        .replace(/^\$\(/g, 'document.querySelector(')
        .replace(/\b\$\$\(/g, 'document.querySelectorAll(')
        .replace(/\b\$\(/g, 'document.querySelector(')
        .replace(/(\;|\,|\(|\)|\+|\-|\*|\/|\=|\<|\>|\||\&|\\|\s)\$\$\(/g, '$1document.querySelectorAll(')
        .replace(/(\;|\,|\(|\)|\+|\-|\*|\/|\=|\<|\>|\||\&|\\|\s)\$\(/g, '$1document.querySelector(')
        .replace(/^eFP\(/g, 'document.elementFromPoint(')
        .replace(/^eFP\b/g, 'document.elementFromPoint.bind(document)')
        .replace(/\beFP\(/g, 'document.elementFromPoint(')
        .replace(/\beFP\b/g, 'document.elementFromPoint.bind(document)')
        .replace(/^gCS\(/g, 'getComputedStyle(')
        .replace(/^gCS\b/g, 'getComputedStyle.bind(window)')
        .replace(/^rAF\(/g, 'requestAnimationFrame(')
        .replace(/^rAF\b/g, 'requestAnimationFrame.bind(window)')
        .replace(/\bgCS\(/g, 'getComputedStyle(')
        .replace(/\bgCS\b/g, 'getComputedStyle.bind(window)')
        .replace(/\brAF\(/g, 'requestAnimationFrame(')
        .replace(/\brAF\b/g, 'requestAnimationFrame.bind(window)')
        .replace(/\.gBCW\(\)/g, '.getBoundingClientRect().width')
        .replace(/\.gBCH\(\)/g, '.getBoundingClientRect().height')
        .replace(/\.gBCL\(\)/g, '.getBoundingClientRect().left')
        .replace(/\.gBCT\(\)/g, '.getBoundingClientRect().top')
        .replace(/\.gBCR\(\)/g, '.getBoundingClientRect().right')
        .replace(/\.gBCB\(\)/g, '.getBoundingClientRect().bottom')
        .replace(/^describe\(/g, describeCode)
        .replace(/\bdescribe\(/g, describeCode));
}
/** The data of the test being written (as ViewModel) */
var tm = m.addProps({
    title: "UntitledTest",
    html: "",
    css: "",
    jsBody: "",
    jsHead: "",
    watches: [],
    watchValues: []
});
/** The data of the test being written (as JSON) */
var getTestData = () => {
    // get the data
    var tmData = tm.sourceModel;
    // sync the watchValues before returning the data
    tmData.watchValues = tmData.watches.map(expr => vm.watchExpectedValues[expr]);
    // return the data
    return tmData;
};
/** Script test constants */
const SCRIPT_TESTS = Object.freeze({
    STATUS: Object.freeze({
        PASS: 0,
        FAIL: 1,
        TIMEOUT: 2,
        NOTRUN: 3
    }),
    PHASE: Object.freeze({
        INITIAL: 0,
        STARTED: 1,
        HAS_RESULT: 2,
        COMPLETE: 3
    })
});
/** The data used to represent the current state of the view */
class ViewModel {
    constructor() {
        // ===================================================
        // github state (readonly)
        // ===================================================
        this.githubUserData$ = cachedCast(() => document.cookie, cookie => {
            // read data from the user cookie (and trust it)
            var userCookie = decodeURIComponent(document.cookie.replace(new RegExp("(?:(?:^|.*;)\\s*" + encodeURIComponent('user').replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*([^;]*).*$)|^.*$"), "$1")) || 'null';
            // parse that data into an object
            var user = null;
            try {
                user = JSON.parse(userCookie.substr(2, userCookie.length - 46));
            }
            catch (ex) { }
            ;
            // return the result
            return user;
        });
        this.githubIsConnected$ = cachedCast(this.githubUserData$, user => !!user);
        this.githubUserName$ = cachedCast(this.githubUserData$, user => user ? user.username : "anonymous");
        this.githubUserId$ = cachedCast(this.githubUserData$, user => user ? user.id : null);
        this.githubUserEmail$ = cachedCast(this.githubUserData$, user => user ? user.email : null);
        // ===================================================
        // editor settings
        // ===================================================
        /** The id of the currently edited test */
        this.currentTestId$ = m.prop("new");
        /** The combined jsHead and jsBody */
        this.jsCombined$ = function (v) {
            if (arguments.length == 0) {
                var jsHead = tm.jsHead;
                var jsBody = tm.jsBody;
                if (jsHead) {
                    jsBody = '//<head>\r\n' + jsHead + '\r\n//</head>\r\n' + jsBody;
                }
                return jsBody;
            }
            else {
                var jsHead = '';
                var jsBody = v;
                jsBody = jsBody.replace(/^\/\/<head>\r\n((.|\r|\n)*)\r\n\/\/<\/head>\r\n/, function (m, code) {
                    jsHead = code;
                    return '';
                });
                tm.jsHead = jsHead;
                tm.jsBody = jsBody;
            }
        };
        this.isHtmlPaneFocused$ = m.prop(false);
        this.isCssPaneFocused$ = m.prop(false);
        this.isJsPaneFocused$ = m.prop(false);
        // ===================================================
        // jsPane settings
        // ===================================================
        /** The id of the currently active tab */
        this.activeJsTab$ = m.prop('jsPaneWatches');
        // ===================================================
        // dom viewer settings
        // ===================================================
        /** The last time the DOM Viewer Tree was updated */
        this.lastDOMUpdateTime$ = m.prop(-1);
        /** The HTML text being displayed in the tree of the DOM Viewer */
        this.domViewerHTMLText$ = m.prop("");
        // ===================================================
        // watch settings
        // ===================================================
        /** This value should be updated each time the watches are modified, and trigger their UI update */
        this.lastWatchUpdateTime$ = m.prop(-1);
        /** The readonly watches for the selected element */
        this.autoWatches = [
            "describe($0)",
            "$0.gBCW()",
            "$0.gBCH()",
            "gCS($0).display",
            "gCS($0).position",
            "gCS($0).marginLeft",
            "gCS($0).marginTop",
            "gCS($0).marginRight",
            "gCS($0).marginBottom",
            "gCS($0).borderLeftWidth",
            "gCS($0).borderTopWidth",
            "gCS($0).borderRightWidth",
            "gCS($0).borderBottomWidth",
            "gCS($0).paddingLeft",
            "gCS($0).paddingTop",
            "gCS($0).paddingRight",
            "gCS($0).paddingBottom",
            "describe($0.offsetParent)",
            "$0.offsetLeft",
            "$0.offsetTop",
        ].concat((e => {
            var ds = Array.from(getComputedStyle(document.documentElement)).sort();
            return ds.map(prop => `gCS($0)['${prop}']`);
        })());
        /** Cache of the script test results */
        this.scriptTestResults$ = m.prop([]);
        /** Determines whether the script test results should be visible */
        this.isScriptTestsVisible$ = m.prop(true);
        /** Metadata of all script test results */
        this.numberOfScriptTests$ = cachedCast(() => this.scriptTestResults$(), (tests) => { return tests.length; });
        this.numberOfSuccessfulScriptTests$ = cachedCast(() => this.scriptTestResults$(), (tests) => {
            return tests.reduce((c, t) => (c + (t.status === SCRIPT_TESTS.STATUS.PASS ? 1 : 0)), 0);
        });
        this.numberOfFailedScriptTests$ = cachedCast(() => this.scriptTestResults$(), (tests) => {
            return tests.reduce((c, t) => (c + (t.status === SCRIPT_TESTS.STATUS.PASS ? 0 : 1)), 0);
        });
        /** Cache of the values of the watches (as js object) */
        this.watchValues = Object.create(null);
        /** Cache of the values of the watches (as string) */
        this.watchDisplayValues = Object.create(null);
        /** Cache of the expected values of the watches (as js expressions) */
        this.watchExpectedValues = Object.create(null);
        /** Special flag map of watches to hide (because they have been pinned) */
        this.hiddenAutoWatches = Object.create(null);
        /** The text currently used as display-filter input for the watches */
        this.watchFilterText$ = m.prop("");
        /** The actual test used as display-filter for the watches (readonly) */
        this.watchFilter$ = cachedCast(() => this.watchFilterText$(), (filterText) => {
            // if no text in the search box, every watch matches
            var isTextMatching = (expr) => true;
            // convert the text into a matcher
            if (filterText.length > 0) {
                // normal case = indexOf search
                var filterTextLC = filterText.toLowerCase();
                isTextMatching = expr => !!~expr.toLowerCase().indexOf(filterTextLC);
                // special case if regexp is typed
                if (filterText.indexOf('/') == 0) {
                    var reg = null;
                    try {
                        reg = reg || eval(filterText);
                    }
                    catch (ex) { }
                    try {
                        reg = reg || eval(filterText + '/i');
                    }
                    catch (ex) { }
                    if (reg instanceof RegExp) {
                        isTextMatching = expr => reg.test(expr);
                    }
                }
            }
            // return the matcher
            return { matches: isTextMatching };
        });
        // ===================================================
        // watch replacement dialog
        // ===================================================
        this.welcomeDialog = new WelcomeDialogViewModel(this);
        // ===================================================
        // watch replacement dialog
        // ===================================================
        this.searchDialog = new SearchDialogViewModel(this);
        // ===================================================
        // watch replacement dialog
        // ===================================================
        this.selectorGenerationDialog = new SelectorGenerationDialogViewModel(this);
        // ===================================================
        // settings dialog
        // ===================================================
        this.settingsDialog = new SettingsDialogViewModel(this);
        // ===================================================
        // deleted user dialog
        // ===================================================
        this.deletedUserDialog = new DeletedUserDialogViewModel(this);
        // ===================================================
        // user testcases dialog
        // ===================================================
        this.userTestcasesDialog = new UserTestcasesDialogViewModel(this);
        // ===================================================
        // output frame settings
        // ===================================================
        /** Whether the mouse is being tracked to select a new element */
        this.isPicking$ = m.prop(false);
        /** The currently to-be-selected element under the mouse */
        this.selectedElement$ = m.prop(null);
        /** Whether a line jump is advised in the html editor */
        this.shouldMoveToSelectedElement$ = m.prop(false);
        /** The mapping between current source lines and source lines at the time of the last run */
        this.lineMapping = [0];
        /** How many source lines the current run had */
        this.lineMappingLineCount = 1;
        /** Cache of the auto-generated IDs, for cleaning purpose */
        this.idMappings = new Set();
        /** Whether the test model is still waiting on some data from the server */
        this.isLoading$ = m.prop(false);
    }
    /** Update sate management of the DOM Viewer tree */
    refreshDOMViewer() {
        this.domViewerHTMLText$(getOutputPaneElement().outerHTML);
        this.lastDOMUpdateTime$(performance.now());
    }
    setChangeInScriptTestVisibility(visible) {
        this.isScriptTestsVisible$(visible);
        this.lastWatchUpdateTime$(performance.now());
    }
    setupExpectedValueFor(expr) {
        // get the current expected value if any
        var currentExpectedValue = this.watchExpectedValues[expr];
        // get the current watch value if any
        var currentWatchValue = '';
        try {
            currentWatchValue = JSON.stringify(this.watchValues[expr]);
        }
        catch (ex) { }
        // now prompt for a new expected value
        var newValue = prompt("Please enter a javascript expression producing the expected value (leave empty to set none)", currentExpectedValue || currentWatchValue || '');
        // parse it into a form we can safely consider an expected value
        try {
            switch (newValue) {
                case null:
                case '':
                case 'true':
                case 'false':
                case 'null':
                case 'undefined':
                case 'Number.NaN':
                case 'Number.POSITIVE_INFINITY':
                case 'Number.NEGATIVE_INFINITY':
                    {
                        // sounds good
                        break;
                    }
                default:
                    {
                        // then it needs to be some json
                        newValue = JSON.parse(newValue);
                        // type must be a primitive type so we can safely eval it anytime
                        if (typeof (newValue) == 'string' || typeof (newValue) == 'number' || typeof (newValue) == 'boolean') {
                            newValue = JSON.stringify(newValue);
                        }
                        else {
                            throw new Error("Unsupported value; only primitive types are supported");
                        }
                    }
            }
        }
        catch (ex) {
            alert('Sorry, this value cannot be used as an expected value.\n\nOnly primitive types are supported.');
            console.error(ex);
            return;
        }
        // set this as the new expected value
        if (newValue) {
            this.watchExpectedValues[expr] = newValue;
        }
        else if (newValue === '') {
            delete this.watchExpectedValues[expr];
        }
        else {
            return; // because the user cancelled
        }
        // invalidate the current rendering (if necessary)
        vm.lastWatchUpdateTime$(performance.now());
        m.redraw();
    }
    /** Fetches the testcases for the given user and  */
    fetchTestcasesByUser(author) {
        fetch(`/u/${author}`, {
            method: 'GET',
            credentials: "same-origin"
        }).then((response) => {
            response.text().then(text => {
                this.userTestcasesDialog.tests$(JSON.parse(text));
            });
        }).catch(ex => {
            console.error(ex);
            console.log(`Oops, something went wrong... Can't seem to get the tests created by ${author}.`);
        });
    }
    /** Deletes the test by the gievn id and author */
    deleteTestcase(author, id) {
        fetch(`/delete/t/${id}/${author}`, {
            method: 'DELETE',
            credentials: "same-origin"
        }).then((response) => {
            response.text().then(text => {
                alert(text);
                this.fetchTestcasesByUser(author);
            });
        }).catch(ex => {
            console.error(ex);
            alert("Oops, something went wrong... Try deleting the test again.");
        });
    }
    /** Adds an expression to the list of watches (eventually bootstrapped with a value) */
    addPinnedWatch(expr, value) {
        // check that we have a base on which pinning this expression makes sense
        var processedExpression = expr;
        if (~expr.indexOf("$0")) {
            var w1 = window;
            if (!w1.$0) {
                // cannot pin an auto watch when no element is on the stack
                return;
            }
            else if (w1.$0replacement || w1.$0.id) {
                // we already know how to replace $0 by a stable expression
                processedExpression = processedExpression.replace(/\$0/g, w1.$0replacement || w1.$0.id);
            }
            else {
                // we need to show the dialog before replacing $0 by $0replacement
                var dialog = this.selectorGenerationDialog;
                dialog.watchExpression$(expr);
                dialog.watchValue$({ defined: arguments.length >= 2, value: value });
                dialog.autoId$(w1.$0.sourceTagId || '');
                dialog.chosenMode$(w1.$0.sourceTagId ? 'id' : 'selector');
                dialog.chosenId$(w1.$0.sourceTagId || '');
                dialog.chosenSelector$(buildSelectorFor(w1.$0));
                dialog.isOpened$(true);
                return;
            }
        }
        // if we were given a fake element as $0, we need to delete it before running the watches
        if (w1 && w1.$0 && 'id' in w1.$0 && !('nodeName' in w1.$0))
            window['$0'] = undefined;
        // actually pin this expresion now that the safety checks have run
        tm.watches.push(processedExpression);
        if (arguments.length >= 2) {
            // a value was provided for us, let's use it
            vm.watchValues[processedExpression] = value;
            vm.watchDisplayValues[processedExpression] = `${value}`; // TODO
        }
        else if (expr in vm.watchValues) {
            // we just pinned some auto watch
            vm.watchValues[processedExpression] = vm.watchValues[expr];
            vm.watchDisplayValues[processedExpression] = vm.watchDisplayValues[expr];
            vm.hiddenAutoWatches[expr] = true;
        }
        else {
            // we have no recollection of this watch, recompute everything
            vm.refreshWatches();
        }
        this.lastWatchUpdateTime$(performance.now());
    }
    /** Removes an expression from the list of watches */
    removePinnedWatch(expr) {
        var index = tm.watches.indexOf(expr);
        if (index >= 0) {
            tm.watches.splice(index, 1);
        }
        this.lastWatchUpdateTime$(performance.now());
    }
    /** Recomputes the values and display values of watches */
    refreshWatches(elm) {
        // possibly push elm on the stack of selected elements
        if (elm) {
            var w1 = window;
            var w2 = getOutputPane().contentWindow;
            w2.$9 = w1.$9 = w1.$8;
            w2.$8 = w1.$8 = w1.$7;
            w2.$7 = w1.$7 = w1.$6;
            w2.$6 = w1.$6 = w1.$5;
            w2.$5 = w1.$5 = w1.$4;
            w2.$4 = w1.$4 = w1.$3;
            w2.$3 = w1.$3 = w1.$2;
            w2.$2 = w1.$2 = w1.$1;
            w2.$1 = w1.$1 = w1.$0;
            w2.$0 = w1.$0 = elm;
            w1.$0replacement = undefined;
        }
        // reset state
        this.watchValues = Object.create(null);
        this.watchDisplayValues = Object.create(null);
        this.hiddenAutoWatches = Object.create(null);
        // evalute the watches
        var w1 = window;
        var w2 = getOutputPane().contentWindow;
        for (var expr of [...tm.watches, ...vm.autoWatches]) {
            var result = '';
            if (expr && (w1.$0 || !~expr.indexOf("$0"))) {
                try {
                    result = w2.eval(expandShorthandsIn(expr));
                }
                catch (ex) {
                    result = '!!!' + (ex.message ? ex.message : `${ex}`);
                }
            }
            // output the current value
            vm.watchValues[expr] = result;
            vm.watchDisplayValues[expr] = `${result}`; // TODO
        }
        this.lastWatchUpdateTime$(performance.now());
    }
    // ===================================================
    // general dialog settings
    // ===================================================
    closeAllDialogs() {
        this.selectorGenerationDialog.isOpened$(false);
        this.searchDialog.isOpened$(false);
        this.welcomeDialog.isOpened$(false);
        this.settingsDialog.isOpened$(false);
        this.userTestcasesDialog.isOpened$(false);
        this.deletedUserDialog.isOpened$(false);
    }
    /** Removes the user cookie */
    logOut() {
        document.cookie = 'user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        redrawIfReady();
    }
    /** Redirects to the login page */
    logIn() {
        var currentId = this.currentTestId$();
        if (currentId != 'local:save' && currentId != 'new') {
            sessionStorage.setItem('local:save', currentId);
        }
        location.href = '/login/github/start';
    }
    /** Deletes the user from the app and logs them out */
    deleteUser() {
        fetch('/delete/u', {
            method: 'DELETE',
            credentials: "same-origin"
        }).then((response) => {
            response.text().then(text => {
                this.deletedUserDialog.deletedUser$(this.githubUserName$());
                this.deletedUserDialog.newAnonymousUser$(text);
                this.logOut();
            });
        }).catch(ex => {
            console.error(ex);
            alert("Oops, something went wrong... Try deleting your account again.");
        });
    }
    /** Refreshes the output frame with the latest source code */
    run() {
        // hide outdated element outline
        this.isPicking$(false);
        this.selectedElement$(null);
        if (window.jsPaneConsoleOutput) {
            window.jsPaneConsoleOutput.innerHTML = '';
        }
        // bail out if we don't have loaded yet
        var outputPane = getOutputPane();
        if (!outputPane) {
            setTimeout(x => this.run(), 100);
            return;
        }
        // remove any $ values since we are going to clear the inner document
        var w1 = window;
        var w2 = outputPane.contentWindow;
        var recoverableElements = [];
        w1.$0replacement = undefined;
        for (var i = 10; i--;) {
            recoverableElements.unshift(w1['$' + i]);
            w1['$' + i] = w2['$' + i] = undefined;
        }
        for (var id of this.idMappings) {
            w2[id] = undefined;
        }
        this.idMappings.clear();
        // extract the doctype, if any (default to html5 doctype)
        var doctype = "<!doctype html>";
        var html = tm.html.replace(/<!doctype .*?>/gi, function (value) {
            doctype = value;
            return '';
        });
        // generate new document
        var d = outputPane.contentWindow.document;
        d.open();
        d.write(doctype);
        // prepare the console hooks
        outputPane.contentWindow.console.debug = function (...args) {
            args.forEach(arg => appendToConsole('-', arg));
            console.debug.apply(console, args);
        };
        outputPane.contentWindow.console.log = function (...args) {
            args.forEach(arg => appendToConsole('-', arg));
            console.log.apply(console, args);
        };
        outputPane.contentWindow.console.dir = function (...args) {
            args.forEach(arg => appendToConsole('-', arg));
            console.dir.apply(console, args);
        };
        outputPane.contentWindow.console.info = function (...args) {
            args.forEach(arg => appendToConsole('i', arg));
            console.info.apply(console, args);
        };
        outputPane.contentWindow.console.warn = function (...args) {
            args.forEach(arg => appendToConsole('!', arg));
            console.warn.apply(console, args);
        };
        outputPane.contentWindow.console.error = function (...args) {
            args.forEach(arg => appendToConsole('‼️', arg));
            console.error.apply(console, args);
        };
        // write the document content
        d.write("<title>" + tm.title.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</title>");
        d.write("<script>" + tm.jsHead + '<' + '/script> <script src="bin/testharness.js"><' + '/script>');
        d.write("<style>" + tm.css + "</style>");
        attributeLines(0);
        var htmlLines = html.split("\n");
        for (var lineIndex = 0; lineIndex < htmlLines.length;) {
            d.writeln(htmlLines[lineIndex]);
            attributeLines(++lineIndex);
        }
        d.write("<script>" + tm.jsBody + "<" + "/script>");
        d.close();
        // reset the line mapping
        vm.lineMapping = htmlLines.map((l, i) => i);
        vm.lineMappingLineCount = htmlLines.length;
        // create short names for all elements without custom id
        attributeIds(this);
        // recover $0/1/... values if we can
        for (var i = 10; i--;) {
            var elm = recoverableElements[i];
            if (elm) {
                try {
                    if (elm.id) {
                        w1['$' + i] = w2['$' + i] = w2.document.getElementById(elm.id);
                    }
                    else if (elm.sourceLine) {
                        // TODO: try to match elements by sourceLine and tagName
                    }
                }
                catch (ex) {
                    w1['$' + i] = w2['$' + i] = null;
                }
            }
        }
        // rerun the watches and refresh DOM viewer
        this.refreshWatches();
        this.refreshDOMViewer();
        //-------------------------------------------------------
        /** Detects newly inserted elements and note which html line generated them */
        function attributeLines(lineIndex) {
            for (var i = d.all.length; i--;) {
                if (d.all[i].sourceLine == undefined) {
                    d.all[i].sourceLine = lineIndex;
                }
                else {
                    break;
                }
            }
        }
        /** Creates global variables to easily access nodes without id */
        function attributeIds(vm) {
            var tagCounters = Object.create(null);
            for (var i = 0; ++i < d.all.length;) {
                var el = d.all[i];
                if (el.sourceLine > 0 && el != d.body) {
                    var tagCounter = tagCounters[el.tagName] = 1 + (tagCounters[el.tagName] | 0);
                    if (!el.id) {
                        var tagId = el.tagName.toLowerCase() + tagCounter;
                        if (!getOutputPane().contentWindow[tagId]) {
                            getOutputPane().contentWindow[tagId] = el;
                            el.sourceTagId = tagId;
                            vm.idMappings.add(tagId);
                            console.log(tagId, el);
                        }
                    }
                }
            }
        }
    }
    /** Saves the test in a json url */
    saveInUrl() {
        suspendRedrawsOn(redraw => {
            location.hash = "#/json:" + encodeHash(JSON.stringify(getTestData()));
            vm.currentTestId$(location.hash.substr(2));
            redraw();
            // pad has no easy-to-use address bar, so provide an easy source to copy the url:
            if (window.external && "DoEvents" in window.external) {
                prompt("Copy the url from here:", location.href);
            }
        });
    }
    /** Saves the test model in the localStorage */
    saveLocally() {
        var data = getTestData();
        var id = '';
        var idLetters = 'abcdefghijklmnopqrstuvwxyz0123456789';
        for (var i = 5; i--;) {
            id += idLetters[Math.floor(Math.random() * idLetters.length)];
        }
        sessionStorage.setItem('local:save', 'local:' + id);
        localStorage.setItem('local:' + id, JSON.stringify(data));
        localStorage.setItem('local:save', localStorage.getItem('local:' + id)); // in case the session gets lost
        suspendRedrawsOn(redraw => {
            this.currentTestId$("local:" + id);
            location.hash = "#/local:" + id;
            redraw();
        });
    }
    /** Saves the test model on the server */
    saveOnline() {
        // ensure test case title:
        if (!tm.title || tm.title == "UntitledTest") {
            try {
                tm.title = prompt("Enter a title for your test (pressing cancel will abort save)", tm.title);
                if (tm.title == null) {
                    tm.title = "UntitledTest";
                    return;
                }
            }
            catch (ex) {
                // do nothing
            }
        }
        // ensure the user is connected
        if (!this.githubIsConnected$()) {
            this.saveLocally();
            alert(`You are about to be redirected to the login page. Your current work has been saved locally with id ${sessionStorage.getItem('local:save')}, and will be recovered after you log in.`);
            this.settingsDialog.logIn();
            return;
        }
        // upload the testcase data
        var data = getTestData();
        fetch('/new/testcase/', {
            method: 'POST',
            body: JSON.stringify(data),
            credentials: "same-origin"
        }).then(r => r.json()).then(o => {
            sessionStorage.removeItem('local:save');
            localStorage.removeItem('local:save');
            suspendRedrawsOn(redraw => {
                // update the data
                this.currentTestId$(o.id);
                this.updateURLForTest();
                // refresh the iframe and view
                this.run();
                // remove suspender
                redraw();
            });
        }).catch(ex => {
            console.error(ex);
            alert("Oops, something went wrong... Try again or save locally by pressing ALT when you click on the save button.");
        });
    }
    /** Redirects the page to have the specified user's testcases in an dialog open */
    redirectToUsersTests(author) {
        this.userTestcasesDialog.previousUrl$(location.hash);
        history.replaceState(getTestData(), `Tests by ${this.githubUserName$()}`, `/#/u/${this.githubUserName$()}`);
    }
    /** Closes the testcases dialog and redirects back to the previous page */
    redirectBackFromUsersTests() {
        history.replaceState(getTestData(), document.title, this.userTestcasesDialog.previousUrl$());
        updatePageTitle();
    }
    /** Resets the test model based on new data */
    openFromJSON(newData) {
        this.isLoading$(false);
        this.watchValues = Object.create(null);
        this.watchDisplayValues = Object.create(null);
        this.watchExpectedValues = Object.create(null);
        Object.assign(tm.sourceModel, {
            title: 'UntitledTest',
            html: '',
            css: '',
            jsHead: '',
            jsBody: '',
            watches: [],
            watchValues: []
        });
        if (newData) {
            Object.assign(tm.sourceModel, newData);
            if (newData.watchValues && newData.watchValues.length) {
                for (var i = newData.watchValues.length; i--;) {
                    this.watchExpectedValues[newData.watches[i]] = newData.watchValues[i];
                }
            }
        }
        this.updateURLForTest();
        this.run();
    }
    /** Updates url and page title on test id change */
    updateURLForTest() {
        updatePageTitle();
        location.hash = '#/' + vm.currentTestId$();
        history.replaceState(getTestData(), document.title, location.href); // TODO: clone
    }
    /** Exports the test into a web platform test */
    saveToFile() {
        var html = '';
        function ln(...args) { html += String.raw(...args) + '\n'; }
        // extract the doctype, if any (default to html5 doctype)
        var doctype = "<!doctype html>";
        var tm_html = tm.html.replace(/<!doctype .*?>\s*\r?\n?/gi, function (value) {
            doctype = value.trim();
            return '';
        }).trim();
        // start the document
        ln `${doctype}`;
        // ensure test case title:
        if (!tm.title || tm.title == "UntitledTest") {
            try {
                tm.title = prompt("Enter a title for your test", tm.title);
                if (!tm.title) {
                    tm.title = 'UntitledTest';
                }
            }
            catch (ex) {
                // do nothing
            }
        }
        if (tm.title) {
            ln `<title>${tm.title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</title>`;
        }
        else {
            ln `<title>UntitledTest</title>`;
        }
        // ensure test case harness:
        var pathToHarness = "/resources/";
        try {
            pathToHarness = prompt("Enter the path to the testharness folder", pathToHarness);
            if (pathToHarness && !/\/$/.test(pathToHarness)) {
                pathToHarness += '/';
            }
        }
        catch (ex) {
            // do nothing
        }
        ln `<script src="${pathToHarness}testharness.js"></script>`;
        ln `<script src="${pathToHarness}testharnessreport.js"></script>`;
        // append the test case itself
        if (tm.jsHead) {
            ln `<script>${"\n\n" + tm.jsHead + "\n\n"}</script>`;
        }
        if (tm.css) {
            ln `<style>${"\n\n" + tm.css + "\n\n"}</style>`;
        }
        if (tm_html) {
            ln ``;
            ln `${tm_html}`;
            ln ``;
        }
        if (tm.jsBody) {
            ln `<script>${"\n\n" + tm.jsBody + "\n\n"}</script>`;
        }
        ln `<script>
var test_description = document.title;
promise_test(
	t => {
		return new Promise(test => addEventListener('load', e=>test()))
		${Array.from(tm.watches).map(expr => ({
            expression: expr,
            jsValue: vm.watchValues[expr]
        })).filter(w => !!w.expression).map(w => `.then(test => assert_equals(${expandShorthandsIn(w.expression)}, ${JSON.stringify(w.jsValue)}, ${JSON.stringify(`Invalid ${w.expression};`)}))`).join('\n\t\t')}
	},
	test_description
);
</script>`;
        var blob = new Blob([html], { type: 'text/html' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.setAttribute("download", "testcase.html");
        a.href = url;
        a.click();
        setTimeout(x => URL.revokeObjectURL(url), 10000);
    }
}
class SelectorGenerationDialogViewModel {
    constructor(vm) {
        /** The attached view model */
        this.vm = null;
        /** Whether the dialog is opened or closed */
        this.isOpened$ = m.prop(false);
        /** The raw watch expression we want to pin */
        this.watchExpression$ = m.prop("");
        /** Its precomputed value, in case one was given */
        this.watchValue$ = m.prop({ defined: false, value: undefined });
        /** The id auto-generated for the element, if any */
        this.autoId$ = m.prop("");
        /** Whether there is an auto-generated id (readonly) */
        this.isAutoAvailable$ = cachedCast(this.autoId$, x => !!x);
        /** The mode chosen by the user */
        this.chosenMode$ = m.prop("auto");
        /** The id the user typed in the text box (id mode) */
        this.chosenId$ = m.prop("");
        /** The selector the user typed in the text box (selector mode) */
        this.chosenSelector$ = m.prop("");
        this.vm = vm;
    }
}
class SettingsDialogViewModel {
    constructor(vm) {
        /** The attached view model */
        this.vm = null;
        /** Whether the dialog is opened or closed */
        this.isOpened$ = m.prop(false);
        /** Whether to use Monaco on this device or not */
        this.useMonaco$ = m.prop2((v) => {
            if (typeof (this.intenal_useMonaco) == 'undefined') {
                this.intenal_useMonaco = !localStorage.getItem('noMonaco');
            }
            return this.intenal_useMonaco;
        }, (v) => {
            this.intenal_useMonaco = !!v;
            localStorage.setItem('noMonaco', v ? '' : 'true');
        });
        this.vm = vm;
    }
    /** Ask the viewmodel to log the user out */
    logOut() {
        this.vm.logOut();
    }
    /** Ask the viewmodel to log a user in */
    logIn() {
        this.vm.logIn();
    }
    /** Ask the viewmodel to delete this user */
    deleteUser() {
        this.vm.deleteUser();
    }
    /** Open the welcome dialog */
    openWelcomeDialog() {
        this.vm.welcomeDialog.isOpened$(true);
    }
    /** Open the search dialog */
    openSearchDialog() {
        this.vm.searchDialog.isOpened$(true);
    }
}
class DeletedUserDialogViewModel {
    constructor(vm) {
        /** The attached view model */
        this.vm = null;
        /** Whether the dialog is opened or closed */
        this.isOpened$ = m.prop(false);
        /** The user that ws deleted */
        this.deletedUser$ = m.prop("");
        /** The username of the anonymous user name assigned to the tests from the deleted user */
        this.newAnonymousUser$ = m.prop("");
        this.vm = vm;
    }
}
class UserTestcasesDialogViewModel {
    constructor(vm) {
        /** The attached view model */
        this.vm = null;
        /** Whether the dialog is opened or closed */
        this.isOpened$ = m.prop(false);
        /** The author to display the tests of */
        this.author$ = m.prop("");
        /** The tests created by this author */
        this.tests$ = m.prop([]);
        /** The previous URL that was open to return to */
        this.previousUrl$ = m.prop("");
        this.vm = vm;
        this.author$(vm.githubUserName$());
        this.previousUrl$("/#/new");
    }
    updateAuthorOfTestcases(author) {
        this.author$(author);
        this.vm.fetchTestcasesByUser(author);
    }
    deleteTest(id) {
        this.vm.deleteTestcase(this.author$(), id);
    }
}
class WelcomeDialogViewModel {
    constructor(vm) {
        /** The attached view model */
        this.vm = null;
        /** Whether the dialog is opened or closed */
        this.isOpened$ = m.prop(false);
        this.vm = vm;
        if (location.hash == '' || location.hash == '#/new') {
            if (!localStorage.getItem('noWelcome') && !vm.githubIsConnected$()) {
                this.isOpened$(true);
            }
            else {
                localStorage.setItem('noWelcome', 'true');
            }
        }
        else {
            localStorage.setItem('noWelcome', 'true');
        }
    }
}
class SearchDialogViewModel {
    constructor(vm) {
        /** The attached view model */
        this.vm = null;
        /** Whether the dialog is opened or closed */
        this.isOpened$ = m.prop(false);
        /** Whether the dialog should get focus */
        this.shouldGetFocus$ = m.prop(false);
        /** The text that is being searched */
        this.searchTerms$ = m.prop("");
        /** The text that is being searched */
        this.searchUrl$ = m.prop("about:blank");
        this.vm = vm;
    }
    /** Opens the dialog */
    open() {
        if (!this.isOpened$()) {
            this.searchTerms$("");
            this.searchUrl$("about:blank");
            this.isOpened$(true);
        }
        this.shouldGetFocus$(true);
    }
}
var vm = new ViewModel();
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
/// <reference path="wptest-vm.tsx" />
var Input = new Tag().from(a => React.createElement("input", Object.assign({}, attributesOf(a), { value: a.value$(), oninput: bindTo(a.value$), onchange: bindTo(a.value$) })));
var InputCheckbox = new Tag().from(a => React.createElement("input", Object.assign({ type: "checkbox" }, attributesOf(a), { checked: a.value$(), onchange: bindTo(a.value$, "checked") })));
var InputRadio = new Tag().from(a => React.createElement("input", Object.assign({ type: "radio" }, attributesOf(a), { checked: a.checkedValue$() == a.value, onchange: bindTo(a.checkedValue$) })));
var TextArea = new Tag().from(a => React.createElement("textarea", Object.assign({}, attributesOf(a), { oninput: bindTo(a.value$), onchange: bindTo(a.value$) }), a.value$()));
var BodyToolbar = new Tag().from(a => React.createElement("body-toolbar", { row: true, role: "toolbar" },
    React.createElement("button", { onclick: e => vm.run(), title: "Move your code to the iframe" }, "Run"),
    React.createElement("button", { onclick: e => { if (e.shiftKey) {
            vm.saveInUrl();
        }
        else if (e.altKey) {
            vm.saveLocally();
        }
        else {
            vm.saveOnline();
        } }, title: "Save your test online (Shift: url, Alt: local storage)" }, "Save"),
    React.createElement("button", { onclick: e => vm.saveToFile(), title: "Download as a weplatform test case" }, "Export"),
    React.createElement("button", { onclick: e => vm.settingsDialog.isOpened$(true), title: "Open the settings dialog" }, "\u22C5\u22C5\u22C5"),
    React.createElement("hr", { style: "visibility: hidden; flex:1 0 0px;" }),
    React.createElement(Input, { "value$": a.model.title$, title: "Title of your test case" })));
var MonacoTextEditor = new Tag().with({
    oncreate(node) {
        // set default state values
        this.editor = null;
        this.value = node.attrs.value$();
        this.isDirty = false;
        // wait for monaco to load if needed
        if (localStorage.getItem('noMonaco'))
            return;
        require(['vs/editor/editor.main'], then => {
            // create the text editor, and save it in the state
            this.value = node.attrs.value$();
            this.isDirty = false;
            let editor = this.editor = monaco.editor.create(document.getElementById(node.attrs.id + 'Area'), {
                value: this.value,
                fontSize: 13,
                lineNumbers: "off",
                lineNumbersMinChars: 0,
                folding: false,
                minimap: {
                    enabled: false
                },
                scrollbar: {
                    useShadows: false,
                    verticalHasArrows: false,
                    horizontalHasArrows: false,
                    vertical: 'hidden',
                    horizontal: 'hidden',
                    verticalScrollbarSize: 0,
                    horizontalScrollbarSize: 0,
                    arrowSize: 0
                },
                language: node.attrs.language,
            });
            this.editor.getModel().updateOptions({
                insertSpaces: false,
                tabSize: 4,
            });
            // register to some events to potentially update the linked value
            this.editor.getModel().onDidChangeContent(e => {
                if (this.editor.isFocused()) {
                    this.isDirty = true;
                    redrawIfReady();
                }
            });
            this.editor.onDidFocusEditor(() => {
                if (node.attrs && node.attrs.isFocused$) {
                    node.attrs.isFocused$(true);
                    redrawIfReady();
                }
            });
            this.editor.onDidBlurEditor(() => {
                if (node.attrs && node.attrs.isFocused$) {
                    node.attrs.isFocused$(false);
                    redrawIfReady();
                }
            });
            // register to the window resize event, and relayout if needed
            window.addEventListener('resize', x => {
                this.editor.layout();
            });
            // hookup language-specific things
            switch (node.attrs.language) {
                case "html": {
                    this.editor.getModel().onDidChangeContent(e => {
                        let change = e.changes[0]; // there seems to be only one change at a given time for HTML panel editing
                        var oldLineCount = 1 + change.range.endLineNumber - change.range.startLineNumber;
                        var newLineCount = countLines(change.text);
                        var deltaLineCount = (newLineCount - oldLineCount);
                        var totalLineCount = countLines(editor.getValue());
                        var newLineMapping = new Array(totalLineCount);
                        for (var x = 0; x < totalLineCount; x++) {
                            if (x < change.range.startLineNumber) {
                                newLineMapping[x] = crossMappingHelper(x);
                            }
                            else if (x < change.range.startLineNumber + newLineCount - 1) {
                                newLineMapping[x] = crossMappingHelper(change.range.startLineNumber - 1);
                            }
                            else {
                                newLineMapping[x] = crossMappingHelper(x - deltaLineCount);
                            }
                        }
                        vm.lineMapping = newLineMapping;
                        function countLines(txt) {
                            return txt.split(/\n/g).length;
                        }
                        function crossMappingHelper(x) {
                            if (x < vm.lineMapping.length) {
                                return vm.lineMapping[x];
                            }
                            else {
                                return vm.lineMappingLineCount - 1;
                            }
                        }
                    });
                    this.editor.addAction({
                        id: 'wpt-inspect',
                        label: 'Inspect this element',
                        contextMenuGroupId: 'navigation',
                        contextMenuOrder: 0,
                        run() {
                            var sourceLine = 1 + vm.lineMapping[editor.getPosition().lineNumber - 1];
                            var w = getOutputPane().contentWindow;
                            var d = getOutputPane().contentDocument;
                            for (var i = 0; i < d.all.length; i++) {
                                var elm = d.all[i];
                                if (elm.sourceLine == sourceLine && elm != d.body) {
                                    vm.selectedElement$(elm);
                                    vm.refreshWatches(elm);
                                    return;
                                }
                            }
                            vm.selectedElement$(undefined);
                            vm.refreshWatches();
                        }
                    });
                    break;
                }
                case "css": {
                    this.editor.addAction({
                        id: "lookup-on-csswg",
                        label: "Search on csswg.org",
                        contextMenuGroupId: 'navigation',
                        contextMenuOrder: 0,
                        run() {
                            var word = editor.getModel().getWordAtPosition(editor.getPosition()).word;
                            window.open("http://bing.com/search?q=" + word + " site:drafts.csswg.org");
                        }
                    });
                    this.editor.addAction({
                        id: "lookup-on-msdn",
                        label: "Search on MSDN",
                        contextMenuGroupId: 'navigation',
                        contextMenuOrder: 0.1,
                        run() {
                            var word = editor.getModel().getWordAtPosition(editor.getPosition()).word;
                            window.open("http://bing.com/search?q=" + word + " property site:msdn.microsoft.com");
                        }
                    });
                    this.editor.addAction({
                        id: "lookup-on-mdn",
                        label: "Search on MDN",
                        contextMenuGroupId: 'navigation',
                        contextMenuOrder: 0.2,
                        run() {
                            var word = editor.getModel().getWordAtPosition(editor.getPosition()).word;
                            window.open("http://bing.com/search?q=" + word + " css site:developer.mozilla.org ");
                        }
                    });
                    this.editor.addAction({
                        id: "cssbeautify",
                        label: "Beautify the code",
                        contextMenuGroupId: 'navigation',
                        contextMenuOrder: 0.3,
                        run() {
                            editor.setValue(cssbeautify(editor.getValue(), { indent: '\t' }));
                            editor.focus();
                        }
                    });
                    break;
                }
                case "javascript": {
                    // TODO
                    // Add the model of builtin functions?
                    // And of generated IDs?
                    break;
                }
            }
            // eventually recover current textbox focus state
            let linkedTextbox = document.getElementById(node.attrs.id + "Textbox");
            if (document.activeElement === linkedTextbox) {
                let startPos = linkedTextbox.selectionStart;
                let endPos = linkedTextbox.selectionEnd;
                if (startPos > 0 || endPos > 0) {
                    let startLine = 0, startPosInLine = startPos;
                    let endLine = 0, endPosInLine = endPos;
                    var lines = linkedTextbox.value.split(/\n/g);
                    while (startPosInLine > lines[startLine].length) {
                        startPosInLine -= lines[startLine].length + 1;
                        startLine++;
                    }
                    while (endPosInLine > lines[endLine].length) {
                        endPosInLine -= lines[endLine].length + 1;
                        endLine++;
                    }
                    this.editor.setSelection(new monaco.Range(1 + startLine, 1 + startPosInLine, 1 + endLine, 1 + endPosInLine));
                }
                this.editor.focus();
            }
            redrawIfReady();
        });
    },
    onbeforeupdate(node, oldn) {
        // verifies that we have a text control to work with
        if (!this.editor)
            return;
        // verifies whether we need to change the text of the control
        var theNewValue$ = node.attrs["value$"];
        var theNewValue = theNewValue$();
        var cantForciblyUpdate = () => (this.editor.isFocused()
            && this.value
            && theNewValue);
        if (theNewValue != this.value && !cantForciblyUpdate()) {
            // there was a model update
            this.isDirty = false;
            this.editor.setValue(this.value = theNewValue);
            // in this case, stop tracking the line mapping
            if (node.attrs.language === 'html') {
                vm.lineMapping = this.value.split(/\n/g).map(l => 0);
                vm.shouldMoveToSelectedElement$(false);
            }
        }
        else if (this.isDirty) {
            // there was a content update
            theNewValue$(this.value = this.editor.getValue());
            requestAnimationFrame(time => m.redraw());
            this.isDirty = false;
        }
        else {
            // no update
        }
        // check whether we should move the cursor as requested by the view model
        if (vm.shouldMoveToSelectedElement$()) {
            vm.shouldMoveToSelectedElement$(false); // only one editor should take this
            var elm = vm.selectedElement$();
            var column = 0;
            try {
                column = this.editor.getValue().split(/\n/g)[elm.sourceLine - 1].match(/^\s+/)[0].length;
            }
            catch (ex) { }
            this.editor.revealLineInCenterIfOutsideViewport(elm.sourceLine);
            this.editor.setPosition({ lineNumber: elm.sourceLine, column: 1 + column });
            this.editor.focus();
        }
    }
}).from((a, c, s) => React.createElement("monaco-text-editor", { id: a.id, language: a.language },
    React.createElement("monaco-text-editor-area", { id: a.id + 'Area' }),
    React.createElement(TextArea, { id: a.id + 'Textbox', "value$": a.value$, hidden: !!s.editor, onkeydown: enableTabInTextarea }),
    React.createElement("monaco-text-editor-placeholder", { hidden: a.value$().length > 0 }, ({
        'javascript': '// JAVASCRIPT CODE',
        'html': '<!-- HTML MARKUP -->',
        'css': '/* CSS STYLES */'
    }[a.language] || ''))));
function enableTabInTextarea(e) {
    // tab but not ctrl+tab
    if (e.ctrlKey || e.altKey)
        return;
    if (e.keyCode == 9 || e.which == 9) {
        e.preventDefault();
        var s = this.selectionStart;
        this.value = this.value.substring(0, this.selectionStart) + "\t" + this.value.substring(this.selectionEnd);
        this.selectionStart = this.selectionEnd = s + 1;
        this.onchange(e);
    }
}
var TabButton = new Tag().from((a, c) => React.createElement("button", Object.assign({}, attributesOf(a), { onclick: e => a.activePane$(a.pane), "aria-controls": a.pane, "aria-expanded": `${a.pane == a.activePane$()}` }), c));
var ToolsPaneToolbar = new Tag().from(a => React.createElement("tools-pane-toolbar", { row: true, "aria-controls": a.activePane$(), role: "toolbar" },
    React.createElement(TabButton, { pane: "jsPaneWatches", "activePane$": a.activePane$ }, "Watches"),
    React.createElement(TabButton, { pane: "jsPaneConsole", "activePane$": a.activePane$ }, "Console"),
    React.createElement(TabButton, { pane: "jsPaneHeadCode", "activePane$": a.activePane$ }, "Header code"),
    React.createElement(TabButton, { pane: "jsPaneBodyCode", "activePane$": a.activePane$ }, "Body code")));
var ToolsPaneWatches = new Tag().with({
    onbeforeupdate() {
        var lastWatchFilter = vm.watchFilterText$();
        var lastWatchUpdateTime = vm.lastWatchUpdateTime$();
        var shouldUpdate = (false
            || this.lastKnownWatchUpdateTime != lastWatchUpdateTime
            || this.lastKnownWatchFilter != lastWatchFilter);
        this.lastKnownWatchUpdateTime = lastWatchUpdateTime;
        this.lastKnownWatchFilter = lastWatchFilter;
        return shouldUpdate;
    },
    getScriptTestStatusText(expr) {
        if (expr.status !== SCRIPT_TESTS.STATUS.PASS) {
            if (expr.message) {
                return expr.message;
            }
        }
        switch (expr.status) {
            case SCRIPT_TESTS.STATUS.PASS: return "Passed";
            case SCRIPT_TESTS.STATUS.FAIL: return "Failed";
            case SCRIPT_TESTS.STATUS.TIMEOUT: return "Timeout";
            case SCRIPT_TESTS.STATUS.NOTRUN: return "Not Run";
            default: return "Unknown Status";
        }
    },
    getScriptTestsOverallStatus() {
        return `Found ${vm.numberOfScriptTests$()} tests${vm.numberOfScriptTests$() > 0 ? `: ${vm.numberOfSuccessfulScriptTests$()} passing, ${vm.numberOfFailedScriptTests$()} failed` : ''}.`;
    }
}).from((a, c, self) => React.createElement("tools-pane-watches", { block: true, id: a.id, "is-active-pane": a.activePane$() == a.id },
    React.createElement(Input, { class: "watch-filter-textbox", "value$": vm.watchFilterText$, onkeyup: e => { if (e.keyCode == 27) {
            vm.watchFilterText$('');
        } }, type: "text", required: true, placeholder: "\uD83D\uDD0E", title: "Filter the watch list" }),
    React.createElement("ul", { class: "watch-list", hidden: vm.watchFilterText$() !== '' },
        React.createElement("li", null,
            React.createElement("input", { type: "checkbox", checked: vm.isScriptTestsVisible$(), title: "Uncheck to hide script test results", onchange: e => { vm.setChangeInScriptTestVisibility(e.target.checked); } }),
            React.createElement("input", { type: "text", disabled: true, title: self.getScriptTestsOverallStatus(), value: self.getScriptTestsOverallStatus() }),
            React.createElement("output", null))),
    React.createElement("ul", { class: "watch-list", hidden: !vm.isScriptTestsVisible$() || vm.watchFilterText$() !== '' }, vm.scriptTestResults$().map((expr, i, a) => React.createElement("li", null,
        React.createElement("input", { type: "checkbox", checked: true, disabled: true, title: "Remove the test from your script to remove it" }),
        React.createElement("input", { type: "text", title: expr.name, value: expr.name, disabled: true, style: "color:black;" }),
        React.createElement("output", { assert: expr.status !== SCRIPT_TESTS.STATUS.PASS ? expr.status !== SCRIPT_TESTS.STATUS.NOTRUN ? 'fail' : 'none' : 'pass' }, `${self.getScriptTestStatusText(expr)}`)))),
    vm.watchFilterText$() === '' ? React.createElement("br", null) : '',
    React.createElement("ul", { class: "watch-list" },
        React.createElement("li", null,
            React.createElement("input", { type: "checkbox", checked: true, disabled: true, title: "Uncheck to delete this watch" }),
            React.createElement("input", { type: "text", placeholder: "/* add new watch here */", onchange: e => { if (e.target.value) {
                    vm.addPinnedWatch(e.target.value);
                    e.target.value = '';
                    e.target.focus();
                } } }),
            React.createElement("output", null))),
    React.createElement("ul", { class: "watch-list" }, tm.watches.map((expr, i, a) => React.createElement("li", null,
        React.createElement("input", { type: "checkbox", checked: true, title: "Uncheck to delete this watch", onchange: e => { if (!e.target.checked) {
                vm.removePinnedWatch(expr);
                e.target.checked = true;
            } } }),
        React.createElement(Input, { type: "text", title: expr, "value$": m.prop2(x => expr, v => { if (a[i] != v) {
                a[i] = v;
                requestAnimationFrame(then => vm.refreshWatches());
            } }) }),
        React.createElement("output", { assert: vm.watchExpectedValues[expr] ? eval(vm.watchExpectedValues[expr]) === vm.watchValues[expr] ? 'pass' : 'fail' : 'none' }, `${vm.watchDisplayValues[expr] || ''}${vm.watchExpectedValues[expr] ? eval(vm.watchExpectedValues[expr]) !== vm.watchValues[expr] ? `, expected ${vm.watchExpectedValues[expr]}` : '' : ''}`),
        React.createElement("button", { class: "edit", title: "Edit the expected value", onclick: e => vm.setupExpectedValueFor(expr) }, "edit")))),
    React.createElement("ul", { class: "watch-list" }, vm.autoWatches.map(expr => React.createElement("li", { hidden: vm.hiddenAutoWatches[expr] || !vm.watchFilter$().matches(expr) },
        React.createElement("input", { type: "checkbox", title: "Check to pin this watch", onchange: e => { if (e.target.checked) {
                vm.addPinnedWatch(expr);
                e.target.checked = false;
            } } }),
        React.createElement("input", { type: "text", readonly: true, title: expr, value: expr }),
        React.createElement("output", { title: `${vm.watchDisplayValues[expr] || ''}` }, `${vm.watchDisplayValues[expr] || ''}`))))));
var ToolsPaneConsole = new Tag().with({
    oncreate() {
        this.history = [''];
        this.historyIndex = 0;
    },
    onsumbit(e) {
        try {
            var inp = e.target.querySelector('input');
            var expr = inp.value;
            inp.value = '';
            // update the expression history
            this.history[this.history.length - 1] = expr;
            this.historyIndex = this.history.push("") - 1;
            // append expression to console
            appendToConsole(">", new String(expr));
            // evaluate expression
            var res = undefined;
            try {
                res = getOutputPane().contentWindow.eval(expandShorthandsIn(expr));
            }
            catch (ex) {
                res = ex;
            }
            // append result to console
            appendToConsole("=", res);
        }
        catch (ex) {
            console.error(ex);
        }
        finally {
            e.preventDefault();
            return false;
        }
    },
    onkeypress(e) {
        var inp = e.target;
        if (e.key == 'Up' || e.key == 'ArrowUp') {
            if (this.historyIndex > 0)
                this.historyIndex--;
            inp.value = this.history[this.historyIndex];
        }
        else if (e.key == 'Down' || e.key == 'ArrowDown') {
            if (this.historyIndex < this.history.length - 1)
                this.historyIndex++;
            inp.value = this.history[this.historyIndex];
        }
        else if (this.historyIndex == this.history.length - 1) {
            this.history[this.historyIndex] = inp.value;
        }
        else {
            // nothing to do
        }
    }
}).from((a, c, self) => React.createElement("tools-pane-console", { id: a.id, "is-active-pane": a.activePane$() == a.id },
    React.createElement("pre", { id: a.id + "Output" }),
    React.createElement("form", { method: "POST", onsubmit: e => self.onsumbit(e) },
        React.createElement("input", { type: "text", onkeydown: e => self.onkeypress(e), oninput: e => self.onkeypress(e) }))));
var ToolsPaneCode = new Tag().from(a => React.createElement("tools-pane-code", { id: a.id, "is-active-pane": a.activePane$() == a.id },
    React.createElement(MonacoTextEditor, { id: a.id + '--editor', "value$": a.value$, language: "javascript" })) // TODO
);
var OutputPaneCover = new Tag().with({
    shouldBeHidden() {
        return !vm.isPicking$() && !vm.selectedElement$();
    },
    boxStyles$: cachedCast(vm.selectedElement$, elm => {
        var styles = {
            marginBox: {
                position: "absolute",
                transform: "translate(0, 0)",
                borderStyle: "solid",
                borderColor: "rgba(255,0,0,0.3)"
            },
            borderBox: {
                borderStyle: "solid",
                borderColor: "rgba(0,0,0,0.3)"
            },
            paddingBox: {
                borderStyle: "solid",
                borderColor: "rgba(0,0,0,0.4)",
                backgroundColor: "rgba(0,0,0,0.5)",
                backgroundClip: "padding-box"
            },
            contentBox: {
            // nothing special
            }
        };
        if (elm) {
            var es = gCS(elm);
            // position
            styles.marginBox.display = 'block';
            styles.marginBox.top = `${gBCT(elm)}px`;
            styles.marginBox.left = `${gBCL(elm)}px`;
            // margin box
            var mt = parseInt(es.marginTop);
            var ml = parseInt(es.marginLeft);
            var mr = parseInt(es.marginRight);
            var mb = parseInt(es.marginBottom);
            styles.marginBox.transform = `translate(${-ml}px,${-mt}px)`;
            styles.marginBox.borderTopWidth = `${mt}px`;
            styles.marginBox.borderLeftWidth = `${ml}px`;
            styles.marginBox.borderRightWidth = `${mr}px`;
            styles.marginBox.borderBottomWidth = `${mb}px`;
            // border box
            var bt = parseInt(es.borderTopWidth);
            var bl = parseInt(es.borderLeftWidth);
            var br = parseInt(es.borderRightWidth);
            var bb = parseInt(es.borderBottomWidth);
            styles.borderBox.borderTopWidth = `${bt}px`;
            styles.borderBox.borderLeftWidth = `${bl}px`;
            styles.borderBox.borderRightWidth = `${br}px`;
            styles.borderBox.borderBottomWidth = `${bb}px`;
            // padding box
            var pt = parseInt(es.paddingTop);
            var pl = parseInt(es.paddingLeft);
            var pr = parseInt(es.paddingRight);
            var pb = parseInt(es.paddingBottom);
            styles.paddingBox.borderTopWidth = `${pt}px`;
            styles.paddingBox.borderLeftWidth = `${pl}px`;
            styles.paddingBox.borderRightWidth = `${pr}px`;
            styles.paddingBox.borderBottomWidth = `${pb}px`;
            // content box
            styles.contentBox.width = `${gBCW(elm) - pl - pr - bl - br}px`;
            styles.contentBox.height = `${gBCH(elm) - pt - pb - bt - bb}px`;
        }
        return styles;
    }),
    setCurrentElementFromClick(e) {
        // ie hack to hide the element that covers the iframe and prevents elementFromPoint to work
        if ("ActiveXObject" in window) {
            document.getElementById("outputPaneCover").style.display = 'none';
        }
        var elm = getOutputPane().contentDocument.elementFromPoint(e.offsetX, e.offsetY) || getOutputPane().contentDocument.documentElement;
        var shouldUpdate = vm.selectedElement$() !== elm;
        vm.selectedElement$(elm);
        // ie hack to unhide the element that covers the iframe and prevents elementFromPoint to work
        if ("ActiveXObject" in window) {
            document.getElementById("outputPaneCover").style.display = '';
        }
        if (e.type == 'pointerdown' || e.type == 'mousedown') {
            // stop picking on pointer down
            vm.isPicking$(false);
            // also, update the watches for this new element
            vm.refreshWatches(elm);
            if (elm.sourceLine) {
                vm.shouldMoveToSelectedElement$(true);
            }
            // we should always update in this case
            shouldUpdate = true;
        }
        // we kinda need a synchronous redraw to be reactive
        // and we need no redraw at all if we didn't update
        e.redraw = false;
        if (shouldUpdate) {
            m.redraw(true);
        }
    },
    getPointerOrMouseEvents() {
        var onpointerdown = 'onpointerdown' in window ? 'onpointerdown' : 'onmousedown';
        var onpointermove = 'onpointermove' in window ? 'onpointermove' : 'onmousemove';
        if (this.shouldBeHidden()) {
            return {
                [onpointermove]: null,
                [onpointerdown]: null
            };
        }
        if (!this.events) {
            this.events = {
                [onpointermove]: e => this.setCurrentElementFromClick(e),
                [onpointerdown]: e => this.setCurrentElementFromClick(e)
            };
        }
        return this.events;
    }
}).from((a, c, self) => React.createElement("output-pane-cover", Object.assign({ block: true, id: a.id, "is-active": vm.isPicking$() }, self.getPointerOrMouseEvents()),
    React.createElement("margin-box", { block: true, hidden: self.shouldBeHidden(), style: self.boxStyles$().marginBox },
        React.createElement("border-box", { block: true, style: self.boxStyles$().borderBox },
            React.createElement("padding-box", { block: true, style: self.boxStyles$().paddingBox },
                React.createElement("content-box", { block: true, style: self.boxStyles$().contentBox }))))));
var HTMLPane = new Tag().from(a => React.createElement("html-pane", { "is-focused": a.isFocused$(), "disabled-style": { 'flex-grow': tm.html ? 3 : 1 } },
    React.createElement(MonacoTextEditor, { id: "htmlPaneEditor", "value$": tm.html$, language: "html", "isFocused$": a.isFocused$ })));
var CSSPane = new Tag().from(a => React.createElement("css-pane", { "is-focused": a.isFocused$(), "disabled-style": { 'flex-grow': tm.css ? 3 : 1 } },
    React.createElement(MonacoTextEditor, { id: "cssPaneEditor", "value$": tm.css$, language: "css", "isFocused$": a.isFocused$ })));
var JSPane = new Tag().from(a => React.createElement("js-pane", { "is-focused": a.isFocused$(), "disabled-style": { 'flex-grow': tm.jsBody ? 3 : 1 } },
    React.createElement(MonacoTextEditor, { id: "jsPaneEditor", "value$": vm.jsCombined$, language: "javascript", "isFocused$": a.isFocused$ })));
var ToolsPane = new Tag().from(a => React.createElement("tools-pane", null,
    React.createElement(ToolsPaneToolbar, { "activePane$": vm.activeJsTab$ }),
    React.createElement("tools-pane-tabs", null,
        React.createElement(ToolsPaneWatches, { id: "jsPaneWatches", "activePane$": vm.activeJsTab$ }),
        React.createElement(ToolsPaneConsole, { id: "jsPaneConsole", "activePane$": vm.activeJsTab$ }),
        React.createElement(ToolsPaneCode, { id: "jsPaneHeadCode", "value$": tm.jsHead$, "activePane$": vm.activeJsTab$ }),
        React.createElement(ToolsPaneCode, { id: "jsPaneBodyCode", "value$": tm.jsBody$, "activePane$": vm.activeJsTab$ }))));
var OutputPane = new Tag().from(a => React.createElement("output-pane", null,
    React.createElement("output-pane-toolbar", { role: "toolbar" },
        React.createElement("h3", null, " Rendered Result "),
        React.createElement("button", { onclick: e => vm.isPicking$(!vm.isPicking$()) }, "\uD83D\uDD0D select element ")),
    React.createElement("iframe", { id: "outputPane", src: "about:blank", border: "0", frameborder: "0", "is-active": !vm.isPicking$() }),
    React.createElement(OutputPaneCover, { id: "outputPaneCover" })));
var DOMViewElement = new Tag().with({
    oncreate() {
        this.visible = undefined;
    },
    setSelectedElement(e) {
        vm.selectedElement$(e);
        vm.refreshWatches(e);
    },
    isSelectedElement(e) {
        return e === vm.selectedElement$();
    },
    // Computes an array of HTML text to display and indices of children elements
    // Ex.    <p> <span> Foo </span> bar <span> text </span> </p>
    //    =>  ["<p> ", 0, " bar ", 1, " </p>"]
    // Used to recursively display all elements with recursive calls to children elements.
    elementBody$(e) {
        if (e.children.length == 0) {
            return [e.outerHTML];
        }
        else {
            let original = e.outerHTML;
            let ret = [];
            ret.push(original);
            let i = 0;
            // Split HTML text at children elements and replace with their indices.
            Array.from(e.children).forEach((val) => {
                for (let part of ret) {
                    if (typeof part !== 'string') {
                        continue;
                    }
                    let indexFound = part.indexOf(val.outerHTML);
                    if (indexFound == -1) {
                        continue;
                    }
                    let pre = part.slice(0, indexFound);
                    let suf = part.slice((indexFound + val.outerHTML.length));
                    let temp = [];
                    temp.push(pre);
                    temp.push(i);
                    temp.push(suf);
                    // Remove the part we split from the list of elements to only have the
                    // split version within the array we will be returning
                    let firstOccurrenceInRet = ret.indexOf(part);
                    if (firstOccurrenceInRet !== -1) {
                        ret.splice(firstOccurrenceInRet, 1);
                    }
                    ret = ret.concat(temp);
                }
                i++;
            });
            // Ensure only html text and children element indices left
            ret = ret.filter(val => (typeof val === 'string' && val.length > 0) || typeof val === 'number');
            return ret;
        }
    },
    isVisible(a) {
        if (!a.toggleable) {
            return true;
        }
        if (this.visible === undefined) {
            this.visible = (a.element.nodeName.toUpperCase() != 'HEAD');
        }
        return this.visible;
    },
    toggleVisibility() {
        this.visible = !this.visible;
    },
    toggleButtonText$() {
        if (this.visible || this.visible === undefined) {
            return "-";
        }
        else {
            return "+";
        }
    },
    toggleText$(child) {
        if (!this.visible) {
            if (child.childNodes.length == 0) {
                return child.outerHTML;
            }
            let childHTML = child.outerHTML;
            let prefix = childHTML.substring(0, (childHTML.indexOf(">") + 1));
            let suffix = childHTML.substring(childHTML.lastIndexOf("<"));
            return `${prefix} ... ${suffix}`;
        }
        return "";
    }
}).from((a, c, self) => React.createElement("dom-view-element", null,
    React.createElement("code", { "is-hidden": (!a.toggleable || a.element.childNodes.length === 0), class: "domViewTreeToggle", onclick: () => self.toggleVisibility() }, `${self.toggleButtonText$()}`),
    React.createElement("ul", { class: "domViewTree" }, self.isVisible(a) ?
        React.createElement("dom-view-tree-element", { "is-hidden": !(self.isVisible(a)) }, self.elementBody$(a.element).map((val) => React.createElement("li", null, (typeof val === 'string') ?
            React.createElement("code", { class: "domViewTreeElement", onclick: () => self.setSelectedElement(a.element), "is-selected": self.isSelectedElement(a.element) }, val)
            :
                React.createElement(DOMViewElement, { element: a.element.children[val], toggleable: true }))))
        :
            React.createElement("li", null,
                React.createElement("code", { class: "domViewTreeElement", onclick: () => self.setSelectedElement(a.element), "is-selected": self.isSelectedElement(a.element) }, self.toggleText$(a.element))))));
var DOMViewPane = new Tag().with({
    getOutputTree() {
        var lastDOMTreeText = vm.domViewerHTMLText$();
        var lastDOMUpdateTime = vm.lastDOMUpdateTime$();
        var shouldUpdate = (false
            || this.lastKnownDOMUpdateTime != lastDOMUpdateTime
            || this.savedTreeText != lastDOMTreeText);
        if (!shouldUpdate) {
            return this.savedTree;
        }
        this.savedTreeText = lastDOMTreeText;
        var tree = this.savedTree = React.createElement(DOMViewElement, { element: getOutputPaneElement(), toggleable: false });
        return tree;
    }
}).from((a, c, self) => React.createElement("dom-view-pane", null,
    React.createElement("dom-view-pane-toolbar", { role: "toolbar" },
        React.createElement("h3", null, " DOM Tree "),
        React.createElement("button", { onclick: e => vm.refreshWatches() }, "\u21BB refresh watches")),
    React.createElement("dom-view-tree", null,
        " ",
        self.getOutputTree(),
        " ")));
var UserTestcasesDialog = new Tag().with({
    deleteTest(id) {
        vm.userTestcasesDialog.deleteTest(id);
    },
    close() {
        var form = vm.userTestcasesDialog;
        form.isOpened$(false);
        vm.redirectBackFromUsersTests();
    }
}).from((a, c, self) => React.createElement("dialog", { as: "user-testcases-dialog", autofocus: true, hidden: !vm.userTestcasesDialog.isOpened$() },
    React.createElement("section", { tabindex: "-1" },
        React.createElement("h3", null,
            "Tests created by ",
            vm.userTestcasesDialog.author$()),
        React.createElement("form", { action: "POST", onsubmit: e => { e.preventDefault(); self.close(); } },
            React.createElement("table", null, vm.userTestcasesDialog.tests$().map((val) => React.createElement("tr", null,
                React.createElement("td", { style: "padding-right:20px" },
                    React.createElement("a", { href: `/#/${val.id}` }, `${val.id}: ${val.title} (${new Date(val.creationDate)})`)),
                React.createElement("td", null,
                    React.createElement("button", { onclick: () => self.deleteTest(val.id) }, "Delete"))))),
            React.createElement("footer", { style: "margin-top: 20px" },
                React.createElement("input", { type: "submit", value: "Close" }))))));
var SelectorGenerationDialog = new Tag().with({
    generateReplacement() {
        var form = vm.selectorGenerationDialog;
        var w1 = window;
        // create the requested replacement, if possible
        switch (form.chosenMode$()) {
            case "auto": {
                w1.$0replacement = w1.$0.sourceTagId;
                break;
            }
            case "id": {
                if (form.chosenId$()) {
                    // assign the id to the element if we can
                    if (w1.$0) {
                        w1.$0.id = form.chosenId$();
                    }
                    if (w1.$0 && w1.$0.sourceLine >= 1) {
                        var txt = '^(.|\r)*?';
                        var line = vm.lineMapping[w1.$0.sourceLine - 1];
                        for (var i = line; i--;) {
                            txt += '\\n(.|\r)*?';
                        }
                        txt += '\\<' + w1.$0.tagName + '\\b';
                        var reg = new RegExp(txt, 'i');
                        tm.html = tm.html.replace(reg, '$& id="' + form.chosenId$() + '"');
                        vm.run();
                        if (!window['$0'])
                            window['$0'] = { id: form.chosenId$() };
                    }
                    // then return the value
                    w1.$0replacement = `$(${JSON.stringify('#' + form.chosenId$())})`;
                }
                break;
            }
            case "selector": {
                if (form.chosenSelector$()) {
                    w1.$0replacement = `$(${JSON.stringify(form.chosenSelector$())})`;
                }
                break;
            }
        }
        form.isOpened$(false);
        if (form.watchValue$().defined) {
            vm.addPinnedWatch(form.watchExpression$(), form.watchValue$().value);
        }
        else {
            vm.addPinnedWatch(form.watchExpression$());
        }
    }
}).from((a, s, self) => React.createElement("dialog", { as: "selector-generation-dialog", autofocus: true, hidden: !vm.selectorGenerationDialog.isOpened$() },
    React.createElement("section", { tabindex: "-1" },
        React.createElement("h1", null, "How do you want to do this?"),
        React.createElement("form", { action: "POST", onsubmit: e => { e.preventDefault(); self.generateReplacement(); } },
            React.createElement("label", { hidden: !vm.selectorGenerationDialog.isAutoAvailable$(), style: "display: block; margin-bottom: 10px" },
                React.createElement(InputRadio, { name: "chosenMode", value: "auto", "checkedValue$": vm.selectorGenerationDialog.chosenMode$ }),
                "Use the source index"),
            React.createElement("label", { style: "display: block; margin-bottom: 10px" },
                React.createElement(InputRadio, { name: "chosenMode", value: "id", "checkedValue$": vm.selectorGenerationDialog.chosenMode$ }),
                "Assign an id the the element",
                React.createElement(Input, { type: "text", "value$": vm.selectorGenerationDialog.chosenId$, onfocus: e => vm.selectorGenerationDialog.chosenMode$('id') })),
            React.createElement("label", { style: "display: block; margin-bottom: 10px" },
                React.createElement(InputRadio, { name: "chosenMode", value: "selector", "checkedValue$": vm.selectorGenerationDialog.chosenMode$ }),
                "Use a css selector",
                React.createElement(Input, { type: "text", "value$": vm.selectorGenerationDialog.chosenSelector$, onfocus: e => vm.selectorGenerationDialog.chosenMode$('selector') })),
            React.createElement("footer", { style: "margin-top: 20px" },
                React.createElement("input", { type: "submit", value: "OK" }),
                "\u00A0",
                React.createElement("input", { type: "button", value: "Cancel", onclick: e => vm.selectorGenerationDialog.isOpened$(false) }))))));
var DeletedUserDialog = new Tag().with({
    close() {
        var form = vm.deletedUserDialog;
        form.isOpened$(false);
    }
}).from((a, s, self) => React.createElement("dialog", { as: "deleted-user-dialog", autofocus: true, hidden: !vm.deletedUserDialog.isOpened$() },
    React.createElement("section", { tabindex: "-1" },
        React.createElement("h1", null, "Successfully removed your account!"),
        React.createElement("form", { action: "POST", onsubmit: e => { e.preventDefault(); self.close(); } },
            React.createElement("p", null,
                "Successfully deleted your account: ",
                React.createElement("b", null, vm.deletedUserDialog.deletedUser$()),
                " from wptest.center. All tests created by you no longer have your name associated with them, but instead are now associated with randomly assigned anonymous name: ",
                React.createElement("b", null, vm.deletedUserDialog.newAnonymousUser$()),
                "."),
            React.createElement("p", null,
                "To view and delete your tests please go to ",
                React.createElement("a", { href: `/#/u/${vm.deletedUserDialog.newAnonymousUser$()}` },
                    "wptest.center/#/u/",
                    vm.deletedUserDialog.newAnonymousUser$()),
                " to see a list of tests that you can delete. ",
                React.createElement("b", null, "Please save this link for future reference to delete your tests.")),
            React.createElement("footer", { style: "margin-top: 20px" },
                React.createElement("input", { type: "submit", value: " Got it! " }))))));
var SettingsDialog = new Tag().with({
    close() {
        var form = vm.settingsDialog;
        form.isOpened$(false);
    },
    deleteUser() {
        let confirmed = confirm("Are you sure you want to delete your account?");
        if (confirmed) {
            vm.settingsDialog.deleteUser();
            vm.deletedUserDialog.isOpened$(true);
            vm.settingsDialog.isOpened$(false);
        }
    }
}).from((a, s, self) => React.createElement("dialog", { as: "settings-dialog", autofocus: true, hidden: !vm.settingsDialog.isOpened$() },
    React.createElement("section", { tabindex: "-1" },
        React.createElement("h1", null, "Settings"),
        React.createElement("form", { action: "POST", onsubmit: e => { e.preventDefault(); self.close(); } },
            React.createElement("label", { style: "display: block; margin-bottom: 10px" },
                React.createElement("button", { onclick: e => vm.settingsDialog.openWelcomeDialog() },
                    React.createElement("span", { class: "icon" }, "\uD83D\uDEC8"),
                    "Open the welcome screen")),
            React.createElement("label", { style: "display: block; margin-bottom: 10px" },
                React.createElement("button", { onclick: e => vm.settingsDialog.openSearchDialog() },
                    React.createElement("span", { class: "icon" }, "\uD83D\uDD0E"),
                    "Search existing test cases")),
            React.createElement("hr", null),
            React.createElement("label", { style: "display: block; margin-bottom: 10px" },
                React.createElement("button", { hidden: !vm.githubIsConnected$(), onclick: e => vm.redirectToUsersTests(vm.githubUserName$()) },
                    React.createElement("span", { class: "icon" }, "\uD83D\uDCC1"),
                    "See testcases made by you, ",
                    vm.githubUserName$(),
                    ".")),
            React.createElement("label", { style: "display: block; margin-bottom: 10px" },
                React.createElement("button", { hidden: vm.githubIsConnected$(), onclick: e => vm.settingsDialog.logIn() },
                    React.createElement("span", { class: "icon" }, "\uD83D\uDD12"),
                    "Log In using your Github account"),
                React.createElement("button", { hidden: !vm.githubIsConnected$(), onclick: e => vm.settingsDialog.logOut() },
                    React.createElement("span", { class: "icon" }, "\uD83D\uDD12"),
                    "Log Out of your Github account (",
                    vm.githubUserName$(),
                    ")")),
            React.createElement("label", { style: "display: block; margin-bottom: 10px" },
                React.createElement("button", { hidden: !vm.githubIsConnected$(), onclick: e => self.deleteUser() },
                    React.createElement("span", { class: "icon" }, "\u26D4\uFE0F"),
                    "Remove your account (",
                    vm.githubUserName$(),
                    ") from wptest")),
            React.createElement("hr", null),
            React.createElement("label", { style: "display: block; margin-bottom: 10px" },
                React.createElement("button", { hidden: !vm.settingsDialog.useMonaco$(), onclick: e => vm.settingsDialog.useMonaco$(false), style: "display: block" },
                    React.createElement("span", { class: "icon" }, "\u2699"),
                    "Disable the advanced text editor on this device from now on"),
                React.createElement("button", { hidden: vm.settingsDialog.useMonaco$(), onclick: e => vm.settingsDialog.useMonaco$(true), style: "display: block" },
                    React.createElement("span", { class: "icon" }, "\u2699"),
                    "Enable the advanced text editor on this device from now on")),
            React.createElement("label", { style: "display: block; margin-bottom: 10px" },
                React.createElement("a", { style: "display: block", href: "https://github.com/MicrosoftEdge/wptest", target: "_blank" },
                    React.createElement("span", { class: "icon" }),
                    "Contribute on Github")),
            React.createElement("footer", { style: "margin-top: 20px" },
                React.createElement("input", { type: "submit", value: "Close" }))))));
var SearchDialog = new Tag().with({
    search() {
        var form = vm.searchDialog;
        form.searchUrl$('/search?q=' + encodeURIComponent(form.searchTerms$()) + '&time=' + Date.now());
    },
    close() {
        var form = vm.searchDialog;
        form.isOpened$(false);
    },
    onupdate() {
        var form = vm.searchDialog;
        if (this.wasOpened != form.isOpened$()) {
            if (this.wasOpened) {
                // TODO: close
            }
            else {
                // TODO: open
            }
        }
    }
}).from((a, s, self) => React.createElement("dialog", { as: "search-dialog", autofocus: true, hidden: !vm.searchDialog.isOpened$() },
    React.createElement("section", { tabindex: "-1", role: "search", style: "width: 80%; width: 80vw" },
        React.createElement("h1", null, "Search testcases"),
        React.createElement("form", { action: "POST", onsubmit: e => { e.preventDefault(); self.search(); } },
            React.createElement("p", { style: "font-size: 10px" }, "Search terms are separated by spaces, and must all match for the result to be returned; You can use the --html --css --js --author modifiers to narrow down the search. Out of these, only --author considers its arguments as alternatives."),
            React.createElement("p", { style: "font-size: 10px; color: green;" }, "Example: \"table --css border hidden --author FremyCompany gregwhitworth\" will return all test cases containing \"table\" in any code field, containing both border & hidden in their css code, and that have been written by FremyCompany or gregwhitworth."),
            React.createElement("div", { style: "display: flex;" },
                React.createElement(Input, { placeholder: "search terms here", "value$": vm.searchDialog.searchTerms$, style: "flex: 1 0 0px" }),
                React.createElement("input", { type: "submit", value: "Search" })),
            React.createElement("iframe", { frameborder: "0", border: "0", src: vm.searchDialog.searchUrl$() }),
            React.createElement("footer", { style: "margin-top: 5px" },
                React.createElement("input", { type: "button", onclick: e => self.close(), value: "Close" }))))));
var WelcomeDialog = new Tag().with({
    close() {
        var form = vm.welcomeDialog;
        localStorage.setItem('noWelcome', 'true');
        form.isOpened$(false);
    }
}).from((a, s, self) => React.createElement("dialog", { as: "welcome-dialog", autofocus: true, hidden: !vm.welcomeDialog.isOpened$() },
    React.createElement("section", { tabindex: "-1" },
        React.createElement("h1", null, "The Web Platform Test Center"),
        React.createElement("form", { action: "POST", onsubmit: e => { e.preventDefault(); self.close(); } },
            React.createElement("p", null, "This websites provides tools to simplify the creation of reduced web platform test cases and the search of previously-written test cases."),
            React.createElement("p", null, "It is primarily addressed at engineers who build web browsers, and web developers who want to help bugs getting fixed by filing reduced issues on existing browsers."),
            React.createElement("footer", { style: "margin-top: 20px" },
                React.createElement("input", { type: "submit", value: " Got it! " }))))));
var TestEditorView = new Tag().from(a => {
    // check if url pointing to an user instead of test
    if (location.hash.substr(2, 2) === 'u/') {
        vm.closeAllDialogs();
        vm.userTestcasesDialog.isOpened$(true);
        vm.userTestcasesDialog.updateAuthorOfTestcases(location.hash.substr(4));
    }
    // if the page moved to a new id 
    // then we need to reset all data and download the new test
    else if (a.id != vm.currentTestId$() && (a.id == location.hash.substr(2) || (a.id.substr(0, 5) == 'json:' && location.hash.substr(0, 7) == '#/json:'))) {
        vm.currentTestId$(a.id);
        vm.closeAllDialogs();
        var id = a.id;
        if (id == 'local:save') {
            id = sessionStorage.getItem(id) || (localStorage.getItem('local:save') ? 'local:save' : 'new');
            vm.currentTestId$(id);
            vm.updateURLForTest();
        }
        if (id.indexOf('local:') == 0) {
            try {
                vm.openFromJSON(JSON.parse(localStorage.getItem(id)));
            }
            catch (ex) {
                alert("An error occurred while trying to load that test. Is it still in your local storage?");
            }
            // when we recover the local:save test, we should offer to save online
            if (a.id == 'local:save') {
                sessionStorage.removeItem('local:save');
                localStorage.removeItem('local:save');
                if (id != 'local:save' && vm.githubIsConnected$()) {
                    setTimeout(function () {
                        if (confirm(`Welcome back, ${vm.githubUserName$()}! Should we save your test online now?`)) {
                            localStorage.removeItem(id);
                            vm.saveOnline();
                        }
                    }, 32);
                }
            }
        }
        else if (id.indexOf('json:') == 0) {
            vm.openFromJSON(JSON.parse(decodeHash(location.hash.substr('#/json:'.length))));
        }
        else if (id && id != 'new') {
            vm.isLoading$(true);
            vm.openFromJSON(null);
            fetch('/uploads/' + id + '.json').then(r => r.json()).then(d => {
                vm.openFromJSON(d);
            });
        }
    }
    // in all cases, we return the same markup though to avoid trashing
    return (React.createElement("body", null,
        React.createElement(BodyToolbar, { model: tm }),
        React.createElement("top-row", { row: true },
            React.createElement(HTMLPane, { "isFocused$": vm.isHtmlPaneFocused$ }),
            React.createElement(CSSPane, { "isFocused$": vm.isCssPaneFocused$ }),
            React.createElement(JSPane, { "isFocused$": vm.isJsPaneFocused$ })),
        React.createElement("bottom-row", { row: true },
            React.createElement(OutputPane, null),
            React.createElement(DOMViewPane, null),
            React.createElement(ToolsPane, null)),
        React.createElement(UserTestcasesDialog, null),
        React.createElement(SelectorGenerationDialog, null),
        React.createElement(SettingsDialog, null),
        React.createElement(DeletedUserDialog, null),
        React.createElement(SearchDialog, null),
        React.createElement(WelcomeDialog, null))).children;
});
m.route(document.body, '/new', { '/:id...': TestEditorView(), '/u/:author...': TestEditorView() });
//----------------------------------------------------------------
setInterval(updatePageTitle, 3000);
function updatePageTitle() {
    var titlePart = '';
    var urlPart = '';
    var id = vm.currentTestId$();
    if (id && id != 'new' && id.substr(0, 5) != 'json:') {
        urlPart = 'wptest.center/#/' + id;
    }
    else {
        urlPart = 'wptest.center';
    }
    if (tm.title && tm.title != 'UntitledTest') {
        titlePart = tm.title + ' - ';
    }
    document.title = titlePart + urlPart;
}
