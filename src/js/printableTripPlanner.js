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

OTP.PrintableTripPlanner = function() {
    var map = null;
    var toMap = null;
    var fromMap = null;

    // DOM elements
    var root = jQuery("body");
        
    function makeTripRequest() {
        map.showBusy();
        toMap.showBusy();
        fromMap.showBusy();
        
        jQuery.jsonp({
            callback: "fn",
            url: OTP.Config.atisProxyServiceUrl,
            data: {
                arriveBy: OTP.Util.getParameterByName("arriveBy", false),
                date: OTP.Util.getParameterByName("date", null),
                time: OTP.Util.getParameterByName("time", null),
                optimize: OTP.Util.getParameterByName("optimize", "QUICK"),
                maxWalkDistance: OTP.Util.getParameterByName("maxWalkDistance", null),
                wheelchair: OTP.Util.getParameterByName("wheelchair", false),
                fromPlace: OTP.Util.getParameterByName("fromPlace", null),
                toPlace: OTP.Util.getParameterByName("toPlace", null),
                from: OTP.Util.getParameterByName("from", null),
                to: OTP.Util.getParameterByName("to", null),
                intermediatePlaces: "",
                showIntermediateStops: true,
                mode: OTP.Util.getParameterByName("mode", null)
            },
            success: function(data, status) {
                updatePage(data);

                map.hideBusy();
            },
            error:function(xError, status) {
                map.hideBusy();                
            },
            complete: function(xhr, status) {
                map.hideBusy();                
            }
        });
    }

    function updatePage(data) {
        var itineraryCollection = null;
        if(data.plan.itineraries.itinerary instanceof Array) {
            itineraryCollection = data.plan.itineraries.itinerary;
        } else {
            itineraryCollection = [data.plan.itineraries.itinerary];
        }

        var inineraryIndex = parseInt(OTP.Util.getParameterByName("itineraryIndex", 1));
        if(inineraryIndex === NaN 
            || inineraryIndex < 1 
            || inineraryIndex > itineraryCollection.length) {
            return;
        }
    
        var trip = itineraryCollection[inineraryIndex - 1];
        if(trip === null) {
            return;
        }

        var stepByStepWrapper = root.find("#narrative");
        var startTime, endTime = null;
        jQuery.each(trip.legs.leg, function(legIndex, leg) {
            // leg step by step summary
            stepByStepWrapper.append(OTP.Util.formatLeg(legIndex, leg));
        
            // start/end times
            if(trip.legs.leg.length - 1 === legIndex) {
                endTime = OTP.Util.ISO8601StringToDate(leg.endTime);
            } else if(legIndex === 0) {
                startTime = OTP.Util.ISO8601StringToDate(leg.startTime);
            }
        });

        // from label
        root.find("#from-label").find("h1")
            .text(OTP.Util.getParameterByName("from", null));
    
        root.find("#from-label").find("p")
            .text("")
            .append("Date: " + OTP.Util.dateToPrettyDate(startTime) + "<br/>" + 
                    "Depart: " + OTP.Util.dateToPrettyTime(startTime));

        // to label
        root.find("#to-label").find("h1")
            .text(OTP.Util.getParameterByName("to", null));
    
        root.find("#to-label").find("p")
            .text("")
            .append("Date: " + OTP.Util.dateToPrettyDate(endTime) + "<br/>" + 
                    "Arrive: " + OTP.Util.dateToPrettyTime(endTime));

        // fare label
        var studentFare = "";
        var seniorFare = "";
        var regularFare = "";
        var studentFareORCA = "";
        var seniorFareORCA = "";
        var regularFareORCA = "";
        jQuery(trip.fare.fare.entry).each(function(legIndex) {
            var costInCents = parseInt(this.value.cents, 10);
            var costLabel = null;
            if(costInCents === 0) {
                costLabel = "Fare N/A";
            } else {
                costLabel = "$" + OTP.Util.centsToDollars(costInCents);
            }

            if (this.key === "student") {studentFare = costLabel;}
            else if (this.key === "senior") {seniorFare = costLabel;}
            else if (this.key === "regular") {regularFare = costLabel;}
            else if (this.key === "farecard_student") {studentFareORCA = costLabel;}
            else if (this.key === "farecard_senior") {seniorFareORCA = costLabel;}
            else if (this.key === "farecard_regular") {regularFareORCA = costLabel;}
        });                        

        var wrapper = root.find("#fare").find("ul");
        wrapper.append("<li><span>Adult</span> " + regularFare + " (" + regularFareORCA + ")");
        wrapper.append("<li><span>Youth</span> " + studentFare + " (" + studentFareORCA + ")");
        wrapper.append("<li class='last'><span>Senior / Disabled</span> " + seniorFare + " (" + seniorFareORCA + ")");

        // travel time
        var tripDuration = endTime.getTime() - startTime.getTime();
        var transfers = Math.floor(trip.legs.leg.length / 2) - 1;

        root.find("#travelTime p").text(OTP.Util.millisecondsToString(tripDuration) + ", " 
                + transfers + ' transfer' + ((transfers === 1) ? "" : "s"));

        updateMaps(data, inineraryIndex);
    }

    function updateMaps(data, targetTripNumber) {
        if(data === null) {
            return;
        }

        map.reset();
        toMap.reset();
        fromMap.reset();

        var itineraryCollection = null;
        if(data.plan.itineraries.itinerary instanceof Array) {
            itineraryCollection = data.plan.itineraries.itinerary;
        } else {
            itineraryCollection = [data.plan.itineraries.itinerary];
        }

        var trip = itineraryCollection[targetTripNumber - 1];
        if(trip === null) {
            return;
        }

        var legStops = [];
        jQuery.each(trip.legs.leg, function(legIndex, leg) {
            // add leg + markers to map
            map.addLegToPlannedRoute(leg);
            map.addLegInfoMarker(leg, null);

            toMap.addLegToPlannedRoute(leg);
            toMap.addLegInfoMarker(leg, null);

            fromMap.addLegToPlannedRoute(leg);
            fromMap.addLegInfoMarker(leg, null);

            if(typeof leg.intermediateStops !== 'undefined' && leg.intermediateStops !== null) {
                var intermediateStops = null;
                if(leg.intermediateStops.stop instanceof Array) {
                    intermediateStops = leg.intermediateStops.stop;
                } else {
                    intermediateStops = [leg.intermediateStops.stop];
                }
                jQuery.each(intermediateStops, function(_, stop) {
                    legStops.push(stop.stopId);
                });
            }

            // add start finish icons to map
            if(trip.legs.leg.length - 1 === legIndex) {
                map.setEndPoint(leg.to.lon, leg.to.lat);
                toMap.setEndPoint(leg.to.lon, leg.to.lat);
                toMap.zoomAroundPoint(new OpenLayers.LonLat(leg.to.lon, leg.to.lat));
            } else if(legIndex === 0) {
                map.setStartPoint(leg.from.lon, leg.from.lat);
                fromMap.setStartPoint(leg.from.lon, leg.from.lat);
                fromMap.zoomAroundPoint(new OpenLayers.LonLat(leg.from.lon, leg.from.lat));
            }
        });

        map.addStopsWithIds(legStops);
        map.zoomToPlannedRoute();

        toMap.addStopsWithIds(legStops);
        fromMap.addStopsWithIds(legStops);
    }

    // UI behaviors
    function addUIBehavior() {
        root.find("#print").click(function() {
            window.print();
            return false;
        });

        root.find("#map_text, #map_only, #text_only").click(function() {
            root.removeClass()
                .addClass(jQuery(this).attr("id"));
    
            jQuery("#map_text, #map_only, #text_only")
                .removeClass();
                
            var activeLink = jQuery(this);
            
            activeLink.addClass("selected");

            // HACK for IE. OpenLayers and IE don't play nicely, because 
            // OpenLayers seems to set some explicit "display" rule on its
            // map containers that confuses IE, even if the container is set 
            // to hidden. 
            if(activeLink.attr("id") === "text_only") {
                setTimeout(function() {
                    jQuery("#toDetailMap").hide();
                    jQuery("#fromDetailMap").hide();
                }, 100);
            } else {
                jQuery("#toDetailMap").show();
                jQuery("#fromDetailMap").show();
            }
            
            return false;
        });
    }
    
    // constructor
    map = OTP.Map(
        document.getElementById("map"),
        null,
        { hasTripPlanner: true, inert: true }
    );

    toMap = OTP.Map(
        document.getElementById("toDetailMap"),
        null,
        { hasTripPlanner: true, inert: true }
    );

    fromMap = OTP.Map(
        document.getElementById("fromDetailMap"),
        null,
        { hasTripPlanner: true, inert: true }
    );

    addUIBehavior();
    makeTripRequest();

    return {};
};