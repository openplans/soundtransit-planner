var OTP = window.OTP || {};

OTP.Map = function(_root) {
    var root = jQuery(_root);
    var map = null;

    // private methods
    function decodePolyline(encoded) {
        var len = encoded.length;
        var index = 0;
        var array = [];
        var lat = 0;
        var lng = 0;

        while (index < len) {
            var b;
            var shift = 0;
            var result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            var dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lat += dlat;

            shift = 0;
            result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            var dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lng += dlng;

            array.push([lat * 1e-5, lng * 1e-5]);
        }

        return array;
    }


    // constructor
    OpenLayers.ImgPath = "js/openlayers/img/";

    map = new OpenLayers.Map(root.attr("id"), {
        controls: [
            new OpenLayers.Control.Navigation(),
            new OpenLayers.Control.KeyboardDefaults(),
            new OpenLayers.Control.PanZoomBar({zoomWorldIcon:false}),
        ]
    });

    var shaded = new OpenLayers.Layer.VirtualEarth("Shaded", {
        type: VEMapStyle.Shaded
    });
    var hybrid = new OpenLayers.Layer.VirtualEarth("Hybrid", {
        type: VEMapStyle.Hybrid
    });
    var aerial = new OpenLayers.Layer.VirtualEarth("Aerial", {
        type: VEMapStyle.Aerial
    });

    map.addLayers([shaded, hybrid, aerial]);
    map.setCenter(new OpenLayers.LonLat(-122.30, 47.45), 8);

    
    // public methods
    return {
        setStartPoint: function() {

        },
        
        setEndPoint: function() {

        },
        
        addRouteLeg: function(encodedPolyline) {
        
        }
    };
}