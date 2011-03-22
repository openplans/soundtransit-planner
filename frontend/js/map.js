/* 
Copyright 2011, Sound Transit

This program is free software: you can redistribute it and/or
modify it under the terms of the GNU Lesser General Public License
as published by the Free Software Foundation, either version 3 of
the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
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
    var legInfoMarkers = [];
    
    // vector layers
    var routeLayer = null;
    var markersLayer = null;
    var dataMarkerLayers = {};

    // marker controls
    var markersDragControl = null;
    var markersSelectControl = null;

    // route-specific features/WFS CQL for system map items on routeLayer
    var systemMapRouteCriteria = {};
    var systemMapRouteFeatures = {};
    var systemMapRouteInfoMarkers = {};
    
    // Amended Version of OpenLayers.Control.PanZoomBar
    // since otherwise we can't style ZoomBar adequately
    // and OpenLayers doesn't have a standalone ZoomBar function
    OpenLayers.Control.PanZoomBar.prototype.draw = function(px) {
        // initialize our internal div
        OpenLayers.Control.prototype.draw.apply(this, arguments);

        px = this.position.clone();
        this.buttons = [];

        var sz = new OpenLayers.Size(26,22);
        var centered = new OpenLayers.Pixel(px.x + sz.w/2, px.y);

        px.y = centered.y + sz.h;
        this._addButton("zoomin", "zoom-plus-mini.png", centered.add(0, 50), sz);

        centered = this._addZoomBar(centered.add(0, 71));
        this._addButton("zoomout", "zoom-minus-mini.png", centered, sz);

        return this.div;
    }

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
        hideInfoWindow();

        // route lines
        if(routeLayer !== null) {
            routeLayer.removeAllFeatures();
        }

        // route-filtered stops
        var routeStopsLayer = dataMarkerLayers["stops_routes"];
        if(typeof routeStopsLayer !== 'undefined' && routeStopsLayer !== null) {
            routeStopsLayer.removeAllFeatures();
        }

        // to/from markers, etc.
        if(markersLayer !== null) {
            markersLayer.removeAllFeatures();
        }

        // route info markers
        if(legInfoMarkers !== null) {
            jQuery.each(legInfoMarkers, function(_, m) {
                if(m !== null) {
                    m.remove();
                }
            });
        }

        if(markersDragControl !== null) {
            markersDragControl.deactivate();
        }
    }

    // leg info markers
    function updateLegInfoMarkerPositions() {
        if(legInfoMarkers !== null) {
            jQuery.each(legInfoMarkers, function(i, infoMarker) {
                var lonlat = new OpenLayers.LonLat(infoMarker.data("lon"), infoMarker.data("lat"));
                var viewPortPx = map.getViewPortPxFromLonLat(lonlat);
                var layerContainerPx = map.getLayerPxFromViewPortPx(viewPortPx);

                if(layerContainerPx === null) {
                    return;
                }

                infoMarker
                    .css("top", layerContainerPx.y - infoMarker.height() - 11)
                    .css("left", layerContainerPx.x - (infoMarker.width() / 2));
            });
        }
    }

    function showLegInfoMarkerInfoWindow(lonlat, legInfoMarker, legInfoWindowHtml) {
        hideInfoWindow();

        var infoWindowContent = jQuery("<div></div>")
                                    .addClass("info-content")
                                    .addClass("leg-info-marker")
                                    .append(getInfoWindowClose())
                                    .append(legInfoWindowHtml);

        infoWindow = jQuery("<div></div>")
                            .addClass("info-window")
                            .append(infoWindowContent)
                            .appendTo(jQuery(map.layerContainerDiv));

        // set position of infowindow
        var viewPortPx = map.getViewPortPxFromLonLat(lonlat);
        var layerContainerPx = map.getLayerPxFromViewPortPx(viewPortPx);

        infoWindowContent
            .css("width", infoWindowContent.width());

        infoWindow
            .css("top", layerContainerPx.y - infoWindow.height() - legInfoMarker.height() - 20)
            .css("left", layerContainerPx.x - (infoWindow.width() / 2));

        ensureInfoWindowIsVisible();
    }

    function addLegInfoMarker(route, mode, legInfoWindowHtml, lonlat) {
        if(route === null || mode === null) {
            return null;
        }

        var infoMarker = jQuery("<div></div>")
                            .addClass("info_marker")
                            .appendTo(jQuery(map.layerContainerDiv))
                            .data("lon", lonlat.lon)
                            .data("lat", lonlat.lat);

        var contentWrapper = jQuery("<div></div>")
                            .addClass("content")
                            .appendTo(infoMarker);

        var modeIcon = jQuery("<p></p>")
                            .addClass("leg-mode")
                            .addClass(mode.toLowerCase())
                            .appendTo(contentWrapper);

        var contentLabel = jQuery("<p></p>")
                            .addClass("route-label")
                            .html(route)
                            .appendTo(contentWrapper);

        if(options.hasTripPlanner !== true && options.showScheduleLinkInRouteMarker !== false) {
            contentLabel
                .append('<a href="' + OTP.Agency.getScheduleURLForLeg(mode, route) + '" target="_new">Schedule</a>');
                
            contentWrapper.addClass("has-schedule-link");
        }
        
        var viewPortPx = map.getViewPortPxFromLonLat(lonlat);
        var layerContainerPx = map.getLayerPxFromViewPortPx(viewPortPx);

        infoMarker
            .css("width", contentWrapper.width() + 8);

        infoMarker
            .css("top", layerContainerPx.y - infoMarker.height() - 11)
            .css("left", layerContainerPx.x - (infoMarker.width() / 2));

        // info bubble on this info marker
        if(legInfoWindowHtml !== null && typeof legInfoWindowHtml !== 'undefined') {
            contentWrapper.click(function(e) {
                var legInfoMarker = jQuery(this).parent();
                showLegInfoMarkerInfoWindow(lonlat, legInfoMarker, legInfoWindowHtml);
                return false; 
            });
        }

        legInfoMarkers.push(infoMarker);

        return infoMarker;
    }

    // context menu (right-click menu)
    function hideContextMenu() {
        if(contextMenu !== null) {
            contextMenu.remove();
        }
    }

    function showContextMenu(point) {
        hideContextMenu();

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
        var infoWindowContent = jQuery(getInfoWindowContentForFeature(feature.attributes, feature.geometry.x, feature.geometry.y))
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
            .css("top", layerContainerPx.y - infoWindow.height() - (getMarkerRadiusAtCurrentZoomLevel() * 2))
            .css("left", layerContainerPx.x - (infoWindow.width() / 2));
            
        ensureInfoWindowIsVisible();
    }

    function getInfoWindowContentForFeature(featureProperties, lon, lat) {
        var typeClass = null;

        var headerContent = featureProperties.name;
        var content = null;

        if(typeof featureProperties.outlettype !== 'undefined') {
            typeClass = "fareoutlet";

            var prettyOutletType = (featureProperties.outlettype === 'TVM') ? "Ticket Vending Machine" : 
                                    ((featureProperties.outlettype === 'Retailer') ? "Retailer" 
                                    : "ORCA Customer Service Center");

            // crossbar: location
            content = '<div class="crossbar"><strong>' + prettyOutletType + '</strong> - ' + featureProperties.location + '</div>';

            // what can I do here?
            content += '<div class="fare-actions"><strong>What You Can Do Here</strong>:';
            content += (featureProperties.outlettype === 'TVM') ? '<ul><li>Buy new ORCA Card (adult cards only)</li><li>Reload ORCA Card</li><li>Buy new monthly pass on ORCA Card</li><li>Central link tickets</li><li>Sounder tickets</li></ul>' : 
                        ((featureProperties.outlettype === 'Retailer') ? '<ul><li>Reload ORCA Card</li><li>Buy new monthly pass on ORCA Card</li></ul>Note: No new ORCA cards sold here.' 
                        : '<ul><li>Buy new ORCA Card, including Youth and Senior cards</li><li>Reload ORCA Card</li><li>Buy new monthly pass on ORCA Card</li></ul>');
            content += '</div>';

            // how can I pay here?
            content += '<div class="payment-actions"><strong>Payment Methods Accepted</strong>:';
            content += (featureProperties.outlettype === 'TVM') ? '<ul><li>Cash</li><li>Visa, MasterCard</li></ul>' : 
                        ((featureProperties.outlettype === 'Retailer') ? '<ul><li>Cash</li></ul>' 
                        : '<ul><li>Cash</li><li>Visa, MasterCard</li><li>Checks</li></ul>');
            content += '</div>';

        } else if(typeof featureProperties.accessible !== 'undefined') {
            typeClass = "stop";

            // crossbar: accessibility 
            if (featureProperties.accessible !== "") {
                if(featureProperties.accessible === "Y") {
                    content = '<div class="crossbar"><strong>Accessible</strong>: Yes</div>';
                } else {
                    content = '<div class="crossbar"><strong>Accessible</strong>: No</div>';
                }
            } else {
                content = '<div class="crossbar"><strong>Accessible</strong>: Unknown</div>';
            }

            // nearby parking
            if (featureProperties.parking_near !== null && featureProperties.parking_near !== "") {
                content += "<strong>Nearby Parking</strong>: " + featureProperties.parking_near + "<br />";
            }

            // service at this stop
            content += '<div class="info-routes"></div>';

            var callbackFunction = "getRoutesServingStop" + Math.floor(Math.random() * 1000000000);
            jQuery.ajax({
                 url: OTP.Config.atisProxyScheduleUrl,
                 dataType: "jsonp",
                 jsonpCallback: callbackFunction,
                 data: {
                     atisstopid: featureProperties.atisid
                 },
                 success: function(data) {                 
                    if(typeof data.service === 'undefined') {
                        return;
                    }

                    var services = null;
                    if(data.service instanceof Array) {
                        services = data.service;
                    } else {
                        services = [data.service];
                    }

                    var routesByAgencyMap = {};
                    jQuery.each(services, function(_, service) {
                        var route = OTP.Agency.getDisplayNameForLeg(null, service.route);
                        var agency = OTP.Agency.getAgencyNameForLeg(service.operator, service.route);
                        if(typeof routesByAgencyMap[agency] === 'undefined') {
                            routesByAgencyMap[agency] = [];
                        }
                        routesByAgencyMap[agency].push(route);
                    });

                    var routeMarkup = "";
                    jQuery.each(routesByAgencyMap, function(agencyName, routeArray) {
                        if(routeArray.length <= 0) {
                            return;
                        }
                        
                        if(routeMarkup.length > 0) {
                            routeMarkup += "<br/>";
                        }
                        
                        routeMarkup += agencyName + " " + routeArray.unique().join(", ");
                    });

                    var routeDiv = root.find('.info-window .info-routes')
                                        .html('<strong>Routes That Serve This Stop</strong>:<br />' + routeMarkup);

                    // some browsers will append "px" to the css value so we need to force coversion to integer
                    infoWindow.css("top", (parseInt(infoWindow.css("top"), 10) - routeDiv.height()));

                    ensureInfoWindowIsVisible();
                }
            });
        } else {
            typeClass = "parkandride";

            // replace header with preferred name, if available
            if(featureProperties.altname !== null && featureProperties.altname !== "") {
                headerContent = featureProperties.altname;
            }

            // crossbar: location
            if(featureProperties.altlocation !== null && featureProperties.altlocation !== "") {
                content = '<div class="crossbar">' + featureProperties.altlocation + '</div>';
            } else {
                content = '<div class="crossbar">' + featureProperties.location + '</div>';
            }
            
            // station attributes
            if (featureProperties.spaces !== null && featureProperties.spaces !== 0 && featureProperties.spaces !== "") {
                content += "<strong>Parking Spaces</strong>: " + featureProperties.spaces + "<br/>";
            }

            if (featureProperties.timefull !== null && featureProperties.timefull !== 0 && featureProperties.timefull !== "") {
                content += "Note: This parking lot is typically full by " + featureProperties.timefull + " AM.<br/>";
            }

            if (featureProperties.numbikeloc !== null && featureProperties.numbikeloc !== 0 && featureProperties.numbikeloc !== "") {
                content += "<strong>Bike Lockers</strong>: " + featureProperties.numbikeloc + "<br />";
            }
            
            if (featureProperties.bikerack !== null && featureProperties.numbikeloc !== "") {
                content += "<strong>Bike Racks Available</strong>: Yes<br />";
            }
            
            if (featureProperties.tvm !== null && featureProperties.tvm !== "") {
                content += "<strong>TVM Available</strong>: Yes<br />";
            }
            
            if (featureProperties.restrooms !== null && featureProperties.restrooms !== "") {
                content += "<strong>Restrooms Available</strong>: Yes<br />";
            }
            
            if (featureProperties.hours !== null && featureProperties.hours !== "") {
                content += "<strong>Hours</strong>: " + featureProperties.hours + "<br />";
            }
            
            if (featureProperties.electricca !== null && featureProperties.electricca !== 0 && featureProperties.electricca !== "") {
                content += "<strong>Electric Car Chargers</strong>: " + featureProperties.electricca + "<br />";
            }
            
            if (featureProperties.notes !== null && featureProperties.notes !== "") {
                content += "<strong>Notes</strong>: <br/>" + featureProperties.notes;
            }
        }
    
        var contentWrapper = jQuery("<div></div>")
                            .addClass("info-content")
                            .addClass(typeClass);

        var headerWrapper = jQuery("<div></div>")
                            .addClass("info-header")
                            .html("<h2>" + headerContent + "</h2>")
                            .append(getInfoWindowClose());

        // start/end trip here if trip planner is present
        if (options.hasTripPlanner === true) {
            var startEndTrip = jQuery('<div class="start-end-area"></div>');
                    
            jQuery('<a href="#">Start Trip Here</a>')
                .click(function(e) {
                    if(typeof options.updateFromLocationFunction === 'function') {
                        var lonlat = new OpenLayers.LonLat(lon, lat);
                        setStartMarker(lonlat);
                        hideInfoWindow();

                        var proj = new OpenLayers.Projection("EPSG:4326");
                        var toFeature = markersLayer.getFeaturesByAttribute('type', "end");
                        var submitAfterDone = (toFeature !== null && typeof toFeature[0] !== 'undefined') ? true : false;
                        options.updateFromLocationFunction(lonlat.transform(map.getProjectionObject(), proj), submitAfterDone);
                    }
                    return false;
            }).appendTo(startEndTrip);
        
            jQuery('<a href="#">End Trip Here</a>')
                .click(function(e) {
                    if(typeof options.updateToLocationFunction === 'function') {
                        var lonlat = new OpenLayers.LonLat(lon, lat);
                        setEndMarker(lonlat);
                        hideInfoWindow();

                        var proj = new OpenLayers.Projection("EPSG:4326");
                        var fromFeature = markersLayer.getFeaturesByAttribute('type', "start");
                        var submitAfterDone = (fromFeature !== null && typeof fromFeature[0] !== 'undefined') ? true : false;
                        options.updateToLocationFunction(lonlat.transform(map.getProjectionObject(), proj), submitAfterDone);
                    }
                    return false;
            }).appendTo(startEndTrip);

            contentWrapper.append(startEndTrip);
        }
        
        contentWrapper
            .prepend(content);
        
        return jQuery('<div></div>')
                    .append(headerWrapper)
                    .append(contentWrapper);
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
        hideInfoWindow();
        
        systemMapRouteCriteria[mode] = "";
        removeRouteLayerFeaturesForMode(mode);
    }

    function removeRouteLayerFeaturesForMode(mode) {
        // route-filtered stops
        var stopFeatures = systemMapRouteFeatures["stops_routes" + mode];
        var routeStopsLayer = dataMarkerLayers["stops_routes"];
        if(typeof routeStopsLayer !== 'undefined' && routeStopsLayer !== null 
            && typeof stopFeatures !== 'undefined' && stopFeatures !== null) {

            routeStopsLayer.removeFeatures(stopFeatures);
            systemMapRouteFeatures["stops_routes" + mode] = null;
        }

        // route lines
        var routeLineFeatures = systemMapRouteFeatures[mode];
        if(typeof routeLineFeatures !== 'undefined' && routeLineFeatures !== null) {
            routeLayer.removeFeatures(routeLineFeatures);
            systemMapRouteFeatures[mode] = null;
        }

        // remove old existing feature info markers
        var infoMarkers = systemMapRouteInfoMarkers[mode];
        if(typeof infoMarkers !== 'undefined' && infoMarkers !== null) {
            jQuery.each(infoMarkers, function(_, m) {
                if(m !== null) {
                    m.remove();
                }
            });
            systemMapRouteInfoMarkers[mode] = null;
        }
    }

    function drawRouteLayerForMode(mode, element) {
        removeRouteLayerFeaturesForMode(mode);

        var cqlQuery = systemMapRouteCriteria[mode];
        if(cqlQuery === null || cqlQuery === "") {
            return;
        }

        showBusy();

        var routeIds = {};
        var callbackFunction = "drawRouteLayerForModeCallback" + Math.floor(Math.random() * 1000000000);
        jQuery.ajax({
             url: OTP.Config.wfsServiceUrl,
             dataType: "jsonp",
             jsonpCallback: callbackFunction,
             data: {
                 request: "GetFeature",
                 outputFormat: "json",
                 format_options: "callback:" + callbackFunction,
                 typeName: "soundtransit:routes",
                 propertyName: "the_geom,designator,operator,routeid",
                 cql_filter: cqlQuery
             },
             success: function(data) {
                 hideBusy();
                 
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

                 var flagsAdded = {};
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

                        var style = {
                            strokeColor: OTP.Agency.getColorForLeg(mode, feature.properties.designator),
                            strokeWidth: 5
                        };
                        var polyline = new OpenLayers.Geometry.LineString(points);
                        var lineFeature = new OpenLayers.Feature.Vector(polyline, null, style);
                        routeLayer.addFeatures([lineFeature]);
                        systemMapRouteFeatures[mode].push(lineFeature);
                        routeIds[feature.properties.routeid] = feature.properties.routeid;

                        // add marker to middle leg of line
                        var routeName = OTP.Agency.getDisplayNameForLeg(null, feature.properties.designator);
                        
                        // add info marker to middle leg
                        if((routeName in flagsAdded) === false) {
                            var lineLength = lineFeature.geometry.getLength();
                            var length_p = 0;
                            var infoMarkerPointGeom = null;
                            for(var p = 0; p < points.length; p++) {
                                var thisPoint = points[p];
                                var nextPoint = ((p + 1 < points.length) ? points[p + 1] : null);

                                if(nextPoint !== null) {
                                    var legLength = thisPoint.distanceTo(nextPoint);

                                    if(length_p + legLength > (lineLength / 2)) {
                                        var _points = [];
                                        _points.push(thisPoint);
                                        _points.push(nextPoint);
                                        var _thisLeg = new OpenLayers.Geometry.LineString(_points);
                                        infoMarkerPointGeom = _thisLeg.getCentroid();
                                        _thisLeg.destroy();
                                        break;   
                                    }

                                    length_p += legLength;
                                }
                            }

                            var infoMarkerLonLat = new OpenLayers.LonLat(infoMarkerPointGeom.x, infoMarkerPointGeom.y);
                            var infoMarker = addLegInfoMarker(OTP.Agency.getDisplayNameForLeg(mode, routeName), 
                                                              OTP.Agency.getModeLabelForLeg(mode, routeName), 
                                                              null, 
                                                              infoMarkerLonLat);

                            if(typeof systemMapRouteInfoMarkers[mode] === 'undefined' || systemMapRouteInfoMarkers[mode] === null) {
                                systemMapRouteInfoMarkers[mode] = [];
                            }
                            systemMapRouteInfoMarkers[mode].push(infoMarker);

                            flagsAdded[routeName] = true;
                        }
                    }
                 });

                 zoomToRouteLayerExtent();
             }, // success()
             complete: function(xhr, status) {
                 showBusy();

                 // get stop IDs from ATIS, then add the WFS layer of those stops
                 var routeQuery = "";
                 for(routeId in routeIds) {
                    if(routeQuery.length > 0) {
                        routeQuery += ",";
                    }
                    routeQuery += routeId;
                 }

                 var callbackFunction = "drawRouteLayerForModeGetStopsCallback" + Math.floor(Math.random() * 1000000000);
                 jQuery.ajax({
                      url: OTP.Config.atisProxyStopsUrl,
                      dataType: "jsonp",
                      jsonpCallback: callbackFunction,
                      data: {
                          routeid: routeQuery
                      },
                      success: function(data) {
                          hideBusy();
                          
                          var cqlSet = "";
                          jQuery.each(data.stops, function(_, stop) {
                              if(cqlSet.length > 0) {
                                  cqlSet += ",";
                              }
                              cqlSet += "'" + stop.atisstopid + "'"; 
                          });
                          addDataLayer("stops", "stops_routes", null, false, "atisid IN (" + cqlSet + ")", "stops_routes" + mode);
                      }
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

        var stopsRoutesLayer = dataMarkerLayers["stops_routes"]
        if(typeof stopsRoutesLayer !== 'undefined') {
            stopsRoutesLayer.setVisibility(true);
        }

        var closeButton = jQuery('<a class="close" href="#">Close</a>')
                                    .click(function(e) {
                                        jQuery(this).parent().remove();
                                        return false;
                                    });

        tooManyPopup = jQuery("<div></div>")
                            .addClass("too_many")
                            .append("<p>There are too many " + typeString + " to display. " + 
                                    "Please <a href='#' class='zoom'>zoom in</a> to see all " + typeString + ".</p>")
                            .appendTo(map.viewPortDiv)
                            .append(closeButton);
                            
        tooManyPopup.find("a.zoom").click(function(e) {
                   map.zoomTo(13);
                   
                   var stopsToggleButton = controlsRoot.find("#toggle-location");
                   addDataLayer("stops", null, stopsToggleButton, true, null);

                   return false;
               });
    }

    function hideTooMany() {
        if(tooManyPopup !== null) {
            tooManyPopup.remove();
        }
    }

    function addDataLayer(type, layerId, element, constrainToBBOX, cql, featureStoreKey) {
        if(layerId === null) {
            layerId = type;
        }

        var layer = dataMarkerLayers[layerId];
        if(typeof layer === 'undefined' || layer === null) {
            return;
        }

        // if we're going to draw the features for this layer, add 
        // active class to its selector indicator
        if(element !== null) {
            jQuery(element).addClass("active");
        }
                
        if(type === "stops" && cql === null) {
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

        if(cql !== null) {
            layer.removeFeatures(featuresToRemove);
            data.cql_filter = cql;
        }

        if(typeof featureStore !== 'undefined' && featureStore !== null) {
            layer.removeFeatures(featureStore);
        }

        if(constrainToBBOX === true) {           
            // clear features not visible anymore from map if we're getting lots of features on this layer
            if(layer.features.length > 300) {
                var featuresToRemove = [];             
                var viewportBounds = map.getExtent();
                jQuery.each(layer.features, function(_, feature) {
                    var featureLatLon = new OpenLayers.LonLat(feature.geometry.x, feature.geometry.y);
                    if(!viewportBounds.containsLonLat(featureLatLon)) {
                        featuresToRemove.push(feature);
                    }
                });
                layer.removeFeatures(featuresToRemove);
            }
            
            data.BBOX = map.getExtent().toBBOX() + "," + layer.projection;
        }

        showBusy();

        jQuery.ajax({
             url: OTP.Config.wfsServiceUrl,
             dataType: "jsonp",
             jsonpCallback: callbackFunction,
             data: data,
             success: function(data) {
                hideBusy();
                
                if(typeof data.features === 'undefined') {
                    return;
                }

                if(type === "stops") {
                    if(data.features.length > 512) {
                        showTooMany(type);
                        layer.removeAllFeatures();
                        data = null;
                        return;
                    } else {
                        hideTooMany();
                    }
                }

                var features = [];
                jQuery(data.features).each(function(_, feature) {
                    var point = new OpenLayers.Geometry.Point(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
                    var proj = new OpenLayers.Projection("EPSG:4326");
                    var icon = new OpenLayers.Feature.Vector(point.transform(proj, map.getProjectionObject()), feature.properties);
                    features.push(icon);
                });
                layer.addFeatures(features);

                // save the features we're adding by mode, so we can remove if the user removes only one
                // mode of routes (+ stops) FIXME
                if(layerId === "stops_routes") {
                    systemMapRouteFeatures[featureStoreKey] = features;
                }
           }
        });     
    }
    
    function removeDataLayer(type) {
        var layer = dataMarkerLayers[type];
        if(typeof layer !== 'undefined' && layer !== null) {
            layer.removeAllFeatures();
        }

        if(type === "stops") {            
            // if we're hiding the stops layer, try to show filtered stops instead of "all stops"
            var stopsRoutesLayer = dataMarkerLayers["stops_routes"]
            if(typeof stopsRoutesLayer !== 'undefined') {
                stopsRoutesLayer.setVisibility(true);
            }
            hideTooMany();
        }
    }

    function getMarkerRadiusAtCurrentZoomLevel() {
        var ratio = map.getZoom() / 18;
        return Math.floor(ratio * 12.5);
    }

    function getStopMarkerRadiusAtCurrentZoomLevel() {
        var ratio = map.getZoom() / 18;
        return Math.floor(ratio * 16.5);
    }

    function setupDataLayers() {
        // trip planner vector layers
        routeLayer = new OpenLayers.Layer.Vector("Routes");
        markersLayer = new OpenLayers.Layer.Vector("Trip Planner Markers", { rendererOptions: {zIndexing: true}});

        // stops layers styling contexts
        var stopContext = {
            getPointRadius: getStopMarkerRadiusAtCurrentZoomLevel,
            getOffset : function() {
                return 0 - getStopMarkerRadiusAtCurrentZoomLevel();
            }            
        };
        
        var templateStops = {
            graphicXOffset: "${getOffset}",
            graphicYOffset: "${getOffset}",
            pointRadius: "${getPointRadius}",
            externalGraphic: OTP.Config.tripPlannerImagePath + "location-icon.png"
        };

        // all stops layer
        dataMarkerLayers.stops = new OpenLayers.Layer.Vector("Stop Markers");
        dataMarkerLayers.stops.styleMap = new OpenLayers.StyleMap({
            'default': new OpenLayers.Style(templateStops, {context:stopContext}),
            'select': new OpenLayers.Style(templateStops, {context:stopContext})
        });
        dataMarkerLayers.stops.events.on({
            moveend: function(e) {        
                var stopsToggleButton = controlsRoot.find("#toggle-location");
                if(stopsToggleButton.hasClass("active")) {
                    addDataLayer("stops", null, stopsToggleButton, true, null);
                }
            }
        });

        // route stops layer
        dataMarkerLayers.stops_routes = new OpenLayers.Layer.Vector("Stop Markers Filtered To Route");
        dataMarkerLayers.stops_routes.styleMap = new OpenLayers.StyleMap({
            'default': new OpenLayers.Style(templateStops, {context:stopContext}),
            'select': new OpenLayers.Style(templateStops, {context:stopContext})
        });

        // other data layer styling:
        var context = {
            getPointRadius: getMarkerRadiusAtCurrentZoomLevel,
            getOffset : function() {
                return 0 - getMarkerRadiusAtCurrentZoomLevel();
            }            
        };
        
        var templateParking = {
            graphicXOffset: "${getOffset}",
            graphicYOffset: "${getOffset}",
            pointRadius: "${getPointRadius}",
            externalGraphic: OTP.Config.tripPlannerImagePath + "parking-icon.png"
        };
        dataMarkerLayers.parkandrides = new OpenLayers.Layer.Vector("Park and Ride Markers");
        dataMarkerLayers.parkandrides.styleMap = new OpenLayers.StyleMap({
            'default': new OpenLayers.Style(templateParking, {context:context}),
            'select': new OpenLayers.Style(templateParking, {context:context})
        });

        var templateFares = {
            graphicXOffset: "${getOffset}",
            graphicYOffset: "${getOffset}",
            pointRadius: "${getPointRadius}",
            externalGraphic: OTP.Config.tripPlannerImagePath + "fares-icon.png"
        };
        dataMarkerLayers.fareoutlets = new OpenLayers.Layer.Vector("Fare Outlets Markers");
        dataMarkerLayers.fareoutlets.styleMap = new OpenLayers.StyleMap({
            'default': new OpenLayers.Style(templateFares, {context:context}),
            'select': new OpenLayers.Style(templateFares, {context:context})
        });     

        // hide info windows when zoom changes on data layers
        jQuery.each(dataMarkerLayers, function(_, layer) {
            layer.events.on({
                moveend: function(e) {
                   if(e.zoomChanged) {
                      hideInfoWindow();
                   }
                }
            });
        });

        map.addLayers([dataMarkerLayers.stops, dataMarkerLayers.stops_routes, dataMarkerLayers.parkandrides, 
                        dataMarkerLayers.fareoutlets, markersLayer]);

        // events for infoLegMarkers placed on map
        map.events.on({
            zoomend: function(e) {
                // redraw info leg markers at new zoom level.
                updateLegInfoMarkerPositions();
            }
        });
                        
        // enable selection of features in data layers and disambiguation markers
        // HACK: a hack to get around the OL limitation of only allowing one marker select control per map.
        var selectFeatureEventDispatcher = function(feature) {
            if(feature === null) {
                return;
            }
            if(feature.attributes.type === "disambiguation") {
                onSelectDisambiguationOption(feature);
            } else {
                showInfoWindow(feature);
            }
        }
        markersSelectControl = new OpenLayers.Control.SelectFeature([markersLayer, dataMarkerLayers.stops, dataMarkerLayers.stops_routes, 
                                                                    dataMarkerLayers.parkandrides, dataMarkerLayers.fareoutlets], 
                                                                    { onSelect: selectFeatureEventDispatcher });
        map.addControl(markersSelectControl);
        markersSelectControl.activate();

        // listener for drag events on trip planner markers--enabled when we add a to/from icon to map
        markersDragControl = new OpenLayers.Control.DragFeature(markersLayer, { onComplete: onCompleteMarkerMove });
        map.addControl(markersDragControl);
        markersDragControl.activate();
        
        // add this layer separately after the drag control so the event handlers don't accidently catch it.
        map.addLayers([routeLayer]);
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
        var apiKey = OTP.Config.bingMapsKey;

        var road = new OpenLayers.Layer.Bing({
            key: apiKey,
            type: "Road",
            name: "Road",
            version: "v1"
        });

        var aerial = new OpenLayers.Layer.Bing({
            key: apiKey,
            type: "Aerial",
            name: "Aerial",
            version: "v1"
        });
        
        var hybrid = new OpenLayers.Layer.Bing({
            key: apiKey,
            type: "AerialWithLabels",
            name: "Hybrid",
            version: "v1"
        });

        map.addLayers([road, aerial, hybrid]);
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

        if(parentElement.css("position") === "absolute") {
            layerChooserPopout.css("left", Math.floor(offsetParent.left - (contentWidth / 2)) - 5);
            layerChooserPopout.css("top", 25);
        } else {
            layerChooserPopout.css("left", Math.floor((offset.left - offsetParent.left) - (contentWidth / 2)) + (openingElement.width() / 2) - 5);
        }
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

                    showBusy();

                    var callbackFunction = "getRouteListCallback" + Math.floor(Math.random() * 1000000000);
                    jQuery.ajax({
                            url: OTP.Config.wfsServiceUrl,
                            dataType: "jsonp",
                            jsonpCallback: callbackFunction,
                            data: {
                                request: "GetFeature",
                                outputFormat: "json",
                                format_options: "callback:" + callbackFunction,
                                propertyName: "designator,routedescription",
                                typeName: "soundtransit:routes",
                                cql_filter: "(operator LIKE '" + agency + "')"
                            },
                            success: function(data) {
                                hideBusy();
                                
                                var selectBox = content.find("#bus-route");
                                selectBox.children().remove();
                                selectBox.append("<option value=''>Select route</option>");

                                // push routes into an array and sort to remove dupes (can't do this in geoserver, unfortunately)
                                var routesToAdd = [];
                                for(var i = 0; i < data.features.length; i++) {
                                    var route = data.features[i];
                                    routesToAdd.push(route.properties);
                                }
                                
                                // sort features
                                routesToAdd.sort(function(a, b) {
                                    if (a.designator < b.designator) { return -1; }
                                    else if (a.designator > b.designator) { return 1; }
                                    else { return 0; }
                                });

                                var lastValue = null;
                                jQuery.each(routesToAdd, function(_, route) {
                                    // remove duplicates
                                    if(lastValue !== null) {
                                        if(lastValue === route.designator) {
                                            return;
                                        }
                                    }
                                    lastValue = route.designator;
                                    
                                    var label = OTP.Agency.getDisplayNameForLeg(null, route.designator);
                                    if(route.routedescription !== null) {
                                        if(route.routedescription.length > 40) {
                                            label += " " + route.routedescription.substr(0, 25) + "...";
                                        } else {
                                            label += " " + route.routedescription;
                                        }
                                    }
                                    
                                    var option = jQuery("<option></option>")
                                                .text(label)
                                                .val(route.designator);
                                    selectBox.append(option);
                                });
                            }
                    });
                });
                
                content.find("#bus-route")
                    .change(function(e) {
                        var v = jQuery(this).val();
                        
                        if(v !== null && v !== "" && v !== "Select route") {
                            systemMapRouteCriteria.BUS = "(operator LIKE '" + content.find("#bus-agency").val() 
                                                            + "' AND designator LIKE '" + v + "' AND routetyp LIKE 'P')";
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
                hideLayerButtonPopout();

                setBaseLayer("Road");
                return false;
            });

        controlsRoot.find("#base-aerial")
            .click(function() {
                controlsRoot.find("#base-layers")
                    .find("a")
                    .removeClass("active");

                jQuery(this).addClass("active");
                hideLayerButtonPopout();
                
                setBaseLayer("Aerial");

                var hybridSelector = jQuery('<div>' + 
                                                '<input type="checkbox" id="hybrid">' + 
                                                '<strong>Show&nbsp;Labels</strong>' + 
                                            '</div>').addClass("aerialSelector");
                                            
                hybridSelector.find("input").change(function() {
                    var checked = jQuery(this).attr("checked");
                    
                    if(checked === true) {
                        setBaseLayer("Hybrid");
                    } else {
                        setBaseLayer("Aerial");
                    }
                    
                    hideLayerButtonPopout();
                });
                
                showLayerButtonPopout(this, hybridSelector, null, function(content) {
                    content.find("input").attr("checked", null);
                });
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
                    addDataLayer("fareoutlets", null, this, false, null);
                }
                hideInfoWindow();
                return false;
            })
            .hover(function(e) {
                if(e.type === "mouseenter") {
                    showLayerButtonPopout(this, "<strong>Fare&nbsp;Outlets</strong>", null, null);                    
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
                    addDataLayer("parkandrides", null, this, false, null);
                }
                hideInfoWindow();
                return false;
            })
            .hover(function(e) {
                if(e.type === "mouseenter") {
                    showLayerButtonPopout(this, "<strong>Park&nbsp;and&nbsp;Rides</strong>", null, null);                    
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
                    addDataLayer("stops", null, this, true, null);
                }
                hideInfoWindow();
                return false;
            })
            .hover(function(e) {
                if(e.type === "mouseenter") {
                    showLayerButtonPopout(this, "<strong>Stops</strong>", null, null);                    
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

    // legend/chrome behaviors
    function addLegendBehavior() {
        jQuery("#map #legend .toggler").click(function() {
            var element = jQuery(this);
            if(element.hasClass("expanded")) {
                element.siblings(".content").slideUp();
                element.removeClass("expanded");                  
            } else {
                element.siblings(".content").slideDown();
                element.addClass("expanded");
            }
            return false;
        });
    }

    function addMapToggleWidthBehavior() {
        jQuery("#toggle-map-width").click(function() {
            jQuery(this).toggleClass("fullsize");
            jQuery("#tripplanner-wrap").toggleClass("fullsize");
            jQuery("#map-controls").toggleClass("fullsize");
            return false;
        });
    }

    // to/from markers
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
                externalGraphic: OTP.Config.tripPlannerImagePath + "a-flag.png",
                graphicWidth: 23,
                graphicHeight: 30,
                graphicXOffset: 0,
                graphicYOffset: -30,
                graphicTitle: "Drag To Change Route",
                cursor: "move"
            };

            markersLayer.addFeatures([icon]);
        }        

        if(markersDragControl !== null) {
            markersDragControl.activate();
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
                externalGraphic: OTP.Config.tripPlannerImagePath + "b-flag.png",
                graphicWidth: 23,
                graphicHeight: 30,
                graphicXOffset: 0,
                graphicYOffset: -30,
                graphicTitle: "Drag To Change Route",
                cursor: "move"
            };

            markersLayer.addFeatures([icon]);
        }        

        if(markersDragControl !== null) {
            markersDragControl.activate();
        }
    }
    
    // event handlers
    function onCompleteMarkerMove(feature) {
        if(feature !== null) {       
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
        }
    }

    function onSelectDisambiguationOption(feature) {
        if(feature !== null) {
            jQuery(".possible-" + feature.attributes.index)
                .trigger("click");
        }
    }
    
    function showBusy() {
        root.find("#loading").show();
    }

    function hideBusy() {
        root.find("#loading").hide();
    }

    // constructor
    map = new OpenLayers.Map(root.attr("id"), {
        projection: new OpenLayers.Projection("EPSG:900913"),
        maxExtent: new OpenLayers.Bounds(-20037508.34,-20037508.34,20037508.34,20037508.34),
        controls: [
            new OpenLayers.Control.Navigation({'zoomWheelEnabled': false}),
            new OpenLayers.Control.PanZoomBar({zoomWorldIcon:false, zoomStopHeight: 6, zoomStopWidth: 28}),
            new OpenLayers.Control.PanPanel(),
            new OpenLayers.Control.Attribution()
        ]
    });

    // this points OL to our custom icon set
    OpenLayers.ImgPath = OTP.Config.openLayersUIImagePath;

    // setup map 
    addBaseLayers();
    setupDataLayers();
    
    addContextMenuBehavior();
    addMapLayerChooserBehavior();
    addLegendBehavior();
    addMapToggleWidthBehavior();

    // center on seattle metro area
    var point = new OpenLayers.LonLat(-122.30, 47.45);
    var proj = new OpenLayers.Projection("EPSG:4326");
    map.setCenter(point.transform(proj, map.getProjectionObject()), 8);

    // public methods    
    return {
        showScheduleLinkInRouteMarker: function(v) {
            options.showScheduleLinkInRouteMarker = v;
        },
        
        setModeChooserUIVisibility: function(v) {
            var modeChooserButtons = controlsRoot.find("#toggle-bus,#toggle-sounder,#toggle-link,#toggle-ferry");

            if(v === false) {
                modeChooserButtons.hide();
            } else {
                modeChooserButtons.show();
            }
        },
        
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
        
        zoomToDisambiguationExtent: function() {
            if(markersLayer !== null) {
                map.zoomToExtent(markersLayer.getDataExtent());
            }
        },

        setStartPoint: function(lon, lat) {
            if(lon === null || lat === null) {
                return;
            }
            
            var point = new OpenLayers.LonLat(lon, lat);
            var proj = new OpenLayers.Projection("EPSG:4326");
            setStartMarker(point.transform(proj, map.getProjectionObject()));
        },
        
        setEndPoint: function(lon, lat) {
            if(lon === null || lat === null) {
                return;
            }

            var point = new OpenLayers.LonLat(lon, lat);
            var proj = new OpenLayers.Projection("EPSG:4326");
            setEndMarker(point.transform(proj, map.getProjectionObject()));
        },

        addDisambiguationPoint: function(lon, lat, index) {
            if(lat === null || lon === null) {
                return;
            }

            if (index === null) {
                index = 1;
            }

            var point = new OpenLayers.Geometry.Point(lat, lon);
            var proj = new OpenLayers.Projection("EPSG:4326");
            var icon = new OpenLayers.Feature.Vector(point.transform(proj, map.getProjectionObject()), { type: "disambiguation", index: index });
            icon.style = {
                             externalGraphic: OTP.Config.tripPlannerImagePath + "pin-" + index + ".png",
                             graphicWidth: 32,
                             graphicHeight: 37,
                             graphicXOffset: -15,
                             graphicYOffset: -37,
                             graphicTitle: "Disambiguation Point",
                             cursor: "pointer"
                         };           

            markersLayer.addFeatures([icon]);
            
            if(markersDragControl !== null) {
                markersDragControl.deactivate();
            }
        },

        highlightDisambiguationPoint: function(index) {
            if(index === null) {
                return;
            }

            var features = markersLayer.getFeaturesByAttribute("index", index);
            
            if(typeof features[0] !== 'undefined') {
                var newStyle = features[0].style;
                newStyle.graphicZIndex = 1000000;
                newStyle.externalGraphic = OTP.Config.tripPlannerImagePath + "pin-" + index + "-highlight.png";  
                markersLayer.drawFeature(features[0], newStyle);
            }
        },
        
        unhighlightDisambiguationPoint: function(index) {
            if(index === null) {
                return;
            }

            var features = markersLayer.getFeaturesByAttribute("index", index);
            
            if(typeof features[0] !== 'undefined') {
                var newStyle = features[0].style;
                newStyle.externalGraphic = OTP.Config.tripPlannerImagePath + "pin-" + index + ".png";  
                markersLayer.drawFeature(features[0], newStyle);
            }
        },

        addStopsWithIds: function(stopIds) {
            var cqlSet = "";
            jQuery.each(stopIds, function(_, id) {
                if(cqlSet.length > 0) {
                    cqlSet += ",";
                }
                cqlSet += "'" + id + "'"; 
            });
            addDataLayer("stops", "stops_routes", null, false, "localid IN (" + cqlSet + ")");
        },

        addLegToPlannedRoute: function(leg) {
            if(leg === null) {
                return;
            }

            var rawPoints = decodePolyline(leg.legGeometry.points);
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

            var style = {
                strokeColor: OTP.Agency.getColorForLeg(leg["@mode"], leg["@route"]),
                strokeOpacity: 0.80,
                strokeWidth: 5
            };

            var polyline = new OpenLayers.Geometry.LineString(points);
            var lineFeature = new OpenLayers.Feature.Vector(polyline, null, style);
            routeLayer.addFeatures([lineFeature]);
        },

        addLegToHoverRoute: function(leg) {
            if(leg === null) {
                return;
            }

            var rawPoints = decodePolyline(leg.legGeometry.points);
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

            var style = {
                strokeColor: OTP.Agency.getColorForLeg(leg["@mode"], leg["@route"]),
                strokeOpacity: 0.50,
                strokeWidth: 5
            };

            var polyline = new OpenLayers.Geometry.LineString(points);
            var lineFeature = new OpenLayers.Feature.Vector(polyline, { type: "hover" }, style);
            routeLayer.addFeatures([lineFeature]);
        },

        addLegInfoMarker: function(leg, legInfoWindowHtml) {
            if(leg === null || leg["@mode"] === "WALK") {
                return;
            }

            var proj = new OpenLayers.Projection("EPSG:4326");
            var wgsLonLat = new OpenLayers.LonLat(leg.from.lon, leg.from.lat);
            var lonlat = wgsLonLat.transform(proj, map.getProjectionObject())

            addLegInfoMarker(OTP.Agency.getDisplayNameForLeg(leg["@mode"], leg["@route"]), 
                             OTP.Agency.getModeLabelForLeg(leg["@mode"], leg["@route"]), 
                             legInfoWindowHtml, 
                             lonlat); 
        },
        
        removeHoverRoute: function() {
              var features = routeLayer.getFeaturesByAttribute("type", "hover");

              if(features !== null) {
                  routeLayer.removeFeatures(features);
              }
        },

        showBusy: showBusy,
        
        hideBusy: hideBusy
    };
};
