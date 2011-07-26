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
    
    return {
        showFerryRouteFor: function(v) {
            return map.showFerryRouteFor(v);
        },
        
        showLinkRouteFor: function(v) {
            return map.showLinkRouteFor(v);
        },
        
        showSounderRouteFor: function(v, s) {
            return map.showSounderRouteFor(v, s);
        },
        
        showBusRouteFor: function(v, s) {
            return map.showBusRouteFor(v, s);
        },
        
        showScheduleLinkInRouteMarker: function(v) {
            return map.showScheduleLinkInRouteMarker(v);
        },
        
        setModeChooserUIVisibility: function(v) {
            return map.setModeChooserUIVisibility(v);
        }
    };
};