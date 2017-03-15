/* INITIALIZE MAP */
var mymap = L.map('mapid', {
  scrollWheelZoom: false,
  zoomControl: false
}).setView([39.9526, -75.163], 3);

L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/streets-v10/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoiYWJoaXN1cmk5NyIsImEiOiJjaXc0MHcyZGkwMndmMnRvMHplM3c4cmV0In0.NIVRBOjWLn8rVRR9EgDQRw', {
  maxZoom: 18,
  attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap<\/a> contributors, ' +
    '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA<\/a>, ' +
    'Imagery © <a href="http://mapbox.com">Mapbox<\/a>',
}).addTo(mymap);
L.control.zoom({
  position: 'bottomright'
}).addTo(mymap);
$("#cancel").prop('disabled', true);

/* MAP STATE */
var newBoxMode = false;
var bounds = [];
var boxes = {};
var currentBox;
var clicking = false;
var dragStart, dragEnd;
var uploadURL;
var expansionCoef = 0.002195 // approx amount of degrees = 800 ft
/* MOUSE DRAG -> MAP BOX FUNCTIONALITY */

function mousedownMap(e) {
  if (newBoxMode) {
    clicking = true;
    bounds[0] = e.latlng;
    bounds[1] = e.latlng;
    currentBox = L.rectangle(bounds, {
      color: 'blue',
      weight: 1
    });
  }
}

function mousemoveMap(e) {
  if (newBoxMode && clicking) {
    bounds[1] = e.latlng;
    currentBox.setBounds(bounds);
    currentBox.addTo(mymap);
  }
}


/* HANDLE MAKING CHANGES TO THE TABLE FOR SHOWING BOXES */
function createBox(name) {
  if (name) {
    $('#step-3').fadeIn(1000);
    
    boxes[currentBox._leaflet_id] = {
      'name': name,
      'rectangle': currentBox,
      'zoomLevel': mymap.getZoom()
    };


    $('#locationTable thead tr:last').after(
      '<tr id="' + currentBox._leaflet_id + '"><td>' + name +
      '<\/td><td><div><button id="goToButton' + currentBox._leaflet_id + '" data-box-id="' + currentBox._leaflet_id + '" class="btn btn-default">Go To Box<\/button>&nbsp;<button class="btn btn-danger deleteBox">Delete<\/button></div><\/td><\/tr>'
    );

    $('#goToButton' + currentBox._leaflet_id).on('click', function (e) {
      var obj = boxes[$(this).data('boxId')]
      console.log(obj);
      var bounds = obj.rectangle._bounds;
      var neLat = bounds._northEast.lat
      var neLon = bounds._northEast.lng
      var swLat = bounds._southWest.lat
      var swLon = bounds._southWest.lng
      var lat = swLat + ((neLat - swLat) / 2);
      var long = swLon + ((neLon - swLon) / 2);
      mymap.setView(L.latLng(lat, long), obj.zoomLevel);
    })

    $('.deleteBox').on('click', function (e) {
      var id = this.parentNode.parentNode.parentNode.id;
      boxes[id].rectangle.editing.disable();
      boxes[id].rectangle.remove();
      delete boxes[id];
      this.parentNode.parentNode.parentNode.remove();
    });

    currentBox.bindPopup(name).openPopup();
    currentBox.editing.enable();
  } else {
    currentBox.remove();
  }
  currentBox = null;
}

/* RENDERING OF BOXES AT DIFFERENT ZOOM LEVELS */
function toggleAllBoxMarkers(e) {
  var boxKeys = Object.keys(boxes);
  for (var i = 0; i < boxKeys.length; i++) {
    toggleBoxMarker(boxes[boxKeys[i]]);
  }
}

function toggleBoxMarker(box) {
  var rect = box.rectangle;
  var zoom = box.zoomLevel;
  var boxPane = rect.getPane().firstChild;

  var w = boxPane.getBoundingClientRect().width;
  var h = boxPane.getBoundingClientRect().height;

  if ((w > 40 && h > 40) || mymap.getZoom() >= box.zoomLevel) {
    rect.editing.enable();
  } else {
    rect.editing.disable();
  }
}


function mouseupMap(e) {
  if (newBoxMode && currentBox) {
    bounds[1] = e.latlng;
    currentBox.setBounds(bounds);
    currentBox.addTo(mymap);
    boxPane = currentBox.getPane();

    bootbox.prompt('Give this location a name', createBox);
    $('.bootbox-input').attr('placeholder', 'e.g. Daily work location');
    mymap.dragging.enable();
    newBoxMode = false;
    clicking = false;
    $('.notif').fadeOut(500);
    $("#cancel").prop('disabled', true);
    $("#newBoxButton").prop('disabled', false);
  }
}

mymap.on('mousedown', mousedownMap);
mymap.on('mousemove', mousemoveMap);
mymap.on('mouseup', mouseupMap);
mymap.on('zoom', toggleAllBoxMarkers)

$('#newBoxButton').on('click', function (e) {
  newBoxMode = true;
  $('#newBoxButton').prop('disabled', true);
  $('#cancel').prop('disabled', false);
  $('.notif').fadeIn(500);
  mymap.dragging.disable();
})
$('#cancel').on('click', function (e) {
  newBoxMode = false;
  $("#newBoxButton").prop('disabled', false);
  $("#cancel").prop('disabled', true);
  $('.notif').fadeOut(500);
  mymap.dragging.enable();
})
