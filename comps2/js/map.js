var OTP = window.OTP || {};

OTP.Map = function(_root) {
    if(typeof _root === 'undefined' || _root === null) {
        return null;
    }
    
    var root = jQuery(_root);
    var map = null;
    var menu = null;

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

    function showPopupMenu(point) {
        var lonlat = map.getLonLatFromViewPortPx(point);

        menu = jQuery("<ul></ul>");
    
        var startTripHere = jQuery('<li></li>')
                            .append('<a href="#">Start Trip Here</a>')
                            .click(function(e) {
                                // FIXME
                                var proj = new OpenLayers.Projection("EPSG:900913");
                                var proj2 = new OpenLayers.Projection("EPSG:4326");
                                var wgsLonLat = lonlat.transform(proj, proj2);

                                jQuery("#from").val(wgsLonLat.lat + "," + wgsLonLat.lon).removeClass("blank");                                
                                menu.remove();
                                return false;
                            });
        menu.append(startTripHere);

        var endTripHere = jQuery('<li></li>')
                            .append('<a href="#">End Trip Here</a>')
                            .click(function(e) {
                                // FIXME
                                var proj = new OpenLayers.Projection("EPSG:900913");
                                var proj2 = new OpenLayers.Projection("EPSG:4326");
                                var wgsLonLat = lonlat.transform(proj, proj2);
                                
                                jQuery("#to").val(wgsLonLat.lat + "," + wgsLonLat.lon).removeClass("blank");
                                menu.remove();
                                return false;
                            });
        menu.append(endTripHere);

        var zoomInHere = jQuery('<li></li>')
                            .append('<a href="#">Zoom In Here</a>')
                            .click(function(e) {
                                var zoom = map.getZoom() + 1;
                                if(map.isValidZoomLevel(zoom)) {                                    
                                    map.setCenter(lonlat, zoom);
                                }
                                menu.hide();
                                return false;
                            });
        menu.append(zoomInHere);

        var zoomOutHere = jQuery('<li></li>')
                            .append('<a href="#">Zoom Out Here</a>')
                            .click(function(e) {
                                var zoom = map.getZoom() - 1;
                                if(map.isValidZoomLevel(zoom)) {                                    
                                    map.setCenter(lonlat, zoom);
                                }
                                menu.hide();
                                return false;
                            });
        menu.append(zoomOutHere);

        var centerMapHere = jQuery('<li></li>')
                            .append('<a href="#">Center Map Here</a>')
                            .click(function(e) {
                                var lonlat = map.getLonLatFromViewPortPx(point);
                                map.centerLayerContainer(lonlat);
                                menu.hide();
                                return false;
                            });
        menu.append(centerMapHere);

        menu.css("z-index", "10000000")
            .css("position", "absolute")
            .css("left", point.x)
            .css("top", point.y)
            .menu();

        jQuery(map.viewPortDiv)
                .append(menu);
    }

    // constructor
    map = new OpenLayers.Map(root.attr("id"), {
        projection: new OpenLayers.Projection("EPSG:900913"),
        maxExtent: new OpenLayers.Bounds(-20037508.34,-20037508.34,20037508.34,20037508.34),
        controls: [
            new OpenLayers.Control.Navigation(),
            new OpenLayers.Control.KeyboardDefaults(),
            new OpenLayers.Control.PanZoomBar({zoomWorldIcon:false})
        ]
    });

    // this points OL to our custom pan/zoom icon set
    OpenLayers.ImgPath = "js/openlayers/img/";

    // a container to hold our planned routes
    var plannedRoute = new OpenLayers.Layer.Vector("Planned Route");
    map.addLayer(plannedRoute);
    
    // add bing baselayers
    var road = new OpenLayers.Layer.Bing({ 
        key: "AgszXQ8Q5lbiJFYujII-Lcie9XQ-1DK3a2X7xWJmfSeipw8BAAF0ETX8AJ4K-PDm", 
        layer: "Road", 
        name: "Road"         
    });
    
    var aerial = new OpenLayers.Layer.Bing({ 
        key: "AgszXQ8Q5lbiJFYujII-Lcie9XQ-1DK3a2X7xWJmfSeipw8BAAF0ETX8AJ4K-PDm", 
        layer: "Aerial", 
        name: "Aerial" 
    });
    
    var hybrid = new OpenLayers.Layer.Bing({ 
        key: "AgszXQ8Q5lbiJFYujII-Lcie9XQ-1DK3a2X7xWJmfSeipw8BAAF0ETX8AJ4K-PDm", 
        layer: "AerialWithLabels", 
        name: "Aerial With Labels" 
    });

    map.addLayers([road, aerial, hybrid]);

    // context menu
    OpenLayers.Control.Click = OpenLayers.Class(OpenLayers.Control, {                
       initialize: function(options) {
           OpenLayers.Control.prototype.initialize.apply(this, arguments); 

           this.handler = new OpenLayers.Handler.Click(
                this, 
                {
                   'click': this.onClick
                },
                {
                  'single': true,
                  'double': false,
                  'pixelTolerance': 0,
                  'stopSingle': false,
                  'stopDouble': false
                }
            );
        }, 
        onClick: function(e) {
            if(e.button === 2 || (e.button === 0 && e.altKey === true)) {
                showPopupMenu(e.xy);
            } else {
                if(menu !== null) {
                    menu.hide();
                }
            }
        }
    });
    
    var clickControl = new OpenLayers.Control.Click();
    map.addControl(clickControl);
    clickControl.activate();

    // (hides context menu in FF)
    jQuery(map.layerContainerDiv)
        .get(0).oncontextmenu = function() { 
            return false; 
        };

   	// center on seattle metro area
   	var point = new OpenLayers.LonLat(-122.30, 47.45);
   	var proj = new OpenLayers.Projection("EPSG:4326");
   	var proj2 = new OpenLayers.Projection("EPSG:900913");
	map.setCenter(point.transform(proj, proj2), 8);
	
/* 
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
    
    map.addLayers([routes, stops, parkandride, fareoutlets]);
*/

    // public methods
    return {
        showLayer: function(name) {
            var layerArray = map.layers;
            for (var i=0;i<layerArray.length;i++) {
                if (map.layers[i].name === name) {
                      map.layers[i].setVisibility(true);
                }
            }
        },

        hideLayer: function(name) {
            var layerArray = map.layers;
            for (var i=0;i<layerArray.length;i++) {
                if (map.layers[i].name === name) {
                    map.layers[i].setVisibility(false);
                }
            }
        },

		toggleLayer: function(name) {
            var layerArray = map.layers;
            for (var i=0;i<layerArray.length;i++) {
                if (map.layers[i].name === name) {
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
        
        reset: function() {
            if(plannedRoute !== null) {
                plannedRoute.removeAllFeatures();
            }
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
                         strokeColor: "#02305E",
                         strokeOpacity: 0.75,
                         strokeWidth: 4
                };                
            }

            var polyline = new OpenLayers.Geometry.LineString(points);
            var lineFeature = new OpenLayers.Feature.Vector(polyline, null, style);
            plannedRoute.addFeatures([lineFeature]);
        }
    };
};
