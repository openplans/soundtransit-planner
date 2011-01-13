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

    function prettyRoute(route, includeAgencyName) {
        if(route === null) {
            return "Unknown";
        }

        var agencyName = "Unknown Agency";

        if(isSounder(route)) {
            agencyName = '<a href="http://www.soundtransit.org/sounder">Sounder</a>';
            route = "";
        } else if(isTheLink(route)) {
            agencyName = '<a href="http://www.soundtransit.org/link">Link Light Rail</a>';
            route = "";
        } else {
            var agencyIdentifier = (route + '').toUpperCase().match('^[M|P|CT|ST]');

            if(agencyIdentifier !== null && typeof agencyIdentifier[0] !== 'undefined') {
                agencyIdentifier = agencyIdentifier[0];
                route = route.substring(agencyIdentifier.length);

                if(agencyIdentifier === "M") {
                    agencyName = '<a href="http://metro.kingcounty.gov/">King County Metro</a>';
                } else if(agencyIdentifier === "P") {
                    agencyName = '<a href="http://www.piercetransit.org/">Pierce Transit</a>';
                } else if(agencyIdentifier === "ST") {
                    agencyName = '<a href="http://www.soundtransit.org">Sound Transit</a>';
                } else if(agencyIdentifier === "CT") {
                    agencyName = '<a href="http://www.commtrans.org/">Community Transit</a>';
                }
            }
        }

        return ((includeAgencyName === true) ? agencyName + ' ' : '') + '<strong>' + route + '</strong>';
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

        jQuery.jsonp({
            callback: "fn",
            url: "http://sea.dev.openplans.org:8080/translatis-api/ws/planP",
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

    // FIXME: better (pluggable?) system for handling special route formatting cases? e.g. color, icons, etc.?
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
            root.find("#trip-data")
                .html(
                    '<div id="no-results">' + 
                    '<h3>We\'re sorry!</h3>' + 
                    '<p>Something went wrong when trying to plan your trip&mdash;the system reported \"' + data.error.msg + '\"</p>' + 
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
                        modeText += prettyRoute(leg["@route"], false) + ' ';
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
                    // add each travel leg to map
                    if(isSounder(leg["@route"])) {
                        map.addLegToPlannedRoute(leg.legGeometry.points, "SOUNDER");
                    } else if(isTheLink(leg["@route"])) {
                        map.addLegToPlannedRoute(leg.legGeometry.points, "LINK");
                    } else {
                        map.addLegToPlannedRoute(leg.legGeometry.points, leg["@mode"]);
                    }

                    // add start finish icons to map
                    if(trip.legs.leg.length - 1 === legIndex) {
                        map.setEndPoint(leg.legGeometry.points);
                    } else if(legIndex === 0) {
                        map.setStartPoint(leg.legGeometry.points);
                    }
                });

                map.zoomToPlannedRoute();
            }
            
            tripNumber++;
        });
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
                    '<img class="mode-icon" src="img/otp/' + displayType.toLowerCase() + '16x16.png" alt="' + displayType + '" />' + prettyCase(leg["@mode"]) + ' - ' + prettyRoute(leg["@route"], true) + 
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

    // FIXME
    function disambiguateResults(results) {
        var disambiguateMarkup = jQuery('<div id="disambiguate-results"></div>');
        var disambiguateToMarkup = "";
        var disambiguateFromMarkup = "";

        map.beginDisambiguation();

        if (results.to.candidate instanceof Array) {
          var disambiguateToMarkup = jQuery('<div id="to-possibles"><h3>We found several ending points for your search</h3><h4>Did you mean?</h4></div>');
          var toList = jQuery('<ol></ol>');
          // TODO: Add points to map, select behavior
          jQuery(results.to.candidate).each(function(_, result) {
              if (_ >= 9) {return false;} //cap disambiguation somewhere
              var feature_id = map.addDisambiguationPoint(result.latitude, result.longitude, (_+1), 'to');

              var link = jQuery('<a href="#">select</a>').click(function() {
                  userHasDisambiguated('to', $(this).parent().children('span.lat-lon').text());
                  return false;
              });

              jQuery('<li class="possible-' + (_ + 1) + '"><span class="nice-name">' + result.name + ', ' + result.area + '</span><span class="lat-lon" style="display: none;">' + result.latitude + ',' + result.longitude + '</span></li>') .mouseenter(function() { map.highlightDisambiguationPoint(feature_id, (_ + 1));}).mouseleave(function() { map.unhighlightDisambiguationPoint(feature_id, (_ + 1));}).click(function() {
                    userHasDisambiguated('to', $(this).children('span.lat-lon').text());
                    return false;
                }).append(link).appendTo(toList);

          });

            // account for the fact that we only want to show one set of disambiguation at a time
            if (results.from.candidate instanceof Array) {
                disambiguateToMarkup.css('display', 'none');
            } else {
                root.find('#to').addClass("ambiguous").focus();
            }
            disambiguateToMarkup.append(toList);
        }

        if (results.from.candidate instanceof Array) {
            var disambiguateFromMarkup = jQuery('<div id="from-possibles"><h3>We found several starting points for your search</h3><h4>Did you mean?</h4></div>');
            var fromList = jQuery('<ol></ol>');
            // TODO: Add points to map, select behavior
            jQuery(results.from.candidate).each(function(_, result) {
                if (_ >= 9) {return false;} //cap disambiguation somewhere
                var feature_id = map.addDisambiguationPoint(result.latitude, result.longitude, (_+1), 'from');
  
                var link = jQuery('<a href="#">select</a>').click(function() {
                    userHasDisambiguated('from', $(this).parent().children('span.lat-lon').text());
                    return false;
                });

                jQuery('<li class="possible-' + (_ + 1) + '"><span class="nice-name">' + result.name + ', ' + result.area + '</span><span class="lat-lon" style="display: none;">' + result.latitude + ',' + result.longitude + '</span></li>') .mouseenter(function() { map.highlightDisambiguationPoint(feature_id, (_ + 1));}).mouseleave(function() { map.unhighlightDisambiguationPoint(feature_id, (_ + 1));}).click(function() {
                        userHasDisambiguated('from', $(this).children('span.lat-lon').text());
                        return false;
                    }).append(link).appendTo(fromList);

            });
            
            root.find('#from').addClass("ambiguous").focus();
            disambiguateFromMarkup.append(fromList);
        }

        root.find("#trip-data")
            .html(disambiguateMarkup.append(disambiguateFromMarkup).append(disambiguateToMarkup));
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

    function userHasDisambiguated(location, value) { // location should be either "to" or "from"
        root.find('#' + location ).val(value).removeClass('ambiguous');
        
        root.find('#' + location + '-possibles').fadeOut('slow', function() { 
            $(this).remove();
            map.removeDisambiguationFor(location);
            if (root.find('#disambiguate-results').children().length == 0) {
                map.endDisambiguation();
                root.find("form#trip-plan-form").submit();
            } else {
                root.find('#to').addClass('ambiguous').focus();
                root.find('#disambiguate-results').children().fadeIn('slow');
            }
        });
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
            if (parseInt(hoursField.val()) > 11) {
                hoursField.val(1);
            } else {
                hoursField.val(parseInt(hoursField.val()) + 1);
            }
            element.val('0');
        }

        var decrementAtMin = function(element) {
            var hoursField = root.find('#leavehour');
            if (parseInt(hoursField.val()) < 2) {
                hoursField.val(12);
            } else {
                hoursField.val(parseInt(hoursField.val()) - 1);
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
        //root.find("#leavetype, #leaveampm, #trippriority, #maxwalk").combobox();        

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