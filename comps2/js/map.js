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
        type: VEMapStyle.Shaded,
		isBaseLayer: true
    });
    var hybrid = new OpenLayers.Layer.VirtualEarth("Hybrid", {
        type: VEMapStyle.Hybrid,
		isBaseLayer: true
    });
    var aerial = new OpenLayers.Layer.VirtualEarth("Aerial", {
        type: VEMapStyle.Aerial,
		isBaseLayer: true
    });

   	map.addLayers([shaded, hybrid, aerial]);
	map.setCenter(new OpenLayers.LonLat(-122.30, 47.45), 8);
    


    routes = new OpenLayers.Layer.WMS("Routes", "http://sea.dev.openplans.org/geoserver/gwc/service/wms", 
		{
			layers: 'soundtransit:routes',
			format: 'image/png'
		},
		{ 
			tileSize: new OpenLayers.Size(256,256), 
			isBaseLayer: false 
		}
	);
    map.addLayer(routes);


    stops = new OpenLayers.Layer.WMS("Stops", "http://sea.dev.openplans.org/geoserver/gwc/service/wms", 
		{
			layers: 'soundtransit:stops',
			format: 'image/png'
		},
		{ 
			tileSize: new OpenLayers.Size(256,256), 
			isBaseLayer: false 
		}
	);
    map.addLayer(stops);

    

    parkandride = new OpenLayers.Layer.WMS("Park and Ride", "http://sea.dev.openplans.org/geoserver/gwc/service/wms", 
		{
			layers: 'soundtransit:parkandride',
			format: 'image/png'
		},
		{ 
			tileSize: new OpenLayers.Size(256,256), 
			isBaseLayer: false 
		}
	);
    map.addLayer(parkandride);



    fareoutlets = new OpenLayers.Layer.WMS("Park and Ride", "http://sea.dev.openplans.org/geoserver/gwc/service/wms", 
		{
			layers: 'soundtransit:fareoutlets',
			format: 'image/png'
		},
		{ 
			tileSize: new OpenLayers.Size(256,256), 
			isBaseLayer: false
		}
	);
    map.addLayer(fareoutlets);



    // public methods
    return {
		showLayer: function(name) {
			
		},
		
		hideLayer: function(name) {
			
		},
		
        setStartPoint: function() {

        },
        
        setEndPoint: function() {

        },
        
        addRouteLeg: function(encodedPolyline) {
        
        }
    };
}