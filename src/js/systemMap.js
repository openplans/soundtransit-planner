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

OTP.SystemMap = function(_root, _mapControlsRoot) {
    if(typeof _root === 'undefined' || _root === null) {
        return null;
    }
    
    var root = jQuery(_root);
    var map = new OTP.Map(_root, _mapControlsRoot);
    var mapControls = jQuery(_mapControlsRoot);
    
    var _stops = null;
    var _route = null;
    var _operator = null;
    var _mode = null;
    
    function addPrintUIBehavior() {
        // print button
        mapControls.find("#print").click(function() {
            var printableUrl = OTP.Config.systemMapPrintUrl;

            printableUrl += "?operator=" + _operator;
            printableUrl += "&route=" + _route;
            printableUrl += "&mode=" + _mode;
            printableUrl += "&stops=" + _stops;

            window.open(printableUrl, "print", "status=0,toolbar=0,scrollbars=1,width=760,height=600");

            return false;
        });
    }    

    addPrintUIBehavior();
    
    return {
        showRouteWithCriteria: function(route, mode, operator, stops) {
            _stops = stops;
            _route = route;
            _operator = operator;
            _mode = mode;
            return map.showRouteWithCriteria(route, mode, operator, stops);
        },

        setPrintable: function(v) {
            if(v === true) {
                mapControls.find("#map-controls-wrap").addClass("printable");
            } else {
                mapControls.find("#map-controls-wrap").removeClass("printable");
            }
        },
                
        // legacy method
        showFerryRouteFor: function(r) {
            _mode = "WSF";
            _route = r;
            _operator = null;
            _stops = null;
            return map.showRouteWithCriteria(_route, _mode, _operator, _stops);
        },
        
        // legacy method
        showLinkRouteFor: function(r) {
            _mode = "LINK";
            _route = r;
            _operator = "ST";
            _stops = null;
            return map.showRouteWithCriteria(_route, _mode, _operator, _stops);
        },
        
        // legacy method
        showSounderRouteFor: function(r, s) {
            _mode = "SOUNDER";
            _route = r;
            _operator = "ST";
            _stops = s;
            return map.showRouteWithCriteria(_route, _mode, _operator, _stops);
        },
        
        // legacy method
        showBusRouteFor: function(o, r) {
            _mode = "BUS";
            _route = r;
            _operator = o;
            _stops = null;
            return map.showRouteWithCriteria(_route, _mode, _operator, _stops);
        },
        
        showScheduleLinkInRouteMarker: function(v) {
            return map.showScheduleLinkInRouteMarker(v);
        },
        
        setModeChooserUIVisibility: function(v) {
            return map.setModeChooserUIVisibility(v);
        }
    };
};