var EXPORTED_SYMBOLS = ["DOMUtils"]

const CI = Components.interfaces;
const CC = Components.classes;

const DOMUtils = {
	
  lookupMethod: Components.utils ? Components.utils.lookupMethod : Components.lookupMethod,
  
  consoleDump: false,
  
  dump: function(msg) {
    if(this.consoleDump) dump("[RequestPolicy DOMUtils] " + msg + "\n");
  },
  
  findBrowser: function(chrome, win) {
    var gb = chrome.getBrowser();
    var browsers;
    if (!(gb && (browsers = gb.browsers))) return null;
    
    var browser = gb.selectedBrowser;
    if (browser.contentWindow == win) return browser;
    
    for (var j = browsers.length; j-- > 0;) {
      browser = browsers[j];
      if (browser.contentWindow == win) return browser;
    }
    
    return null;
  },
  
  findBrowserForNode: function(ctx) {
    if (!ctx) return null;
    var bi = null;
    try {
      if (!(ctx instanceof CI.nsIDOMWindow)) {
        if (ctx instanceof CI.nsIDOMDocument) {
          ctx = ctx.defaultView;
        } else if(ctx instanceof CI.nsIDOMNode) {
          ctx = ctx.ownerDocument.defaultView;
        } else return null; 
      }
      if (!ctx) return null;
      ctx = this.lookupMethod(ctx, "top")();
      
      var bi = this.createBrowserIterator(this.getChromeWindow(ctx));
      for (var b; b = bi.next();) {
        try {
          if (b.contentWindow == ctx) return b;
        } catch(e1) {
          this.dump("Skipping browser iteration: " + e1);
        }
      }
      this.dump("Browser not found for " + ctx);
    } catch(e2) {
      this.dump("Can't find browser for " + ctx + ": " + e2);
    } finally {
      if (bi) bi.dispose();
      ctx = null;
    }
   
    return null;
  },
  
  
  
  getDocShellFromWindow: function(window) {
    try {
      return window.QueryInterface(CI.nsIInterfaceRequestor)
                   .getInterface(CI.nsIWebNavigation)
                   .QueryInterface(CI.nsIDocShell);
    } catch(e) {
      return null;
    }
  },
    
  getChromeWindow: function(window) {
    try {
      return this.lookupMethod(this.getDocShellFromWindow(window)
        .QueryInterface(CI.nsIDocShellTreeItem).rootTreeItem
        .QueryInterface(CI.nsIInterfaceRequestor)
        .getInterface(CI.nsIDOMWindow), "window")();
    } catch(e) {
      return null;
    }
  },
  
  get windowMediator() {
    delete this.windowMediator;
    return this.windowMediator = CC['@mozilla.org/appshell/window-mediator;1']
                  .getService(CI.nsIWindowMediator);
  },
  
  _winType: null,
  perWinType: function(delegate) {
    var wm = this.windowMediator;
    var w = null;
    var aa = Array.prototype.slice.call(arguments);
    for each(var type in ['navigator:browser', 'emusic:window', 'Songbird:Main']) {
     aa[0] = type;
      w = delegate.apply(wm, aa);
      if (w) {
        this._winType = type;
        break;
      }
    }
    return w;
  },
  
  get mostRecentBrowserWindow() {
    var res = this._winType && this.windowMediator.getMostRecentWindow(this._winType, true);
    return res || this.perWinType(this.windowMediator.getMostRecentWindow, true);
  },
  
  get windowEnumerator() {
    var res = this._winType && this.windowMediator.getZOrderDOMWindowEnumerator(this._winType, true);
    return res || this.perWinType(this.windowMediator.getZOrderDOMWindowEnumerator, true);
  },
  
  createBrowserIterator: function(initialWin) {
    return new BrowserIterator(initialWin);
  }
  
};
