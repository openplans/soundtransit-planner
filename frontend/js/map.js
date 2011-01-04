var OTP = window.OTP || {};

OTP.Map = function(_root, _controlsRoot, options) {
    if(typeof _root === 'undefined' || _root === null) {
        return null;
    }
    
    // configuration options--valid values are:
    //
    // * updateFromLocationFunction: function called when end marker is dragged
    // * updateToLocationFunction: function called when start marker is dragged
    // * hasTripPlanner: true or false, indicating whether a trip planner is present with this map
    //
    options = jQuery.extend(options, {});
    
    // DOM elements
    var root = jQuery(_root);
    var controlsRoot = jQuery(_controlsRoot);
    var map = null;

    // popup-able things
    var contextMenu = null;
    var infoWindow = null;
    var layerChooserPopout = null;

    // array of WMS layers that can be queried with WFS GetFeature
    var queryableLayers = [];

    // the vector layers that are used by the trip planner to show the planned route.
    var routeLayer = null;   
    var markersLayer = null;
    var markersDragControl = null;

    // CQL filter for system-map route layer
    var systemMapRouteCriteria = {};

    // decodes google-encoded polyline data
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

    // context menu (right-click menu)
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

        contextMenu = jQuery("<ul></ul>")
                        .addClass("context-menu");

        var lonlat = map.getLonLatFromViewPortPx(point);
    
        // show trip-planner-only functions if we have a trip planner attached
        if(options.hasTripPlanner === true) {
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
        }
        
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

        contextMenu
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

    function showInfoWindow(clickedLocation, featureData) {
        hideInfoWindow();

        if(typeof featureData.features === 'undefined' || featureData.features.length === 0) {
            return;
        }

        var feature = featureData.features[0];

        if(feature === null) {
            return;
        }
        
        // create info window popup wrapper and append to DOM
        var lonlat = null;
        var infoWindowContent = null;
        if(featureData.features.length > 1) {
            infoWindowContent = jQuery("<div>There is more than one facility at this point. Zoom in to choose one.</div>")
                                    .addClass("content")
                                    .css("width", "175px");
                                    
            lonlat = clickedLocation;
        } else {
            infoWindowContent =  jQuery(getInfoWindowContentForFeature(feature.properties))
                                    .addClass("content");

            var wgsLonlat = new OpenLayers.LonLat(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
            var proj = new OpenLayers.Projection("EPSG:4326");
            lonlat = wgsLonlat.transform(proj, map.getProjectionObject());
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
        var viewPortPx = map.getViewPortPxFromLonLat(lonlat);
        var layerContainerPx = map.getLayerPxFromViewPortPx(viewPortPx);
        var iconSize = getIconSizeInPixelsAtThisZoomLevel();

        infoWindowContent
            .css("width", infoWindowContent.width());

        infoWindow
            .css("top", layerContainerPx.y - infoWindow.height() - iconSize.h - 2)
            .css("left", layerContainerPx.x - (infoWindow.width() / 2));
            
        ensureInfoWindowIsVisible();
    }

    function ensureInfoWindowIsVisible() {
        if(infoWindow === null) {
            return;
        }
        
        var infoWindowWidth = infoWindow.width();
        var infoWindowPosition = infoWindow.position();
        var viewPortWidth = jQuery(map.viewPortDiv).width();
        var layerContainerPosition = jQuery(map.layerContainerDiv).position();

        var x = 0;
        var y = 0;

        var hiddenTop = infoWindowPosition.top + layerContainerPosition.top;
        if(hiddenTop < 0) {
            y = hiddenTop - 30;
        }

        var hiddenLeft = infoWindowPosition.left + layerContainerPosition.left;
        if(hiddenLeft < 0) {
            x = hiddenLeft - 50;
        }

        var hiddenRight = (infoWindowPosition.left + layerContainerPosition.left + infoWindowWidth) - viewPortWidth;
        if(hiddenRight > 0) {
            x += hiddenRight + 30;
        }

        map.pan(x, y);
    }

    function getInfoWindowContentForFeature(featureProperties) {
        var content = jQuery("<div></div>")
                            .addClass("content");

        var headerWrapper = jQuery("<div></div>")
                            .addClass("header")
                            .appendTo(content);

        var header = jQuery("<p></p>")
                            .appendTo(headerWrapper);

        if(typeof featureProperties.outlettype !== 'undefined') {
            headerWrapper.addClass("fareoutlet");
            header.text(featureProperties.name);
        } else if(typeof featureProperties.accessible !== 'undefined') {
            headerWrapper.addClass("stop");
            header.text(featureProperties.name);
        } else {
            headerWrapper.addClass("parkandride");
            header.text(featureProperties.location);
        }

        for(k in featureProperties) {
            var v = featureProperties[k];            

            content.append("<p>" + k + ": " + v + "</p>");
        }
        
        return content;
    }

    // NOTE: this logic should match the SLD-specified display logic in GeoServer!
    function getIconSizeInPixelsAtThisZoomLevel() {
        if(map.getScale() <= 50000) {
            return new OpenLayers.Size(25, 25);            
        } else {
            var iconSizeInMeters = 500;
            var iconSizeInPixels = iconSizeInMeters / map.getResolution();
            return new OpenLayers.Size(iconSizeInPixels, iconSizeInPixels);
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
                    return;
                }
                
                // build a bbox that is roughly the size of a icon on the map at this zoom level
                var lonlat = map.getLonLatFromViewPortPx(e.xy); 
                var metersPerPixel = map.getResolution();
                var queryBounds = new OpenLayers.Bounds(lonlat.lon - (iconSize.w * metersPerPixel), 
                                                    lonlat.lat - (iconSize.h * metersPerPixel), 
                                                    lonlat.lon + (iconSize.w * metersPerPixel), 
                                                    lonlat.lat + (iconSize.h * metersPerPixel));

                // generate visible layer query specification
                var visibleLayerTypes = [];
                for(var i = 0; i < queryableLayers.length; i++) {
                    if(queryableLayers[i].getVisibility() === true) {
                        var activeLayer = queryableLayers[i];
                        visibleLayerTypes.push(activeLayer.params.LAYERS);
                    }
                }
                
                if(visibleLayerTypes.length === 0) {
                    return;
                }

                // make request
                var callbackFunction = "getFeatureCallback" + Math.floor(Math.random() * 1000000000);
                jQuery.ajax({
                        url: "http://sea.dev.openplans.org:8080/geoserver/wfs",
                        dataType: "jsonp",
                        jsonpCallback: callbackFunction,
                        data: {
                            request: "GetFeature",
                            outputFormat: "json",
                            format_options: "callback:" + callbackFunction,
                            typeName: visibleLayerTypes.join(","),
                            bbox: queryBounds.toBBOX(6, false) + "," + map.getProjection()
                        },
                        success: function(data) {    
                            showInfoWindow(lonlat, data);
                        }
                });
            }
        });

        var getFeatureInfoControl = new OpenLayers.Control.GetFeatureInfoWithJSONP();
        map.addControl(getFeatureInfoControl);
        getFeatureInfoControl.activate();
    }

    // layer stuff
    function zoomToRouteLayerExtent() {
        if(routeLayer !== null) {
            var bounds = routeLayer.getDataExtent();
            map.zoomToExtent(bounds);
        }
    }

    // FIXME: do we need to clear then readd everything here?
    function refreshRouteLayer() {
        if(routeLayer !== null) {
            routeLayer.removeAllFeatures();
        }
        
        for(mode in systemMapRouteCriteria) {         
            var cqlQuery = systemMapRouteCriteria[mode];

            if(cqlQuery === null || cqlQuery === "") {
                continue;
            }

            var style = null;
            if(mode === "WSF") {
                 style = {
                          strokeColor: "#666666",
                          strokeOpacity: 0.80,
                          strokeWidth: 4
                 };
            } else if(mode === "BUS") {
                 style = {
                          strokeColor: "#5380B0",
                          strokeOpacity: 0.80,
                          strokeWidth: 4
                 };                
            } else if(mode === "SOUNDER") {
                 style = {
                          strokeColor: "#0B9140",
                          strokeOpacity: 0.80,
                          strokeWidth: 4
                 };                                
            } else if(mode === "LINK") {
                 style = {
                          strokeColor: "#41B1C1",
                          strokeOpacity: 0.80,
                          strokeWidth: 4
                 };                                
            }

            drawWFSRouteQueryWithStyle(cqlQuery, style);
        }
    }

    function drawWFSRouteQueryWithStyle(cqlQuery, style) {
        if(cqlQuery === null || style === null) {
            return;
        }

        var callbackFunction = "drawWFSRouteQueryWithStyleCallback" + Math.floor(Math.random() * 1000000000);
        jQuery.ajax({
             url: "http://sea.dev.openplans.org:8080/geoserver/wfs",
             dataType: "jsonp",
             jsonpCallback: callbackFunction,
             data: {
                 request: "GetFeature",
                 outputFormat: "json",
                 format_options: "callback:" + callbackFunction,
                 typeName: "soundtransit:routes",
                 propertyName: "the_geom",
                 cql_filter: cqlQuery
             },
             success: function(data) {
                 if(typeof data.features === 'undefined') {
                     return;
                 }

                 jQuery(data.features).each(function(_, feature) {
                     for(var z = 0; z < feature.geometry.coordinates.length; z++) {
                         var points = [];

                         for(var i = 0; i < feature.geometry.coordinates[z].length; i++) {
                             var wgsPoint = new OpenLayers.Geometry.Point(feature.geometry.coordinates[z][i][1], feature.geometry.coordinates[z][i][0]);
                             var proj = new OpenLayers.Projection("EPSG:4326");
                             var point = wgsPoint.transform(proj, map.getProjectionObject());
                             points.push(point);
                         }

                         if(points.length === 0) {
                             return;
                         }

                         var polyline = new OpenLayers.Geometry.LineString(points);
                         var lineFeature = new OpenLayers.Feature.Vector(polyline, null, style);
                         routeLayer.addFeatures([lineFeature]);
                     }
                 });

             }
        });        
    }
    
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

    function addDataLayers() {
        var stops = new OpenLayers.Layer.WMS("Stops", "http://sea.dev.openplans.org:8080/geoserver/gwc/service/wms", {
            layers: 'soundtransit:stops',
            format: 'image/png'
        },
        {
            tileSize: new OpenLayers.Size(256,256),
            isBaseLayer: false,
            visibility: false
        });

        var parkandride = new OpenLayers.Layer.WMS("Park and Rides", "http://sea.dev.openplans.org:8080/geoserver/gwc/service/wms", {
            layers: 'soundtransit:parkandrides',
            format: 'image/png'
        },
        {
            tileSize: new OpenLayers.Size(256,256),
            isBaseLayer: false,
            visibility: false
        });

        var fareoutlets = new OpenLayers.Layer.WMS("Fare Outlets", "http://sea.dev.openplans.org:8080/geoserver/gwc/service/wms", {
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

    function addRouteLayers() {
        // (markers are in a separate layer because they are draggable, the route is not)
        routeLayer = new OpenLayers.Layer.Vector("Routes");
        markersLayer = new OpenLayers.Layer.Vector("Route Markers");

        map.addLayers([routeLayer, markersLayer]);

        // listener for drag events on markers
        var markersDragControl = new OpenLayers.Control.DragFeature(markersLayer, { onComplete: onCompleteMarkerMove });
        map.addControl(markersDragControl);
        markersDragControl.activate();
    }

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

    // layer selection UI + tooltips
    function hideLayerButtonPopout() {
        if(layerChooserPopout !== null) {
            layerChooserPopout.hide();
        }
    }

    function showLayerButtonPopout(openingElement, content, initFn) {
        hideLayerButtonPopout();

        openingElement = jQuery(openingElement);

        // if popout isn't already created, create it + add it to DOM
        var popoutId = openingElement.attr("id") + "-popout";

        layerChooserPopout = controlsRoot.find("#" + popoutId);
        if(layerChooserPopout.length === 0) {
            // wrap content in a div if we were passed a string--if a DOM node, just wrap in jQuery.
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
                 
        // position popout
        var parentElement = jQuery(openingElement.parent());
        var offset = openingElement.offset();
        var offsetParent = parentElement.offset();

        var contentElement = layerChooserPopout.find(".content");
        var contentWidth = contentElement.width();
        contentElement.css("width", contentWidth);
        layerChooserPopout.css("left", Math.floor((offset.left - offsetParent.left) - (contentWidth / 2)) + (openingElement.width() / 2) - 5);
    }

    function showFerryRouteLayerSelector(element) {
        var chooserUI = controlsRoot.find("#ferry-layer-chooser");
        
        showLayerButtonPopout(element, chooserUI, function(content) {
            content.find("#ferry")
                .change(function(e) {
                    var v = jQuery(this).val();
                    
                    if(v !== null && v !== "" && v !== "Select route") {
                        systemMapRouteCriteria.WSF = "(designator LIKE '" + v + "' AND routetyp LIKE 'P')";
                    } else {
                        systemMapRouteCriteria.WSF = "";
                    }
                    
                    refreshRouteLayer();
                });
        });
    }

    function showLinkRouteLayerSelector(element) {
        var chooserUI = controlsRoot.find("#link-layer-chooser");

        showLayerButtonPopout(element, chooserUI, function(content) {
            content.find("#link-central, #link-tacoma")
                .change(function(e) {
                    systemMapRouteCriteria.LINK = "";
                    
                    jQuery("#link-central, #link-tacoma").each(function(_, checkbox) {
                        checkbox = jQuery(checkbox);
                        if(checkbox.attr("checked") === true) {
                            if(systemMapRouteCriteria.LINK.length > 0) {
                                systemMapRouteCriteria.LINK += " OR ";
                            }
                            systemMapRouteCriteria.LINK += "(designator LIKE '" + checkbox.val() + "' AND routetyp LIKE 'P')";
                        }
                    });

                    refreshRouteLayer();                    
                });
        });
    }

    function showSounderRouteLayerSelector(element) {
        var chooserUI = controlsRoot.find("#sounder-layer-chooser");

        showLayerButtonPopout(element, chooserUI, function(content) {
            content.find("#sounder-tacoma-seattle, #sounder-everett-seattle")
                .change(function(e) {
                    systemMapRouteCriteria.SOUNDER = "";

                    jQuery("#sounder-tacoma-seattle, #sounder-everett-seattle").each(function(_, checkbox) {
                        // there are two things required to specify a route--we delimit them with a "/" in the input value.
                        var values = checkbox.val().split("/");                        

                        checkbox = jQuery(checkbox);
                        if(checkbox.attr("checked") === true) {
                            if(systemMapRouteCriteria.SOUNDER.length > 0) {
                                systemMapRouteCriteria.SOUNDER += " OR ";
                            }
                            systemMapRouteCriteria.SOUNDER += "(designator LIKE '" + values[0] + "' AND stops=" + values[1] + " AND routetyp LIKE 'P')";
                        }
                    });
                    
                    refreshRouteLayer();
                });
        });
    }

    function showBusRouteLayerSelector(element) {
        var chooserUI = controlsRoot.find("#bus-layer-chooser");

        showLayerButtonPopout(element, chooserUI, function(content) {
            // behavior to populate route dropdown when agency changes
            content.find("#bus-agency")
                .change(function(e) {      
                    var agency = jQuery(this).val();
                    
                    if(agency === "") {
                        return;
                    } 

                    var callbackFunction = "getRouteListCallback" + Math.floor(Math.random() * 1000000000);
                    jQuery.ajax({
                            url: "http://sea.dev.openplans.org:8080/geoserver/wfs",
                            dataType: "jsonp",
                            jsonpCallback: callbackFunction,
                            data: {
                                request: "GetFeature",
                                outputFormat: "json",
                                format_options: "callback:" + callbackFunction,
                                propertyName: "designator",
                                typeName: "soundtransit:routes",
                                cql_filter: "(operator LIKE '" + agency + "' AND routetyp LIKE 'P')",
                                sortBy: "designator"
                            },
                            success: function(data) {   
                                var selectBox = content.find("#bus-route");
                                selectBox.children().remove();
                                selectBox.append("<option value=''>Select route</option>");
                                for(var i = 0; i < data.features.length; i++) {
                                    var feature = data.features[i];
                                    var option = jQuery("<option></option")
                                                    .text(feature.properties.designator)
                                                    .val(feature.properties.designator);
                                    selectBox.append(option);
                                } 
                            }
                    });
                });
                
                content.find("#bus-route")
                    .change(function(e) {
                        var v = jQuery(this).val();
                        
                        if(v !== null && v !== "" && v !== "Select route") {
                            systemMapRouteCriteria.BUS = "(operator LIKE '" + content.find("#bus-agency").val() + "' AND designator LIKE '" + v + "' AND routetyp LIKE 'P')";
                        } else {
                            systemMapRouteCriteria.BUS = "";
                        }

                        refreshRouteLayer();
                    });                
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
                
                hideInfoWindow();
                
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

                hideInfoWindow();

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

                hideInfoWindow();

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
            new OpenLayers.Control.Navigation({'zoomWheelEnabled': false}),
            new OpenLayers.Control.KeyboardDefaults(),
            new OpenLayers.Control.PanZoomBar({zoomWorldIcon:false}),
            new OpenLayers.Control.Attribution()
        ]
    });

    // this points OL to our custom icon set
    OpenLayers.ImgPath = "js/openlayers/img/";

    // setup map 
    addBaseLayers();    
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
            if(routeLayer !== null) {
                routeLayer.removeAllFeatures();
            }

            if(markersLayer !== null) {
                markersLayer.removeAllFeatures();
            }
        },

        zoomToPlannedRoute: function() {
            zoomToRouteLayerExtent();
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
            if(encodedPolyline === null || type === null) {
                return;
            }
    
            var rawPoints = decodePolyline(encodedPolyline);
            var points = [];
            for(var i = 0; i < rawPoints.length; i++) {
                var wgsPoint = new OpenLayers.Geometry.Point(rawPoints[i][1], rawPoints[i][0]);
                var proj = new OpenLayers.Projection("EPSG:4326");
                var point = wgsPoint.transform(proj, map.getProjectionObject());
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
            routeLayer.addFeatures([lineFeature]);
        }
    };
};
