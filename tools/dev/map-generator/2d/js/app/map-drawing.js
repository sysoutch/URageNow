function makeImageOfCanvas() {
  var imageUrl = canvas.toDataURL();
  document.getElementById("source_img").src = imageUrl;
  var sourceImg = document.getElementById("source_img");
  var targetImg = document.getElementById("target_img");
  var quality = exportQuality;
  var outputFormat = "jpg";
  var downloadUrl = imageUrl;
  var extension = ".png";

  if (typeof jic !== "undefined") {
    targetImg.src = jic.compress(sourceImg, quality, outputFormat).src;
    downloadUrl = targetImg.src;
    extension = ".jpg";
  }

  downloadDataUrl(downloadUrl, buildMapExportName(extension));
}
