var OTP = window.OTP || {};

OTP.Narrative = function(_root, _map) {
    if(typeof _root === 'undefined' || _root === null) {
        return null;
    }
    
    var root = jQuery(_root);
    var map = OTP.Map(_map);

    // private methods
    function millisecondsToString(duration) {
        var msecondsPerMinute = 1000 * 60;
        var msecondsPerHour = msecondsPerMinute * 60;

        if(isNaN(duration)) {
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
      
    // break out these into a separate utils class? 
    function centsToDollars(num) {
        num = isNaN(num) || num === '' || num === null ? 0.00 : num;
        return parseFloat(num/100).toFixed(2);
    }
      
    function metersToMiles (n, p) {
        var miles = n / 1609.344;
        return miles.toFixed(1);
    }

    function metersToFeet(meters) {
        return parseInt(meters * 3.2808, 10);
    }
      
    function prettyDistance(meters) {
        if (meters === null || typeof meters === 'undefined') {
            return "";
        }

        var miles = metersToMiles(meters);

        // Display distances < 0.1 miles in feet
        if (miles < 0.1) {
            return metersToFeet(meters) + " ft";
        } else {
            return miles + " mi";
        }
    }
      
    function prettyTime(dateObj) {
        var minutes = dateObj.getMinutes();
        minutes = (minutes < 10) ? "0" + minutes : "" + minutes;
    
        var hours = dateObj.getHours();            
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

    function sentenceCase(string) {
        return string.toLowerCase().replace(/(^\s*\w|[\.\!\?]\s*\w)/g,function(c){return c.toUpperCase();});
    }

    function makeTripRequest() {
		// First, add the planning spinner and text
		root.find('#trip-data')
		    .fadeOut("fast", function() {
		        $(this)
		            .html('<div id="trip-spinner">Planning your trip</div>')
	                .fadeIn("fast");
		        });
              
        jQuery.ajax({
            url: "http://sea.dev.openplans.org:8080/translatis-api/ws/planP",
            dataType: "jsonp",
            data: {
                from: "",
                to: "",
                arriveBy: (root.find("#leavetype").val() === "Arrive By"),
                date: root.find("#leaveday").val(),
                time: root.find("#leavehour").val() + ":" + root.find("#leaveminute").val() + " " + root.find("#leaveampm").val(),
                optimize: root.find("#trippriority").val(),
                maxWalkDistance: root.find("#maxwalk").val(),
                wheelchair: (root.find("#accessible").checked === true),
                toPlace: root.find("#to").val(),
                fromPlace: root.find("#from").val(),
                intermediatePlaces: ""
            },
            beforeSend: function() {
            },
            success: function(data) {    
                // TODO:determine whether we need to disambiguate a to or from location (or both)
                if (false) {
                    var resultSet = {'from': ['array','of','options'], 'to': ['array','of','options']};
                    disambiguateResults(resultSet);
                } else {
                    root.find('#trip-data')
                        .fadeOut("fast")
                        .empty();
                    
                    map.reset();

                    processResults(data);
                    addNarrativeUIBehavior();
                    
                    root.find('#trip-data')
                        .fadeIn("fast");
                }
            },
            error:function(x,e){
                root.find("#trip-data")
                    .html(
                        '<div id="no-results">' + 
                        '<h3>We\'re sorry!</h3>' + 
                        '<p>Something went wrong when trying to plan your trip&mdash;try again in a few minutes.</p>' + 
                        '</div>');
            }
        });
    }

    function processResults(data) {
        if (typeof data === 'undefined' || data.plan.itineraries.itinerary.legs.leg.length === 0) {
            root.find("#trip-data")
                .html(
                    '<div id="no-results">' + 
                    '<h3>We\'re sorry!</h3>' + 
                    '<p>We don\'t have transit schedule data for a trip from ' + root.find("#from").val() + ' to ' + root.find("#to").val() + ' at the time and date you specified.</p>' + 
                    '<p>You might try to:</p>' + 
                    '<ul><li>Double check your spelling</li><li>Change the starting or end point of the trip by selecting them on the map</li><li>Look up schedules</li></ul>' + 
                    '</div>');
        }

        var tripSummariesMarkup = jQuery('<table id="tripresult-summaries">' + 
                                            '<thead><tr><th>Trip</th><th>Travel Time</th><th>Cash</th><th>Route &amp; Transfers</th><tr></thead>' + 
                                            '<tbody></tbody>' + 
                                            '</table>');

        var tripIndex = 0;
        jQuery.each(data.plan.itineraries, function(_, trip) {
            var tripNumber = tripIndex + 1;
            var tripModes = [];
            var transfers = Math.floor(trip.legs.leg.length / 2) - 1;

            var studentFare = "";
            var seniorFare = "";
            var regularFare = "";
            jQuery(this.fare.fare.entry).each(function(legIndex) {
                if (this.key == "student") {studentFare = parseInt(this.value.cents, 10);}
                if (this.key == "senior") {seniorFare = parseInt(this.value.cents, 10);}
                if (this.key == "regular") {regularFare = parseInt(this.value.cents, 10);}
            });

            var itineraryMarkup = jQuery('<ul class="trip-stepbystep"></ul>');

            var startTime = null;
            var endTime = null;
            var tripDuration = 0;
            jQuery.each(trip.legs.leg, function(legIndex, leg) {
                var modeText = '<img src="img/' + leg["@mode"].toLowerCase() + '16x16.png" alt="' + leg["@mode"] + '" /> ';

                if(leg["@mode"] !== "WALK" && leg["@route"] !== "") {
                    modeText += '<strong>' + leg["@route"] + '</strong> ';
                }

                // trip options header
                tripModes.push(modeText);

                // trip detail
                itineraryMarkup.append((leg["@mode"] === "WALK") ? formatWalkLeg(legIndex, leg) : formatTransitLeg(legIndex, leg));

                // add leg to map
                map.addLeg(leg["@mode"], leg.legGeometry.points);

                // end time, start time, duration across this trip
                if(! isNaN(leg.duration) && typeof leg.duration !== 'undefined') {
                    try {
                        tripDuration += parseInt(leg.duration, 10);
                    } catch(e) {}
                }

                if(typeof leg.startTime !== 'undefined' && leg.startTime !== null) {
                    var legStartTime = new Date(leg.startTime);
                    if(startTime === null || legStartTime < startTime) {
                        startTime = legStartTime;
                    }                    
                }

                if(typeof leg.endTime !== 'undefined' && leg.endTime !== null) {
                    var legEndTime = new Date(leg.endTime);
                    if(endTime === null || legEndTime > endTime) {
                        endTime = legEndTime;
                    }                    
                }
            });
            
            // move to a standalone function
            var activeClass = (tripNumber === 1) ? "active" : "";

            jQuery('<tr id="trip' + tripNumber + '-summary" class="'+ activeClass + '">' +
                    '<td class="trip-id">' + tripNumber + '</td>' +
                    '<td>' + millisecondsToString(tripDuration) + '<em>' + ((startTime !== null) ? prettyTime(startTime) : "Unknown") + ' - ' + ((endTime !== null) ? prettyTime(endTime) : "Unknown") + '</em></td>' + 
                    '<td>$' + centsToDollars(regularFare) + '</td>' + 
                    '<td class="trip-modes">' + tripModes.join("<em>›</em> ") + '</td>' + 
                    '</tr>')
                    .appendTo(tripSummariesMarkup.children('tbody'));

            // move to a standalone function
            jQuery('<table class="trip-prices">' + 
                    '<thead><tr><th><h3>Trip ' + tripNumber + '</h3></th><th colspan="2">' + millisecondsToString(tripDuration) + ', ' + transfers + ' Transfer' + ((transfers === 1) ? "" : "s") + '</th></tr></thead>' + 
                    '<tbody>' + 
                    '<tr><th scope="row">Adult</th><td>$' + centsToDollars(regularFare) + ' Cash</td><td>$---- <a href="#">ORCA</a></td></tr>' +
                    '<tr><th scope="row">Youth</th><td>$' + centsToDollars(studentFare) + ' Cash</td><td>$---- <a href="#">ORCA</a></td></tr>' + 
                    '<tr><th scope="row">Senior / Disabled</th><td>$' + centsToDollars(seniorFare) + ' Cash</td><td>$---- <a href="#">ORCA</a></td></tr>' + 
                    '</tbody></table>')
                    .appendTo(root.find("#trip-data"));

            jQuery(itineraryMarkup).appendTo(root.find("#trip-data"));

            tripIndex++;
        }); // each trip
        
        jQuery(tripSummariesMarkup).prependTo(root.find("#trip-data"));

        map.zoomToPlannedRoute();
    }

    function formatWalkLeg(legIndex, leg) {
        return jQuery('<li class="' + leg["@mode"].toLowerCase() + ' leg-' + legIndex + '"></li>').html(
                    '<img class="mode-icon" src="img/walk16x16.png" alt="' + leg["@mode"] + '" />' +
                    'Walk from <strong>' + ((typeof leg.startPlace !== 'undefined' && leg.startPlace !== null) ? leg.startPlace : "Unknown") + '</strong> to <strong>' + ((typeof leg.endPlace !== 'undefined' && leg.endPlace !== null) ? leg.endPlace : "Unknown") + '</strong>' + 
                    '<div class="stepmeta">' + millisecondsToString(leg.duration) + ' (' + prettyDistance(leg.distance) + ')</div>');
    }

    function formatTransitLeg(legIndex, leg) {
        return jQuery('<li class="' + leg["@mode"].toLowerCase() + ' leg-' + legIndex + '"></li>').html(
                    '<img class="mode-icon" src="img/' + leg["@mode"].toLowerCase() + '16x16.png" alt="' + leg["@mode"] + '" />' + sentenceCase(leg["@mode"]) + ' - <strong>' + leg["@route"] + '</strong>' + 
                    '<table class="substeps"><tbody>' + 
                    '<tr><td>' + prettyTime(new Date(leg.startTime)) + '</td><td>Depart ' + ((leg.from.name !== null) ? leg.from.name : "Unknown") + '<div class="stepmeta">' + millisecondsToString(leg.duration) + ' (-- stops)<br />Previous stop is ----</div></td></tr>' + 
                    '<tr><td>' + prettyTime(new Date(leg.endTime)) + '</td><td>Arrive ' + ((leg.to.name !== null) ? leg.to.name : "Unknown") + '<div class="stepmeta">Previous stop is ----</div></td></tr>' + 
                    '</tbody></table>');
    }

    // Expects an object in the format  {'from': [array,of,options], 'to': [array,of,options]}
    function disambiguateResults(results) {
        var disambiguateMarkup = jQuery('<div id="disambiguate-results"></div>');
        var disambiguateToMarkup = (results.to) ? jQuery('<div id="from-possibles"><h3>We found several starting points for your search</h3><h4>Did you mean?</h4><ol><li class="possible-1">12th Ave, Seattle WA <a href="#">select</a></li><li class="possible-2">52 12th Ave, Seattle WA <a href="#">select</a></li></ol></div>') : "";
        var disambiguateFromMarkup = (results.from) ? jQuery('<div id="from-possibles"><h3>We found several ending points for your search</h3><h4>Did you mean?</h4><ol><li class="possible-1">12th Ave, Seattle WA <a href="#">select</a></li><li class="possible-2">52 12th Ave, Seattle WA <a href="#">select</a></li></ol></div>') : "";

        // TODO: Add points to map, select behavior
        results.to.each(function(toIndex) {       
            disambiguateToMarkup.append("");
        });

        // TODO: Add points to map, select behavior
        results.from.each(function(toIndex) {       
            disambiguateFromMarkup.append("");
        });

        root.find("#trip-data")
            .html(disambiguateMarkup.append(disambiguateToMarkup + disambiguateFromMarkup));
    }

    function addFormUIBehavior() {
        var setBlankClassIfEmpty = function(element) { 
            if(jQuery(element).val() === "") {
                jQuery(element).addClass('blank');
            } else {
                jQuery(element).removeClass('blank');
            }
        }
        var zeroPad = function(value) { 
            return (parseInt(value) < 10) ? ("0" + value.toString()) : value;
        }

        // clear button behavior
        root.find('#clear').click(function() {
            root.find('#to, #from')
                .val("")
                .removeClass('ambiguous')
                .each(function() {
                    setBlankClassIfEmpty(this);
                });
                
            root.find('#disambiguation, #trip-data')
                .fadeOut('slow');
                
            map.reset();
        });
  
        // to/from
        root.find('#to, #from')
            .bind('blur, change', function() {
                setBlankClassIfEmpty(this);
            })
            .each(function() {
                setBlankClassIfEmpty(this);
            });
        
        // to/from toggle
        root.find("#tofromtoggle").click(function() {
            var tempSwapVal = root.find("#from").val();

            root.find("#from").val(root.find("#to").val())
                .each(function() {
                    setBlankClassIfEmpty(this);
                });

            root.find("#to").val(tempSwapVal)
                .each(function() {
                    setBlankClassIfEmpty(this);
                });
        });
  
        // date pickers
        var now = new Date();
 
        root.find("#leaveday")
            .val(zeroPad(now.getMonth() + 1) + "/" + zeroPad(now.getDate()) + "/" + now.getFullYear())
            .datepicker({
                showOn: "button",
                buttonImage: "img/calendar.png",
                buttonImageOnly: true
            });
	
        root.find('#leavehour')
            .val(zeroPad(now.getHours() > 12) ? (now.getHours() -12) : ((now.getHours() == 0) ? 12 : now.getHours()));

		root.find('#leaveminute')
            .val(zeroPad(now.getMinutes()))
            .bind('change', function(event, ui) {
                this.value = zeroPad(this.value);
            })
            .spinner({ min: 0, max: 59, increment: 'fast' });

        if (now.getHours() > 12) {
            root.find('#leaveampm option[value="pm"]')
                .attr('selected', 'selected');
        }          

        root.find("#leavetype, #leaveampm, #trippriority, #maxwalk").combobox();        

        // more options
        root.find('a#optionstoggle').click(function() {
            if (jQuery(this).hasClass('active')) {
                root.find('#moreoptions').hide();

                jQuery(this).html('More Options<span></span>')
                    .removeClass('active');
            } else {
                root.find('#moreoptions').show();

                jQuery(this).html('Fewer Options<span></span>')
                    .addClass('active');
            }
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

            root.find('#' + (this.id).split('-')[0] + '-results')
                .slideDown()
                .addClass("active");            

            root.find('.results').not('#' + (this.id).split('-')[0] + '-results')
                .slideUp()
                .removeClass("active");
        });
    }
        
    // constructor
    addFormUIBehavior();
    addNarrativeUIBehavior();
    
    // public methods
    return {
    };
};