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

    // vector layers
    var routeLayer = null;   
    var markersLayer = null;
    var markersLimitReachedPopup = null;

    // controls attached to markersLayer
    var markersDragControl = null;
    var markersSelectControl = null;
    
    // for clicking and hovering disambiguation candidates on the map
    var disambiguationSelectControl = null;

    // marker features on markersLayer
    var tripPlannerMarkerFeatures = null;
    var dataLayerMarkerFeatures = {};

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

        if(markersLayer !== null && tripPlannerMarkerFeatures !== null) {
            markersLayer.removeFeatures(tripPlannerMarkerFeatures);
            tripPlannerMarkerFeatures = null;
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
                                    var proj = new OpenLayers.Projection("EPSG:4326");

                                    if(typeof options.updateFromLocationFunction === 'function') {
                                        options.updateFromLocationFunction(lonlat.transform(map.getProjectionObject(), proj), false);
                                    }

                                    var fromFeature = markersLayer.getFeaturesByAttribute('type', "start");                                        
                                    if(fromFeature !== null && typeof fromFeature[0] !== 'undefined') {
                                        fromFeature[0].move(lonlat.transform(proj,map.getProjectionObject()));
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
                                    
                                    var toFeature = markersLayer.getFeaturesByAttribute('type', "end");                                        
                                    if(toFeature !== null && typeof toFeature[0] !== 'undefined') {
                                        toFeature[0].move(lonlat.transform(proj,map.getProjectionObject()));
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
            .css("top", layerContainerPx.y - infoWindow.height() - (feature.style.pointRadius * 2) - 2)
            .css("left", layerContainerPx.x - (infoWindow.width() / 2));
            
        ensureInfoWindowIsVisible();
    }

    function getInfoWindowContentForFeature(featureProperties) {
        var popupContent = "";
        var type = "";
        var headerContent = featureProperties.name;
        var crossbar = "";
        var amenities = "";
        var ticketText = "";
        var lonlat = new OpenLayers.LonLat(featureProperties.lon, featureProperties.lat);
        var startEndTrip = jQuery('<div class="start-end-area"></div>');
        
        
        if(typeof featureProperties.outlettype !== 'undefined') {
            type = "fareoutlet";
            var niceOutletType = (featureProperties.outlettype == 'TVM') ? "Ticket Vending Machine" : ((featureProperties.outlettype == 'ORCA') ? "ORCA Customer service center" : "Retailer");
            //var niceOutletType = (featureProperties.outlettype == 'TVM') ? "Ticket Vending Machine" : ((featureProperties.outlettype == 'Retailer') ? "ORCA Customer service center" : "Retailer");
            crossbar = '<div class="crossbar"><strong>' + niceOutletType + '</strong> - ' + featureProperties.location + '</div>';
            
        } else if(typeof featureProperties.accessible !== 'undefined') {
            type = "stop";
            crossbar = '<div class="crossbar"><strong>Stop ID</strong>: ' + featureProperties.localid.replace(/^\D/i, "") + '</div>';
            // temporary workaround for our stop data having lat and lon transposed. Remove when we're able to fix that.
            lonlat = new OpenLayers.LonLat(featureProperties.lat, featureProperties.lon);
        } else {
            type = "parkandride";
            crossbar = '<div class="crossbar">' + featureProperties.location + '</div>';
            if (featureProperties.spaces !== 0 && featureProperties.spaces !== "") {amenities += "Parking spaces: " + featureProperties.spaces;}
            if (featureProperties.timefull !== 0 && featureProperties.timefull !== "") {amenities += " This parking lot is typically full by " + featureProperties.timefull + "AM<br />"} else {amenities += "<br />"}
            if (featureProperties.numbikeloc !== 0 && featureProperties.numbikeloc !== "") {amenities += "Bike Lockers: " + featureProperties.numbikeloc + "<br />";}
            if (featureProperties.electricca !== 0 && featureProperties.electricca !== "") {amenities += "Electric Car Chargers: " + featureProperties.electricca + "<br />";}
            if (featureProperties.notes !== "") {amenities += "Notes: " + featureProperties.notes;}

        }
    
        var content = jQuery("<div></div>")
                            .addClass("info-content")
                            .addClass(type);

        var headerWrapper = jQuery("<div></div>")
                            .addClass("info-header")
                            .html("<h2>" + headerContent + "</h2>")
                            .append(getInfoWindowClose());

        var popupContent = headerWrapper.after(content.append(crossbar).append(amenities).append(ticketText));

        // Leaving in for debug, but we don't want to display all this info to users
        for(k in featureProperties) {
            var v = featureProperties[k];            
            content.append("<!-- " + k + ": " + v + " -->");
        }
        
        jQuery('<a href="#">Start Trip Here</a>')
            .click(function(e) {
                if(typeof options.updateFromLocationFunction === 'function') {
                    options.updateFromLocationFunction(lonlat, false);
                }
        }).appendTo(startEndTrip);
        
        jQuery('<a href="#">End Trip Here</a>')
            .click(function(e) {
                if(typeof options.updateToLocationFunction === 'function') {
                    options.updateToLocationFunction(lonlat, false);
                }
        }).appendTo(startEndTrip);
        
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
        
        // if we're going to draw the polyline for this route, add 
        // active class to its selector indicator
        if(element !== null) {
            jQuery(element).addClass("active");
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

                 jQuery(data.features).each(function(_, feature) {
                     if(typeof systemMapRouteFeatures[mode] === 'undefined' || systemMapRouteFeatures[mode] === null) {
                         systemMapRouteFeatures[mode] = [];
                     }
                     
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
    function featureCountForDataLayer(type) {
        // remove features from map
        var features = dataLayerMarkerFeatures[type];

        if(typeof features !== 'undefined' && features !== null) {            
            return features.length;
        } else {
            return null;
        }
    }

    function addDataLayer(type, array) {
        var callbackFunction = "addDataLayerCallback" + Math.floor(Math.random() * 1000000000);
        jQuery.ajax({
             url: "http://sea.dev.openplans.org:8080/geoserver/wfs",
             dataType: "jsonp",
             jsonpCallback: callbackFunction,
             data: {
                 request: "GetFeature",
                 outputFormat: "json",
                 format_options: "callback:" + callbackFunction,
                 typeName: "soundtransit:" + type
             },
             success: function(data) {
                if(typeof data.features === 'undefined') {
                    return;
                }

                jQuery(data.features).each(function(_, feature) {
                    if(typeof dataLayerMarkerFeatures[type] === 'undefined' || dataLayerMarkerFeatures[type] === null) {
                        dataLayerMarkerFeatures[type] = [];
                    }

                    var point = new OpenLayers.Geometry.Point(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
                    var proj = new OpenLayers.Projection("EPSG:4326");
                    var icon = new OpenLayers.Feature.Vector(point.transform(proj, map.getProjectionObject()), feature.properties);
                    var style = {
                          pointRadius: 12.5,
                          graphicXOffset: -12,
                          graphicYOffset: -12
                    };
                    
                    switch(type) {
                        case "stops":
                            style.externalGraphic = "img/otp/location-icon.png";
                            break;
                        case "parkandrides":
                            style.externalGraphic = "img/otp/parking-icon.png";
                            break;
                        case "fareoutlets":
                            style.externalGraphic = "img/otp/fares-icon.png";
                            break;
                    }
                    icon.style = style;

                    dataLayerMarkerFeatures[type].push(icon);
                });

                markersLayer.addFeatures(dataLayerMarkerFeatures[type]);
                map.zoomToExtent(markersLayer.getExtent());
             }
        });     
    }

    function removeDataLayer(type) {
        // remove features from map
        var features = dataLayerMarkerFeatures[type];

        if(typeof features !== 'undefined' && features !== null) {            
            markersLayer.removeFeatures(features);
            dataLayerMarkerFeatures[type] = null;
        }
    }

    function setupDataLayers() {
        // (markers are in a separate layer because they are draggable, the route is not)
        routeLayer = new OpenLayers.Layer.Vector("Routes");

        markersLayer = new OpenLayers.Layer.Vector("Markers");

        // hide info window for this layer when zoom changes
        markersLayer.events.on({
                        moveend: function(e) {
                             if(e.zoomChanged) {
                                hideInfoWindow();
                             }
                        }
                      });

        map.addLayers([routeLayer, markersLayer]);

        // enable selection of features
        markersSelectControl = new OpenLayers.Control.SelectFeature(markersLayer, { onSelect: showInfoWindow });
        map.addControl(markersSelectControl);
        markersSelectControl.activate();

        // listener for drag events on markers
        //markersDragControl = new OpenLayers.Control.DragFeature(markersLayer, { onComplete: onCompleteMarkerMove });
        //map.addControl(markersDragControl);
        //markersDragControl.activate();
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
            name: "Road"
        });

        var hybrid = new OpenLayers.Layer.Bing({
            key: apiKey,
            type: "AerialWithLabels",
            name: "Hybrid"
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
            if(systemMapRouteCriteria.WSF === "" || systemMapRouteCriteria.WSF === null) {
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
            if(systemMapRouteCriteria.LINK === "" || systemMapRouteCriteria.LINK === null) {
                content.find("#link-central, #link-tacoma").attr("checked", false);
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
            if(systemMapRouteCriteria.SOUNDER === "" || systemMapRouteCriteria.SOUNDER === null) {
                content.find("#sounder-tacoma-seattle, #sounder-everett-seattle").attr("checked", false);
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
            if(systemMapRouteCriteria.BUS === "" || systemMapRouteCriteria.BUS === null) {
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
                var layerName = 'Fare Outlets';
                if(featureCountForDataLayer("fareoutlets") !== null) {
                    removeDataLayer("fareoutlets");
                    jQuery(this).removeClass("active");                    
                } else {
                    addDataLayer("fareoutlets");
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
                if(featureCountForDataLayer("parkandrides") !== null) {
                    removeDataLayer("parkandrides");
                    jQuery(this).removeClass("active");                    
                } else {
                    addDataLayer("parkandrides");
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
                if(featureCountForDataLayer("stops") !== null) {
                    removeDataLayer("stops");
                    jQuery(this).removeClass("active");                    
                } else {
                    addDataLayer("stops");
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
    setupDataLayers();
    
    addContextMenuBehavior();
    addMapLayerChooserBehavior();

    // center on seattle metro area
    var point = new OpenLayers.LonLat(-122.30, 47.45);
    var proj = new OpenLayers.Projection("EPSG:4326");
    map.setCenter(point.transform(proj, map.getProjectionObject()), 8);

    // public methods    
    return {
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
            if(markersDragControl !== null) {
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
                var point = new OpenLayers.Geometry.Point(endPoint[1], endPoint[0]);
                var proj = new OpenLayers.Projection("EPSG:4326");
                var icon = new OpenLayers.Feature.Vector(point.transform(proj, map.getProjectionObject()), { type: "start" });
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
                tripPlannerMarkerFeatures.push(icon);
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
                             externalGraphic: "img/otp/b-flag.png",
                             graphicWidth: 23,
                             graphicHeight: 30,
                             graphicXOffset: 0,
                             graphicYOffset: -30,
                             graphicTitle: "Drag To Change Route",
                             cursor: "move"
                         };

            markersLayer.addFeatures([icon]);
            tripPlannerMarkerFeatures.push(icon);
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
            tripPlannerMarkerFeatures.push(icon);
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
