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
    var infoWindow = null;
    var contextMenu = null;
    var layerChooserPopout = null;
    var tooManyPopup = null;
    
    // vector layers
    var routeLayer = null;   
    var markersLayer = null;
    var dataMarkersLayers = {};

    // marker controls
    var markersDragControl = null;
    var markersSelectControl = null;
    var disambiguationSelectControl = null;

    // route-specific features/WFS CQL for system map on routeLayer
    var systemMapRouteCriteria = {};
    var systemMapRouteFeatures = {};

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

    function reset() {
        if(routeLayer !== null) {
            routeLayer.removeAllFeatures();
        }

        if(markersLayer !== null) {
            markersLayer.removeAllFeatures();
        }
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
                                    setStartMarker(lonlat);

                                    // if we have known to and from locations, submit the form
                                    var fromFeature = markersLayer.getFeaturesByAttribute('type', "start");
                                    var toFeature = markersLayer.getFeaturesByAttribute('type', "end");
                                    var submitAfterDone = (toFeature !== null && typeof toFeature[0] !== 'undefined' 
                                                            && fromFeature !== null && typeof fromFeature[0] !== 'undefined') ? true : false;

                                    if(typeof options.updateFromLocationFunction === 'function') {
                                        var proj = new OpenLayers.Projection("EPSG:4326");
                                        options.updateFromLocationFunction(lonlat.transform(map.getProjectionObject(), proj), submitAfterDone);
                                    }

                                    hideContextMenu();
                                    
                                    return false;
                                });
            contextMenu.append(startTripHere);

            var endTripHere = jQuery('<li></li>')
                                .addClass("separator")
                                .append('<a href="#">End Trip Here</a>')
                                .click(function(e) {                                    
                                    setEndMarker(lonlat);

                                    // if we have known to and from locations, submit the form
                                    var fromFeature = markersLayer.getFeaturesByAttribute('type', "start");
                                    var toFeature = markersLayer.getFeaturesByAttribute('type', "end");
                                    var submitAfterDone = (toFeature !== null && typeof toFeature[0] !== 'undefined' 
                                                            && fromFeature !== null && typeof fromFeature[0] !== 'undefined') ? true : false;

                                    if(typeof options.updateToLocationFunction === 'function') {
                                        var proj = new OpenLayers.Projection("EPSG:4326");
                                        options.updateToLocationFunction(lonlat.transform(map.getProjectionObject(), proj), submitAfterDone);
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

    function showInfoWindow(feature) {
        hideInfoWindow();

        // create info window popup wrapper and append to DOM
        var infoWindowContent = jQuery(getInfoWindowContentForFeature(feature.attributes))
                                    .addClass("content");

        infoWindow = jQuery("<div></div>")
                            .addClass("info-window")
                            .append(infoWindowContent)
                            .appendTo(jQuery(map.layerContainerDiv));

        // set position of infowindow
        var lonlat = new OpenLayers.LonLat(feature.geometry.x, feature.geometry.y);
        var viewPortPx = map.getViewPortPxFromLonLat(lonlat);
        var layerContainerPx = map.getLayerPxFromViewPortPx(viewPortPx);

        infoWindowContent
            .css("width", infoWindowContent.width());

        infoWindow
            .css("top", layerContainerPx.y - infoWindow.height())
            .css("left", layerContainerPx.x - (infoWindow.width() / 2));
            
        ensureInfoWindowIsVisible();
    }

    function getInfoWindowContentForFeature(featureProperties) {
        var popupContent = "";
        var type = "";
        var headerContent = featureProperties.name;
        var crossbar = "";
        var toggle = "";
        var amenities = "";
        var ticketText = "";
        var lonlat = new OpenLayers.LonLat(featureProperties.lon, featureProperties.lat);
        var startEndTrip = jQuery('<div class="start-end-area"></div>');
        
        
        if(typeof featureProperties.outlettype !== 'undefined') {
            type = "fareoutlet";
            var niceOutletType = (featureProperties.outlettype == 'TVM') ? "Ticket Vending Machine" : ((featureProperties.outlettype == 'Retailer') ? "Retailer" : "ORCA Customer service center");
            crossbar = '<div class="crossbar"><strong>' + niceOutletType + '</strong> - ' + featureProperties.location + '</div>';
            amenities += "<strong>What can I do here</strong>";
            amenities += (featureProperties.outlettype == 'TVM') ? '<div class="fare-actions"><ul><li>Buy new ORCA Card (Note: Adult cards only)</li><li>Reload ORCA Card</li><li>Buy new monthly pass on ORCA Card</li><li>Central link tickets</li><li>Sounder tickets</li></ul></div>' : ((featureProperties.outlettype == 'Retailer') ? '<div class="fare-actions"><ul><li>Reload ORCA Card</li><li>Buy new monthly pass on ORCA Card</li></ul>Note: No new ORCA cards sold here</div>' : '<div class="fare-actions"><ul><li>Buy new ORCA Card, including Youth and Senior card</li><li>Reload ORCA Card</li><li>Buy new monthly pass on ORCA Card</li></ul></div>');
            
        } else if(typeof featureProperties.accessible !== 'undefined') {
            type = "stop";
            crossbar = '<div class="crossbar"><strong>Stop ID</strong>: ' + featureProperties.localid.replace(/^\D/i, "") + '</div>';
            if (featureProperties.park2min !== null && featureProperties.park2min !== "") {amenities += "<strong>Nearby Parking</strong>: " + featureProperties.park2min + "<br />";}
            // temporary workaround for our stop data having lat and lon transposed. Remove when we're able to fix that.
            lonlat = new OpenLayers.LonLat(featureProperties.lat, featureProperties.lon);
        } else {
            type = "parkandride";
            crossbar = '<div class="crossbar">' + featureProperties.location + '</div>';
            if (featureProperties.spaces !== 0 && featureProperties.spaces !== "") {amenities += "<strong>Parking spaces:</strong> " + featureProperties.spaces;}
            if (featureProperties.timefull !== 0 && featureProperties.timefull !== "") {amenities += " This parking lot is typically full by " + featureProperties.timefull + "AM<br />"} else {amenities += "<br />"}
            if (featureProperties.numbikeloc !== 0 && featureProperties.numbikeloc !== "") {amenities += "<strong>Bike Lockers:</strong> " + featureProperties.numbikeloc + "<br />";}
            if (featureProperties.electricca !== 0 && featureProperties.electricca !== "") {amenities += "<strong>Electric Car Chargers:</strong> " + featureProperties.electricca + "<br />";}
            if (featureProperties.notes !== null && featureProperties.notes !== "") {amenities += "<strong>Notes:</strong> " + featureProperties.notes;}
        }
    
        var content = jQuery("<div></div>")
                            .addClass("info-content")
                            .addClass(type);

        var headerWrapper = jQuery("<div></div>")
                            .addClass("info-header")
                            .html("<h2>" + headerContent + "</h2>")
                            .append(getInfoWindowClose());

        var popupContent = headerWrapper.after(content.append(crossbar).append(amenities).append(ticketText));

/*
        // Leaving in for debug, but we don't want to display all this info to users
        for(k in featureProperties) {
            var v = featureProperties[k];            
            content.append("<!-- " + k + ": " + v + " -->");
        }
*/
       
        if (options.hasTripPlanner === true) {
            jQuery('<a href="#">Start Trip Here</a>')
                .click(function(e) {
                    if(typeof options.updateFromLocationFunction === 'function') {
                        options.updateFromLocationFunction(lonlat, false);
                    }
                    return false;
            }).appendTo(startEndTrip);
        
            jQuery('<a href="#">End Trip Here</a>')
                .click(function(e) {
                    if(typeof options.updateToLocationFunction === 'function') {
                        options.updateToLocationFunction(lonlat, false);
                    }
                    return false;
            }).appendTo(startEndTrip);
        }
        
        content.append(startEndTrip);
        
        return popupContent;
    }
    
    function getInfoWindowClose() {
        return jQuery('<a href="#">Close</a>')
            .addClass("close")
            .click(function(e) {
                hideInfoWindow();
                return false; 
            });
    }

    // route layer stuff
    function zoomToRouteLayerExtent() {
        if(routeLayer !== null) {
            map.zoomToExtent(routeLayer.getDataExtent());
        }
    }

    function removeRouteLayerForMode(mode) {
        systemMapRouteCriteria[mode] = "";

        // remove features from map
        var features = systemMapRouteFeatures[mode];
        
        if(typeof features !== 'undefined' && features !== null) {            
            routeLayer.removeFeatures(features);
            systemMapRouteFeatures[mode] = null;
        }
    }

    function drawRouteLayerForMode(mode, element) {
        // remove old existing features (FIXME?)
        var features = systemMapRouteFeatures[mode];

        if(features !== null) {            
            routeLayer.removeFeatures(features);
            systemMapRouteFeatures[mode] = null;
        }

        var cqlQuery = systemMapRouteCriteria[mode];

        if(cqlQuery === null || cqlQuery === "") {
            return;
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

        var callbackFunction = "drawRouteLayerForModeCallback" + Math.floor(Math.random() * 1000000000);
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
        
                 // if we're going to draw the polyline for this route, add 
                 // active class to its selector indicator
                 if(element !== null) {
                     jQuery(element).addClass("active");
                 }

                 if(typeof systemMapRouteFeatures[mode] === 'undefined' || systemMapRouteFeatures[mode] === null) {
                     systemMapRouteFeatures[mode] = [];
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
                         systemMapRouteFeatures[mode].push(lineFeature);
                     }
                     
                     zoomToRouteLayerExtent();
                 });
             }
        });        
    }
    
    // data layer stuff (fare outlets, etc.)
    // FIXME: for stops only now
    function showTooMany(type) {
        if(type === null) {
            return;
        }
        
        hideTooMany();
        
        var typeString = "unknown";
        switch(type) {
            case "stops":
                typeString = "stops and stations";
                break;
            case "parkandrides":
                typeString = "park and rides";
                break;
            case "fareoutlets":
                typeString = "fare outlets";
                break;
        }

        tooManyPopup = jQuery("<div></div>")
                            .addClass("too_many")
                            .append("<p>There are too many " + typeString + " to display. " + 
                                    "Please <a href='#'>zoom in</a> to see all " + typeString + ".</p>")
                            .appendTo(map.viewPortDiv);
                            
        tooManyPopup.find("a").click(function(e) {
            map.zoomTo(14);

            var stopsToggleButton = controlsRoot.find("#toggle-location");
            addDataLayer("stops", stopsToggleButton, true);
            
            return false;
        });
    }

    function hideTooMany() {
        if(tooManyPopup !== null) {
            tooManyPopup.remove();
        }
    }

    function addDataLayer(type, element, constrainToBBOX) {
        var layer = dataMarkersLayers[type];

        if(layer === null) {
            return;
        }

        if(type === "stops") {
            if(map.getZoom() < 12) {
                showTooMany(type);
                layer.removeAllFeatures();
                return;
            } else {
                hideTooMany();
            }
        }

        var callbackFunction = "addDataLayerCallback" + Math.floor(Math.random() * 1000000000);
        var data = {
            request: "GetFeature",
            outputFormat: "json",
            format_options: "callback:" + callbackFunction,
            typeName: "soundtransit:" + type
        };
        
        if(constrainToBBOX === true) {            
            // clear existing features from last BBOX constrained query
            layer.removeAllFeatures();

            data.BBOX = map.getExtent().toBBOX() + "," + layer.projection;
        }
    
        jQuery.ajax({
             url: "http://sea.dev.openplans.org:8080/geoserver/wfs",
             dataType: "jsonp",
             jsonpCallback: callbackFunction,
             data: data,
             success: function(data) {                 
                if(typeof data.features === 'undefined') {
                    return;
                }

                if(type === "stops") {
                    if(data.features.length > 512) {
                        showTooMany(type);
                        data = null;
                        return;
                    } else {
                        hideTooMany();
                    }
                }
                
                // if we're going to draw the polyline for this route, add 
                // active class to its selector indicator
                if(element !== null) {
                    jQuery(element).addClass("active");
                }

                var features = [];
                jQuery(data.features).each(function(_, feature) {
                    var point = new OpenLayers.Geometry.Point(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
                    var proj = new OpenLayers.Projection("EPSG:4326");
                    var icon = new OpenLayers.Feature.Vector(point.transform(proj, map.getProjectionObject()), feature.properties);
                    features.push(icon);
                });
                layer.addFeatures(features);
           }
        });     
    }
    
    function removeDataLayer(type) {
        var layer = dataMarkersLayers[type];
        
        if(layer !== null) {
            layer.removeAllFeatures();
        }

        if(type === "stops") {
            hideTooMany();
        }
    }

    function setupDataLayers() {
        // (TP markers are in a separate layer because they are draggable, the route is not)
        routeLayer = new OpenLayers.Layer.Vector("Routes");
        markersLayer = new OpenLayers.Layer.Vector("Trip Planner Markers");

        // data layer markers
        dataMarkersLayers.stops = new OpenLayers.Layer.Vector("Stop Markers");
        dataMarkersLayers.parkandrides = new OpenLayers.Layer.Vector("Park and Ride Markers");
        dataMarkersLayers.fareoutlets = new OpenLayers.Layer.Vector("Fare Outlets Markers");

        // hide info windows when zoom changes on data layers
        jQuery.each(dataMarkersLayers, function(_, layer) {
            layer.events.on({
                moveend: function(e) {
                   if(e.zoomChanged) {
                      hideInfoWindow();
                   }
                }
            });
        });

        // layer style configuration
        var context = {
            getPointRadius : function() {
                var ratio = map.getZoom() / 18;
                return Math.floor(ratio * 12.5);
            },
            getOffset : function() {
                var ratio = map.getZoom() / 18;
                return Math.ceil(0 - (ratio * 12.5));
            }            
        };

        var templateStops = {
            graphicXOffset: "${getOffset}",
            graphicYOffset: "${getPointRadius}",
            pointRadius: "${getPointRadius}",
            externalGraphic: "img/otp/location-icon.png"
        };
        dataMarkersLayers.stops.styleMap = new OpenLayers.StyleMap({
            default: new OpenLayers.Style(templateStops, {context:context}),
            select: new OpenLayers.Style(templateStops, {context:context})
        });
        dataMarkersLayers.stops.events.on({
            moveend: function(e) {        
                var stopsToggleButton = controlsRoot.find("#toggle-location");
                if(stopsToggleButton.hasClass("active")) {
                    addDataLayer("stops", stopsToggleButton, true);
                }
            }
        });
        
        var templateParking = {
            graphicXOffset: "${getOffset}",
            graphicYOffset: "${getPointRadius}",
            pointRadius: "${getPointRadius}",
            externalGraphic: "img/otp/parking-icon.png"
        };
        dataMarkersLayers.parkandrides.styleMap = new OpenLayers.StyleMap({
            default: new OpenLayers.Style(templateParking, {context:context}),
            select: new OpenLayers.Style(templateParking, {context:context})
        });

        var templateFares = {
            graphicXOffset: "${getOffset}",
            graphicYOffset: "${getPointRadius}",
            pointRadius: "${getPointRadius}",
            externalGraphic: "img/otp/fares-icon.png"
        };
        dataMarkersLayers.fareoutlets.styleMap = new OpenLayers.StyleMap({
            default: new OpenLayers.Style(templateFares, {context:context}),
            select: new OpenLayers.Style(templateFares, {context:context})
        });     

        map.addLayers([routeLayer, dataMarkersLayers.stops, dataMarkersLayers.parkandrides, 
                        dataMarkersLayers.fareoutlets, markersLayer]);

        // enable selection of features in data layers
        markersSelectControl = new OpenLayers.Control.SelectFeature([dataMarkersLayers.stops, dataMarkersLayers.parkandrides, 
                                                                    dataMarkersLayers.fareoutlets], { onSelect: showInfoWindow });
        map.addControl(markersSelectControl);
        markersSelectControl.activate();

        // listener for drag events on trip planner markers
        markersDragControl = new OpenLayers.Control.DragFeature(markersLayer, { onComplete: onCompleteMarkerMove });
        map.addControl(markersDragControl);
        markersDragControl.activate();
    }

    // base layer stuff
    function setBaseLayer(name) {
        var layerArray = map.layers;
        for (var i=0;i<layerArray.length;i++) {
            if (map.layers[i].name === name && map.layers[i].isBaseLayer === true) {
                map.setBaseLayer(map.layers[i]);
            }
        }  
    }

    function addBaseLayers() {
        var apiKey = "AgszXQ8Q5lbiJFYujII-Lcie9XQ-1DK3a2X7xWJmfSeipw8BAAF0ETX8AJ4K-PDm";

        var road = new OpenLayers.Layer.Bing({
            key: apiKey,
            type: "Road",
            name: "Road",
            version: "v1"
        });

        var hybrid = new OpenLayers.Layer.Bing({
            key: apiKey,
            type: "AerialWithLabels",
            name: "Hybrid",
            version: "v1"
        });

        map.addLayers([road, hybrid]);
    }

    // layer selection UI + tooltips
    function hideLayerButtonPopout() {
        if(layerChooserPopout !== null) {
            layerChooserPopout.hide();
        }
    }

    function showLayerButtonPopout(openingElement, content, initFn, displayFn) {
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

        // call display function if specificed
        if(typeof displayFn === 'function') {
            displayFn(layerChooserPopout.find(".content"));
        }
                 
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
            // called first time popup is created
            
            content.find("#ferry")
                .change(function(e) {
                    var v = jQuery(this).val();
                    
                    if(v !== null && v !== "" && v !== "Select route") {
                        systemMapRouteCriteria.WSF = "(designator LIKE '" + v + "' AND routetyp LIKE 'P')";
                    } else {
                        systemMapRouteCriteria.WSF = "";
                    }

                    drawRouteLayerForMode("WSF", element);
                });
        }, function(content) {
            // reset UI called each time popup is displayed            
            if(typeof systemMapRouteCriteria.WSF === 'undefined' ||
                systemMapRouteCriteria.WSF === "" || systemMapRouteCriteria.WSF === null) {
                content.find("#ferry").val("");
            }
        });
    }

    function showLinkRouteLayerSelector(element) {
        var chooserUI = controlsRoot.find("#link-layer-chooser");

        showLayerButtonPopout(element, chooserUI, function(content) {
            // called first time popup is created
            
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

                    drawRouteLayerForMode("LINK", element);                    
                });
        }, function(content) {
            // reset UI called each time popup is displayed            
            if(typeof systemMapRouteCriteria.LINK === 'undefined' ||
                systemMapRouteCriteria.LINK === "" || systemMapRouteCriteria.LINK === null) {
                content.find("#link-central, #link-tacoma").attr("checked", null);
            }
        });
    }

    function showSounderRouteLayerSelector(element) {
        var chooserUI = controlsRoot.find("#sounder-layer-chooser");

        showLayerButtonPopout(element, chooserUI, function(content) {
            // called first time popup is created
            
            content.find("#sounder-tacoma-seattle, #sounder-everett-seattle")
                .change(function(e) {
                    systemMapRouteCriteria.SOUNDER = "";

                    jQuery("#sounder-tacoma-seattle, #sounder-everett-seattle").each(function(_, checkbox) {
                        checkbox = jQuery(checkbox);

                        // there are two things required to specify a route--we delimit them with a "/" in the input value. HACK
                        var values = checkbox.val().split("/");                        

                        if(checkbox.attr("checked") === true) {
                            if(systemMapRouteCriteria.SOUNDER.length > 0) {
                                systemMapRouteCriteria.SOUNDER += " OR ";
                            }
                            systemMapRouteCriteria.SOUNDER += "(designator LIKE '" + values[0] + "' AND stops=" + values[1] + " AND routetyp LIKE 'P')";
                        }
                    });
                    
                    drawRouteLayerForMode("SOUNDER", element);
                });
        }, function(content) {
            // reset UI called each time popup is displayed
            if(typeof systemMapRouteCriteria.SOUNDER === 'undefined' ||
                systemMapRouteCriteria.SOUNDER === "" || systemMapRouteCriteria.SOUNDER === null) {
                content.find("#sounder-tacoma-seattle, #sounder-everett-seattle").attr("checked", null);
            }
        });
    }

    function showBusRouteLayerSelector(element) {
        var chooserUI = controlsRoot.find("#bus-layer-chooser");

        showLayerButtonPopout(element, chooserUI, function(content) {
            // called first time popup is created
            
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
                                cql_filter: "(operator LIKE '" + agency + "' AND routetyp LIKE 'P')"
                            },
                            success: function(data) {   
                                var selectBox = content.find("#bus-route");
                                selectBox.children().remove();
                                selectBox.append("<option value=''>Select route</option>");

                                // push routes into an array and sort to remove dupes (can't do this in geoserver, unfortunately)
                                var routes = [];
                                for(var i = 0; i < data.features.length; i++) {
                                    var feature = data.features[i];
                                    routes.push(feature.properties.designator);
                                }
                                routes.sort();

                                var lastValue = null;
                                for(var i = 0; i < routes.length; i++) {
                                    // remove duplicates
                                    if(lastValue !== null) {
                                        if(lastValue === routes[i]) {
                                            continue;
                                        }
                                    }
                                    lastValue = routes[i];
                                    var option = jQuery("<option></option")
                                                .text(routes[i])
                                                .val(routes[i]);
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

                        drawRouteLayerForMode("BUS", element);
                    });                
        }, function(content) {       
            // reset UI called each time popup is displayed
            if(typeof systemMapRouteCriteria.BUS === 'undefined' ||
                systemMapRouteCriteria.BUS === "" || systemMapRouteCriteria.BUS === null) {
                content.find("#bus-agency, #bus-route").val("");
            }
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
                var element = jQuery(this);
                var layerName = 'Fare Outlets';
                if(element.hasClass("active")) {
                    removeDataLayer("fareoutlets");
                    jQuery(this).removeClass("active");                    
                } else {
                    addDataLayer("fareoutlets", this, false);
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
                var element = jQuery(this);
                var layerName = 'Park and Rides';
                if(element.hasClass("active")) {
                    removeDataLayer("parkandrides");
                    jQuery(this).removeClass("active");                    
                } else {
                    addDataLayer("parkandrides", this, false);
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
                var element = jQuery(this);
                var layerName = 'Stops';
                if(element.hasClass("active")) {
                    removeDataLayer("stops");
                    jQuery(this).removeClass("active");                    
                } else {
                    addDataLayer("stops", this, true);
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
                var element = jQuery(this);
                if(element.hasClass("active")) {
                    element.removeClass("active");
                    removeRouteLayerForMode("WSF");
                    hideLayerButtonPopout();
                } else {
                    showFerryRouteLayerSelector(this);
                }
                return false;
            });   
            
        controlsRoot.find("#toggle-link")
            .click(function() {
                var element = jQuery(this);
                if(element.hasClass("active")) {
                    element.removeClass("active");
                    removeRouteLayerForMode("LINK");
                    hideLayerButtonPopout();
                } else {
                    showLinkRouteLayerSelector(this);
                }
                return false;
            });     
                    
        controlsRoot.find("#toggle-sounder")
            .click(function() {
                var element = jQuery(this);
                if(element.hasClass("active")) {
                    element.removeClass("active");
                    removeRouteLayerForMode("SOUNDER");
                    hideLayerButtonPopout();
                } else {
                    showSounderRouteLayerSelector(this);
                }
                return false;
            });  
                           
        controlsRoot.find("#toggle-bus")
            .click(function() {
                var element = jQuery(this);
                if(element.hasClass("active")) {
                    element.removeClass("active");
                    removeRouteLayerForMode("BUS");
                    hideLayerButtonPopout();                    
                } else {
                    showBusRouteLayerSelector(this);
                }
                return false;
            });             
    }

    // markers
    function setStartMarker(lonlat) {
        if(lonlat === null) {
            return;
        }
        
        var startMarker = markersLayer.getFeaturesByAttribute('type', "start");

        if(startMarker !== null && typeof startMarker[0] !== 'undefined') {
            startMarker[0].move(lonlat);
        } else { 
            var point = new OpenLayers.Geometry.Point(lonlat.lon, lonlat.lat);
            var icon = new OpenLayers.Feature.Vector(point, { type: "start" });

            icon.style = {
                externalGraphic: "img/otp/a-flag.png",
                graphicWidth: 23,
                graphicHeight: 30,
                graphicXOffset: 0,
                graphicYOffset: -30,
                graphicTitle: "Drag To Change Route",
                cursor: "move"
            };

            markersLayer.addFeatures([icon]);
        }        
    }
    
    function setEndMarker(lonlat) {
        if(lonlat === null) {
            return;
        }
        
        var endMarker = markersLayer.getFeaturesByAttribute('type', "end");

        if(endMarker !== null && typeof endMarker[0] !== 'undefined') {
            endMarker[0].move(lonlat);
        } else { 
            var point = new OpenLayers.Geometry.Point(lonlat.lon, lonlat.lat);
            var icon = new OpenLayers.Feature.Vector(point, { type: "end" });

            icon.style = {
                externalGraphic: "img/otp/b-flag.png",
                graphicWidth: 23,
                graphicHeight: 30,
                graphicXOffset: 0,
                graphicYOffset: -30,
                graphicTitle: "Drag To Change Route",
                cursor: "move"
            };

            markersLayer.addFeatures([icon]);
        }        
    }
    
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
    setupDataLayers();
    
    addContextMenuBehavior();
    addMapLayerChooserBehavior();

    // center on seattle metro area
    var point = new OpenLayers.LonLat(-122.30, 47.45);
    var proj = new OpenLayers.Projection("EPSG:4326");
    map.setCenter(point.transform(proj, map.getProjectionObject()), 8);

    // public methods    
    return {
        showFerryRouteFor: function(v) {
            if(v === null || v === "") {
                return;
            }

            systemMapRouteCriteria.WSF = "(designator LIKE '" + v + "' AND routetyp LIKE 'P')";
            drawRouteLayerForMode("WSF", '#toggle-ferry');               
        },

        showLinkRouteFor: function(v) {
            if(v === null || v === "") {
                return;
            }

            systemMapRouteCriteria.LINK = "(designator LIKE '" + v + "' AND routetyp LIKE 'P')";
            drawRouteLayerForMode("LINK", '#toggle-link');           
        },

        showSounderRouteFor: function(v,s) {
            if(v === null || v === "" || s === null || s === "") {
                return;
            }

            systemMapRouteCriteria.SOUNDER = "(designator LIKE '" + v + "' AND stops=" + s + " AND routetyp LIKE 'P')";
            drawRouteLayerForMode("SOUNDER", '#toggle-sounder');
        },

        showBusRouteFor: function(v,s) {
            if(v === null || v === "" || s === null || s === "") {
                return;
            }

            systemMapRouteCriteria.BUS = "(operator LIKE '" + v + "' AND designator LIKE '" + s + "' AND routetyp LIKE 'P')";
            drawRouteLayerForMode("BUS", '#toggle-bus');
        },
        
        reset: function() {
            reset();
        },

        zoomToPlannedRoute: function() {
            zoomToRouteLayerExtent();
        },

        beginDisambiguation: function() {
            if(markersDragControl !== null && markersSelectControl !== null) {
                markersDragControl.deactivate();
                markersSelectControl.deactivate();
            }
        },

        endDisambiguation: function() {
            if(markersDragControl !== null && markersSelectControl !== null) {
                markersDragControl.activate();
                markersSelectControl.activate();
            }
        },

        removeDisambiguationFor: function(location) {
            markersLayer.removeFeatures(markersLayer.getFeaturesByAttribute('location', location));
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
                var point = new OpenLayers.LonLat(endPoint[1], endPoint[0]);
                var proj = new OpenLayers.Projection("EPSG:4326");
                setStartMarker(point.transform(proj, map.getProjectionObject()));
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
            var point = new OpenLayers.LonLat(endPoint[1], endPoint[0]);
            var proj = new OpenLayers.Projection("EPSG:4326");
            setEndMarker(point.transform(proj, map.getProjectionObject()));
        },

        addDisambiguationPoint: function(lon, lat, counter, location) {
            if(lat === null || lon === null) {
                return;
            }

            if (counter === null) {
                counter = 1;
            }

            var point = new OpenLayers.Geometry.Point(lat, lon);
            var proj = new OpenLayers.Projection("EPSG:4326");
            var icon = new OpenLayers.Feature.Vector(point.transform(proj, map.getProjectionObject()), { type: "disambiguation", location: location});

            icon.style = {
                             externalGraphic: "img/otp/pin-" + counter + ".png",
                             graphicWidth: 32,
                             graphicHeight: 37,
                             graphicXOffset: -15,
                             graphicYOffset: -37,
                             graphicTitle: "Disambiguation Point",
                             cursor: "auto"
                         };           

            markersLayer.addFeatures([icon]);
            map.zoomToExtent(markersLayer.getDataExtent());

            return icon.id;
        },

        highlightDisambiguationPoint: function(id, counter) {
            if(id === null || counter === null) {
                return;
            }
            
            // FIXME: There must be a better way to do this, but I'm not finding a way to specify highlight or select styles on a per-feature basis.
            markersSelectControl.highlight(markersLayer.getFeatureById(id));
            markersLayer.getFeatureById(id).style = {
                             externalGraphic: "img/otp/pin-" + counter + ".png",
                             graphicWidth: 32,
                             graphicHeight: 37,
                             graphicXOffset: -15,
                             graphicYOffset: -37,
                             graphicTitle: "Disambiguation Point",
                             cursor: "auto"
                         };

        },
        
        unhighlightDisambiguationPoint: function(id, counter) {
            if(id === null || counter === null) {
                return;
            }

            markersSelectControl.unhighlight(markersLayer.getFeatureById(id));
            markersLayer.getFeatureById(id).style = {
                             externalGraphic: "img/otp/pin-" + counter + "-highlight.png",
                             graphicWidth: 32,
                             graphicHeight: 37,
                             graphicXOffset: -15,
                             graphicYOffset: -37,
                             graphicTitle: "Disambiguation Point",
                             cursor: "auto"
                         };
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
