var OTP = window.OTP || {};

OTP.Map = function(_root, _controlsRoot, options) {
    if(typeof _root === 'undefined' || _root === null) {
        return null;
    }
    
    var root = jQuery(_root);
    var controlsRoot = jQuery(_controlsRoot);
    options = jQuery.extend(options, {});

    // instance vars
    var map = null;
    
    var contextMenu = null;
    var infoWindow = null;
    var layerChooserPopout = null;
    
    var queryableLayers = [];
    var plannedRouteLayer = null;
    var markersLayer = null;
    var markersDragControl = null;

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

    // context menu
    function hideContextMenu() {
        if(contextMenu !== null) {
            contextMenu.remove();
        }
            
        if(markersDragControl !== null) {
            markersDragControl.activate();
        }                 
    }
    
    function showContextMenu(point) {
        if(contextMenu !== null) {
            contextMenu.remove();
        }

        if(markersDragControl !== null) {
            markersDragControl.deactivate();
        }

        contextMenu = jQuery("<ul></ul>");

        var lonlat = map.getLonLatFromViewPortPx(point);
    
        var startTripHere = jQuery('<li></li>')
                            .append('<a href="#">Start Trip Here</a>')
                            .click(function(e) {
                                var proj = new OpenLayers.Projection("EPSG:4326");
                                if(typeof options.updateFromLocationFunction === 'function') {
                                    options.updateFromLocationFunction(lonlat.transform(map.getProjectionObject(), proj), false);
                                }
                                hideContextMenu();
                                return false;
                            });
        contextMenu.append(startTripHere);

        var endTripHere = jQuery('<li></li>')
                            .addClass("separator")
                            .append('<a href="#">End Trip Here</a>')
                            .click(function(e) {
                                var proj = new OpenLayers.Projection("EPSG:4326");
                                if(typeof options.updateToLocationFunction === 'function') {
                                    options.updateToLocationFunction(lonlat.transform(map.getProjectionObject(), proj), false);
                                }
                                hideContextMenu();
                                return false;
                            });
        contextMenu.append(endTripHere);

        var zoomInHere = jQuery('<li></li>')
                            .append('<a href="#">Zoom In Here</a>')
                            .click(function(e) {
                                var zoom = map.getZoom() + 1;
                                if(map.isValidZoomLevel(zoom)) {                                    
                                    map.setCenter(lonlat, zoom);
                                }
                                hideContextMenu();
                                return false;
                            });
        contextMenu.append(zoomInHere);

        var zoomOutHere = jQuery('<li></li>')
                            .append('<a href="#">Zoom Out Here</a>')
                            .click(function(e) {
                                var zoom = map.getZoom() - 1;
                                if(map.isValidZoomLevel(zoom)) {                                    
                                    map.setCenter(lonlat, zoom);
                                }
                                hideContextMenu();
                                return false;
                            });
        contextMenu.append(zoomOutHere);

        var centerMapHere = jQuery('<li></li>')
                            .append('<a href="#">Center Map Here</a>')
                            .click(function(e) {
                                map.centerLayerContainer(lonlat);
                                hideContextMenu();
                                return false;
                            });
        contextMenu.append(centerMapHere);

        contextMenu.css("z-index", "10000000")
            .css("position", "absolute")
            .css("left", point.x)
            .css("top", point.y)
            .menu();

        jQuery(map.viewPortDiv)
                .append(contextMenu);
    }

    function addContextMenuBehavior() {
        var showContextMenuWrapper = function(e) {
            // (all the below position stuff is for IE, from http://www.quirksmode.org/js/events_properties.html)
            var posx, posy = null;
            if (e.pageX || e.pageY) {
                posx = e.pageX;
                posy = e.pageY;
            } else if (e.clientX || e.clientY) {
                posx = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
                posy = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
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

    // feature info window/data layer query behavior
    function hideInfoWindow() {
        if(infoWindow !== null) {
            infoWindow.remove();
        }        
    }

    function getInfoWindowContentForFeature(featureProperties, layer) {
        var content = jQuery("<div></div>");

        var header = jQuery("<p></p>")
                        .addClass("header");

        switch(layer.name) {
            case "Fare Outlets":
                header.text(featureProperties.name);
                break;                                
            case "Park and Rides":
                header.text(featureProperties.location);            
                break;
            case "Stops":
                header.text(featureProperties.name);
                break;
            default:
                header.text("Unknown Layer");
        }
        
        content.append(header);

        return content;
    }

    function onGetFeatureResponse(featureData, layer) {
        hideInfoWindow();

        var feature = featureData.features[0];
        
        if(typeof featureData.features === 'undefined' 
            || featureData.features.length === 0
            || feature === null) {
            return;
        }

        var infoWindowContent = null;
        
        if(featureData.features.length > 1) {
            infoWindowContent = jQuery("<div>There is more than one feature at this point. Zoom in to choose one.</div>")
                                    .addClass("content")
                                    .css("width", "175px");
        } else {
            infoWindowContent =  jQuery(getInfoWindowContentForFeature(feature.properties, layer))
                                    .addClass("content");
        }
        
        var closeButton = jQuery('<a href="#">Close</a>')
                                    .addClass("close")
                                    .click(function(e) {
                                        hideInfoWindow();
                                        return false; 
                                    });

        infoWindow = jQuery("<div></div>")
                            .addClass("info-window")
                            .append(infoWindowContent.append(closeButton))
                            .appendTo(jQuery(map.layerContainerDiv));

        // set position of infowindow
        var wgsLonlat = new OpenLayers.LonLat(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
        var proj = new OpenLayers.Projection("EPSG:4326");
        var lonlat = wgsLonlat.transform(proj, map.getProjectionObject());
        var viewPortPx = map.getViewPortPxFromLonLat(lonlat);
        var layerContainerPx = map.getLayerPxFromViewPortPx(viewPortPx);
        var iconSize = getIconSizeInPixelsAtThisZoomLevel();

        infoWindowContent
            .css("width", infoWindowContent.width());

        infoWindow
            .css("top", layerContainerPx.y - infoWindow.height() - iconSize.h - 2)
            .css("left", layerContainerPx.x - (infoWindow.width() / 2));
    }

    function getIconSizeInPixelsAtThisZoomLevel() {
        if(map.getScale() <= 20000) {
            return new OpenLayers.Size(25, 25);
        } else if(map.getScale() <= 100000) {
            return new OpenLayers.Size(20, 20);
        } else if(map.getScale() <= 1500000) {
            return new OpenLayers.Size(15, 15);
        } else {
            return null;
        }
    }

    function addDataLayerQueryBehavior() {
        if(queryableLayers === null || queryableLayers.length === 0) {
            return;
        }
        
        OpenLayers.Control.GetFeatureInfoWithJSONP = OpenLayers.Class(OpenLayers.Control, {               
            initialize: function() {
                OpenLayers.Control.prototype.initialize.apply(this, arguments);

                this.handler = new OpenLayers.Handler.Click(
                    this,
                    {
                        'click': this.trigger
                    },
                    {
                        'single': true,
                        'double': false
                    }
                );
            },
            trigger: function(e) {
                var iconSize = getIconSizeInPixelsAtThisZoomLevel();                

                if(iconSize === null) {
                    // icons are now shown on map now
                    return;
                }
                
                var lonlat = map.getLonLatFromViewPortPx(e.xy); 
                var metersPerPixel = (1/map.getResolution());
                var bounds = new OpenLayers.Bounds(lonlat.lon - (iconSize.w * metersPerPixel), 
                                                    lonlat.lat - (iconSize.h * metersPerPixel), 
                                                    lonlat.lon + (iconSize.w * metersPerPixel), 
                                                    lonlat.lat + (iconSize.h * metersPerPixel));

                for(var i = 0; i < queryableLayers.length; i++) {
                    var activeLayers = [];
                    if(queryableLayers[i].getVisibility() === true) {
                        var activeLayer = queryableLayers[i];
                        activeLayers.push(activeLayer.params.LAYERS);
                    }

                    if(activeLayers.length === 0) {
                        return;
                    }

                    var callbackFunction = "getFeatureInfoCallback" + Math.floor(Math.random() * 1000000000);
                    jQuery.ajax({
                            url: "http://sea.dev.openplans.org/geoserver/wfs",
                            dataType: "jsonp",
                            jsonpCallback: callbackFunction,
                            data: {
                                request: "GetFeature",
                                outputFormat: "json",
                                format_options: "callback:" + callbackFunction,
                                typeName: activeLayers.join(","),
                                bbox: bounds.toBBOX(6, false) + "," + map.getProjection()
                            },
                            success: function(data) {    
                                onGetFeatureResponse(data, activeLayer);
                            }
                    });
                }
            }
        });

        var getFeatureInfoControl = new OpenLayers.Control.GetFeatureInfoWithJSONP();
        map.addControl(getFeatureInfoControl);
        getFeatureInfoControl.activate();
    }

    // layer stuff
    function addBaseLayers() {
        var apiKey = "AgszXQ8Q5lbiJFYujII-Lcie9XQ-1DK3a2X7xWJmfSeipw8BAAF0ETX8AJ4K-PDm";

        var road = new OpenLayers.Layer.Bing({
            key: apiKey,
            type: "Road",
            name: "Road"
        });

        var hybrid = new OpenLayers.Layer.Bing({
            key: apiKey,
            type: "AerialWithLabels",
            name: "Hybrid"
        });

        map.addLayers([road, hybrid]);
    }

    function addRouteLayers() {
        var routes = new OpenLayers.Layer.WMS("Routes", "http://sea.dev.openplans.org/geoserver/gwc/service/wms", {
            layers: 'soundtransit:routes',
            format: 'image/png'
        },
        {
            tileSize: new OpenLayers.Size(256,256),
            isBaseLayer: false,
            visibility: false
        });

        map.addLayers([routes]);        
    }

    function addDataLayers() {
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

        map.addLayers([stops, parkandride, fareoutlets]);

        // (will have info window popups associated with them when clicked on)
        queryableLayers = [stops, parkandride, fareoutlets];
    }

    function addPlannedRouteLayers() {
        // (markers are in a separate layer because they are draggable, the route is not)
        plannedRouteLayer = new OpenLayers.Layer.Vector("Planned Route");
        markersLayer = new OpenLayers.Layer.Vector("Planned Route Markers");

        map.addLayers([plannedRouteLayer, markersLayer]);

        // listener for drag events on markers
        var markersDragControl = new OpenLayers.Control.DragFeature(markersLayer, { onComplete: onCompleteMarkerMove });
        map.addControl(markersDragControl);
        markersDragControl.activate();
    }

    // layer manipulation
    function setBaseLayer(name) {
        var layerArray = map.layers;
        for (var i=0;i<layerArray.length;i++) {
            if (map.layers[i].name === name && map.layers[i].isBaseLayer === true) {
                map.setBaseLayer(map.layers[i]);
            }
        }  
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

    // layer selection UI
    function hideLayerButtonPopout() {
        if(layerChooserPopout !== null) {
            layerChooserPopout.hide();
        }
    }

    function showLayerButtonPopout(element, content, initFn) {
        hideLayerButtonPopout();

        element = jQuery(element);

        // if popout isn't already created, create it
        var popoutId = element.attr("id") + "-popout";
        layerChooserPopout = controlsRoot.find("#" + popoutId);
        if(layerChooserPopout.length === 0) {        
            var layerChooserPopoutContent = null;
            if(typeof content === "string") {
                layerChooserPopoutContent = jQuery("<div></div>")
                                            .append(jQuery(content));
            } else {
                layerChooserPopoutContent = jQuery(content.show());
            }

            // activate close button, if any is present
            layerChooserPopoutContent.find("a.close").click(function(e) {
                hideLayerButtonPopout();
                return false; 
            });

            layerChooserPopout = jQuery("<div></div>")
                                .addClass("layer-popout")
                                .append(layerChooserPopoutContent.addClass("content"));

            controlsRoot.append(layerChooserPopout.attr("id", popoutId));

            // call initialization function if specificed
            if(typeof initFn === 'function') {
                initFn(layerChooserPopoutContent);
            }
        }

        layerChooserPopout.show();
                 
        var openingElement = element;
        var parentElement = jQuery(openingElement.parent());
        var offset = openingElement.offset();
        var offsetParent = parentElement.offset();

        var contentElement = layerChooserPopout.find(".content");
        var contentWidth = contentElement.width();
        contentElement.css("width", contentWidth);
        layerChooserPopout.css("left", Math.floor((offset.left - offsetParent.left) - (contentWidth / 2)) + (element.width() / 2) - 5);
    }

    function showFerryRouteLayerSelector(element) {
        var chooserUI = controlsRoot.find("#ferry-layer-chooser");
        showLayerButtonPopout(element, chooserUI, function(content) {
            content.find("#ferry")
                .change(function(e) {
                    
                });
        });
    }

    function showLinkRouteLayerSelector(element) {
        var chooserUI = controlsRoot.find("#link-layer-chooser");
        showLayerButtonPopout(element, chooserUI, function(content) {

        });
    }

    function showSounderRouteLayerSelector(element) {
        var chooserUI = controlsRoot.find("#sounder-layer-chooser");
        showLayerButtonPopout(element, chooserUI, function(content) {

        });
    }

    function showBusRouteLayerSelector(element) {
        var chooserUI = controlsRoot.find("#bus-layer-chooser");
        showLayerButtonPopout(element, chooserUI, function(content) {

        });
    }

    function addMapLayerChooserBehavior() {
        // base layer links
        controlsRoot.find("#base-road")
            .click(function() {
                controlsRoot.find("#base-layers")
                    .find("a")
                    .removeClass("active");

                jQuery(this).addClass("active");

                setBaseLayer("Road");
                return false;
            });

        controlsRoot.find("#base-aerial")
            .click(function() {
                controlsRoot.find("#base-layers")
                    .find("a")
                    .removeClass("active");

                jQuery(this).addClass("active");

                setBaseLayer("Hybrid");
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
            })
            .hover(function(e) {
                if(e.type === "mouseenter") {
                    showLayerButtonPopout(this, "<strong>Fare&nbsp;Outlets</strong>", null);                    
                } else {
                    hideLayerButtonPopout();
                }
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
            })
            .hover(function(e) {
                if(e.type === "mouseenter") {
                    showLayerButtonPopout(this, "<strong>Park&nbsp;and&nbsp;Rides</strong>", null);                    
                } else {
                    hideLayerButtonPopout();
                }
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
            })
            .hover(function(e) {
                if(e.type === "mouseenter") {
                    showLayerButtonPopout(this, "<strong>Stops</strong>", null);                    
                } else {
                    hideLayerButtonPopout();
                }
            });
            
        // mode layers
        controlsRoot.find("#toggle-ferry")
            .click(function() {
                showFerryRouteLayerSelector(this);
                return false;
            });   
            
        controlsRoot.find("#toggle-link")
            .click(function() {
                showLinkRouteLayerSelector(this);
                return false;
            });     
                    
        controlsRoot.find("#toggle-sounder")
            .click(function() {
                showSounderRouteLayerSelector(this);
                return false;
            });  
                           
        controlsRoot.find("#toggle-bus")
            .click(function() {
                showBusRouteLayerSelector(this);
                return false;
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

    // constructor
    map = new OpenLayers.Map(root.attr("id"), {
        projection: new OpenLayers.Projection("EPSG:900913"),
        maxExtent: new OpenLayers.Bounds(-20037508.34,-20037508.34,20037508.34,20037508.34),
        controls: [
            new OpenLayers.Control.Navigation(),
            new OpenLayers.Control.KeyboardDefaults(),
            new OpenLayers.Control.PanZoomBar({zoomWorldIcon:false}),
            new OpenLayers.Control.Attribution()
        ]
    });

    // this points OL to our custom icon set
    OpenLayers.ImgPath = "js/openlayers/img/";

    // setup map 
    addBaseLayers();
    addPlannedRouteLayers();
    addRouteLayers();
    addDataLayers();

    addContextMenuBehavior();
    addMapLayerChooserBehavior();
    addDataLayerQueryBehavior();

    // center on seattle metro area
    var point = new OpenLayers.LonLat(-122.30, 47.45);
    var proj = new OpenLayers.Projection("EPSG:4326");
    map.setCenter(point.transform(proj, map.getProjectionObject()), 8);

    // public methods    
    return {
        reset: function() {
            if(plannedRouteLayer !== null) {
                plannedRouteLayer.removeAllFeatures();
            }

            if(markersLayer !== null) {
                markersLayer.removeAllFeatures();
            }
        },

        zoomToPlannedRoute: function() {
            if(plannedRouteLayer !== null) {
                var bounds = plannedRouteLayer.getDataExtent();
                map.zoomToExtent(bounds);
            }
        },

        // FIXME: we have to pass an encoded polyline into here because we 
        // don't have access to just the start/end points for some leg types. Change API?
        setStartPoint: function(encodedPolyline) {
                if(encodedPolyline === null) {
                    return;
                }

                var rawPoints = decodePolyline(encodedPolyline);

                if(rawPoints.length === 0) {
                    return;
                }

                var endPoint = rawPoints[0];
                var point = new OpenLayers.Geometry.Point(endPoint[1], endPoint[0]);
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

                markersLayer.addFeatures([icon]);
        },
        
        // FIXME: we have to pass an encoded polyline into here because we 
        // don't have access to just the start/end points for some leg types. Change API?
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

            markersLayer.addFeatures([icon]);
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
                         strokeColor: "#5380B0",
                         strokeOpacity: 0.80,
                         strokeWidth: 4
                };                
            } else if(type === "SOUNDER") {
                style = {
                         strokeColor: "#0B9140",
                         strokeOpacity: 0.80,
                         strokeWidth: 4
                };                                
            } else if(type === "LINK") {
                style = {
                         strokeColor: "#41B1C1",
                         strokeOpacity: 0.80,
                         strokeWidth: 4
                };                                
            }

            var polyline = new OpenLayers.Geometry.LineString(points);
            var lineFeature = new OpenLayers.Feature.Vector(polyline, null, style);
            plannedRouteLayer.addFeatures([lineFeature]);
        }
    };
};
