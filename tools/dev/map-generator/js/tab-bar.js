function switchTab(tabName) {
  var btn2d = document.getElementById('tab2d');
  var btn3d = document.getElementById('tab3d');
  var panel2d = document.getElementById('panel2d');
  var panel3d = document.getElementById('panel3d');

  if (tabName === '2D') {
    btn2d.classList.add('active');
    btn3d.classList.remove('active');
    btn2d.setAttribute('aria-selected', 'true');
    btn3d.setAttribute('aria-selected', 'false');
    panel2d.classList.add('active');
    panel3d.classList.remove('active');
  } else {
    btn3d.classList.add('active');
    btn2d.classList.remove('active');
    btn3d.setAttribute('aria-selected', 'true');
    btn2d.setAttribute('aria-selected', 'false');
    panel3d.classList.add('active');
    panel2d.classList.remove('active');
  }
}

function getActiveGeneratorFrame() {
  var activePanel = document.querySelector('.tab-panel.active');
  return activePanel ? activePanel.querySelector('iframe') : null;
}

function getActiveGeneratorWindow() {
  var frame = getActiveGeneratorFrame();
  try {
    return frame && frame.contentWindow ? frame.contentWindow : null;
  } catch (_) {
    return null;
  }
}

function callActiveGenerator(methodName) {
  var generatorWindow = getActiveGeneratorWindow();
  var method = generatorWindow && generatorWindow[methodName];
  if (typeof method !== 'function') return Promise.resolve(null);
  return Promise.resolve(method.call(generatorWindow));
}

function describeActiveGeneratorAssets() {
  return callActiveGenerator('__urageToolDescribeCurrentAssets').then(function(payload) {
    return Array.isArray(payload) ? payload : payload ? [payload] : [];
  });
}

function exportActiveGeneratorImage() {
  return callActiveGenerator('__urageToolRequestExportImage').then(function(payload) {
    if (payload) return payload;
    return describeActiveGeneratorAssets().then(function(descriptors) {
      return descriptors.find(function(descriptor) { return descriptor && descriptor.kind === 'image'; }) || null;
    });
  });
}

if (typeof window.registerDashboardToolBridge === 'function') {
  window.registerDashboardToolBridge({
    onDescribeCurrentAssets: describeActiveGeneratorAssets,
    onExportImage: exportActiveGeneratorImage
  });
} else {
  window.__urageToolDescribeCurrentAssets = describeActiveGeneratorAssets;
  window.__urageToolDescribeCurrentAsset = function() {
    return describeActiveGeneratorAssets().then(function(descriptors) { return descriptors[0] || null; });
  };
  window.__urageToolRequestExportImage = exportActiveGeneratorImage;
}
