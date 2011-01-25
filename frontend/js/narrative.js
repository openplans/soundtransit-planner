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

OTP.Narrative = function(_root, _map, _mapControlsRoot) {
    if(typeof _root === 'undefined' || _root === null) {
        return null;
    }

    // DOM elements
    var root = jQuery(_root);
    var map = null;

    // the response from the server--passed to updateMap when
    // user selects a second route without a new trip plan request
    var plannerResponse = null;

    // formatting 
    // FIXME: potential timezone issues?
    function ISO8601StringToDate(str) {
        if(str === null) {
            return null;
        }
        
        // adapted from http://anentropic.wordpress.com/2009/06/25/javascript-iso8601-parser-and-pretty-dates/
        var parts = str.split('T'),
        dateParts = parts[0].split('-'),
        timeParts = parts[1].split('-'),
        timeSubParts = timeParts[0].split(':'),
        timeSecParts = timeSubParts[2].split('.'),
        timeHours = Number(timeSubParts[0]),

        _date = new Date();
        _date.setFullYear(Number(dateParts[0]));
        _date.setMonth(Number(dateParts[1])-1);
        _date.setDate(Number(dateParts[2]));
        _date.setHours(Number(timeHours));
        _date.setMinutes(Number(timeSubParts[1]));
        _date.setSeconds(Number(timeSecParts[0]));
        if (timeSecParts[1]) {
            _date.setMilliseconds(Number(timeSecParts[1]));
        }

        return _date;
    }

    function millisecondsToString(duration) {
        var msecondsPerMinute = 1000 * 60;
        var msecondsPerHour = msecondsPerMinute * 60;

        try {
            duration = parseFloat(duration);
            
            if(isNaN(duration)) {
                return "Unknown";
            }
        } catch(e) {
            return "Unknown";
        }

        var hours = Math.floor(duration / msecondsPerHour);
        var interval = duration - (hours * msecondsPerHour);
        var minutes = Math.floor(interval / msecondsPerMinute);

        var hourString = (hours > 0) ? ((hours === 1) ? hours + " hour, " : hours + " hours, ") : false;
        var minuteString = minutes + " min";

        if(hourString) {
            return hourString + minuteString;
        } else {
            return minuteString;
        }
    }

    function centsToDollars(n) {
        try {
            return parseFloat(n/100).toFixed(2);
        } catch(e) {
            return null;
        }
    }

    function metersToMiles (n) {
        try {
            return parseFloat(n / 1609.344).toFixed(1);
        } catch(e) {
            return null;
        }
    }

    function metersToFeet(meters) {
        try {
            return parseInt(meters * 3.2808, 10);
        } catch(e) {
            return null;
        }
    }

    function prettyDistance(meters) {
        if (meters === null || typeof meters === 'undefined') {
            return "Unknown";
        }

        var miles = metersToMiles(meters);

        if(miles === null) {
            return "Unknown";
        }

        // Display distances < 0.1 miles in feet
        if (miles < 0.1) {
            var feet = metersToFeet(meters);
            
            if(feet === null) {
                return "Unknown";
            }
            
            return feet + " ft";
        } else {
            return miles + " mi";
        }
    }

    function prettyTime(dateObject) {
        if(dateObject === null) {
            return "Unknown";
        }
        
        var minutes = dateObject.getMinutes();
        minutes = (minutes < 10) ? "0" + minutes : "" + minutes;

        var hours = dateObject.getHours();
        var amOrPm = "";

        if(hours >= 12) {
            if(hours > 12) {
                hours = hours - 12;
            }
            amOrPm = "pm";
        } else {
            if(hours === 0) {
                hours = 12;
            }
            amOrPm = "am";
        }
        return hours + ":" + minutes + amOrPm;
    }

    function prettyCase(string) {
        // make sentence case
        return string.toLowerCase().replace(/(^\s*\w|[\.\!\?]\s*\w)/g,function(c){return c.toUpperCase();});
    }

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

    function getRouteName(route) {
        if(route === null) {
            return "Unknown";
        }

        var agencyIdentifier = (route + '').toUpperCase().match('^[M|P|CT|ST]');

        if(agencyIdentifier !== null && typeof agencyIdentifier[0] !== 'undefined') {
            return route.substring(agencyIdentifier[0].length);
        } else {
            return route;
        }
    }

    // narrative logic
    function makeTripRequest() {
        // remove ambiguous classes, since we don't know whether the new values are resolvable
        root.find('#to, #from').removeClass('ambiguous');
        
        // planning spinner and text
        root.find('#trip-data')
            .fadeOut("fast", function() {
                $(this)
                    .html('<div id="trip-spinner">Planning your trip</div>')
                    .fadeIn("fast");
                });
        
        // Prevent garbage time values from giving false negative for trips
        if (isNaN(parseInt(root.find('#leavehour').val())) || isNaN(parseInt(root.find('#leaveminute').val()))) {
            var now = new Date();
            root.find('#leavehour')
                .val((now.getHours() > 12) ? (now.getHours() - 12) : ((now.getHours() === 0) ? 12 : now.getHours()));
            
                 root.find('#leaveminute').val(now.getMinutes()).change();
        }

        jQuery.jsonp({
            callback: "fn",
            url: OTP.Config.atisProxyServiceUrl,
            data: {
                arriveBy: (root.find("#leavetype").val() === "Arrive By"),
                date: root.find("#leaveday").val(),
                time: root.find("#leavehour").val() + ":" + root.find("#leaveminute").val() + " " + root.find("#leaveampm").val(),
                optimize: root.find("#trippriority").val(),
                maxWalkDistance: root.find("#maxwalk").val(),
                wheelchair: (root.find("#accessible").attr("checked") === true),
                from: root.find("#from").val(),
                to: root.find("#to").val(),
                toPlace: root.find("#to").val(),
                fromPlace: root.find("#from").val(),
                intermediatePlaces: "",
                showIntermediateStops: true,
                mode: "TRANSIT,WALK"
            },
            success: function(data, status) {    
                if (typeof data.geocodeResponse !== 'undefined') {
                    map.reset();
                    disambiguateResults(data.geocodeResponse);
                } else {
                    root.find('#trip-data')
                        .fadeOut("fast")
                        .empty();

                    updateNarrative(data);
                    addNarrativeUIBehavior();

                    root.find('#trip-data')
                        .fadeIn("fast");
                }
            },
            error:function(xError, status) {                
                root.find("#trip-data")
                    .html(
                        '<div id="no-results">' + 
                        '<h3>We\'re sorry!</h3>' + 
                        '<p>Something went wrong when trying to plan your trip&mdash;try your request again later.</p>' + 
                        '</div>');
            }
        });
    }

    // FIXME: better (pluggable?) system for handling special route formatting cases? e.g. color, icons, formatting, etc.?
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

    function updateNarrative(data) {
        // error returned
        if(typeof data.error !== 'undefined') {
            var msg = "<p>Something went wrong when trying to plan your trip.</p>";

            var errorId_r = data.error.msg.match(/[0-9]*/ig);
            if(errorId_r !== null && typeof errorId_r[1] !== 'undefined') {
                var errorId = errorId_r[1];
                switch (errorId) {
                    case '11085':
                        msg = "<p>The trip start and end points are too close for us to plan a trip for you. Please change your origin and/or destination and try again.</p>";
                        break;
                    case '20003':
                        msg = "<p>No transit stops are within walking distance of your desired starting point. Please change your origin by dragging the marker or typing in a new address and try again.</p>";
                        break;
                    case '20004':
                        msg = "<p>No transit stops are within walking distance of your desired destination. Please change your trip's end point by dragging the marker or typing in a new address and try again.</p>";
                        break;
                    case '20007':
                        msg = "<p>We were unable to find a trip that meets your specifications. Try changing the date and time of your trip, the start and end locations or check the schedule.</p>";
                        break;
                    case '20008':
                        msg = "<p>No transit available for this trip at the time you've requested. Please change the time above and try again.</p>";
                        break;
                    default:
                        msg = "<p>Something went wrong when trying to plan your trip&mdash;the system reported '" + data.error.msg + "'</p>";
                        break;
                }
            }
            
            root.find("#trip-data")
                .html(
                    '<div id="no-results">' + 
                    '<h3>We\'re sorry!</h3>' + 
                     msg + 
                    '</div>');

            return;
        }

        // trip summary header
        var tripSummariesMarkup = jQuery('<table id="tripresult-summaries">' + 
                                            '<thead><tr><th>Trip</th><th>Travel Time</th><th>Cash</th><th>Route &amp; Transfers</th><tr></thead>' + 
                                            '<tbody></tbody>' + 
                                            '</table>');

        var itineraryCollection = null;
        if(typeof data.plan.itineraries.itinerary.duration !== 'undefined') {
            itineraryCollection = [data.plan.itineraries.itinerary];
        } else {
            itineraryCollection = data.plan.itineraries.itinerary;
        }

        var tripIndex = 0;
        jQuery.each(itineraryCollection, function(_, trip) {
            var tripNumber = tripIndex + 1;
            var tripModes = [];

            // transfers for this trip
            var transfers = Math.floor(trip.legs.leg.length / 2) - 1;

            // fares for this trip
            var studentFare = "";
            var seniorFare = "";
            var regularFare = "";
            var studentFareORCA = "";
            var seniorFareORCA = "";
            var regularFareORCA = "";
            jQuery(this.fare.fare.entry).each(function(legIndex) {
                if (this.key == "student") {studentFare = parseInt(this.value.cents, 10);}
                if (this.key == "senior") {seniorFare = parseInt(this.value.cents, 10);}
                if (this.key == "regular") {regularFare = parseInt(this.value.cents, 10);}
                if (this.key == "farecard_student") {studentFareORCA = parseInt(this.value.cents, 10);}
                if (this.key == "farecard_senior") {seniorFareORCA = parseInt(this.value.cents, 10);}
                if (this.key == "farecard_regular") {regularFareORCA = parseInt(this.value.cents, 10);}
            });

            var tripWrapper = jQuery("<div></div>")
                                .addClass("results")
                                .attr("id", "trip" + tripNumber + "-results");
                            
            // step by step directions for this trip
            var itineraryMarkup = jQuery('<ul class="trip-stepbystep"></ul>');

            var startTime = null;
            var endTime = null;
            var tripDuration = 0;
            jQuery.each(trip.legs.leg, function(legIndex, leg) {                  
                // leg mode icons for this trip
                if(isSounder(leg["@route"])) {
                    tripModes.push('<img src="img/otp/sounder16x16.png" alt="Sounder" /> <strong>Sounder</strong> ');

                } else if(isTheLink(leg["@route"])) {
                    tripModes.push('<img src="img/otp/link16x16.png" alt="Link" /> <strong>Link</strong> ');

                } else {
                    var modeText = '<img src="img/otp/' + leg["@mode"].toLowerCase() + '16x16.png" alt="' + leg["@mode"] + '" /> ';

                    if(leg["@mode"] !== "WALK") {
                        modeText += '<strong>' + getRouteName(leg["@route"]) + '</strong> ';
                    }
                    
                    tripModes.push(modeText);                    
                }

                // leg descriptions for this trip
                itineraryMarkup.append((leg["@mode"] === "WALK") ? formatWalkLeg(legIndex, leg) : formatTransitLeg(legIndex, leg));

                // end time, start time, duration across this trip for use in trip summary 
                if(! isNaN(leg.duration) && typeof leg.duration !== 'undefined') {
                    try {
                        tripDuration += parseInt(leg.duration, 10);
                    } catch(e) {}
                }

                if(typeof leg.startTime !== 'undefined' && leg.startTime !== null) {
                    var legStartTime = ISO8601StringToDate(leg.startTime);
                    if(startTime === null || legStartTime < startTime) {
                        startTime = legStartTime;
                    }
                }

                if(typeof leg.endTime !== 'undefined' && leg.endTime !== null) {
                    var legEndTime = ISO8601StringToDate(leg.endTime);
                    if(endTime === null || legEndTime > endTime) {
                        endTime = legEndTime;
                    }
                }
            });

            // set initial selection class/map display
            var activeClass = "";
            if(tripNumber === 1) {
                activeClass = "active";
                tripWrapper.addClass("active");

                updateMap(data, tripNumber);
            }

            // trip summary header
            jQuery('<tr id="trip' + tripNumber + '-summary" class="'+ activeClass + '">' +
                    '<td class="trip-id">' + tripNumber + '</td>' +
                    '<td>' + millisecondsToString(tripDuration) + '<em>' + ((startTime !== null) ? prettyTime(startTime) : "Unknown") + ' - ' + ((endTime !== null) ? prettyTime(endTime) : "Unknown") + '</em></td>' + 
                    '<td>$' + centsToDollars(regularFare) + '</td>' + 
                    '<td class="trip-modes">' + tripModes.join("<em>›</em> ") + '</td>' + 
                    '</tr>')
                    .appendTo(tripSummariesMarkup.children('tbody'));

            // trip descripton: price header
            jQuery('<table class="trip-prices">' + 
                    '<thead><tr><th><h3>Trip ' + tripNumber + '</h3></th><th colspan="2">' + millisecondsToString(tripDuration) + ', ' + transfers + ' Transfer' + ((transfers === 1) ? "" : "s") + '</th></tr></thead>' + 
                    '<tbody>' + 
                    '<tr><th scope="row">Adult</th><td>$' + centsToDollars(regularFare) + ' Cash</td><td>$' + centsToDollars(regularFareORCA) + ' <a href="http://www.orcacard.com/">ORCA</a></td></tr>' +
                    '<tr><th scope="row">Youth</th><td>$' + centsToDollars(studentFare) + ' Cash</td><td>$' + centsToDollars(studentFareORCA) + ' <a href="http://www.orcacard.com/">ORCA</a></td></tr>' + 
                    '<tr><th scope="row">Senior / Disabled</th><td>$' + centsToDollars(seniorFare) + ' Cash</td><td>$' + centsToDollars(seniorFareORCA) + ' <a href="http://www.orcacard.com/">ORCA</a></td></tr>' + 
                    '</tbody></table>')
                    .appendTo(tripWrapper);

            jQuery(itineraryMarkup)
                .appendTo(tripWrapper);

            // hack to support IE7 last-child selector
            jQuery(".trip-stepbystep li:last-child").addClass("last-child");

            tripWrapper
                .appendTo(root.find("#trip-data"));

            tripIndex++;
        }); // each trip
        
        jQuery(tripSummariesMarkup)
            .prependTo(root.find("#trip-data"));

        // (save map data for later calls to updateMap HACK)
        plannerResponse = data;
    }

    function updateMapForHover(data, targetTripNumber) {
        var itineraryCollection = null;
        if(typeof data.plan.itineraries.itinerary.duration !== 'undefined') {
            itineraryCollection = [data.plan.itineraries.itinerary];
        } else {
            itineraryCollection = data.plan.itineraries.itinerary;
        }

        // draw each leg on map
        var tripNumber = 1;
        jQuery.each(itineraryCollection, function(_, trip) {
            if(tripNumber === targetTripNumber) {
                jQuery.each(trip.legs.leg, function(legIndex, leg) {
                    // add each travel leg to map
                    if(isSounder(leg["@route"])) {
                        map.addLegToHoverRoute(leg, "SOUNDER");
                    } else if(isTheLink(leg["@route"])) {
                        map.addLegToHoverRoute(leg, "LINK");
                    } else {
                        map.addLegToHoverRoute(leg, leg["@mode"]);
                    }
                });
            }
            
            tripNumber++;
        });
    }

    function updateMap(data, targetTripNumber) {
        if(data === null) {
            return;
        }

        map.reset();

        var itineraryCollection = null;
        if(typeof data.plan.itineraries.itinerary.duration !== 'undefined') {
            itineraryCollection = [data.plan.itineraries.itinerary];
        } else {
            itineraryCollection = data.plan.itineraries.itinerary;
        }

        // draw each leg on map
        var tripNumber = 1;
        jQuery.each(itineraryCollection, function(_, trip) {
            if(tripNumber === targetTripNumber) {
                jQuery.each(trip.legs.leg, function(legIndex, leg) {
                    var lonlat = new OpenLayers.LonLat(leg.from.lon, leg.from.lat);

                    // add each travel leg to map
                    if(isSounder(leg["@route"])) {
                        map.addLegToPlannedRoute(leg, "SOUNDER");
                        map.addLegInfoMarker(getRouteName(leg["@route"]), "SOUNDER", getLegMarkerInfoWindowHtml(leg), lonlat);
                    } else if(isTheLink(leg["@route"])) {
                        map.addLegToPlannedRoute(leg, "LINK");
                        map.addLegInfoMarker(getRouteName(leg["@route"]), "LINK", getLegMarkerInfoWindowHtml(leg), lonlat);
                    } else {
                        map.addLegToPlannedRoute(leg, leg["@mode"]);
                        map.addLegInfoMarker(getRouteName(leg["@route"]), leg["@mode"], getLegMarkerInfoWindowHtml(leg), lonlat);
                    }

                    // add start finish icons to map
                    if(trip.legs.leg.length - 1 === legIndex) {
                        map.setEndPoint(leg.to.lon, leg.to.lat);
                    } else if(legIndex === 0) {
                        map.setStartPoint(leg.from.lon, leg.from.lat);
                    }
                });

                map.zoomToPlannedRoute();
            }
            
            tripNumber++;
        });
    }

    function getLegMarkerInfoWindowHtml(leg) {
        if(leg === null || leg["@mode"] === "WALK") {
            return null;
        }

        // previous stop at end point + stops passed on leg
        var stopsPassed = -1;
        var previousToStop = "unknown";

        if(typeof leg.intermediateStops !== 'undefined' && leg.intermediateStops !== null) {
            var intermediateLegs = null;
            if(typeof leg.intermediateStops.stop.name !== 'undefined') {
                intermediateLegs = [leg.intermediateStops.stop];
            } else {
                intermediateLegs = leg.intermediateStops.stop;
            }
        
            if(intermediateLegs.length >= 1) {
                previousToStop = intermediateLegs[intermediateLegs.length - 1].name;
                stopsPassed = intermediateLegs.length;
            }
        }

        return jQuery('<table class="substeps"><tbody>' + 
                        '<tr><td>' + prettyTime(ISO8601StringToDate(leg.startTime)) + '</td><td>Depart ' + ((leg.from.name !== null) ? leg.from.name : "Unknown") + '</div></td></tr>' + 
                        '<tr><td>' + prettyTime(ISO8601StringToDate(leg.endTime)) + '</td><td>Arrive ' + ((leg.to.name !== null) ? leg.to.name : "Unknown") + 
                            '<div class="stepmeta">' +
                                millisecondsToString(leg.duration) + ((stopsPassed >= 0) ? ' (' + stopsPassed + ' stop' + ((stopsPassed === 1) ? '' : 's') + ')' : '') +
                                '<br />Previous stop is ' + previousToStop + 
                            '</div>' + 
                        '</td></tr>' + 
                    '</tbody></table>');
    }

    function formatWalkLeg(legIndex, leg) {
        return jQuery('<li class="walk leg-' + legIndex + '"></li>').html(
                    '<img class="mode-icon" src="img/otp/walk16x16.png" alt="Walk" />' +
                    'Walk from <strong>' + ((leg.from.name !== null) ? leg.from.name : "Unknown") + '</strong> to <strong>' + ((leg.to.name !== null) ? leg.to.name : "Unknown") + '</strong>' + 
                    '<div class="stepmeta">' + millisecondsToString(leg.duration) + ' (' + prettyDistance(leg.distance) + ')</div>');
    }

    function formatTransitLeg(legIndex, leg) {
        // determine key that will be used to display mode icons
        var displayType = leg["@mode"];
        
        if(isSounder(leg["@route"])) {
            displayType = 'Sounder';
        } else if(isTheLink(leg["@route"])) {
            displayType = 'Link';
        }

        // previous stop at end point + stops passed on leg
        var stopsPassed = -1;
        var previousToStop = "unknown";

        if(typeof leg.intermediateStops !== 'undefined' && leg.intermediateStops !== null) {
            var intermediateLegs = null;
            if(typeof leg.intermediateStops.stop.name !== 'undefined') {
                intermediateLegs = [leg.intermediateStops.stop];
            } else {
                intermediateLegs = leg.intermediateStops.stop;
            }
        
            if(intermediateLegs.length >= 1) {
                previousToStop = intermediateLegs[intermediateLegs.length - 1].name;
                stopsPassed = intermediateLegs.length;
            }
        }
        
        return jQuery('<li class="' + displayType.toLowerCase() + ' leg-' + legIndex + '"></li>').html(
                    '<img class="mode-icon" src="img/otp/' + displayType.toLowerCase() + '16x16.png" alt="' + displayType + '" />' + prettyCase(leg["@mode"]) + ' - ' + getAgencyForRoute(leg["@route"], true) + ' <strong>' + getRouteName(leg["@route"]) + '</strong>' +
                    '<table class="substeps"><tbody>' + 
                    '<tr><td>' + prettyTime(ISO8601StringToDate(leg.startTime)) + '</td><td>Depart ' + ((leg.from.name !== null) ? leg.from.name : "Unknown") + '</div></td></tr>' + 
                    '<tr><td>' + prettyTime(ISO8601StringToDate(leg.endTime)) + '</td><td>Arrive ' + ((leg.to.name !== null) ? leg.to.name : "Unknown") + 
                        '<div class="stepmeta">' +
                            millisecondsToString(leg.duration) + ((stopsPassed >= 0) ? ' (' + stopsPassed + ' stop' + ((stopsPassed === 1) ? '' : 's') + ')' : '') +
                            '<br />Previous stop is ' + previousToStop + 
                        '</div>' + 
                    '</td></tr>' + 
                    '</tbody></table>');
    }

    // disambiguation
    function disambiguateResults(results) {
        var candidateList = null;
        var locationType = null;
        var friendlyLocationType = null;
                     
        if(typeof results.from !== 'undefined' && results.from.candidate instanceof Array) {
            candidateList = results.from.candidate;
            locationType = "from";
            friendlyLocationType = "starting";
        } else if(typeof results.to !== 'undefined' && results.to.candidate instanceof Array) {
            candidateList = results.to.candidate;
            locationType = "to";
            friendlyLocationType = "ending";
        } else {
            return;
        }
        // if we're here, we have a list of things to disambiguate:

		map.reset();
        
        var disambiguateMarkup = jQuery('<div id="' + locationType + '-possibles">' + 
                                            '<h3>We found several ' + friendlyLocationType + ' points for your search</h3>' + 
                                            '<h4>Did you mean?</h4>' + 
                                        '</div>');

        var list = jQuery('<ol></ol>');
        jQuery(candidateList).each(function(i, result) {
            if (i >= 9) {
                return false;
            }
        
            var link = jQuery('<a href="#">select</a>').click(function() {
                delete results[locationType];
                userHasDisambiguated(locationType, jQuery(this).parent().children('span.lat-lon').text(), results);
                return false;
            });

            jQuery('<li class="possible-' + (i + 1) + '">' + 
                        '<span class="nice-name">' + result.name + ', ' + result.area + '</span>' + 
                            '<span class="lat-lon" style="display: none;">' + result.latitude + ',' + result.longitude + '</span>' + 
                    '</li>')
                    .mouseenter(function() { 
                        map.highlightDisambiguationPoint(i + 1);
                    })
                    .mouseleave(function() { 
                        map.unhighlightDisambiguationPoint(i + 1);
                    }).click(function() {
                        delete results[locationType];
                        userHasDisambiguated(locationType, jQuery(this).children('span.lat-lon').text(), results);
                        return false;
                    })
                    .append(link)
                    .appendTo(list);
                    
            map.addDisambiguationPoint(result.latitude, result.longitude, (i + 1));
        });
            
        map.zoomToDisambiguationExtent();
            
        var disambiguateResults = root.find("#disambiguate-results");
        if(disambiguateResults.length === 0) {
            disambiguateResults = jQuery("<div></div>")
                .attr("id", "disambiguate-results")
                .appendTo(root.find("#trip-data").empty());
        }
            
        disambiguateResults
            .append(disambiguateMarkup.append(list));
                
        root.find('#' + locationType)
            .addClass("ambiguous")
            .focus();
    }

    function userHasDisambiguated(location, value, disambiguationResponse) {
        root.find('#' + location )
                .val(value)
                .removeClass('ambiguous');

        root.find('#' + location + '-possibles').fadeOut('slow', function() { 
            jQuery(this).remove();

            // more disambiguation to do still?
            if((typeof disambiguationResponse.from !== 'undefined' && disambiguationResponse.from.candidate instanceof Array) || 
                (typeof disambiguationResponse.to !== 'undefined' && disambiguationResponse.to.candidate instanceof Array)) {

                disambiguateResults(disambiguationResponse);
            } else {
                map.reset();
                root.find("form#trip-plan-form").submit();
            }
        });
    }

    // event handlers
    function updateToLocation(point, submitForm) {
        if(point !== null) {
            root.find("#to")
                .val(parseFloat(point.lat).toFixed(6) + "," + parseFloat(point.lon).toFixed(6))
                .removeClass('blank');

            if(submitForm === true) {
               root.find("form#trip-plan-form")
                    .submit();
            }
        }
    }

    function updateFromLocation(point, submitForm) {
        if(point !== null) {
            root.find("#from")
                .val(parseFloat(point.lat).toFixed(6) + "," + parseFloat(point.lon).toFixed(6))
                .removeClass('blank');            

            if(submitForm === true) {
               root.find("form#trip-plan-form")
                    .submit();
            }
        }        
    }

    // behaviors
    function addFormUIBehavior() {
        var setBlankClassIfEmpty = function(element) { 
            if(jQuery(element).val() === "") {
                jQuery(element).addClass('blank');
            } else {
                jQuery(element).removeClass('blank');
            }
        };

        
        var zeroPad = function(value) { 
            return (parseInt(value, 10) < 10) ? ("0" + value.toString()) : value;
        };
        
        var incrementAtMax = function(element) {
            var hoursField = root.find('#leavehour');
            var ampmField = root.find('#leaveampm');
            
            if (parseInt(hoursField.val()) > 11) {
                hoursField.val(1);
            } else {
                hoursField.val(parseInt(hoursField.val()) + 1);
                if (hoursField.val() == 12) {
                    ampmField.val((ampmField.val() == 'am') ? 'pm' : 'am').trigger('change');
                }
            }
            element.val('0');
        }

        var decrementAtMin = function(element) {
            var hoursField = root.find('#leavehour');
            
            var ampmField = root.find('#leaveampm');
            
            if (parseInt(hoursField.val()) < 2) {
                hoursField.val(12);
            } else {
                hoursField.val(parseInt(hoursField.val()) - 1);
                if (hoursField.val() == 11) {
                    ampmField.val((ampmField.val() == 'am') ? 'pm' : 'am').trigger('change');
                }
            }
            element.val('59');
        }

        // clear button behavior
        root.find('#clear').click(function() {
            root.find('#to, #from')
                .val("")
                .removeClass('ambiguous')
                .each(function() {
                    setBlankClassIfEmpty(this);
                });
                
            root.find("#disambiguation")
                .fadeOut('slow')
                .empty();
                
            root.find('#trip-data')
                .fadeOut('slow')
                .empty()
                .html(
                    '<div id="how-to-plan">' +
                    '<h3>2 Ways to Plan Your Trip</h3>' +
                    '<h4>1. Enter your start and end locations.</h4>' +
                    '<p>Enter your origin and destination above (don\'t use city or zip) then select "Plan Trip".</p>' +
                    '<h4>2. Pick points on the map.</h4>' +
                    '<p>Right-click on the map to set the Start and End locations, then select "Plan Trip".</p>' +
                    '</div>')
                 .fadeIn('slow');
                     
            map.reset();
            
            return false;
        });
  
        // to/from
        root.find('#to, #from')
            .bind('blur', function() {
                setBlankClassIfEmpty(this);
                jQuery(this).removeClass('focus');
            })
            .bind('focus', function() {
                jQuery(this).addClass('focus');
            })
            .each(function() {
                setBlankClassIfEmpty(this); // Initialize to/from blank state
            });
        
        // to/from toggle
        root.find("#tofromtoggle").click(function() {
            var tempSwapVal = root.find("#from").val();

            // FIXME: breaks the setBlankClassIfEmpty function (trying to swap disambiguous classes)
            var tempSwapClass = root.find("#from").attr("class");
            root.find("#from").removeClass().addClass(root.find("#to").attr("class"));
            root.find("#to").removeClass().addClass(tempSwapClass);

            root.find("#from").val(root.find("#to").val())
                .each(function() {
                    setBlankClassIfEmpty(this);
                });

            root.find("#to").val(tempSwapVal)
                .each(function() {
                    setBlankClassIfEmpty(this);
                });

            return false;
        });
  
        // date pickers
        var now = new Date();
 
        root.find("#leaveday")
            .val(zeroPad(now.getMonth() + 1) + "/" + zeroPad(now.getDate()) + "/" + now.getFullYear())
            .datepicker({
                showOn: "button",
                buttonImage: "img/otp/calendar.png",
                buttonImageOnly: true
            });
  
        root.find('#leavehour')
            .val((now.getHours() > 12) ? (now.getHours() - 12) : ((now.getHours() === 0) ? 12 : now.getHours()));

        root.find('#leaveminute')
            .spinner({ 
                min: 0, 
                max: 59, 
                increment: 'fast', 
                onIncrementWhenMax: function(element) { 
                    incrementAtMax(element);
                }, 
                onDecrementWhenMin: function(element) { 
                    decrementAtMin(element);
                }
            })
            .bind('change', function(event, ui) {
                this.value = zeroPad(this.value);
            })
            .val(zeroPad(now.getMinutes()));

        if (now.getHours() >= 12) {
            root.find('#leaveampm option[value="pm"]')
                .attr('selected', 'selected');
        }          

        root.find("#leavetype, #leaveampm, #trippriority, #maxwalk").selectmenu();

        // more options
        root.find('a#optionstoggle').click(function() {
            if (jQuery(this).hasClass('active')) {
                root.find('#moreoptions').hide();

                jQuery(this).html('More Options<span> </span>')
                    .removeClass('active');
            } else {
                root.find('#moreoptions').show();

                jQuery(this).html('Fewer Options<span> </span>')
                    .addClass('active');
            }
            
            return false;
        });

        // form submit action
        root.find("form#trip-plan-form").submit(function(e) {
            e.preventDefault();
            makeTripRequest();
        });
    }
    
    function addNarrativeUIBehavior() {
        // table row focus
        root.find('#tripresult-summaries tbody tr').click(function() {
            root.find('#tripresult-summaries tr')
                .removeClass("active");
            
            jQuery(this).addClass("active");

            var tripNumber = parseInt((this.id).split('-')[0].match(/([0-9]*)$/ig)[0], 10);

            root.find('#trip' + tripNumber + '-results')
                .slideDown()
                .addClass("active");

            root.find('.results').not('#trip' + tripNumber + '-results')
                .slideUp()
                .removeClass("active");
                
            updateMap(plannerResponse, tripNumber);
        }).hover(function(e) {
            // line is already on map as the active route
            if(jQuery(this).hasClass("active")) {
                return;
            }

            var tripNumber = parseInt((this.id).split('-')[0].match(/([0-9]*)$/ig)[0], 10);

            if(e.type === "mouseenter") {
                map.removeHoverRoute();
                updateMapForHover(plannerResponse, tripNumber);
            } else {
                map.removeHoverRoute();
            }
        });
    }

    // constructor
    map = OTP.Map(
        _map, 
        _mapControlsRoot,
        { 
            updateToLocationFunction: updateToLocation, 
            updateFromLocationFunction: updateFromLocation,
            hasTripPlanner: true
        }
    );

    addFormUIBehavior();

    // public methods
    return {
        setFrom: function(v) {
            if(v === null || v === "") {
                return;
            }
                
            root.find('#from')
                .val(v)
                .trigger("change");
        },

        setTo: function(v) {
            if(v === null || v === "") {
                return;
            }
                
            root.find('#to')
                .val(v)
                .trigger("change");
        },

        setLeaveType: function(v) {
            if(v === null || v === "") {
                return;
            }
                
            root.find('#leavetype')
                .val(v);
        },

        setDay: function(v) {
            if(v === null || v === "") {
                return;
            }

            root.find('#leaveday')
                .val(v);
        },

        setHour: function(v) {
            if(v === null || v === "") {
                return;
            }

            root.find('#leavehour')
                .val(v);
        },

        setMinute: function(v) {
            if(v === null || v === "") {
                return;
            }
                
            root.find('#leaveminute')
                .val(v)
                .trigger("change");
        },

        setAmPm: function(v) {
            if(v === null || v === "") {
                return;
            }
            
            var realSelect = root.find('#leaveampm-wrap select');
            var styledSelect = root.find('#leaveampm-wrap input');

            realSelect.children().each(function(_, option) {
               if(option.value === v) {
                   styledSelect.val(option.text);
                   return false;
               } 
            });
        },

        setTripPriority: function(v) {
            if(v === null || v === "") {
                return;
            }
            
            // deploy extras section if value was changed
            var currentValue = root.find('#trippriority-wrap select').val();
            if(currentValue !== v) {
                root.find('#moreoptions').show();

                root.find('a#optionstoggle').html('Fewer Options<span></span>')
                    .addClass('active');
            }
 
            var realSelect = root.find('#trippriority-wrap select');
            var styledSelect = root.find('#trippriority-wrap input');

            realSelect.children().each(function(_, option) {
                if(option.value === v) {
                   styledSelect.val(option.text);
                   return false;
               } 
            });
        },

        setMaxWalk: function(v) {
            if(v === null || v === "") {
                return;
            }
            
            // deploy extras section if value was changed
            var currentValue = root.find('#maxwalk-wrap select').val();
            if(currentValue !== v) {
                root.find('#moreoptions').show();

                root.find('a#optionstoggle').html('Fewer Options<span></span>')
                    .addClass('active');
            }
                    
            var realSelect = root.find('#maxwalk-wrap select');
            var styledSelect = root.find('#maxwalk-wrap input');

            realSelect.children().each(function(_, option) { 
               if(option.value === v) {
                   styledSelect.val(option.text);
                   return false;
               } 
            });
        },

        setAccessible: function(v) {
            if(v === null || v === "") {
                return;
            }

            // deploy extras section if value was changed
            var currentValue = root.find('accessible').attr("checked");
            if(currentValue !== v) {
                root.find('#moreoptions').show();

                root.find('a#optionstoggle').html('Fewer Options<span></span>')
                    .addClass('active');
            }

            root.find('accessible')
                .attr('checked', v);
        },

        planTrip: function() {
            root.find("form#trip-plan-form").submit();
        }
    };
};