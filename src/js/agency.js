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
    getDirectionLabelForDirectionCode: function(direction) {
        switch(direction) {
            case "S":
                return "Southbound";
            case "N":
                return "Northbound";
            case "W":
                return "Westbound";
            case "E":
                return "Eastbound";
            case "L":
                return "Local";
            case "E":
                return "Express";
            case "O":
                return "Outbound";
            case "I":
                return "Inbound";
            default:
                return "Unknown Direction";
        }
    },
    
    getFormattedHeadsign: function(route, headsign) {
        if(headsign === null || route === null) {
            return null;
        }

        // (special case to get a better headsign value)
        if(route === "PTLDTC") {
            route = "PTacoma Link Light Rail -";
        }
        
        return jQuery.trim(headsign.replace(route, ""));
    },
    
    getScheduleURLForLeg: function(mode, route, operatorId, stops, rawRoute) {
        if(operatorId === "M" || operatorId === "MT") {
            var paddedRoute = "" + route;
            while(paddedRoute.length < 3) {
                paddedRoute = "0" + paddedRoute;
            }
            return "http://metro.kingcounty.gov/tops/bus/schedules/s" + paddedRoute + "_0_.html";
        } else if(operatorId === "PT") {
            return "http://www.piercetransit.org/schedules/" + route + "/" + route + ".htm";
        } else if(operatorId === "ST" || operatorId === "SDR" || operatorId === "LLR") {
            if(mode === "Bus") {
                return "http://www.soundtransit.org/Schedules/ST-Express-Bus/" + route + ".xml";
            } else if(mode === "Link") {
                if(rawRoute === "M599") {
                    return "http://www.soundtransit.org/Schedules/Central-Link-light-rail.xml";
                } else if(rawRoute === "PTLDTC") {
                    return "http://www.soundtransit.org/Schedules/Tacoma-Light-Link-Rail.xml";
                }
            } else if(mode === "Sounder") {
                if(stops === 7) {
                    return "http://www.soundtransit.org/Schedules/Sounder-Tacoma-Seattle.xml";
                } else if(stops === 4) {
                    return "http://www.soundtransit.org/Schedules/Sounder-Everett-Seattle.xml";
                }
            }
        } else if(operatorId === "ET") {
            return "http://www.everettwa.org/default.aspx?ID=299";
        } else if(operatorId === "WSF" || operatorId === "MWSF") {
            return "http://www.wsdot.com/ferries/schedule/Default.aspx";
        } else if(operatorId === "CT") {
            return "http://www.commtrans.org/BusService/Schedule.cfm?route=" + route;
        }
        return "http://www.soundtransit.org";
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
            } else if(mode === "LINK" || route === "M599" || route === "TLDTC" || route === "PTLDTC") {
                return "Link";
            } else {
                // For now, street cars appear as/along with buses. (FIXME)
                //return "Streetcar";
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

        var agencyIdentifier = (route + '').toUpperCase().match('^MWSF-|WSF-|M|P|IT|CT|ST|EE');
        if(agencyIdentifier !== null && typeof agencyIdentifier[0] !== 'undefined') {
            route = route.substring(agencyIdentifier[0].length);
        }

        if(route.toUpperCase() === "SOUNDER") {
            return "Sounder";
        } else if((agencyIdentifier !== null && typeof agencyIdentifier[0] !== 'undefined' 
                    && agencyIdentifier[0] === "M" && route === "599") 
                    || route.toUpperCase() === "TLDTC" || route.toUpperCase() === "PTLDTC") {

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
    
    getURLForLeg: function(operatorId, route) {
        if(operatorId === null) {
            return null;
        }

        if(operatorId === "M" || operatorId === "MT") {
            return "http://metro.kingcounty.gov/";
        } else if(operatorId === "IT") {
            var agencyIdentifier = (route + '').toUpperCase().match('^MWSF-|WSF-|M|P|IT|CT|ST|EE');
            if(agencyIdentifier !== null && typeof agencyIdentifier[0] !== 'undefined') {
                route = route.substring(agencyIdentifier[0].length);
            }
            if(route === "411") {
                return "http://www.islandtransit.org/";
            }
            return "http://www.intercitytransit.com/";
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

    getAgencyNameForLeg: function(operatorId, route) {
        if(operatorId === null) {
            return null;
        }

        if(operatorId === "M" || operatorId === "MT") {
            return "King County Metro";
        } else if(operatorId === "IT") {
            var agencyIdentifier = (route + '').toUpperCase().match('^MWSF-|WSF-|M|P|IT|CT|ST|EE');
            if(agencyIdentifier !== null && typeof agencyIdentifier[0] !== 'undefined') {
                route = route.substring(agencyIdentifier[0].length);
            }
            if(route === "411") {
                return "Island Transit";
            }
            return "Intercity Transit";
        } else if(operatorId === "PT") {
            return "Pierce Transit";
        } else if(operatorId === "ST" || operatorId === "SDR" || operatorId === "LLR") {
            return "Sound Transit";
        } else if(operatorId === "ET") {
            return "Everett Transit";
        } else if(operatorId === "WSF" || operatorId === "MWSF") {
            return "Washington State Ferries";
        } else if(operatorId === "CT") {
            return "Community Transit";
        }
        return "Unknown Agency";
    }
};