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
    getFormattedHeadsign: function(headsign) {
        if(headsign === null) {
            return null;
        }
        var headsign_r = headsign.split(/ {3}/ig);
        if(headsign_r !== null && typeof headsign_r[1] !== 'undefined') {
            return OTP.Util.makeSentenceCase(headsign_r[1]);
        } else {
            return "";
        }
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
    
    getURLForLeg: function(mode, route) {
        if(mode === null || route === null) {
            return null;
        }
        
        var label = OTP.Agency.getModeLabelForLeg(mode, route); 
        if(label === "Sounder") {
            return "http://www.soundtransit.org/sounder";
        } else if(label === "Link") {
            return "http://www.soundtransit.org/link";
        } else {
            var agencyIdentifier = (route + '').toUpperCase().match('^MWSF|WSF|M|P|CT|ST|EE');
            if(agencyIdentifier !== null && typeof agencyIdentifier[0] !== 'undefined') {
                agencyIdentifier = agencyIdentifier[0];
                if(agencyIdentifier === "M") {
                    return "http://metro.kingcounty.gov/";
                } else if(agencyIdentifier === "P") {
                    return "http://www.piercetransit.org/";
                } else if(agencyIdentifier === "ST") {
                    return "http://www.soundtransit.org";
                } else if(agencyIdentifier === "EE") {
                    return "http://www.everettwa.org/transit/";
                } else if(agencyIdentifier === "WSF" || agencyIdentifier === "MWSF") {
                    return "http://www.wsdot.wa.gov/ferries/";
                } else if(agencyIdentifier === "CT") {
                    return "http://www.commtrans.org/";
                }
            } else {
                // if there is no route identifier, it's a CT route, except if it's between 500 and 599. 
                try {
                    var routeNum = parseInt(route,10);
                    if(routeNum >= 500 && routeNum <= 599) {
                        return "http://www.soundtransit.org";
                    }
                } catch(e) {}
                return "http://www.commtrans.org/";
            }
        }
        return "#";
    },

    getAgencyNameForLeg: function(mode, route) {
        if(route === null) {
            return null;
        }

        var label = OTP.Agency.getModeLabelForLeg(mode, route); 
        if(label === "Sounder" || label === "Link" || route === "M599" || route.toUpperCase() === "MSOUNDER") {
            return "Sound Transit";
        } else {
            var agencyIdentifier = (route + '').toUpperCase().match('^MWSF|WSF|M|P|CT|ST|EE');
            if(agencyIdentifier !== null && typeof agencyIdentifier[0] !== 'undefined') {
                agencyIdentifier = agencyIdentifier[0];
                if(agencyIdentifier === "M") {
                    return "King County Metro";
                } else if(agencyIdentifier === "P") {
                    return "Pierce Transit";
                } else if(agencyIdentifier === "ST") {
                    return "Sound Transit";
                } else if(agencyIdentifier === "EE") {
                    return "Everett Transit";
                } else if(agencyIdentifier === "WSF" || agencyIdentifier === "MWSF") {
                    return "Washington State Ferry";
                } else if(agencyIdentifier === "CT") {
                    return "Community Transit";
                }
            } else {
                // if there is no route identifier, it's a CT route, except if it's between 500 and 599. 
                try {
                    var routeNum = parseInt(route,10);
                    if(routeNum >= 500 && routeNum <= 599) {
                        return "Sound Transit";
                    }
                } catch(e) {}
                return "Community Transit";
            }
        }
        return "Unknown Agency";
    }
};