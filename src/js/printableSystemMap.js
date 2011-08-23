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

OTP.PrintableSystemMap = function() {
    var root = jQuery("body");
    var map = null;

    var _mode = OTP.Util.getParameterByName("mode", null);
    var _route = OTP.Util.getParameterByName("route", null);
    var _operator = OTP.Util.getParameterByName("operator", null);
    var _stops = OTP.Util.getParameterByName("stops", null);
    var _title = OTP.Util.getParameterByName("title", null);
    
    function generateStopTable(addStopsResponse, routeStopsResponse) {
        var container = root.find("#details");

        var referenceData = {};
        jQuery.each(addStopsResponse.features, function(_, stop) {
            referenceData[stop.properties.atisid] = stop;
        });

        var directionToStopsMap = {};
        jQuery.each(routeStopsResponse.stops, function(_, stop) {
            if(typeof directionToStopsMap[stop.direction] === 'undefined') {
                directionToStopsMap[stop.direction] = [];
            }
            directionToStopsMap[stop.direction].push(stop);
        });

        jQuery.each(directionToStopsMap, function(direction, stops) {
            var header = jQuery("<h2>" + OTP.Agency.getDirectionLabelForDirectionCode(direction) + "</h2>")
                            .appendTo(container);
            
            var table = jQuery('<table></table>')
                            .addClass("stop_list")
                            .appendTo(container);

            var tableHeader = jQuery('<thead><tr>' + 
                                        '<td>Stop</td>' + 
                                        '<td>Parking</td>' + 
                                        '<td>Accessible</td>' + 
                                        '</tr></thead>')
                                        .appendTo(table);

            var tableBody = jQuery('<tbody></tbody>')
                            .appendTo(table);

            var i = 0;
            jQuery.each(stops, function(_, stop) {
                var feature = referenceData[stop.atisstopid];

                var accessible = (feature.properties.accessible === "Y");
                var name = feature.properties.name;
                var parking_near = feature.properties.parking_near;

                var row = jQuery('<tr>' + 
                                    '<td>' + name + '</td>' + 
                                    '<td>' + ((parking_near !== null) ? OTP.Util.makeSentenceCase(parking_near) : "No") + '</td>' + 
                                    '<td>' + ((accessible === true) ? "Yes" : "No") + '</td>' + 
                                 '</tr>')
                                 .appendTo(tableBody);
     
                if(i % 2 == 0) {
                    row.addClass("alt");
                }
                   
                i++;
            });
        });
    }

    // UI behaviors
    function addUIBehavior() {
        root.find("#print").click(function() {
            window.print();
            return false;
        });

        root.find("#map_text, #map_only").click(function() {
            root.removeClass()
                .addClass(jQuery(this).attr("id"));
    
            jQuery("#map_text, #map_only")
                .removeClass();
                
            jQuery(this).addClass("selected");

            return false;
        });
    }

    // constructor
    map = OTP.Map(
        document.getElementById("map"),
        null,
        { hasTripPlanner: true, inert: true, addDataLayerCallback: generateStopTable }
    );
    
    if(_title !== null) {
        jQuery("#map-header")
            .find("h1")
            .text(decodeURI(_title));
    }

    map.showRouteWithCriteria(_route, _mode, _operator, _stops);

    addUIBehavior();

    return {};
};