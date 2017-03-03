// INIT CSV
var expansionCoef = 0.002195 // approx amount of degrees = 800 ft
var csv = [
  ["name of area", "start date", "start time", "end date", "end time", "duration (hrs)", "total time for week (hrs)"]
];
weekMarkMS = 0;
// On click of submit button start csv generation process
$('#submitProcess').on('click', function (e) {
  var errString = "";
  $('#submitErrors').remove();
  
  if (Object.keys(boxes).length <= 0) {
    errString += " Please select at least one bounding box."
  }
  if (!$('#filename').val()) {
    errString += " Please enter a name for your file."
  }
  if ($("#startDay").val() === "") {
    errString += " Please select a valid start day."
  }
  if (errString.length > 0) {
    $('#submitProcess').before("<div id='submitErrors' class='col-md-12'><div class='alert alert-danger'>" + errString + "<\/div><\/div>");
  } else {
    swal({
      title: "Processing Location Data",
      text: 'Note this may take a few minutes: <br> <div class="progress"><div aria-valuemax="100" aria-valuemin="0" aria-valuenow="0" class="progress-bar progress-bar-success" id="donecsv" role="progressbar" style="min-width: 2em">0%</div>',
      html: true,
      showConfirmButton: false
    });

    var obj = processData(boxes, $('#startDay').val());
    var inside = new Array(obj.boxes.length).fill(false);
    var endTimes = new Array(obj.boxes.length).fill(0);
    var durations = new Array(obj.boxes.length).fill(0);
    var count = 0;
    var newOboe = oboe();
    newOboe.node('locations.*', function (location) {
      if (count == 0) {
        console.log('yes count is ' + count );
        weekMarkMS = moment.unix(location.timestampMs / 1000).day(obj.dayStart).hour(0).minute(0).unix() * 1000;
      }
      if (location.timestampMs >= weekMarkMS) {
        for(var i = 0; i < obj.boxes.length; i++) {
          if (isInBox(location.latitudeE7, location.longitudeE7, obj.boxes[i])) {
            if (inside[i] === false) {
              inside[i] = true;
              endTimes[i] = location.timestampMs;
            }
          } else {
            if (inside[i] === true) {
              console.log('is inside');
              var startDate = moment.unix(location.timestampMs / 1000).format('MM-DD-YYYY')
              var startTime = moment.unix(location.timestampMs / 1000).format('HH:mm')
              var endDate = moment.unix(endTimes[i] / 1000).format('MM-DD-YYYY')
              var endTime = moment.unix(endTimes[i] / 1000).format('HH:mm')
              var duration = Math.abs(endTimes[i] - location.timestampMs) / 1000 / 3600
              var entry = [ obj.boxes[i].name, startDate, startTime, endDate, endTime, duration, "", location.timestampMs, endTimes[i]];
              csv.push(entry);
              // reset
              inside[i] = false;
              endTimes[i] = 0;
              durations[i] += duration;
            }
          }
        }
      } 
      if (location.timestampMs < weekMarkMS) {
        for(var i = 0; i < obj.boxes.length; i++) {
          // go thru boxes
          // if still in, cut at the weekMarkMS 
          // start new entry 
          // then just reset weekMark
          // still inside at the end of the week
          if (inside[i] === true) {
            // cut at the weekMarkMS time and add an entry
            var startDate = moment.unix(weekMarkMS / 1000).format('MM-DD-YYYY')
            var startTime = moment.unix(weekMarkMS / 1000).format('HH:mm')
            var endDate = moment.unix(endTimes[i] / 1000).format('MM-DD-YYYY')
            var endTime = moment.unix(endTimes[i] / 1000).format('HH:mm')
            var duration = Math.abs(weekMarkMS - endTimes[i]) / 1000 / 3600
            durations[i] += duration;
            var entry = [ obj.boxes[i].name, startDate, startTime, endDate, endTime, duration, "", weekMarkMS, endTimes[i]];
            csv.push(entry);
            console.log(entry);
            console.log("WEEK END ENTRY CUT");
            // makes sure that endtimes is updated to the new week
            if (isInBox(location.latitudeE7, location.longitudeE7, obj.boxes[i])) {
              endTimes[i] = weekMarkMS - 1;
            } else {
              inside[i] = false;
              endTimes[i] = 0;
            }
          }
        }
        var total = 0;
        var str = ""
        for (var i = 0; i < obj.boxes.length; i++) {
          if (durations[i] > 0) {
            total += Math.abs(durations[i])
            durations[i] = 0
          }
        }
        var weekEntry = [,,,,,,total]
        if (total > 0) {csv.push(weekEntry)};
        console.log('PUSHED WEEK');
        weekMarkMS -= 604800000;
      }
      count++;
      return oboe.drop;
    }).fail(function(err) {
      console.log(err);
    });
    parseFileToCSV($('#uploadInput').get(0).files[0], newOboe);
  }
});
function isInBox(lat, lng, box){ 
  var lat = lat / Math.pow(10, 7);
  var lng = lng / Math.pow(10, 7);
  if (lat <= box.neLat && lat >= box.swLat && lng <= box.neLng && lng >= box.swLng) {
    return true;
  } else {
    return false;
  }
}
function processData(boxes, start) {
  var boxKeys = Object.keys(boxes);
  var resBoxArray = [];
  var arr = [1,2,3,4,5,6,7];
  function getIdx(idx) { return arr[idx - 2 >= 0 ? idx - 2: arr.length - 1] }
  for (var i = 0; i < boxKeys.length; i++) {
    var parseObj = boxes[boxKeys[i]];
    var bounds = parseObj.rectangle._bounds;
    var ne = bounds._northEast;
    var sw = bounds._southWest;
    var neLat = ne.lat;
    var neLng = ne.lng;
    var swLat = sw.lat;
    var swLng = sw.lng;
    if($('#expanded').is(":checked")) {
      console.log('EXPANDED');
      swLat -= expansionCoef;
      swLng -= expansionCoef;
      neLat += expansionCoef;
      neLng += expansionCoef;
    }

    console.log('swlat: ' + swLat + 'swlng: ' + swLng + 'neLat: ' + neLat + 'neLng: ' + neLng);
    resBoxArray.push({
      name: parseObj.name,
      neLat: neLat,
      neLng: neLng,
      swLat: swLat,
      swLng: swLng
    });
  }
  return {
    boxes: resBoxArray,
    dayStart: start,
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
      $("#donecsv").css('width', trimmed + '%').attr('aria-valuenow', trimmed).text(progress + '%')
        // console.log(progress);
      var chunk = evt.target.result;
      oboeInstance.emit('data', chunk); // callback for handling read chunk
    } else {
      console.log("Read error: " + evt.target.error);
      return;
    }
    if (offset >= fileSize) {
      oboeInstance.emit('done');
      console.log("Done reading file");
      endTime = Date.now();
      trimmedCSV = [];
      for (var i = 0; i < csv.length; i++) {
        if (i <= 1) {		
          trimmedCSV.push(csv[i]);
        } else {		
          // check if locations are the same		
          if (csv[i][0] !== "" || trimmedCSV[trimmedCSV.length-1][0] !== "") {		
            if( trimmedCSV[trimmedCSV.length-1][0] === csv[i][0]) {		
              if (Math.abs(trimmedCSV[trimmedCSV.length-1][7] - csv[i][8]) <= 360000) {		
                var old = trimmedCSV[trimmedCSV.length-1];		
                var newentry = csv[i];		
                trimmedCSV[trimmedCSV.length-1] = [newentry[0], newentry[1], newentry[2], old[3], old[4], old[5] + newentry[5], "", newentry[7], old[8]]; 		
              } else {		
                trimmedCSV.push(csv[i])		
              }		
            } else {		
              trimmedCSV.push(csv[i])		
            }		
          } else {		
            trimmedCSV.push(csv[i])		
          }		
        }
      }
      var csvContent = "";
      trimmedCSV.forEach(function (infoArray, index) {
        infoArray = infoArray.slice(0,7);
        dataString = infoArray.join(",");
        csvContent += index < trimmedCSV.length ? dataString + "\n" : dataString;
      });

      var encodedUri = "data:text/csv;charset=utf8," + encodeURIComponent(csvContent);
      var link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "" + $("#filename").val() + ".csv");
      document.body.appendChild(link);
      swal({
        title: "Your file has been created",
        type: "success",
        html: true,
        showCancelButton: true,
        closeOnConfirm: false,
        cancelButtonText: "Edit information",
        confirmButtonText: "Download CSV"
      },
      function(isConfirm){
        if (isConfirm) {
          link.click()
        } else {
          csv = [
            ["name of area", "start date", "start time", "end date", "end time", "duration (hrs)", "total time for week (hrs)"]
          ];
          weekMarkMS = 0;
        }
      });
      
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
