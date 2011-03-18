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

OTP.Agency = {
    getFormattedHeadsign: function(route, headsign) {
        if(headsign === null || route === null) {
            return null;
        }
        return headsign.substr(route.length);
    },
    
    getScheduleURLForLeg: function(mode, route) {
        return "http://www.example.com";
    },
    
    getModeLabelForLeg: function(mode, route) {
        if(mode === null || route === null) {
            return null;
        }

        mode = mode.toUpperCase();
        route = route.toUpperCase();

        if(mode === "WALK") {
            return "Walk";
        } else if(mode === "BUS") {
            return "Bus";
        } else if(mode === "FERRY" || mode === "WSF") {
            return "Ferry";
        } else if(mode === "TRAIN" || mode === "LINK" || mode === "SOUNDER") {
            if(route === "MSOUNDER" || mode === "SOUNDER") {
                return "Sounder";
            } else if(route === "M599" || route === "TLDTC" || mode === "LINK") {
                return "Link";
            } else {
                //return "Streetcar";

                // For now, street cars appear as/along with buses. (FIXME)
                return "Bus";
            }
        }
        return "Unknown";
    },
    
    getColorForLeg: function(mode, route) {
        if(mode === null || route === null) {
            return null;
        }

        var label = OTP.Agency.getModeLabelForLeg(mode, route);
        switch(label) {
            case "Walk":
            case "Ferry":
                return "#666666";
            case "Sounder":
                return "#0B9140";
            case "Link":
                return "#41B1C1";
            case "Bus":
                return "#5380B0";
            default:
                return "#FF0000";
        }
    },
    
    getDisplayNameForLeg: function(mode, route) {
        if(route === null) {
            return "Unknown";
        }

        var agencyIdentifier = (route + '').toUpperCase().match('^MWSF-|WSF-|M|P|CT|ST|EE');
        if(agencyIdentifier !== null && typeof agencyIdentifier[0] !== 'undefined') {
            route = route.substring(agencyIdentifier[0].length);
        }

        if(route.toUpperCase() === "SOUNDER") {
            return "Sounder";
        } else if(route === "599" || route.toUpperCase() === "TLDTC") {
            return "Link";
        } else {
            // strip off direction modifier if present, at end of numeric routes
            var lastCharacter = route.match(/^[0-9]*([N|E|S|W])$/i);
            if(lastCharacter !== null) {
                return route.substring(0, route.length - 1);
            }
            return route;
        }
    },
    
    getURLForLeg: function(operatorId) {
        if(operatorId === null) {
            return null;
        }

        if(operatorId === "M" || operatorId === "MT") {
            return "http://metro.kingcounty.gov/";
        } else if(operatorId === "PT") {
            return "http://www.piercetransit.org/";
        } else if(operatorId === "ST" || operatorId === "SDR" || operatorId === "LLR") {
            return "http://www.soundtransit.org";
        } else if(operatorId === "ET") {
            return "http://www.everettwa.org/transit/";
        } else if(operatorId === "WSF" || operatorId === "MWSF") {
            return "http://www.wsdot.wa.gov/ferries/";
        } else if(operatorId === "CT") {
            return "http://www.commtrans.org/";
        }
        return "#";
    },

    getAgencyNameForLeg: function(operatorId) {
        if(operatorId === null) {
            return null;
        }

        if(operatorId === "M" || operatorId === "MT") {
            return "King County Metro";
        } else if(operatorId === "PT") {
            return "Pierce Transit";
        } else if(operatorId === "ST" || operatorId === "SDR" || operatorId === "LLR") {
            return "Sound Transit";
        } else if(operatorId === "ET") {
            return "Everett Transit";
        } else if(operatorId === "WSF" || operatorId === "MWSF") {
            return "Washington State Ferry";
        } else if(operatorId === "CT") {
            return "Community Transit";
        }
        return "Unknown Agency";
    }
};