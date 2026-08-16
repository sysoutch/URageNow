function setMirrorOptions() {
      var patternInput = document.getElementById("mirrorPattern");
      mirrorPattern = patternInput ? patternInput.value : "xy";
      mirrorRepeatX = readNumber("mirrorRepeatX", 1, 0);
      mirrorRepeatY = readNumber("mirrorRepeatY", 1, 0);
      var rowInput = document.getElementById("mirrorCenterRowOnce");
      var colInput = document.getElementById("mirrorCenterColOnce");
      mirrorCenterRowOnce = !rowInput || rowInput.checked;
      mirrorCenterColOnce = !!(colInput && colInput.checked);
      updateMirrorShapePreview();
      generateMapIfReady();
    }

    function mirrorUsesX() {
      return mirrorPattern === "x" || mirrorPattern === "xy" || mirrorPattern === "all";
    }

    function mirrorUsesY() {
      return mirrorPattern === "y" || mirrorPattern === "xy" || mirrorPattern === "all";
    }

    function mirrorUsesMainDiagonal() {
      return mirrorPattern === "diagonal-main" || mirrorPattern === "diagonal-both" || mirrorPattern === "all";
    }

    function mirrorUsesAntiDiagonal() {
      return mirrorPattern === "diagonal-anti" || mirrorPattern === "diagonal-both" || mirrorPattern === "all";
    }

    function getAxisSpan(size, repeat, shareCenter) {
      return size + repeat * Math.max(1, size - (shareCenter ? 1 : 0));
    }

    function getMirrorGridSize() {
      var cols = mirrorUsesX() ? getAxisSpan(groundWidth, mirrorRepeatX, mirrorCenterColOnce) : groundWidth;
      var rows = mirrorUsesY() ? getAxisSpan(groundHeight, mirrorRepeatY, mirrorCenterRowOnce) : groundHeight;
      if (mirrorUsesMainDiagonal() || mirrorUsesAntiDiagonal()) {
        var square = Math.max(cols, rows);
        cols = square;
        rows = square;
      }
      return { cols: cols, rows: rows };
    }

    function updateMirrorShapePreview() {
      var preview = document.getElementById("mirrorShapePreview");
      if (!preview) {
        return;
      }
      var size = getMirrorGridSize();
      preview.value = size.cols + " x " + size.rows;
    }

    function makeAxisIndexes(index, size, repeat, enabled, shareCenter) {
      if (!enabled) {
        return [index];
      }
      var values = [];
      var stride = Math.max(1, size - (shareCenter ? 1 : 0));
      for (var block = 0; block <= repeat; block++) {
        values.push(block * stride + (block % 2 === 0 ? index : size - 1 - index));
      }
      return values;
    }

    function pushUniqueCell(cells, col, row) {
      var key = col + ":" + row;
      for (var i = 0; i < cells.length; i++) {
        if (cells[i].key === key) {
          return;
        }
      }
      cells.push({ key: key, col: col, row: row });
    }

    function getMirrorCells(i, k) {
      var xValues = makeAxisIndexes(i, groundWidth, mirrorRepeatX, mirrorUsesX(), mirrorCenterColOnce);
      var yValues = makeAxisIndexes(k, groundHeight, mirrorRepeatY, mirrorUsesY(), mirrorCenterRowOnce);
      var cells = [];
      var size = getMirrorGridSize();
      var square = Math.max(size.cols, size.rows);
      for (var y = 0; y < yValues.length; y++) {
        for (var x = 0; x < xValues.length; x++) {
          var col = xValues[x];
          var row = yValues[y];
          pushUniqueCell(cells, col, row);
          if (mirrorUsesMainDiagonal()) {
            pushUniqueCell(cells, row, col);
          }
          if (mirrorUsesAntiDiagonal()) {
            pushUniqueCell(cells, square - 1 - row, square - 1 - col);
          }
          if (mirrorPattern === "diagonal-both" || mirrorPattern === "all") {
            pushUniqueCell(cells, square - 1 - col, square - 1 - row);
          }
        }
      }
      return cells;
    }

    function setMirroredTileData(i, k, mapValue, itemValue) {
      var cells = getMirrorCells(i, k);
      for (var c = 0; c < cells.length; c++) {
        var row = cells[c].row;
        var col = cells[c].col;
        if (!currentMap[row]) {
          currentMap[row] = [];
        }
        if (!currentItems[row]) {
          currentItems[row] = [];
        }
        currentMap[row][col] = mapValue;
        currentItems[row][col] = itemValue || "";
      }
    }
