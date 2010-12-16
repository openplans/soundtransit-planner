var OTP = window.OTP || {};

OTP.Map = function(_root, _controlsRoot, options) {
    if(typeof _root === 'undefined' || _root === null) {
        return null;
    }
    
    var root = jQuery(_root);
    var controlsRoot = jQuery(_controlsRoot);
    var map = null;
    var menu = null;
    
    var plannedRoute = null;
    var markers = null;
    var markersDragControl = null;
    var dataLayers = [];

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

    function hideContextMenu() {
        if(menu !== null) {
            menu.remove();
        }
            
        if(markersDragControl !== null) {
            markersDragControl.activate();
        }                 
    }
    
    function showContextMenu(point) {
        if(menu !== null) {
            menu.remove();
        }

        if(markersDragControl !== null) {
            markersDragControl.deactivate();
        }

        menu = jQuery("<ul></ul>");

        var lonlat = map.getLonLatFromViewPortPx(point);
    
        var startTripHere = jQuery('<li></li>')
                            .append('<a href="#">Start Trip Here</a>')
                            .click(function(e) {
                                var proj = new OpenLayers.Projection("EPSG:4326");
                                if(typeof options.updateFromLocationFunction === 'function') {
                                    options.updateFromLocationFunction(lonlat.transform(map.getProjectionObject(), proj), false);
                                }
                                menu.remove();
                                return false;
                            });
        menu.append(startTripHere);

        var endTripHere = jQuery('<li></li>')
                            .append('<a href="#">End Trip Here</a>')
                            .click(function(e) {
                                var proj = new OpenLayers.Projection("EPSG:4326");
                                if(typeof options.updateToLocationFunction === 'function') {
                                    options.updateToLocationFunction(lonlat.transform(map.getProjectionObject(), proj), false);
                                }
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
                                menu.remove();
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
                                menu.remove();
                                return false;
                            });
        menu.append(zoomOutHere);

        var centerMapHere = jQuery('<li></li>')
                            .append('<a href="#">Center Map Here</a>')
                            .click(function(e) {
                                map.centerLayerContainer(lonlat);
                                menu.remove();
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

    // layer stuff
    function addBaseLayers() {
        var road = new OpenLayers.Layer.Bing({ 
            key: "AgszXQ8Q5lbiJFYujII-Lcie9XQ-1DK3a2X7xWJmfSeipw8BAAF0ETX8AJ4K-PDm", 
            layer: "Road", 
            name: "Road",
            isBaseLayer: true,
      		sphericalMercator: true
        });

        var aerial = new OpenLayers.Layer.Bing({ 
            key: "AgszXQ8Q5lbiJFYujII-Lcie9XQ-1DK3a2X7xWJmfSeipw8BAAF0ETX8AJ4K-PDm", 
            layer: "Aerial", 
            name: "Aerial", 
            isBaseLayer: true,
            sphericalMercator: true
        });

        var hybrid = new OpenLayers.Layer.Bing({ 
            key: "AgszXQ8Q5lbiJFYujII-Lcie9XQ-1DK3a2X7xWJmfSeipw8BAAF0ETX8AJ4K-PDm", 
            layer: "AerialWithLabels", 
            name: "Aerial With Labels", 
            isBaseLayer: true,
      		sphericalMercator: true
        });

        map.addLayers([road, aerial, hybrid]); 
    }

    function addDataLayers() {
        var routes = new OpenLayers.Layer.WMS("Routes", "http://sea.dev.openplans.org/geoserver/gwc/service/wms", {
    		layers: 'soundtransit:routes',
    		format: 'image/png'
    	},
    	{ 
    		tileSize: new OpenLayers.Size(256,256), 
    		isBaseLayer: false,
            visibility: false
    	});

        var stops = new OpenLayers.Layer.WMS("Stops", "http://sea.dev.openplans.org/geoserver/gwc/service/wms", {
    		layers: 'soundtransit:stops',
    		format: 'image/png'
    	},
    	{ 
    		tileSize: new OpenLayers.Size(256,256), 
    		isBaseLayer: false,
            visibility: false
    	});

        var parkandride = new OpenLayers.Layer.WMS("Park and Rides", "http://sea.dev.openplans.org/geoserver/gwc/service/wms", {
        	layers: 'soundtransit:parkandrides',
        	format: 'image/png'
        },
        { 
        	tileSize: new OpenLayers.Size(256,256), 
        	isBaseLayer: false,
            visibility: false
        });

        var fareoutlets = new OpenLayers.Layer.WMS("Fare Outlets", "http://sea.dev.openplans.org/geoserver/gwc/service/wms", {
        	layers: 'soundtransit:fareoutlets',
        	format: 'image/png'
        },
        { 
        	tileSize: new OpenLayers.Size(256,256), 
        	isBaseLayer: false,
            visibility: false
        });

        dataLayers = [routes, stops, parkandride, fareoutlets];
        map.addLayers(dataLayers);        
    }

    function addPlannedRouteLayers() {
        plannedRoute = new OpenLayers.Layer.Vector("Planned Route");
        // (these are in a separate layer because they are draggable, the route is not)
        markers = new OpenLayers.Layer.Vector("Planned Route Markers");

        map.addLayers([plannedRoute, markers]);

        // listener for drag events on markers
        var markersDragControl = new OpenLayers.Control.DragFeature(markers, { onComplete: onCompleteMarkerMove });
        map.addControl(markersDragControl);
        markersDragControl.activate();
    }

	function setLayerVisibility(name, visible) {
        var layerArray = map.layers;
        for (var i=0;i<layerArray.length;i++) {
            if (map.layers[i].name === name) {
                map.layers[i].setVisibility(visible);
            }
        }
    }
    
    function getLayerVisibility(name) {
        var layerArray = map.layers;
        for (var i=0;i<layerArray.length;i++) {
            if (map.layers[i].name === name) {
                return map.layers[i].getVisibility();
            }
        }        
    }

    // behaviors
    function addMapLayerChooserBehavior() {
        // base layer links
        controlsRoot.find("#base-road")
            .click(function() {
                controlsRoot.find("#base-layers")
                    .find("a")
                    .removeClass("active");

                jQuery(this).addClass("active");

                setLayerVisibility('Road', true);
                setLayerVisibility('Aerial With Labels', false);
                setLayerVisibility('Aerial', false);
                return false;
            });

        controlsRoot.find("#base-aerial")
            .click(function() {
                controlsRoot.find("#base-layers")
                    .find("a")
                    .removeClass("active");

                jQuery(this).addClass("active");

                setLayerVisibility('Aerial With Labels', true);
                setLayerVisibility('Aerial', false);
                setLayerVisibility('Road', false);
                return false;
            });

        // data layer links
        controlsRoot.find("#toggle-fares")
            .click(function() {
                var layerName = 'Fare Outlets';
                if(getLayerVisibility(layerName) === true) {
                    setLayerVisibility(layerName, false);
                    jQuery(this).removeClass("active");                    
                } else {
                    setLayerVisibility(layerName, true);
                    jQuery(this).addClass("active");
                }
                return false;
            });

        controlsRoot.find("#toggle-parking")
            .click(function() {
                var layerName = 'Park and Rides';
                if(getLayerVisibility(layerName) === true) {
                    setLayerVisibility(layerName, false);
                    jQuery(this).removeClass("active");                    
                } else {
                    setLayerVisibility(layerName, true);
                    jQuery(this).addClass("active");
                }
                return false;
            });

        controlsRoot.find("#toggle-location")
            .click(function() {
                var layerName = 'Stops';
                if(getLayerVisibility(layerName) === true) {
                    setLayerVisibility(layerName, false);
                    jQuery(this).removeClass("active");                    
                } else {
                    setLayerVisibility(layerName, true);
                    jQuery(this).addClass("active");
                }
                return false;
            });
    }

    function addGetFeatureInfoBehavior() {
        for(var i = 0; i < dataLayers.length; i++) {
            var getFeatureInfoControl = new OpenLayers.Control.GetFeature({
                 protocol: new OpenLayers.Protocol.WFS.v1_1_0({
                     url: "http://sea.dev.openplans.org/geoserver/wfs",
                     featureType: "stops",
                     featurePrefix: "soundtransit",
                     outputFormat: "json"
                 }),
                 click: true
            });
            getFeatureInfoControl.events.register("featureselected", this, function(e) {
                  debugger;
            });
            map.addControl(getFeatureInfoControl);
            getFeatureInfoControl.activate();            
        }
    }

    function addContextMenuBehavior() {
        var showContextMenuWrapper = function(e) {
                // (all the below position stuff is for IE, from http://www.quirksmode.org/js/events_properties.html)
                var posx, posy = null;
                if (e.pageX || e.pageY) {
                    posx = e.pageX;
                    posy = e.pageY;
                } else if (e.clientX || e.clientY) 	{
                    posx = e.clientX + document.body.scrollLeft
                        + document.documentElement.scrollLeft;
                    posy = e.clientY + document.body.scrollTop
                        + document.documentElement.scrollTop;
                }

                var offsets = jQuery(map.div).offset();
                position = new OpenLayers.Pixel(posx - offsets.left,  posy - offsets.top);

                showContextMenu(position);
        };

        // click inside map
        jQuery(map.div).bind("click", function(e) {
            if(e.button === 2 || (e.button === 0 && e.altKey === true)) {
                showContextMenuWrapper(e);
            } else {
                hideContextMenu();
            }
        });

        jQuery(map.div).bind("contextmenu", function(e) {  
            showContextMenuWrapper(e);
            return false;
        });       

        // click outside map
        jQuery(document).mousedown(function(e) {
            hideContextMenu();
        });         
    }

    // event handlers
    function onCompleteMarkerMove(feature) {
        if(feature) {       
            var point = new OpenLayers.LonLat(feature.geometry.x, feature.geometry.y);
            var proj = new OpenLayers.Projection("EPSG:4326");

            if(feature.attributes.type === "start") {
                if(typeof options.updateFromLocationFunction === 'function') {
                    options.updateFromLocationFunction(point.transform(map.getProjectionObject(), proj), true);                            
                }
            } else if(feature.attributes.type === "end") {
                if(typeof options.updateToLocationFunction === 'function') {
                    options.updateToLocationFunction(point.transform(map.getProjectionObject(), proj), true);                            
                }                        
            }

            if(markersDragControl !== null) {
                markersDragControl.deactivate();
            }
        }
    }

    function onGetFeatureResponse(event) {
        debugger;
    }

    // constructor
    map = new OpenLayers.Map(root.attr("id"), {
        projection: new OpenLayers.Projection("EPSG:900913"),
        maxExtent: new OpenLayers.Bounds(-20037508.34,-20037508.34,20037508.34,20037508.34),
        controls: [
            new OpenLayers.Control.Navigation(),
            new OpenLayers.Control.KeyboardDefaults(),
            new OpenLayers.Control.PanZoomBar({zoomWorldIcon:false}),
            new OpenLayers.Control.Scale()
        ]
    });

    // this points OL to our custom icon set
    OpenLayers.ImgPath = "js/openlayers/img/";

    // setup map 
    addBaseLayers();
    addPlannedRouteLayers();
    addDataLayers();

    addContextMenuBehavior();
    addMapLayerChooserBehavior();
    addGetFeatureInfoBehavior();

    // center on seattle metro area
    var point = new OpenLayers.LonLat(-122.30, 47.45);
    var proj = new OpenLayers.Projection("EPSG:4326");
    map.setCenter(point.transform(proj, map.getProjectionObject()), 8);

    // public methods    
    return {
        reset: function() {
            if(plannedRoute !== null) {
                plannedRoute.removeAllFeatures();
            }

            if(markers !== null) {
                markers.removeAllFeatures();
            }
        },
        
        zoomToPlannedRoute: function() {
            if(plannedRoute !== null) {
                var bounds = plannedRoute.getDataExtent();
                map.zoomToExtent(bounds);
            }
        },
        
        setStartPoint: function(encodedPolyline) {
            if(encodedPolyline === null) {
                return;
            }
            
            var rawPoints = decodePolyline(encodedPolyline);
    
            if(rawPoints.length === 0) {
                return;
            }

            var startPoint = rawPoints[0];
            var point = new OpenLayers.Geometry.Point(startPoint[1], startPoint[0]);
            var proj = new OpenLayers.Projection("EPSG:4326");
            var icon = new OpenLayers.Feature.Vector(point.transform(proj, map.getProjectionObject()), { type: "start" });
            icon.style = {
                             externalGraphic: "img/a-flag.png",
                             graphicWidth: 23,
                             graphicHeight: 30,
                             graphicXOffset: 0,
                             graphicYOffset: -30,
                             graphicTitle: "Drag To Change Route",
                             cursor: "move"
                         };

            markers.addFeatures([icon]);
        },
        
        setEndPoint: function(encodedPolyline) {
            if(encodedPolyline === null) {
                return;
            }

            var rawPoints = decodePolyline(encodedPolyline);

            if(rawPoints.length === 0) {
                return;
            }

            var endPoint = rawPoints[rawPoints.length - 1];
            var point = new OpenLayers.Geometry.Point(endPoint[1], endPoint[0]);
            var proj = new OpenLayers.Projection("EPSG:4326");
            var icon = new OpenLayers.Feature.Vector(point.transform(proj, map.getProjectionObject()), { type: "end" });
            icon.style = {
                             externalGraphic: "img/b-flag.png",
                             graphicWidth: 23,
                             graphicHeight: 30,
                             graphicXOffset: 0,
                             graphicYOffset: -30,
                             graphicTitle: "Drag To Change Route",
                             cursor: "move"
                         };

            markers.addFeatures([icon]);
        },
        
        addLegToPlannedRoute: function(encodedPolyline, type) {
            if(encodedPolyline === null) {
                return;
            }
    
            var rawPoints = decodePolyline(encodedPolyline);
            var points = [];
            for(var i = 0; i < rawPoints.length; i++) {
                var point = new OpenLayers.Geometry.Point(rawPoints[i][1], rawPoints[i][0]);
               	var proj = new OpenLayers.Projection("EPSG:4326");
               	var point = point.transform(proj, map.getProjectionObject());
                points.push(point);
            }

            if(points.length === 0) {
                return;
            }

            var style = {};
            if(type === "WALK") {
                style = {
                         strokeColor: "#666666",
                         strokeOpacity: 0.80,
                         strokeWidth: 4
                };
            } else if(type === "BUS") {
                style = {
                         strokeColor: "#02305E",
                         strokeOpacity: 0.80,
                         strokeWidth: 4
                };                
            } else if(type === "SOUNDER") {
                style = {
                         strokeColor: "#448768",
                         strokeOpacity: 0.80,
                         strokeWidth: 4
                };                                
            } else if(type === "LINK") {
                style = {
                         strokeColor: "#228791",
                         strokeOpacity: 0.80,
                         strokeWidth: 4
                };                                
            }

            var polyline = new OpenLayers.Geometry.LineString(points);
            var lineFeature = new OpenLayers.Feature.Vector(polyline, null, style);
            plannedRoute.addFeatures([lineFeature]);
        }
    };
};
