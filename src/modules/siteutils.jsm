
var EXPORTED_SYMBOLS = ["SiteUtils"]

const CI = Components.interfaces;
const CC = Components.classes;

var SiteUtils = {
  const _domainPattern = /^[\w\u0080-\uffff][\w\-\.\u0080-\uffff]*$/;
  
  const _ios = this.ios = CC["@mozilla.org/network/io-service;1"]
    .getService(CI.nsIIOService);
  
  const _uriFixup = this.uriFixup = CC["@mozilla.org/docshell/urifixup;1"]
    .getService(CI.nsIURIFixup);
  
  function sorter(a, b) {
    if (a == b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    const dp = _domainPattern;
    return dp.test(a) ?
        (dp.test(b) ? (a < b ? -1 : 1) : -1)
      : (dp.test(b) ? 1 : a < b ? -1 : 1);
  }
  
  this.sort = function(ss) {
    return ss.sort(sorter);
  };
  
  this.getSite = function(url) {
    if (!url || 
        url.charCodeAt(0) < 33  && // needs trimming
        !(url = url.replace(/^\s*(.*?)\s*$/, '$1'))) {
      return "";
    }
    
    if (url.indexOf(":") == -1) {
      return this.domainMatch(url);
    }
    
    var scheme;
    try {
      scheme = this.ios.extractScheme(url).toLowerCase();
      switch (scheme) {
        case "http": case "https": // commonest case first
          break;
        case "javascript": case "data": 
          return "";
        case "about":
          return /about:neterror(\?|$)/.test(url) ? "about:neterror" : url;
        case "chrome":
          return "chrome:";
      }
      scheme += ":";
      if (url == scheme) return url;
    } catch(ex) {
      return this.domainMatch(url);
    }
    try {
      // let's unwrap JAR uris
      var uri = _uriFixup.createExposableURI(_ios.newURI(url, null, null));
      if (uri instanceof CI.nsIJARURI) {
        uri = uri.JARFile;
        return uri ? this.getSite(uri.spec) : scheme;
      }
      try  {
        return scheme + "//" + uri.hostPort;
      } catch(exNoHostPort) {
        var host = uri.spec.substring(scheme.length);
        return /^\/\/[^\/]/.test(host) && (host = this.domainMatch(host.replace(/^\/\/([^\/]+).*/, "$1")))
          ? scheme + "//" + host
          : scheme;
      }
    } catch(ex) {
      return "";
    }
  };
  
  this.list2set = function(sl) {
    // kill duplicates
    var prevSite = "";
    var site;
    for (var j = sl.length; j--> 0;) {
      site = sl[j];
      if ((!site) || site == prevSite) { 
        sl.splice(j, 1);
      } else {
        prevSite = site;
      }
    }
    return sl;
  };
  
  this.sortedSet = function(sl) {
    return this.list2set(this.sort(sl));
  }
  
  this.splitString = function(s) {
    return s && /[^\s,]/.test(s) && s.split(/\s*[,\s]\s*/) || [];
  };
  
  this.domainMatch = function(url) {
     const m = url.match(_domainPattern);
     return m ? m[0].toLowerCase() : "";
  };
  
  this.sanitizeList = function(sl) {
    for (var j = sl.length; j-- > 0; ) {
      sl[j] = this.getSite(sl[j]);
    }
    return sl;
  };
  
  this.sanitizeMap = function(sm) {
    var site;
    delete sm[""];
    for (var url in sm) {
      site = this.getSite(url);
      if (site != url) {
        if (site) sm[site] = sm[url];
        delete sm[url];
      }
    }
    return sm;
  };
  
  this.sanitizeString = function(s) {
    // s = s.replace(/,/g,' ').replace(/\s{2,}/g,' ').replace(/(^\s+|\s+$)/g,'');
    return this.set2string(this.string2set(s)); 
  };
  
  this.string2set = function(s) {
    return this.sortedSet(this.sanitizeList(this.splitString(s)));
  };
  
  this.set2string = function(ss) {
    return ss.join(" ");
  };
  
  this.crop = function(url, width, max) {
    width = width || 100;
    if (url.length < width) return url;
    
    max = max || 2000;
    if (max > width && url.length > max) {
        return this.crop(url.substring(0, max / 2)) + "\n[...]\n" + 
          this.crop(url.substring(url.length - max / 2));
    }
    
    var parts = [];
   
    while (url.length > width) {
      parts.push(url.substring(0, width));
      url = url.substring(width);
    }
    parts.push(url);
    return parts.join("\n");
  };

};
