// INIT CSV
var expansionCoef = 0.002195 // approx amount of degrees = 800 ft
var csv = [
  ["name of area", "start date", "start time", "end date", "end time", "duration (hrs)", "total time for week (hrs)"]
];
weekMarkMS = 0;

$('#submitProcess').on('click', function () {
  // get the box bounds for workplaces
  var boxbounds = Object.keys(boxes).map((i) => {
    var [neLat, neLng] = [boxes[i].rectangle._bounds._northEast.lat, boxes[i].rectangle._bounds._northEast.lng];
    var [swLat, swLng] = [boxes[i].rectangle._bounds._southWest.lat, boxes[i].rectangle._bounds._southWest.lng];
    return { name: boxes[i].name, neLat, neLng, swLat, swLng }
  })

  // define function to check if in box
  function isInBox(lat, lng, box) {
    var neLat = Number(box.neLat);
    var swLat = Number(box.swLat);
    var neLng = Number(box.neLng);
    var swLng = Number(box.swLng);
    if($('#expanded').is(":checked")) {
      swLat -= expansionCoef;
      swLng -= expansionCoef;
      neLat += expansionCoef;
      neLng += expansionCoef;
    }
    return (lat <= neLat && lat >= swLat && lng <= neLng && lng >= swLng);
  }
  // create array with all segments
  var prevBox = null
  var res = []
  var markers  = [...lv.GetMarkers()]
  var sortedMarkers = markers.sort((a, b) => a.data.timestamp - b.data.timestamp)
  var seg = { start: sortedMarkers[0].data.timestamp, end: sortedMarkers[0].data.timestamp, box: prevBox }
  sortedMarkers.forEach((i, idx) => {
    var a = boxbounds.filter(j => isInBox(Number(i.position.lat), Number(i.position.lng), j));
    var currBox = a[0] ? a[0].name : null;
    if (idx == markers.length -1) {
      seg.end = i.data.timestamp;
      res.push(seg);
      return;
    }
    if (currBox == prevBox) {
      seg.end = i.data.timestamp;
    }
    if (currBox != prevBox) {
      // assume you are in prevBox until you aren't
      res.push(seg);
      prevBox = currBox;
      seg = { start: i.data.timestamp, end: i.data.timestamp, box: prevBox }
    }
  })
  res = res.filter(i => i.start)
  console.log(res);
  // make CSV
  var weekStart = moment.unix(res[0].start / 1000).weekday(Number($('#startDay').val()) * -1).unix() * 1000;
  var weekSpan = 604800000
  var weekEnd = weekStart + weekSpan;
  var weekEntries = [{ weekStart, weekEnd, entries: [] }]
  var currWeek = 0
  for (var j = 0; j < res.length; j++) {
    var i = res[j];
    if (i.box) {
      if (i.start <= weekStart + weekSpan) {

        if (i.end < weekEnd) {
          weekEntries[currWeek].entries.push(i);
        } else {
          weekEntries[currWeek].entries.push({
            start: i.start,
            end: weekEnd,
            box: i.box
          });
          while (i.end > weekEnd + weekSpan) {
            currWeek += 1;
            weekStart = weekEnd;
            weekEnd = weekStart + weekSpan;
            weekEntries.push({ weekStart, weekEnd, entries: [] })
            weekEntries[currWeek].entries.push({
              start: weekStart,
              end: weekEnd,
              box: i.box
            });
          }
          currWeek += 1;
          weekStart = weekEnd;
          weekEnd = weekStart + weekSpan;
          weekEntries.push({ weekStart, weekEnd, entries: [] })
          weekEntries[currWeek].entries.push({
            start: weekStart,
            end: i.end,
            box: i.box
          });

        }
      } else {
        while (i.start >= weekStart + weekSpan) {
          weekStart = weekEnd;
          weekEnd = weekStart + weekSpan;
        }
        currWeek += 1;
        weekEntries.push({ weekStart, weekEnd, entries: [] })
        j--;
      }
    }
  }

  var infoArray = [
    ["name of area", "start date", "start time", "end date", "end time", "duration (hrs)", "total time for week (hrs)"]
  ];
  weekEntries.forEach((i) => {
    var timeTotal = 0;
    i.entries.forEach((i) => {
      var segmentDuration = (Number(i.end) - Number(i.start));
      if (segmentDuration > 0) {
        timeTotal += segmentDuration;
        infoArray.push(formatEntry(i));
      }
    });
    infoArray.push(formatEntry(timeTotal, true))
  });

  var lineArray = [];
  infoArray.forEach(function (infoArray, index) {
    var line = infoArray.join(",");
    lineArray.push(index == 0 ? "data:text/csv;charset=utf-8," + line : line);
  });
  var encodedUri = lineArray.join("\n");
   
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
    },function (isConfirm) {
      if (isConfirm) {
        link.click()
      } else {
        lineArray = [];
        infoArray = [
          ["name of area", "start date", "start time", "end date", "end time", "duration (hrs)", "total time for week (hrs)"]
        ];
        weekMarkMS = 0;
      }
    });

  function formatEntry(entry, isSum = false) {
    if (!isSum) {
      var { start, end, box } = entry;
      var startDate = moment.unix(start / 1000).format('MM-DD-YYYY');;
      var startTime = moment.unix(start / 1000).format('HH:mm');
      var endDate = moment.unix(end / 1000).format('MM-DD-YYYY');
      var endTime = moment.unix(end / 1000).format('HH:mm');
      var duration = (end - start) / (1000 * 3600)
      return [box, startDate, startTime, endDate, endTime, duration, '']
    } else {
      return [, , , , , , entry / (1000 * 3600)]
    }
  }

})
