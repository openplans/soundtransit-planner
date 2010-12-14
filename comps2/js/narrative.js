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

        var hourString = (hours > 0) ? ((hours == 1) ? hours + " hour, " : hours + " hours, ") : false;
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
        return parseInt(meters * 3.2808);
    }
      
    function prettyDistance(meters) {
        if (meters == null || typeof meters == 'undefined') {
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
                mode: "TRANSIT,WALK",
                optimize: root.find("#trippriority").val(),
                maxWalkDistance: root.find("#maxwalk").val(),
                wheelchair: (root.find("#accessible").checked === true),
                toPlace: "47.6615, -122.3123", //jQuery("#to").val(),
                fromPlace: "47.6687,-122.3757", //jQuery("#from").val(),
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
                    
                    processResults(data);
                    
                    root.find('#trip-data')
                        .fadeIn("fast");
                }
            },
            error:function(x,e){
                    if(x.status==0){
                    alert('You are offline!!\n Please Check Your Network.');
                    }else if(x.status==404){
                    alert('Requested URL not found.');
                    }else if(x.status==500){
                    alert('Internal Server Error.');
                    }else if(e=='parsererror'){
                    alert('Error.\nParsing JSON Request failed.');
                    }else if(e=='timeout'){
                    alert('Request Time out.');
                    }else {
                    alert('Unknown Error.\n'+x.responseText);
                    }
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
            var tripDuration = 0;
            var transfers = trip.legs.leg.length - 1;
            
            // FIXME
            var studentFare = 0.0;
            var seniorFare = 0.0;
            var regularFare = 0.0;

            var itineraryMarkup = jQuery('<ul class="trip-stepbystep"></ul>');

            jQuery.each(trip.legs.leg, function(legIndex, leg) {
                var modeText = '<img src="img/' + leg.@mode.toLowerCase() + '16x16.png" alt="' + leg.@mode + '" /> ';

                if(leg.@mode !== "WALK" && leg.@route !== "") {
                    modeText += '<strong>' + leg.@route + '</strong> ';
                }

                tripModes.push(modeText);
                itineraryMarkup.append((leg.@mode === "WALK") ? formatWalkLeg(legIndex, leg) : formatTransitLeg(legIndex, leg));
                tripDuration += leg.duration;
            });

            // move to a standalone function
            var activeClass = (tripNumber === 1) ? "active" : "";
            
            jQuery('<tr id="trip' + tripNumber + '-summary" class="'+ activeClass + '">' +
                    '<td class="trip-id">' + tripNumber + '</td>' +
                    '<td>1 hour 38 min <em>6:15PM-7:28PM</em></td>' + 
                    '<td>$9.50</td>' + 
                    '<td class="trip-modes">' + tripModes.join("<em>›</em> ") + '</td>' + 
                    '</tr>')
                    .appendTo(tripSummariesMarkup.children('tbody'));

            // move to a standalone function
            jQuery('<table class="trip-prices">' + 
                    '<thead><tr><th><h3>Trip ' + tripNumber + '</h3></th><th colspan="2">' + millisecondsToString(tripDuration) + ', ' + transfers + ' Transfers</th></tr></thead>' + 
                    '<tbody>' + 
                    '<tr><th scope="row">Adult</th><td>$' + centsToDollars(regularFare) + ' Cash</td><td>$7.75 <a href="#">ORCA</a></td></tr>' +
                    '<tr><th scope="row">Youth</th><td>$' + centsToDollars(studentFare) + ' Cash</td><td>$7.75 <a href="#">ORCA</a></td></tr>' + 
                    '<tr><th scope="row">Senior / Disabled</th><td>$' + centsToDollars(seniorFare) + ' Cash</td><td>$5.75 <a href="#">ORCA</a></td></tr>' + 
                    '</tbody></table>')
                    .appendTo(root.find("#trip-data"));

            jQuery(itineraryMarkup).appendTo(root.find("#trip-data"));
        }); // each tripIndex
        
        jQuery(tripSummariesMarkup).prependTo(root.find("#trip-data"));
        
        map.zoomToPlannedRoute();
        
        tripIndex++;
    }

    function formatWalkLeg(legIndex, leg) {
        // add polyline to map
        map.addLeg(leg.@mode, leg.legGeometry.points);
        
        // FIXME
        return jQuery('<li class="' + leg.@mode.toLowerCase() + ' leg-' + legIndex + '"></li>').html(
                    '<img class="mode-icon" src="img/walk16x16.png" alt="' + leg.@mode + '" />' +
                    'Walk from <strong>' + ((typeof leg.startPlace !== 'undefined' && leg.startPlace !== null) ? leg.startPlace : "Unknown") + '</strong> to <strong>' + ((typeof leg.endPlace !== 'undefined' && leg.endPlace !== null) ? leg.endPlace : "Unknown") + '</strong>' + 
                    '<div class="stepmeta">' + millisecondsToString(0) + ' (' + prettyDistance(0) + ')</div>');
    }

    function formatTransitLeg(legIndex, leg) {
        // add polyline to map
        map.addLeg(leg.@mode, leg.legGeometry.points);

        // FIXME
        return jQuery('<li class="' + leg.@mode.toLowerCase() + ' leg-' + legIndex + '"></li>').html(
                    '<img class="mode-icon" src="img/' + leg.@mode.toLowerCase() + '16x16.png" alt="' + leg.@mode + '" /><table class="substeps"><tbody>' + 
                    '<tr><td>' + prettyTime(new Date(leg.startTime)) + '</td><td>Depart ' + ((leg.from.name !== null) ? leg.from.name : "Unknown") + '<div class="stepmeta">' + millisecondsToString(leg.duration) + ' (6 stops)<br />Previous stop is Puyllup station</div></td></tr>' + 
                    '<tr><td>' + prettyTime(new Date(leg.endTime)) + '</td><td>Arrive ' + ((leg.to.name !== null) ? leg.to.name : "Unknown") + '<div class="stepmeta">Previous stop is Puyllup station</div></td></tr>' + 
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
            if(jQuery(element).val() == "") {
                jQuery(element).addClass('blank');
            } else {
                jQuery(element).removeClass('blank');
            }
        }
        var zeroPad = function(value) { 
            return (parseInt(value) < 10) ? ("0" + value) : value;
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