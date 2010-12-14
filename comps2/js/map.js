var OTP = window.OTP || {};

OTP.Map = function(_root) {
    if(typeof _root === 'undefined' || _root === null) {
        return null;
    }
    
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

		// Toggle the visibility of a layer, given a name
		function mapLayerToggle(layerName) {
			  var layerArray = map.layers;
			  for (var i=0;i<layerArray.length;i++) {
				    if (map.layers[i].name == layerName) {
					      map.layers[i].setVisibility(!map.layers[i].getVisibility());
				    }
			  }
		}

    // constructor
    map = new OpenLayers.Map(root.attr("id"), {
        projection: new OpenLayers.Projection("EPSG:900913"),
        maxExtent: new OpenLayers.Bounds(-20037508.34,-20037508.34,20037508.34,20037508.34),
        controls: [
            new OpenLayers.Control.Navigation(),
            new OpenLayers.Control.KeyboardDefaults(),
            new OpenLayers.Control.PanZoomBar({zoomWorldIcon:false}),
        ]
    });

    // this points OL to our custom pan/zoom icon set
    OpenLayers.ImgPath = "js/openlayers/img/";
    
    // add bing baselayers
    var shaded = new OpenLayers.Layer.VirtualEarth("Shaded", {
        type: VEMapStyle.Shaded,
		isBaseLayer: true,
		sphericalMercator: true 
    });
    var hybrid = new OpenLayers.Layer.VirtualEarth("Hybrid", {
        type: VEMapStyle.Hybrid,
		isBaseLayer: true,
		sphericalMercator: true 
    });
    var aerial = new OpenLayers.Layer.VirtualEarth("Aerial", {
        type: VEMapStyle.Aerial,
		isBaseLayer: true,
		sphericalMercator: true 
    });

   	map.addLayers([shaded, hybrid, aerial]);

   	// center on seattle metro area
   	var point = new OpenLayers.LonLat(-122.30, 47.45);
   	var proj = new OpenLayers.Projection("EPSG:4326");
   	var proj2 = new OpenLayers.Projection("EPSG:900913");
	map.setCenter(point.transform(proj, proj2), 8);
    
    // setup baselayers
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

    fareoutlets = new OpenLayers.Layer.WMS("Fare Outlets", "http://sea.dev.openplans.org/geoserver/gwc/service/wms", 
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
//    map.addLayers([routes, stops, parkandride, fareoutlets]);

    // a container layer for all the route polylines we'll draw on the map
    var plannedRoute = new OpenLayers.Layer.Vector("Planned Route");
    map.addLayer(plannedRoute);

    // public methods
    return {
		showLayer: function(name) {
			var layerArray = map.layers;
		  for (var i=0;i<layerArray.length;i++) {
			    if (map.layers[i].name == name) {
				      map.layers[i].setVisibility(true);
			    }
		  }
		},
		
		hideLayer: function(name) {
			var layerArray = map.layers;
		  for (var i=0;i<layerArray.length;i++) {
			    if (map.layers[i].name == name) {
				      map.layers[i].setVisibility(false);
			    }
		  }		
		},

		toggleLayer: function(name) {
			var layerArray = map.layers;
		  for (var i=0;i<layerArray.length;i++) {
			    if (map.layers[i].name == name) {
			      map.layers[i].setVisibility(!map.layers[i].getVisibility());
			    }
		  }		
		},
		
		
        setStartPoint: function() {
			// TODO
        },
        
        setEndPoint: function() {
			// TODO
        },
        
        zoomToPlannedRoute: function() {
            if(plannedRoute !== null) {
                var bounds = plannedRoute.getDataExtent();
                map.zoomToExtent(bounds);
            }
        },
        
        addLeg: function(type, encodedPolyline) {
            if(encodedPolyline === null) {
                return;
            }
    
            var rawPoints = decodePolyline(encodedPolyline);
            var points = [];
            for(var i = 0; i < rawPoints.length; i++) {
                var point = new OpenLayers.Geometry.Point();
                point.x = rawPoints[i][1];
                point.y = rawPoints[i][0];
                
               	var proj = new OpenLayers.Projection("EPSG:4326");
               	var proj2 = new OpenLayers.Projection("EPSG:900913");
                points.push(point.transform(proj, proj2));
            }

            if(points.length === 0) {
                return;
            }

            var style = {};
            if(type === "WALK") {
                style = {
                         strokeColor: "#666666",
                         strokeOpacity: 0.75,
                         strokeWidth: 4
                };
            } else if(type === "BUS") {
                style = {
                         strokeColor: "#446797",
                         strokeOpacity: 0.75,
                         strokeWidth: 4
                };                
            }

            var polyline = new OpenLayers.Geometry.LineString(points);
            var lineFeature = new OpenLayers.Feature.Vector(polyline, null, style);
            plannedRoute.addFeatures([lineFeature]);
        }
    };
}