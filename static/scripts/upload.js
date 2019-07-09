/* FILE PROCESSING */
var lv = new PruneClusterForLeaflet(160);
mymap.addLayer(lv);

// file input
$(document).on('change', ':file', function() {
    var input = $(this),
        numFiles = input.get(0).files ? input.get(0).files.length : 1,
        label = input.val().replace(/\\/g, '/').replace(/.*\//, '');
    input.trigger('fileselect', [numFiles, label]);
});

var SCALAR_E7 = 0.0000001;
// Init oboe for file processing
var os = oboe()
os.node('locations.*', function(location) {
    var marker = new PruneCluster.Marker(location.latitudeE7 * SCALAR_E7,
    location.longitudeE7 * SCALAR_E7);
    marker.data.timestamp = location.timestampMs;
    lv.RegisterMarker(marker);
    return oboe.drop;
}).done('done');

// initialize file parsing
$(':file').on('fileselect', function(event, numFiles, label) {
    var input = $(this).parents('.input-group').find(':text'),
        log = numFiles > 1 ? numFiles + ' files selected' : label;

    if (input.length) {
        input.val(log);
        var file = $('#uploadInput').get(0).files[0];
        count = 0;
        parseFile(file, os);
        // initUpload(file);
    } else {
        if (log) alert(log);
    }
});


/*
 Break file into chunks and emit 'data' to oboe instance
 */

function parseFile(file, oboeInstance) {
    var fileSize = file.size;
    var chunkSize = 512 * 1024; // bytes
    var offset = 0;
    var self = this; // we need a reference to the current object
    var chunkReaderBlock = null;
    var startTime = Date.now();
    var endTime = Date.now();
    var readEventHandler = function(evt) {
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
            os.emit('done');
            console.log("Done reading file");
            $('#step-2').fadeIn(1000);
            endTime = Date.now();
            $("#stats").text("Time taken: " + ((endTime - startTime) / 1000).toFixed(2) + "s for file size " + (fileSize / (1024 * 1024)).toFixed(2) + " MB")
            lv.ProcessView()
            return;
        }

        // of to the next chunk
        chunkReaderBlock(offset, chunkSize, file);
    }

    chunkReaderBlock = function(_offset, length, _file) {
        var r = new FileReader();
        var blob = _file.slice(_offset, length + _offset);
        r.onload = readEventHandler;
        r.readAsText(blob);
    }

    // now let's start the read with the first block
    chunkReaderBlock(offset, chunkSize, file);
} 
