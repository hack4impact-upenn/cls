// INIT CSV
var csv = [
  ["name of area", "end time", "duration"]
];
weekStartMS = 0;
weekEndMS = 0;

// On click of submit button start csv generation process
$('#submitProcess').on('click', function (e) {
  var errString = "";
  $('#submitErrors').remove();
  // if (!uploadURL) {
  //   errString += "No file has been uploaded. Please select a file.";
  // }
  if (Object.keys(boxes).length <= 0) {
    errString += " Please select at least one bounding box."
  }
  if (!$('#filename').val()) {
    errString += " Please enter a name for your file."
  }
  if ($("#startDay").val() === "") {
    errString += " Please select a valid start day"
  }
  if ($("#endDay").val() === "") {
    errString += " Please select a valid end day."
  }

  if (errString.length > 0) {
    $('#submitProcess').before("<div id='submitErrors' class='col-md-12'><div class='alert alert-danger'>" + errString + "<\/div><\/div>");
  } else {
    obj = processData(uploadURL, boxes, $('#email').val(), $('#startDay').val(), $('#endDay').val());
    inside = new Array(obj.boxes.length).fill(false);
    startTimes = new Array(obj.boxes.length).fill(null);
    durations = new Array(obj.boxes.length).fill(0);
    var newOboe = oboe();

    newOboe.node('locations.*', function (location) {
      if (weekEndMS === 0) {
        weekEndMS = moment.unix(location.timestampMs / 1000).day(obj.dayEnd).hour(23).minute(59).unix() * 1000;
        weekStartMS = moment.unix(location.timestampMs / 1000).day(obj.dayStart).hour(0).minute(0).unix() * 1000;
      }

      if (location.timestampMs >= weekStartMS && location.timestampMs <= weekEndMS) {
        // within a week
        for (var i = 0; i < obj.boxes.length; i++) {
          // iterate thru the boxes
          var box = obj.boxes[i];
          var lat = location.latitudeE7 / Math.pow(10, 7)
          var lng = location.longitudeE7 / Math.pow(10, 7)
            // check if in box coors && not inside a box
          if (box['swLat'] <= lat && box['neLat'] >= lat &&
            box['swLng'] <= lng && box['neLng'] >= lng && !inside[i]) {
            console.log('enetered ' + box.name);
            inside[i] = true;
            startTimes[i] = location.timestampMs;
          } else if ((box['swLat'] <= lat && box['neLat'] >= lat &&
              box['swLng'] <= lng && box['neLng'] >= lng) && !inside[i]) {
            durations[i] = Math.abs(location.timestampMs - startTimes[i]);
          }
          // not inside the box
          else if (!(box['swLat'] <= lat && box['neLat'] >= lat &&
              box['swLng'] <= lng && box['neLng'] >= lng) && inside[i]) {
            inside[i] = false;
            durations[i] = Math.abs(location.timestampMs - startTimes[i]);
          }
        }

      }
      else if (location.timestampMs < weekStartMS) {
        console.log(moment.unix(location.timestampMs / 1000).format('MM-DD-YYYY ddd HH:mm'));
        weekEndMS -= 604800000
        weekStartMS -= 604800000
        var locationtotal = 0;
        for (var i = 0; i < obj.boxes.length; i++) {
          if (startTimes[i] && durations[i] > 0) {
            console.log('pushed!' + startTimes[i]);
            csv.push([obj.boxes[i].name, moment.unix(startTimes[i] / 1000).format('MM-DD-YYYY ddd HH:mm'),
              (durations[i] / 1000 / 3600).toFixed(2) + " hrs"
            ])
            startTimes[i] = weekEndMS;
            locationtotal += (durations[i] / 1000 / 3600).toFixed(2)
          }
        }
        if (locationtotal > 0) {
          csv.push([], ["Total time this week is: " + locationtotal], [])
        }

      }
      return oboe.drop;
    }).done('done');
    parseFileToCSV($('#uploadInput').get(0).files[0], newOboe)
  }
});

function processData(uploadURL, boxes, email, start, end) {
  var url = uploadURL;
  var boxKeys = Object.keys(boxes);
  var resBoxArray = [];
  for (var i = 0; i < boxKeys.length; i++) {
    var parseObj = boxes[boxKeys[i]];
    var bounds = parseObj.rectangle._bounds;
    var ne = bounds._northEast;
    var sw = bounds._southWest;
    var neLat = ne.lat;
    var neLng = ne.lng;
    var swLat = sw.lat;
    var swLng = sw.lng;
    resBoxArray.push({
      name: parseObj.name,
      neLat: neLat,
      neLng: neLng,
      swLat: swLat,
      swLng: swLng
    });
  }
  return {
    url: url,
    boxes: resBoxArray,
    email: email,
    dayStart: start,
    dayEnd: end
  }
}

function parseFileToCSV(file, oboeInstance) {
  var fileSize = file.size;
  var chunkSize = 512 * 1024; // bytes
  var offset = 0;
  var self = this; // we need a reference to the current object
  var chunkReaderBlock = null;
  var startTime = Date.now();
  var endTime = Date.now();
  var readEventHandler = function (evt) {
    if (evt.target.error == null) {
      offset += evt.target.result.length;
      var progress = (100 * offset / fileSize).toFixed(2);
      var trimmed = (100 * offset / fileSize).toFixed(0);
      $("#done").css('width', trimmed + '%').attr('aria-valuenow', trimmed).text(progress + '%')
      var chunk = evt.target.result;
      oboeInstance.emit('data', chunk); // callback for handling read chunk
    } else {
      console.log("Read error: " + evt.target.error);
      return;
    }
    if (offset >= fileSize) {
      oboeInstance.emit('done');
      console.log("Done reading file");
      $("#step-2").css('display', 'block');
      endTime = Date.now();
      // $("#stats").text("Time taken: " + ((endTime - startTime) / 1000).toFixed(2) +
      //   "s for file size " + (fileSize / (1024 * 1024)).toFixed(2) + " MB")
      // lv.ProcessView()
      var csvContent = "data:text/csv;charset=utf-8,";
      csv.forEach(function (infoArray, index) {
        dataString = infoArray.join(",");
        csvContent += index < csv.length ? dataString + "\n" : dataString;
      });
      var encodedUri = encodeURI(csvContent);
      var link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "" + $("#filename").val() + ".csv");
      document.body.appendChild(link);
      link.click()
      return;
    }

    // of to the next chunk
    chunkReaderBlock(offset, chunkSize, file);
  }

  chunkReaderBlock = function (_offset, length, _file) {
    var r = new FileReader();
    var blob = _file.slice(_offset, length + _offset);
    r.onload = readEventHandler;
    r.readAsText(blob);
  }

  // now let's start the read with the first block
  chunkReaderBlock(offset, chunkSize, file);
}
