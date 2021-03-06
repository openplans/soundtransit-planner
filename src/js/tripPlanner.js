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

OTP.TripPlanner = function(_root, _map, _mapControlsRoot) {
    if(typeof _root === 'undefined' || _root === null) {
        return null;
    }

    // DOM elements
    var root = jQuery(_root);
    var map = null;
    var mapControls = jQuery(_mapControlsRoot);
    var narrativeForm = null;

    // the response from the server--passed to updateMap when
    // user selects a second route without a new trip plan request
    var plannerResponse = null;

    var disambiguationPageSize = 5;
    var disambiguationNameToLonLatMap = {};

    // form submission handler
    function makeTripRequest() {
        // remove ambiguous classes, since we don't know whether the new values are resolvable
        root.find('#to, #from')
            .removeClass('ambiguous');

        // planning spinner and text
        root.find('#trip-data')
            .fadeOut("fast", function() {
                map.showBusy();
                
                jQuery(this)
                    .html('<div id="trip-spinner">Planning your trip...</div>')
                    .fadeIn("fast");
                });

        // mode selector
        var includeModes = "";
        root.find("#bus, #train").each(function(e) {
            var checked = jQuery(this).attr("checked");
            var value = jQuery(this).val();
            if(checked === true) {
                if(includeModes.length > 0) {
                    includeModes += ",";
                }
                includeModes += value;
            }
        });

        // (always include walking!)
        if(includeModes.length > 0) {
            includeModes += ",";
        }
        includeModes += "WALK";

        jQuery.jsonp({
            callback: "fn",
            url: OTP.Config.atisProxyServiceUrl,
            data: {
                arriveBy: (root.find("#leavetype option:selected").val() === "Arrive By"),
                date: root.find("#leaveday").val(),
                time: root.find("#leavehour").val() + ":" + root.find("#leaveminute").val() + " " + root.find("#leaveampm option:selected").val(),
                optimize: root.find("#trippriority option:selected").val(),
                maxWalkDistance: root.find("#maxwalk option:selected").val(),
                wheelchair: (root.find("#accessible").attr("checked") === true),
                fromPlace: getLocationForPlaceName(root.find("#from").val()),
                toPlace: getLocationForPlaceName(root.find("#to").val()),
                from: root.find("#from").val(),
                to: root.find("#to").val(),
                intermediatePlaces: "",
                showIntermediateStops: true,
                mode: includeModes
            },
            success: function(data, status) {
                plannerResponse = data;

                if (typeof data.geocodeResponse !== 'undefined') {
                    map.reset();
                    disambiguateResults(data);
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
            },
            complete: function(xhr, status) {
                map.hideBusy();
            }
        });
    }

    // narrative updating
    function addServiceAlerts(tripWrapper, trip) {
        var routesUsed = "";
        jQuery.each(trip.legs.leg, function(legIndex, leg) {
            if(leg["@mode"].toUpperCase() === "WALK") {
                return;
            }
            if(routesUsed.length > 0) {
                routesUsed += "&";
            }
            routesUsed += "route=" + leg["@agencyId"] + "," 
                                   + OTP.Agency.getDisplayNameForLeg(leg["@mode"], leg["@route"]);
        });

        var callbackFunction = "getAlerts" + Math.floor(Math.random() * 1000000000);
        jQuery.jsonp({
            callback: callbackFunction,
            dataType: "jsonp",
            url: OTP.Config.serviceAlertAggregatorUrl + "?callback=?",
            data: routesUsed,
            success: function(data, status) {
                var items = null;
                if(data.items.item instanceof Array) {
                    items = data.items.item;
                } else {
                    items = [data.items.item];
                }

                if(items.length === 0) {
                    return;
                }

                jQuery.each(items, function(_, item) {
                    if(typeof item.status !== 'undefined' && typeof item.category !== 'undefined') {
                        var alertText = jQuery("<p></p>")
                                                .addClass("alert")
                                                .addClass(item.category.toLowerCase());

                        if(typeof item.link !== 'undefined') {
                            jQuery("<a></a>")
                                    .text(item.status)
                                    .attr("href", item.link)
                                    .attr("target", "_new")
                                    .appendTo(alertText);
                        } else {
                            alertText.text(item.status);
                        }

                        tripWrapper.find(".trip-stepbystep li." + item.agency + item.route)
                            .append(alertText);

                        var alertIconContainer = tripWrapper.find(".trip-prices thead th.last");
                        if(alertIconContainer.find("p.alertIcon").length <= 0) {
                            jQuery("<p></p>")
                                .text(item.category + " Alert")
                                .addClass("alertIcon")
                                .addClass(item.category.toLowerCase())
                                .appendTo(alertIconContainer);
                        }
                    }
                });
            },
            complete: function(xhr, status) {
                map.hideBusy();
            }
        });
    }
    
    function updateNarrative(data) {
        // error returned
        if(typeof data.error !== 'undefined') {
            map.hideBusy();

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
                                "<ul><li>Increase your walking distance to 1 mile (see “advanced search” above), or</li><li>Change the starting point by dragging the A marker on the map, or</li><li>Type in a new address, intersection or landmark for your starting location</li></ul>" + 
                                "<div><strong>Tip</strong>: You can show the stops on the map by clicking on the <img src='" + OTP.Config.tripPlannerImagePath + "location-icon.png'> icon.</div>";
                        break;
                    case '20004':
                        msg = "<p>There are no transit stops within walking distance of your destination.</p>Please try to:</br>" + 
                                "<ul><li>Increase your walking distance to 1 mile (see “advanced search” above), or</li><li>Change the starting point by dragging the A marker on the map, or</li><li>Type in a new address, intersection or landmark for your starting location</li></ul>" +
                                "<div><strong>Tip</strong>: You can show the stops on the map by clicking on the <img src='" + OTP.Config.tripPlannerImagePath + "location-icon.png'> icon.</div>";
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
        var tripSummariesWrapper = jQuery('<h2>Trip Options</h2>' + 
                                            '<table id="tripresult-summaries">' + 
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
            jQuery.each(trip.legs.leg, function(legIndex, leg) {
                // trip summary leg label
                var legLabel = '<img src="' + OTP.Config.tripPlannerImagePath + OTP.Agency.getModeLabelForLeg(leg["@mode"], leg["@route"]).toLowerCase() + '16x16.png" alt="' + OTP.Agency.getModeLabelForLeg(leg["@mode"], leg["@route"]) + '" /> ';

                if(leg["@mode"] !== "WALK") {
                    legLabel += '<strong>' + OTP.Agency.getDisplayNameForLeg(leg["@mode"], leg["@route"]) + '</strong> ';
                }

                tripModes.push(legLabel);

                // leg step by step summary
                stepByStepWrapper.append(OTP.Util.formatLeg(legIndex, leg));
                
                // start/end times
                if(trip.legs.leg.length - 1 === legIndex) {
                    endTime = OTP.Util.ISO8601StringToDate(leg.endTime);
                } else if(legIndex === 0) {
                    startTime = OTP.Util.ISO8601StringToDate(leg.startTime);
                }
            });

            var tripDuration = endTime.getTime() - startTime.getTime();

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
                    '<thead><tr><th><h3>Trip ' + tripNumber + '</h3></th><th colspan="2" class="last">' + OTP.Util.millisecondsToString(tripDuration) + ', ' + transfers + ' Transfer' + ((transfers === 1) ? "" : "s") + '</th></tr></thead>' + 
                    '<tbody>' + 
                    '<tr><th scope="row">Adult</th><td>' + regularFare + ' Cash</td><td>' + regularFareORCA + ' <a href="http://www.orcacard.com/" target="_new">ORCA</a></td></tr>' +
                    '<tr><th scope="row">Youth</th><td>' + studentFare + ' Cash</td><td>' + studentFareORCA + ' <a href="http://www.orcacard.com/" target="_new">ORCA</a></td></tr>' + 
                    '<tr><th scope="row">Senior / Disabled</th><td>' + seniorFare + ' Cash</td><td>' + seniorFareORCA + ' <a href="http://www.orcacard.com/" target="_new">ORCA</a></td></tr>' + 
                    '</tbody></table>')
                    .appendTo(tripWrapper);

            // trip description: step by step
            jQuery(stepByStepWrapper)
                .appendTo(tripWrapper);

            // request + add service alerts
            addServiceAlerts(tripWrapper, trip);

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
    }

    // map updating
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

        mapControls.find("#map-controls-wrap").addClass("printable");
        
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
                var legStops = [];

                jQuery.each(trip.legs.leg, function(legIndex, leg) {
                    // add leg + markers to map
                    map.addLegToPlannedRoute(leg);
                    map.addLegInfoMarker(leg, OTP.Util.formatLegInfoWindowHtml(leg));

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
                    } else if(legIndex === 0) {
                        map.setStartPoint(leg.from.lon, leg.from.lat);
                    }
                });
                map.addStopsWithIds(legStops);
                map.zoomToPlannedRoute();
                return false;
            }
            tripNumber++;
        });
    }

    // disambiguation
    function getLocationForPlaceName(name) {
        if(typeof disambiguationNameToLonLatMap[name] !== 'undefined') {
            return disambiguationNameToLonLatMap[name];
        } else {
            return name;
        }
    }

    function disambiguateResults(data, promptStack) {
        var results = data.geocodeResponse;

        if(results === null) {
            return;
        }

        // create list of location types (to,from) we need to prompt for
        if(typeof promptStack === 'undefined' || promptStack === null) {
            promptStack = [];
            jQuery.each(results, function(locationType, candidates) {
                if(candidates.candidate instanceof Array === true) {
                    promptStack.push(locationType);
                }
            });
        }

        // pick first prompt type of stack
        var locationType = promptStack.slice(0,1);
        var friendlyLocationType = ((locationType === "from") ? "starting" : "ending");

        root.find('#' + locationType)
                    .addClass("ambiguous")
                    .focus();

        var disambiguationWrapper = jQuery("<div></div>")
                                        .attr("id", "disambiguate-results")
                                        .appendTo(root.find("#trip-data").empty());

        var disambiguateMarkup = jQuery('<div id="' + locationType + '-possibles">' + 
                                            '<h3>We found several ' + friendlyLocationType + ' points for your search</h3>' + 
                                            '<h4>Did you mean?</h4>' + 
                                        '</div>')
                                        .appendTo(disambiguationWrapper);

        var listElement = jQuery('<ol></ol>')
                                        .appendTo(disambiguateMarkup);

        var pagerWrapper = jQuery("<div></div>")
                                .attr("id", "pager")
                                .html("<span>Page:</span>")
                                .appendTo(disambiguationWrapper);
                                
        var pager = jQuery('<ol></ol>')
                                        .appendTo(pagerWrapper);

        var fullCandidateList = results[locationType].candidate;
        for(var p = 0; p * disambiguationPageSize < fullCandidateList.length; p++) {
            var addPageItem = function(page) {
                var pageItem = jQuery('<li></li>').append(
                                    jQuery('<a></a>')
                                            .text(page + 1)
                                            .click(function(e) {
                                                updateDisambiguationList(page);
                                                return false;
                                            })
                                )
                                .addClass("page" + (page + 1));

                pager.append(pageItem);
            }
            addPageItem(p);
        }

        var updateDisambiguationList = function(displayPage) {
            map.reset();

            listElement.empty();

            root.find("#pager ol li")
                .removeClass("active")

            root.find("#pager ol li.page" + (displayPage + 1))
                .addClass("active");

            var candidateList = fullCandidateList.slice(displayPage * disambiguationPageSize);
            jQuery(candidateList).each(function(i, result) {
                if (i >= disambiguationPageSize) {
                    return false;
                }

                var onOptionSelectFunction = function(value) {
                    root.find('#' + locationType)
                                    .val(value)
                                    .removeClass('ambiguous');

                    root.find('#' + locationType + '-possibles').fadeOut('fast', function() { 
                        promptStack = promptStack.slice(1);

                        if(promptStack.length > 0) {
                            disambiguateResults(plannerResponse, promptStack);
                        } else {
                            map.reset();
                            root.find("form#trip-plan-form").submit();
                        }
                    });
                };

                var selectLink = jQuery('<a href="#">select</a>').click(function() {
                    onOptionSelectFunction(result.name + ', ' + result.area);
                    return false;
                });

                jQuery('<li class="possible-' + (i + 1) + '">' + 
                            '<span class="nice-name">' + result.name + ', ' + result.area + '</span>' + 
                        '</li>')
                        .mouseenter(function() { 
                            map.highlightDisambiguationPoint(i + 1);
                        })
                        .mouseleave(function() { 
                            map.unhighlightDisambiguationPoint(i + 1);
                        }).click(function() {
                            onOptionSelectFunction(result.name + ', ' + result.area);
                            return false;
                        })
                        .append(selectLink)
                        .appendTo(listElement);

                map.addDisambiguationPoint(result.latitude, result.longitude, (i + 1));

                // put the lat/lon for this location in a map that we can get later--this is so we can display
                // the "friendly" name for this place, also allowing the user to enter it manually if they ever were to?
                disambiguationNameToLonLatMap[result.name + ', ' + result.area] = result.latitude + ',' + result.longitude + ',' + result.landmarkId;
            });

            map.zoomToDisambiguationExtent();
        };

        updateDisambiguationList(0);
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

    function addPrintUIBehavior() {
        // print button
        mapControls.find("#print").click(function() {
            var printableUrl = OTP.Config.tripPlannerPrintUrl;

            var includeModes = "";
            root.find("#bus, #train").each(function(e) {
                var checked = jQuery(this).attr("checked");
                var value = jQuery(this).val();
                if(checked === true) {
                    if(includeModes.length > 0) {
                        includeModes += ",";
                    }
                    includeModes += value;
                }
            });
            
            var activeTrip = root.find("#tripresult-summaries tbody tr.active");
            var selectedTripIndex = null;
            if(activeTrip !== null) {
                selectedTripIndex = activeTrip.attr("id").split('-')[0].match(/([0-9]*)$/ig)[0];
            } else {
                return;
            }
            
            printableUrl += "?arriveBy=" + (root.find("#leavetype option:selected").val() === "Arrive By");
            printableUrl += "&date=" + root.find("#leaveday").val();
            printableUrl += "&time=" + root.find("#leavehour").val() + ":" + root.find("#leaveminute").val() + " " + root.find("#leaveampm option:selected").val();
            printableUrl += "&optimize=" + root.find("#trippriority option:selected").val();
            printableUrl += "&maxWalkDistance=" + root.find("#maxwalk option:selected").val();
            printableUrl += "&wheelchair=" + (root.find("#accessible").attr("checked") === true);
            printableUrl += "&fromPlace=" + encodeURIComponent(getLocationForPlaceName(root.find("#from").val()));
            printableUrl += "&toPlace=" + encodeURIComponent(getLocationForPlaceName(root.find("#to").val()));
            printableUrl += "&from=" +  encodeURIComponent(root.find("#from").val());
            printableUrl += "&to=" + encodeURIComponent(root.find("#to").val());
            printableUrl += "&mode=" + includeModes;
            printableUrl += "&itineraryIndex=" + selectedTripIndex;

            window.open(printableUrl, "print", "status=0,toolbar=0,scrollbars=1,width=760,height=600");

            return false;
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

    narrativeForm = new OTP.TripPlannerForm(_root, map, mapControls);
    addFormUIBehavior();
    addPrintUIBehavior();

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
