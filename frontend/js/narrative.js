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
    var narrativeForm = null;

    // the response from the server--passed to updateMap when
    // user selects a second route without a new trip plan request
    var plannerResponse = null;

    // narrative logic
    function makeTripRequest() {
        // remove ambiguous classes, since we don't know whether the new values are resolvable
        root.find('#to, #from')
            .removeClass('ambiguous');

        // planning spinner and text
        root.find('#trip-data')
            .fadeOut("fast", function() {
                map.showBusy();
                
                $(this)
                    .html('<div id="trip-spinner">Planning your trip...</div>')
                    .fadeIn("fast");
                });

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
                
                map.hideBusy();
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

    function updateNarrative(data) {
        // error returned
        if(typeof data.error !== 'undefined') {
            var msg = null;
            var errorId_r = data.error.msg.match(/[0-9]*/ig);
            if(errorId_r !== null && typeof errorId_r[1] !== 'undefined') {
                var errorId = errorId_r[1];
                switch (errorId) {
                    case '11085':
                        msg = "<p>The start and end locations are too close. We can’t plan a trip for you.</p>Please try to:</br>" + 
                                "<ul><li>Type in a new start or end location and try again, or</li><li>Change the start or end point on the map by dragging the A or B markers</li></ul>";
                        break;
                    case '20003':
                        msg = "<p>There are no transit stops within walking distance of your starting location.</p>Please try to:</br>" + 
                                "<ul><li>Increase your walking distance to 1 mile (see “more options” above), or</li><li>Change the starting point by dragging the A marker on the map, or</li><li>Type in a new address, intersection or landmark for your starting location</li></ul>" + 
                                "<div><strong>Tip</strong>: You can show the stops on the map by clicking on the <img src='img/otp/location-icon.png'> icon.</div>";
                        break;
                    case '20004':
                        msg = "<p>There are no transit stops within walking distance of your destination.</p>Please try to:</br>" + 
                                "<ul><li>Increase your walking distance to 1 mile (see “more options” above), or</li><li>Change the starting point by dragging the A marker on the map, or</li><li>Type in a new address, intersection or landmark for your starting location</li></ul>" +
                                "<div><strong>Tip</strong>: You can show the stops on the map by clicking on the <img src='img/otp/location-icon.png'> icon.</div>";
                        break;
                    case '20008':
                        msg = "<p>There is no trip available for the time you specified</p>Please try to:</br>" + 
                                "<ul><li>Change the date and time of your trip</li></ul>";
                        break;
                    case '20007':
                    default:
                        msg = "<p>We were unable to find a trip</p>Please try to:</br>" + 
                                "<ul><li>Change the date and time of your trip, or</li><li>Change the start or end point of the trip by selecting them on the map, or</li><li>Type in a new address, intersection or landmark for your start or end locations, or</li><li>Look up <a href='#'>schedules</a></li></ul>";
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
        var tripSummariesWrapper = jQuery('<table id="tripresult-summaries">' + 
                                            '<thead><tr><th>Trip</th><th>Travel Time</th><th>Cash</th><th>Route &amp; Transfers</th><tr></thead>' + 
                                            '<tbody></tbody>' + 
                                            '</table>');

        var itineraryCollection = null;
        if(data.plan.itineraries.itinerary instanceof Array) {
            itineraryCollection = data.plan.itineraries.itinerary;
        } else {
            itineraryCollection = [data.plan.itineraries.itinerary];
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

            var tripWrapper = jQuery("<div></div>")
                                .addClass("results")
                                .attr("id", "trip" + tripNumber + "-results");
                            
            var stepByStepWrapper = jQuery('<ul class="trip-stepbystep"></ul>');

            var startTime, endTime = null;
            var tripDuration = 0;
            jQuery.each(trip.legs.leg, function(legIndex, leg) {
                // trip summary leg label
                var legLabel = '<img src="img/otp/' + OTP.Agency.getModeLabelForLeg(leg["@mode"], leg["@route"]).toLowerCase() + '16x16.png" alt="' + OTP.Agency.getModeLabelForLeg(leg["@mode"], leg["@route"]) + '" /> ';

                if(leg["@mode"] !== "WALK") {
                    legLabel += '<strong>' + OTP.Agency.getDisplayNameForLeg(leg["@mode"], leg["@route"]) + '</strong> ';
                }

                tripModes.push(legLabel);

                // leg step by step summary
                stepByStepWrapper.append(formatLeg(legIndex, leg));

                // duration across this trip for use in trip summary 
                if(! isNaN(leg.duration) && typeof leg.duration !== 'undefined') {
                    tripDuration += parseInt(leg.duration, 10);
                }
                
                // start/end times
                if(trip.legs.leg.length - 1 === legIndex) {
                    endTime = OTP.Util.ISO8601StringToDate(leg.endTime);
                } else if(legIndex === 0) {
                    startTime = OTP.Util.ISO8601StringToDate(leg.startTime);
                }
            });

            // trip summary header
            jQuery('<tr id="trip' + tripNumber + '-summary" class="'+ ((tripNumber === 1) ? "active" : "") + '">' +
                    '<td class="trip-id">' + tripNumber + '</td>' +
                    '<td>' + OTP.Util.millisecondsToString(tripDuration) + '<em>' + OTP.Util.dateToPrettyTime(startTime) + ' - ' + OTP.Util.dateToPrettyTime(endTime) + '</em></td>' + 
                    '<td>' + regularFare + '</td>' + 
                    '<td class="trip-modes">' + tripModes.join("<em>›</em> ") + '</td>' + 
                    '</tr>')
                    .appendTo(tripSummariesWrapper.children('tbody'));

            // trip descripton: price header
            jQuery('<table class="trip-prices">' + 
                    '<thead><tr><th><h3>Trip ' + tripNumber + '</h3></th><th colspan="2">' + OTP.Util.millisecondsToString(tripDuration) + ', ' + transfers + ' Transfer' + ((transfers === 1) ? "" : "s") + '</th></tr></thead>' + 
                    '<tbody>' + 
                    '<tr><th scope="row">Adult</th><td>' + regularFare + ' Cash</td><td>' + regularFareORCA + ' <a href="http://www.orcacard.com/" target="_new">ORCA</a></td></tr>' +
                    '<tr><th scope="row">Youth</th><td>' + studentFare + ' Cash</td><td>' + studentFareORCA + ' <a href="http://www.orcacard.com/" target="_new">ORCA</a></td></tr>' + 
                    '<tr><th scope="row">Senior / Disabled</th><td>' + seniorFare + ' Cash</td><td>' + seniorFareORCA + ' <a href="http://www.orcacard.com/" target="_new">ORCA</a></td></tr>' + 
                    '</tbody></table>')
                    .appendTo(tripWrapper);

            // trip description: step by step
            jQuery(stepByStepWrapper)
                .appendTo(tripWrapper);

            // hack to support IE7 last-child selector
            jQuery(".trip-stepbystep li:last-child").addClass("last-child");

            tripWrapper
                .appendTo(root.find("#trip-data"));

            // set initial selection class/map display
            if(tripNumber === 1) {
                tripWrapper.addClass("active");
                updateMap(data, tripNumber);
            }

            tripIndex++;
        }); // each trip
        
        jQuery(tripSummariesWrapper)
            .prependTo(root.find("#trip-data"));

        // (save map data for later calls to updateMap (HACK)
        plannerResponse = data;
    }

    function updateMapForHover(data, targetTripNumber) {
        if(data === null) {
            return;
        }
        
        var itineraryCollection = null;
        if(data.plan.itineraries.itinerary instanceof Array) {
            itineraryCollection = data.plan.itineraries.itinerary;
        } else {
            itineraryCollection = [data.plan.itineraries.itinerary];
        }

        var tripNumber = 1;
        jQuery.each(itineraryCollection, function(_, trip) {
            if(tripNumber === targetTripNumber) {
                jQuery.each(trip.legs.leg, function(legIndex, leg) {
                    map.addLegToHoverRoute(leg);
                });
                return false;
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
        if(data.plan.itineraries.itinerary instanceof Array) {
            itineraryCollection = data.plan.itineraries.itinerary;
        } else {
            itineraryCollection = [data.plan.itineraries.itinerary];
        }

        var tripNumber = 1;
        jQuery.each(itineraryCollection, function(_, trip) {
            if(tripNumber === targetTripNumber) {
                jQuery.each(trip.legs.leg, function(legIndex, leg) {
                    // add leg + markers to map
                    map.addLegToPlannedRoute(leg);
                    map.addLegInfoMarker(leg, formatLegInfoWindowHtml(leg));

                    // add start finish icons to map
                    if(trip.legs.leg.length - 1 === legIndex) {
                        map.setEndPoint(leg.to.lon, leg.to.lat);
                    } else if(legIndex === 0) {
                        map.setStartPoint(leg.from.lon, leg.from.lat);
                    }
                });
                map.zoomToPlannedRoute();
                return false;
            }
            tripNumber++;
        });
    }

    function formatLeg(legIndex, leg) {
        if(leg === null) {
            return null;
        }
        
        if(leg["@mode"] === "WALK") {
            return jQuery('<li class="walk leg-' + legIndex + '"></li>').html(
                        '<img class="mode-icon" src="img/otp/walk16x16.png" alt="Walk" />' +
                        'Walk from <strong>' + ((leg.from.name !== null) ? leg.from.name : "Unknown") + '</strong> to <strong>' + ((leg.to.name !== null) ? leg.to.name : "Unknown") + '</strong>' + 
                        '<div class="stepmeta">' + OTP.Util.millisecondsToString(leg.duration) + ' (' + OTP.Util.metersToPrettyDistance(leg.distance) + ')</div>');
        } else {
            // previous stop at end point + stops passed on leg
            var stopsPassed = -1;
            var previousToStop = "unknown";
            if(typeof leg.intermediateStops !== 'undefined' && leg.intermediateStops !== null) {
                var intermediateLegs = null;
                if(leg.intermediateStops.stop instanceof Array) {
                    intermediateLegs = leg.intermediateStops.stop;
                } else {
                    intermediateLegs = [leg.intermediateStops.stop];
                }
                if(intermediateLegs.length >= 1) {
                    previousToStop = intermediateLegs[intermediateLegs.length - 1].name;
                    stopsPassed = intermediateLegs.length;
                }
            }

            return jQuery('<li class="' + OTP.Agency.getModeLabelForLeg(leg["@mode"], leg["@route"]).toLowerCase() + ' leg-' + legIndex + '"></li>').html(
                    '<img class="mode-icon" src="img/otp/' + OTP.Agency.getModeLabelForLeg(leg["@mode"], leg["@route"]).toLowerCase() + '16x16.png" alt="' + OTP.Agency.getModeLabelForLeg(leg["@mode"], leg["@route"]) + '" />' + 
                        OTP.Util.makeSentenceCase(leg["@mode"]) + ' - ' + 
                            '<a href="' + OTP.Agency.getURLForLeg(leg["@mode"], leg["@route"]) + '" target="_new">' + 
                                OTP.Agency.getAgencyNameForLeg(leg["@mode"], leg["@route"]) + 
                            '</a>' + 
                            ' <strong>' + OTP.Agency.getDisplayNameForLeg(leg["@mode"], leg["@route"]) + '</strong> ' +
                            OTP.Agency.getFormattedHeadsign(leg["@headsign"]) + 
                    '<table class="substeps"><tbody>' + 
                    '<tr><td>' + OTP.Util.dateToPrettyTime(OTP.Util.ISO8601StringToDate(leg.startTime)) + '</td><td>Depart ' + ((leg.from.name !== null) ? leg.from.name : "Unknown") + '</div></td></tr>' + 
                    '<tr><td>' + OTP.Util.dateToPrettyTime(OTP.Util.ISO8601StringToDate(leg.endTime)) + '</td><td>Arrive ' + ((leg.to.name !== null) ? leg.to.name : "Unknown") + 
                        '<div class="stepmeta">' +
                            OTP.Util.millisecondsToString(leg.duration) + ((stopsPassed >= 0) ? ' (' + stopsPassed + ' stop' + ((stopsPassed === 1) ? '' : 's') + ')' : '') +
                            '<br />Previous stop is ' + previousToStop + 
                        '</div>' + 
                    '</td></tr>' + 
                    '</tbody></table>');
        }
    }
    
    function formatLegInfoWindowHtml(leg) {
        if(leg === null || leg["@mode"] === "WALK") {
            return null;
        }

        // previous stop at end point + stops passed on leg
        var stopsPassed = -1;
        var previousToStop = "unknown";
        if(typeof leg.intermediateStops !== 'undefined' && leg.intermediateStops !== null) {
            var intermediateLegs = null;
            if(leg.intermediateStops.stop instanceof Array) {
                intermediateLegs = leg.intermediateStops.stop;
            } else {
                intermediateLegs = [leg.intermediateStops.stop];
            }
            if(intermediateLegs.length >= 1) {
                previousToStop = intermediateLegs[intermediateLegs.length - 1].name;
                stopsPassed = intermediateLegs.length;
            }
        }

        return jQuery('<table class="substeps"><tbody>' + 
                    '<tr><td>' + OTP.Util.dateToPrettyTime(OTP.Util.ISO8601StringToDate(leg.startTime)) + '</td><td>Depart ' + ((leg.from.name !== null) ? leg.from.name : "Unknown") + '</div></td></tr>' + 
                    '<tr><td>' + OTP.Util.dateToPrettyTime(OTP.Util.ISO8601StringToDate(leg.endTime)) + '</td><td>Arrive ' + ((leg.to.name !== null) ? leg.to.name : "Unknown") + 
                        '<div class="stepmeta">' +
                            OTP.Util.millisecondsToString(leg.duration) + ((stopsPassed >= 0) ? ' (' + stopsPassed + ' stop' + ((stopsPassed === 1) ? '' : 's') + ')' : '') +
                            '<br />Previous stop is ' + previousToStop + 
                        '</div>' + 
                    '</td></tr>' + 
                    '</tbody></table>');
    }

    // disambiguation (FIXME: make more robust?)
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
            
        var disambiguationResults = root.find("#disambiguate-results");
        if(disambiguationResults.length === 0) {
            disambiguationResults = jQuery("<div></div>")
                .attr("id", "disambiguate-results")
                .appendTo(root.find("#trip-data").empty());
        }
            
        disambiguationResults
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

            map.removeHoverRoute();

            if(e.type === "mouseenter") {
                updateMapForHover(plannerResponse, tripNumber);
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

    narrativeForm = new OTP.NarrativeForm(_root);
    addFormUIBehavior();

    // public methods
    return {
        setFrom: function(v) {
            return narrativeForm.setFrom(v);
        },

        setTo: function(v) {
            return narrativeForm.setTo(v);
        },

        setLeaveType: function(v) {
            return narrativeForm.setLeaveType(v);
        },

        setDay: function(v) {
            return narrativeForm.setDay(v);
        },

        setHour: function(v) {
            return narrativeForm.setHour(v);
        },

        setMinute: function(v) {
            return narrativeForm.setMinute(v);
        },

        setAmPm: function(v) {
            return narrativeForm.setAmPm(v);
        },

        setTripPriority: function(v) {
            return narrativeForm.setTripPriority(v);
        },

        setMaxWalk: function(v) {
            return narrativeForm.setMaxWalk(v);
        },

        setAccessible: function(v) {
            return narrativeForm.setAccessible(v);
        },

        planTrip: function() {
            root.find("form#trip-plan-form").submit();
        }
    };
};
