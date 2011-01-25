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
    
    // Add hash-sieving function to find unique elements in array
    Array.prototype.unique = function() {
        var o = {}, i, l = this.length, r = [];
        for(i=0; i<l;i++) o[this[i]] = this[i];
        for(i in o) r.push(o[i]);
        return r;
    };

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
        
        if(legInfoMarkers !== null) {
            jQuery.each(legInfoMarkers, function(_, m) {
                if(m !== null && typeof m !== 'undefined') {
                    m.remove();
                }
            });
        }
        
        if(markersDragControl !== null) {
            markersDragControl.deactivate();
        }
    }
    
    // Dupe of narrative.js - TODO: consolidate these - probably in a OTP.Util namespace with some other general-purpose functions
    function getAgencyForRoute(route, includeLink) {
        var agencyName = "Unknown Agency";
        var agencyUrl = null;
        
        if(route === null) {
            return agencyName;
        }

        if(isSounder(route)) {
            agencyUrl = "http://www.soundtransit.org/sounder";
            agencyName = "Sounder";
        } else if(isTheLink(route)) {
            agencyUrl = "http://www.soundtransit.org/link";
            agencyName = "Link Light Rail";
        } else {
            var agencyIdentifier = (route + '').toUpperCase().match('^[M|P|CT|ST]');

            if(agencyIdentifier !== null && typeof agencyIdentifier[0] !== 'undefined') {
                agencyIdentifier = agencyIdentifier[0];
                if(agencyIdentifier === "M") {
                    agencyUrl = "http://metro.kingcounty.gov/";
                    agencyName = "King County Metro";
                } else if(agencyIdentifier === "P") {
                    agencyUrl = "http://www.piercetransit.org/";
                    agencyName = "Pierce Transit";
                } else if(agencyIdentifier === "ST") {
                    agencyUrl = "http://www.soundtransit.org";
                    agencyName = "Sound Transit";
                } else if(agencyIdentifier === "CT") {
                    agencyUrl = "http://www.commtrans.org/";
                    agencyName = "Community Transit";
                } else {
                    // if there is no route identifier, it's a CT route, except if it's between 500 and 599. 
                    try {
                        var agencyIdentifierNum = parseInt(agencyIdentifier);
                        if(agencyIdentifierNum >= 500 && agencyIdentifierNum <= 599) {
                            agencyUrl = "http://www.soundtransit.org";
                            agencyName = "Sound Transit";
                        }
                    } catch(e) {}

                    agencyUrl = "http://www.commtrans.org/";
                    agencyName = "Community Transit";
                }
            }
        }

        if(includeLink) {
            return '<a href="' + agencyUrl + '">' + agencyName + '</a>';
        } else {
            return agencyName;
        }
    }
    
    function isSounder(route) {
        if(route === null) {
            return false;
        }
        return (route.toUpperCase() === "MSOUNDER");
    }

    function isTheLink(route) {
        if(route === null) {
            return false;
        }
        return (route.toUpperCase() === "M599");
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

    function addLegInfoMarker(routeName, type, legInfoWindowHtml, lonlat) {
        if(routeName === null || type === null || type === "WALK") {
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
                            .addClass(type)
                            .appendTo(contentWrapper);

        var contentLabel = jQuery("<p></p>")
                            .addClass("route-label")
                            .html(routeName)
                            .appendTo(contentWrapper);

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
        var routesServed = "";
        var ticketText = "";
        var lonlat = new OpenLayers.LonLat(featureProperties.lon, featureProperties.lat);
        var startEndTrip = jQuery('<div class="start-end-area"></div>');
        
        if(typeof featureProperties.outlettype !== 'undefined') {
            type = "fareoutlet";
            var niceOutletType = (featureProperties.outlettype == 'TVM') ? "Ticket Vending Machine" : ((featureProperties.outlettype == 'Retailer') ? "Retailer" : "ORCA Customer service center");
            crossbar = '<div class="crossbar"><strong>' + niceOutletType + '</strong> - ' + featureProperties.location + '</div>';
            amenities += "<strong>What can I do here</strong>";
            amenities += (featureProperties.outlettype == 'TVM') ? '<div class="fare-actions"><ul><li>Buy new ORCA Card (Note: Adult cards only)</li><li>Reload ORCA Card</li><li>Buy new monthly pass on ORCA Card</li><li>Central link tickets</li><li>Sounder tickets</li></ul></div>' : ((featureProperties.outlettype == 'Retailer') ? '<div class="fare-actions"><ul><li>Reload ORCA Card</li><li>Buy new monthly pass on ORCA Card</li></ul>Note: No new ORCA cards sold here</div>' : '<div class="fare-actions"><ul><li>Buy new ORCA Card, including Youth and Senior card</li><li>Reload ORCA Card</li><li>Buy new monthly pass on ORCA Card</li></ul></div>');
            amenities += "<strong>How can I pay here</strong>";
            amenities += (featureProperties.outlettype == 'TVM') ? '<div class="payment-actions"><ul><li>Cash</li><li>Visa, MasterCard</li></ul></div>' : ((featureProperties.outlettype == 'Retailer') ? '<div class="payment-actions"><ul><li>Cash</li></ul></div>' : '<div class="payment-actions"><ul><li>Cash</li><li>Visa, MasterCard</li><li>Checks</li></ul></div>');
            
        } else if(typeof featureProperties.accessible !== 'undefined') {
            type = "stop";
            var routesServed = '<div class="info-routes"></div>';
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
                    
                    routes = [];
                    sounderRoutes = [];
                    linkRoutes = [];
                    metroRoutes = [];
                    pierceRoutes = [];
                    soundTransRoutes = [];
                    commTransRoutes = [];
                    
                    // We may be handed an array of objects or a single object, depending on how many routes stop here
                    // TODO: handle grouping by transit agency
                    if(data.service instanceof Array) {
                        for(var i = 0; i < data.service.length; i++) {
                            routes.push(data.service[i].route);
                            switch(getAgencyForRoute(data.service[i].route, false)) {
                                case "Sounder":
                                    sounderRoutes.push(data.service[i].route);
                                    break;
                                case "Link Light Rail":
                                    linkRoutes.push(data.service[i].route);
                                    break;
                                case "King County Metro":
                                    metroRoutes.push(data.service[i].route);
                                    break;
                                case "Pierce Transit":
                                    pierceRoutes.push(data.service[i].route);
                                    break;
                                case "Sound Transit":
                                    soundTransRoutes.push(data.service[i].route);
                                    break;
                                case "Community Transit":
                                    commTransRoutes.push(data.service[i].route);
                                    break;
                            }
                        }
                    } else {
                        routes.push(data.service.route);
                        switch(getAgencyForRoute(data.service.route, false)) {
                            case "Sounder":
                                sounderRoutes.push(data.service.route);
                                break;
                            case "Link Light Rail":
                                linkRoutes.push(data.service.route);
                                break;
                            case "King County Metro":
                                metroRoutes.push(data.service.route);
                                break;
                            case "Pierce Transit":
                                pierceRoutes.push(data.service.route);
                                break;
                            case "Sound Transit":
                                soundTransRoutes.push(data.service.route);
                                break;
                            case "Community Transit":
                                commTransRoutes.push(data.service.route);
                        }
                    }

                    var routeDiv = root.find('.info-window .info-routes');

                    if (routes.length > 0) { //only show if we have routes returned
                        var routeMarkup = "";
                        if (sounderRoutes.length > 0) {
                            routeMarkup += getAgencyForRoute(sounderRoutes[0], false) + " " + sounderRoutes.unique().join(", ");
                        }
                        if (linkRoutes.length > 0) {
                            routeMarkup += getAgencyForRoute(linkRoutes[0], false) + " "  + linkRoutes.unique().join(", ");
                        }
                        if (metroRoutes.length > 0) {
                            routeMarkup += getAgencyForRoute(metroRoutes[0], false) + " "  + metroRoutes.unique().join(", ");
                        }
                        if (pierceRoutes.length > 0) {
                            routeMarkup += getAgencyForRoute(pierceRoutes[0], false) + " "  + pierceRoutes.unique().join(", ");
                        }
                        if (soundTransRoutes.length > 0) {
                            routeMarkup += getAgencyForRoute(soundTransRoutes[0], false) + " "  + soundTransRoutes.unique().join(", ");
                        }
                        if (commTransRoutes.length > 0) {
                            routeMarkup += getAgencyForRoute(commTransRoutes[0], false) + " "  + commTransRoutes.unique().join(", ");
                        }
                        
                        routeDiv.html('<strong>Services Routes</strong>:<br />' + routeMarkup);
                        
                        // some browsers will append "px" to the css value so we need to force coversion to integer
                        infoWindow.css("top", (parseInt(infoWindow.css("top")) - routeDiv.height()));
                        ensureInfoWindowIsVisible();
                    }
                    
               }
            });
            crossbar = '<div class="crossbar"><strong>Stop ID</strong>: ' + featureProperties.localid.replace(/^\D/i, "") + '</div>';
            if (featureProperties.park2min !== null && featureProperties.park2min !== "") {amenities += "<strong>Nearby Parking</strong>: " + featureProperties.park2min + "<br />";}
            // temporary workaround for our stop data having lat and lon transposed. Remove when we're able to fix that.
            lonlat = new OpenLayers.LonLat(featureProperties.lat, featureProperties.lon);
        } else {
            type = "parkandride";
            crossbar = '<div class="crossbar">' + featureProperties.location + '</div>';
            if (featureProperties.spaces !== null && featureProperties.spaces !== 0 && featureProperties.spaces !== "") {amenities += "<strong>Parking spaces:</strong> " + featureProperties.spaces;}
            if (featureProperties.timefull !== null && featureProperties.timefull !== 0 && featureProperties.timefull !== "") {amenities += " This parking lot is typically full by " + featureProperties.timefull + "AM<br />"} else {amenities += "<br />"}
            if (featureProperties.numbikeloc !== null && featureProperties.numbikeloc !== 0 && featureProperties.numbikeloc !== "") {amenities += "<strong>Bike Lockers:</strong> " + featureProperties.numbikeloc + "<br />";}
            if (featureProperties.electricca !== null && featureProperties.electricca !== 0 && featureProperties.electricca !== "") {amenities += "<strong>Electric Car Chargers:</strong> " + featureProperties.electricca + "<br />";}
            if (featureProperties.notes !== null && featureProperties.notes !== null && featureProperties.notes !== "") {amenities += "<strong>Notes:</strong> " + featureProperties.notes;}
        }
    
        var content = jQuery("<div></div>")
                            .addClass("info-content")
                            .addClass(type);

        var headerWrapper = jQuery("<div></div>")
                            .addClass("info-header")
                            .html("<h2>" + headerContent + "</h2>")
                            .append(getInfoWindowClose());

        if (options.hasTripPlanner === true) {
            jQuery('<a href="#">Start Trip Here</a>')
                .click(function(e) {
                    if(typeof options.updateFromLocationFunction === 'function') {
                        var toFeature = markersLayer.getFeaturesByAttribute('type', "end");
                        var submitAfterDone = (toFeature !== null && typeof toFeature[0] !== 'undefined') ? true : false;
                        options.updateFromLocationFunction(lonlat, submitAfterDone);

                        var proj = new OpenLayers.Projection("EPSG:4326");
                        setStartMarker(lonlat.transform(proj, map.getProjectionObject()));
                        hideInfoWindow();
                    }
                    return false;
            }).appendTo(startEndTrip);
        
            jQuery('<a href="#">End Trip Here</a>')
                .click(function(e) {
                    if(typeof options.updateToLocationFunction === 'function') {
                        var fromFeature = markersLayer.getFeaturesByAttribute('type', "start");
                        var submitAfterDone = (fromFeature !== null && typeof fromFeature[0] !== 'undefined') ? true : false;
                        options.updateToLocationFunction(lonlat, submitAfterDone);
                        
                        var proj = new OpenLayers.Projection("EPSG:4326");
                        setEndMarker(lonlat.transform(proj, map.getProjectionObject()));
                        hideInfoWindow();
                    }
                    return false;
            }).appendTo(startEndTrip);
        }
        
        content.append(startEndTrip);
        
        content.prepend(ticketText).prepend(amenities).prepend(routesServed).prepend(crossbar);
        
        var popupContent = jQuery('<div></div>').append(headerWrapper).append(content);

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
        removeRouteLayerFeaturesForMode(mode);
    }

    function removeRouteLayerFeaturesForMode(mode) {
        // remove features from map
        var features = systemMapRouteFeatures[mode];

        if(typeof features !== 'undefined' && features !== null) {
            routeLayer.removeFeatures(features);
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

        var style = null;
        if(mode === "WSF") {
            style = {
                strokeColor: "#666666",
                strokeWidth: 4
            };
        } else if(mode === "BUS") {
            // (color set below, per feature)
            style = {
                strokeWidth: 4
            };                
        } else if(mode === "SOUNDER") {
            style = {
                strokeColor: "#0B9140",
                strokeWidth: 4
            };                                
        } else if(mode === "LINK") {
            style = {
                strokeColor: "#41B1C1",
                strokeWidth: 4
            };                                
        }

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
                 propertyName: "the_geom,designator,routetyp",
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
                    var addedFlag = false;
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

                        // add info marker to first leg
                        if(addedFlag === false) {
                            var infoMarkerPoint = new OpenLayers.LonLat(points[0].x, points[0].y);

                            var routeName = feature.properties.designator;
                            var agencyIdentifier = (routeName + '').toUpperCase().match('^[M|P|CT|ST]');
                            if(agencyIdentifier !== null && typeof agencyIdentifier[0] !== 'undefined') {
                                routeName = routeName.substring(agencyIdentifier[0].length);
                            }

                            var infoMarker = addLegInfoMarker(routeName, mode, null, infoMarkerPoint);

                            if(typeof systemMapRouteInfoMarkers[mode] === 'undefined' || systemMapRouteInfoMarkers[mode] === null) {
                                systemMapRouteInfoMarkers[mode] = [];
                            }
                            systemMapRouteInfoMarkers[mode].push(infoMarker);

                            addedFlag = true;
                        }

                        // special styling for secondary bus routes
                        if(mode === "BUS") {
                            if(feature.properties['routetyp'] === "S") {
                                style.strokeColor = "#3A7BBE";
                            } else {
                                style.strokeColor = "#5380B0";
                            }
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
        var layer = dataMarkerLayers[type];

        if(layer === null) {
            return;
        }

        // if we're going to draw the features for this layer, add 
        // active class to its selector indicator
        if(element !== null) {
            jQuery(element).addClass("active");
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
    
        jQuery.ajax({
             url: OTP.Config.wfsServiceUrl,
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
           }
        });     
    }
    
    function removeDataLayer(type) {
        var layer = dataMarkerLayers[type];

        if(layer !== null) {
            layer.removeAllFeatures();
        }

        if(type === "stops") {
            hideTooMany();
        }
    }

    function setupDataLayers() {
        // trip planner vector layers
        routeLayer = new OpenLayers.Layer.Vector("Routes");
        markersLayer = new OpenLayers.Layer.Vector("Trip Planner Markers", { rendererOptions: {zIndexing: true}});

        // data layer markers:
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
        dataMarkerLayers.stops = new OpenLayers.Layer.Vector("Stop Markers");
        dataMarkerLayers.stops.styleMap = new OpenLayers.StyleMap({
            'default': new OpenLayers.Style(templateStops, {context:context}),
            'select': new OpenLayers.Style(templateStops, {context:context})
        });
        dataMarkerLayers.stops.events.on({
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
        dataMarkerLayers.parkandrides = new OpenLayers.Layer.Vector("Park and Ride Markers");
        dataMarkerLayers.parkandrides.styleMap = new OpenLayers.StyleMap({
            'default': new OpenLayers.Style(templateParking, {context:context}),
            'select': new OpenLayers.Style(templateParking, {context:context})
        });

        var templateFares = {
            graphicXOffset: "${getOffset}",
            graphicYOffset: "${getPointRadius}",
            pointRadius: "${getPointRadius}",
            externalGraphic: "img/otp/fares-icon.png"
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

        map.addLayers([routeLayer, dataMarkerLayers.stops, dataMarkerLayers.parkandrides, 
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
        markersSelectControl = new OpenLayers.Control.SelectFeature([markersLayer, dataMarkerLayers.stops, dataMarkerLayers.parkandrides, dataMarkerLayers.fareoutlets], 
                                                                    { onSelect: selectFeatureEventDispatcher });
        map.addControl(markersSelectControl);
        markersSelectControl.activate();

        // listener for drag events on trip planner markers--enabled when we add a to/from icon to map
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
                        systemMapRouteCriteria.WSF = "(designator LIKE '" + v + "')";
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
                            systemMapRouteCriteria.LINK += "(designator LIKE '" + checkbox.val() + "')";
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
                            systemMapRouteCriteria.SOUNDER += "(designator LIKE '" + values[0] + "' AND stops=" + values[1] + ")";
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
                                    
                                    var label = route.designator;
                                    if(route.routedescription !== null) {
                                        if(route.routedescription.length > 40) {
                                            label += " " + route.routedescription.substr(0, 35) + "...";
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
                            systemMapRouteCriteria.BUS = "(operator LIKE '" + content.find("#bus-agency").val() + "' AND designator LIKE '" + v + "')";
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
                    addDataLayer("fareoutlets", this, false);
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
                    addDataLayer("parkandrides", this, false);
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
                    addDataLayer("stops", this, true);
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

    // constructor
    map = new OpenLayers.Map(root.attr("id"), {
        projection: new OpenLayers.Projection("EPSG:900913"),
        maxExtent: new OpenLayers.Bounds(-20037508.34,-20037508.34,20037508.34,20037508.34),
        controls: [
            new OpenLayers.Control.Navigation({'zoomWheelEnabled': false}),
            new OpenLayers.Control.PanZoomBar({zoomWorldIcon:false, zoomStopHeight: 6}),
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

            systemMapRouteCriteria.WSF = "(designator LIKE '" + v + "')";
            drawRouteLayerForMode("WSF", '#toggle-ferry');               
        },

        showLinkRouteFor: function(v) {
            if(v === null || v === "") {
                return;
            }

            systemMapRouteCriteria.LINK = "(designator LIKE '" + v + "')";
            drawRouteLayerForMode("LINK", '#toggle-link');           
        },

        showSounderRouteFor: function(v,s) {
            if(v === null || v === "" || s === null || s === "") {
                return;
            }

            systemMapRouteCriteria.SOUNDER = "(designator LIKE '" + v + "' AND stops=" + s + ")";
            drawRouteLayerForMode("SOUNDER", '#toggle-sounder');
        },

        showBusRouteFor: function(v,s) {
            if(v === null || v === "" || s === null || s === "") {
                return;
            }

            systemMapRouteCriteria.BUS = "(operator LIKE '" + v + "' AND designator LIKE '" + s + "')";
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
                             externalGraphic: "img/otp/pin-" + index + ".png",
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
                newStyle.externalGraphic = "img/otp/pin-" + index + "-highlight.png";  
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
                newStyle.externalGraphic = "img/otp/pin-" + index + ".png";  
                markersLayer.drawFeature(features[0], newStyle);
            }
        },

        addLegToPlannedRoute: function(leg, type) {
            if(leg === null || type === null) {
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
        },

        addLegInfoMarker: function(routeName, type, legInfoWindowHtml, wgsLonlat) {
            if(wgsLonlat === null || routeName === null || type === null || type === 'WALK') {
                return;
            }
            var proj = new OpenLayers.Projection("EPSG:4326");
            var lonlat = wgsLonlat.transform(proj, map.getProjectionObject())
            addLegInfoMarker(routeName, type, legInfoWindowHtml, lonlat); 
        }
    };
};
