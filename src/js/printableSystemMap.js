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
    
    function updateMap() {
        var mode = OTP.Util.getParameterByName("mode", null);
        var route = OTP.Util.getParameterByName("route", null);
        
        if(mode === "BUS") {
            var operator = OTP.Util.getParameterByName("operator", null);
            map.showBusRouteFor(operator, route);
        } else if(mode === "FERRY") {
            map.showFerryRouteFor(route);
        } else if(mode === "SOUNDER") {
            var stops = OTP.Util.getParameterByName("stops", null);
            map.showSounderRouteFor(route, stops);
        } else if(mode === "LINK") {
            map.showLinkRouteFor(route);
        }
    }

    function generateStopTable(data) {
        var container = root.find("#details");
        
        if(typeof data.features === 'undefined') {
            return;
        }
        
        var table = jQuery('<table></table>')
                         .addClass("stop_list")
                         .appendTo(container);

        var tableHeader = jQuery('<thead><tr>' + 
                                    '<td>Route</td>' + 
                                    '<td>Parking</td>' + 
                                    '<td>Accessible</td>' + 
                                 '</tr></thead>')
                          .appendTo(table);

        var tableBody = jQuery('<tbody></tbody>')
                          .appendTo(table);

        var i = 0;
        jQuery.each(data.features, function(_, feature) {
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

    updateMap();
    addUIBehavior();

    return {};
};