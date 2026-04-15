/**
 * 初始化腳本
 * 在 React 載入後隱藏靜態內容（landing 頁面 + footer）
 */
(function() {
  var observer = new MutationObserver(function() {
    var root = document.getElementById('root');
    if (root && root.children.length > 0) {
      var landing = document.getElementById('static-landing');
      var footer = document.getElementById('static-footer');
      if (landing) landing.style.display = 'none';
      if (footer) footer.style.display = 'none';
      observer.disconnect();
    }
  });
  var root = document.getElementById('root');
  if (root) {
    observer.observe(root, { childList: true });
  }
})();
