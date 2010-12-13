var OTP = window.OTP || {};

OTP.Narrative = function(_root, _map) {
    var root = jQuery(_root);
    var map = _map;

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
        jQuery.ajax({
            url: "http://sea.dev.openplans.org:8080/translatis-api/ws/plan",
            dataType: "jsonp",
            data: {
                from: "",
                to: "",
                arriveBy: (jQuery("#leavetype").val() === "Arrive By"),
                date: jQuery("#leaveday").val(),
                time: jQuery("#leavehour").val() + ":" + jQuery("#leaveminute").val() + " " + jQuery("#leaveampm").val(),
                mode: "TRANSIT,WALK",
                optimize: "QUICK",
                maxWalkDistance: 840,
                wheelchair: false, //(jQuery("#accessible").val() === "on"),
                toPlace: "47.6615, -122.3123", //jQuery("#to").val(),
                fromPlace: "47.6687,-122.3757", //jQuery("#from").val(),
                intermediatePlaces: ""
            },
            beforeSend: function() {
              jQuery('#how-to-plan')
                .fadeOut("fast")
            },
            success: function(data) {
              jQuery('#trip-data')
                .fadeOut("fast")
                .empty();

              processReuslts(data);

              jQuery('#trip-data')
                .fadeIn("fast");
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
        var tripSummariesMarkup = jQuery('<table id="tripresult-summaries"><thead><tr><th>Trip</th><th>Travel Time</th><th>Cash</th><th>Route &amp; Transfers</th><tr></thead><tbody></tbody></table>');

        jQuery(data).find('itinerary').each(function(tripIndex) {
            var tripNumber = tripIndex + 1;
            var activeClass = (tripNumber == 1) ? "active" : "";
      
            var legDuration = 0;
            var transfers = jQuery(this).find('leg').size() - 1;
            var studentFare = jQuery(this).find('fare entry key:contains("student") + value cents').text();
            var seniorFare = jQuery(this).find('fare entry key:contains("senior") + value cents').text();
            var regularFare = jQuery(this).find('fare entry key:contains("regular") + value cents').text();
      
            var itineraryMarkup = jQuery('<ul class="trip-stepbystep"></ul>');
            var tripModes = [];
      
            jQuery(this).find('leg').each(function(legIndex) {       
            
             
                // why are we creating a new object here? why not just use the existing OTP format/data model? 
                var legObject=[];
                legObject.legNumber = legIndex + 1;
                legObject.mode = jQuery(this).attr('mode');
                legObject.route = jQuery(this).attr('route');
                legObject.headsign = jQuery(this).attr('headsign');
                legObject.duration = parseInt(jQuery(this).find('duration').text());
                legObject.distance = parseInt(jQuery(this).find('distance').text());
                legObject.startPlace = jQuery(this).find('from name').text();
                legObject.endPlace = jQuery(this).find('to name').text();
                legObject.startTime = new Date(jQuery(this).find('startTime').text());
                legObject.endTime = new Date(jQuery(this).find('endTime').text());
            
                legObject.startPlace = (legObject.startPlace == "") ? "Unknown" : legObject.startPlace;
                legObject.endPlace = (legObject.endPlace == "") ? "Unknown" : legObject.endPlace;
            
                var modeText = '<img src="img/' + legObject.mode.toLowerCase() + '16x16.png" alt="' + legObject.mode + '" /> ';

                if(legObject.mode != "WALK" && legObject.route != "") {
                    modeText += '<strong>' + legObject.route + '</strong> ';
                }

                tripModes.push(modeText);
        
                itineraryMarkup.append((legObject.mode == "WALK") ? formatWalkLeg(legObject) : formatTransitLeg(legObject));
            
                legDuration += legObject.duration;
            });
        
            // move to a standalone function
            jQuery('<tr id="trip' + tripNumber + '-summary" class="'+ activeClass + '"><td class="trip-id">' + tripNumber 
                + '</td><td>1 hour 38 min <em>6:15PM-7:28PM</em></td><td>jQuery9.50</td><td class="trip-modes">' + 
                tripModes.join("<em>›</em> ") + '</td></tr>').appendTo(tripSummariesMarkup.children('tbody'));

            // move to a standalone function
            jQuery('<table class="trip-prices"><thead><tr><th><h3>Trip ' + tripNumber + '</h3></th><th colspan="2">' + millisecondsToString(legDuration) + ', ' + transfers 
                + ' Transfers</th></tr></thead><tbody><tr><th scope="row">Adult</th><td>jQuery' + centsToDollars(regularFare) 
                + ' Cash</td><td>jQuery7.75 <a href="#">ORCA</a></td></tr><tr><th scope="row">Youth</th><td>jQuery' + centsToDollars(studentFare) 
                + ' Cash</td><td>jQuery7.75 <a href="#">ORCA</a></td></tr><tr><th scope="row">Senior / Disabled</th><td>jQuery' + centsToDollars(seniorFare) 
                + ' Cash</td><td>jQuery5.75 <a href="#">ORCA</a></td></tr></tbody></table>').appendTo("#trip-data");

            jQuery(itineraryMarkup).appendTo("#trip-data");
        }); // each tripIndex
        
        jQuery(tripSummariesMarkup).prependTo("#trip-data");
    }

    function formatWalkLeg(legObject) {
        return jQuery('<li class="' + legObject.mode.toLowerCase() + ' leg-' + legObject.legNumber + '"></li>').html('<img class="mode-icon" src="img/walk16x16.png" alt="' 
        + legObject.mode + '" />Walk from <strong>' + legObject.startPlace + '</strong> to <strong>' + legObject.endPlace + '</strong><div class="stepmeta">' 
        + millisecondsToString(legObject.duration) + ' (' + prettyDistance(legObject.distance) + ')</div>');
    }
  		
    function formatTransitLeg(legObject) {
        return jQuery('<li class="' + legObject.mode.toLowerCase() + ' leg-' + legObject.legNumber + '"></li>').html('<img class="mode-icon" src="img/' + legObject.mode.toLowerCase() 
        + '16x16.png" alt="' + legObject.mode + '" /><table class="substeps"><tbody><tr><td>' + prettyTime(legObject.startTime) + '</td><td>Depart ' + legObject.startPlace 
        + '<div class="stepmeta">' + millisecondsToString(legObject.duration) + ' (6 stops)<br />Previous stop is Puyllup station</div></td></tr><tr><td>' 
        + prettyTime(legObject.endTime) + '</td><td>Arrive ' + legObject.endPlace + '<div class="stepmeta">Previous stop is Puyllup station</div></td> </tr></tbody></table>');
    }
            





    function addFormUIBehavior() {
        // what does this do? do we need all this code? please comment this
		jQuery.widget("ui.combobox", {
			_create: function() {
				var self = this,
					select = this.element.hide(),
					selected = select.children( ":selected" ),
					value = selected.val() ? selected.text() : "";
				
                var input = jQuery( "<input>" )
					.insertAfter( select )
					.val( value )
					.autocomplete({
						delay: 0,
						minLength: 0,
						source: function( request, response ) {
							var matcher = new RegExp( jQuery.ui.autocomplete.escapeRegex(request.term), "i" );
							response( select.children( "option" ).map(function() {
								var text = jQuery( this ).text();
								if ( this.value && ( !request.term || matcher.test(text) ) )
									return {
										label: text.replace(
											new RegExp(
												"(?![^&;]+;)(?!<[^<>]*)(" +
												jQuery.ui.autocomplete.escapeRegex(request.term) +
												")(?![^<>]*>)(?![^&;]+;)", "gi"
											), "<strong>$1</strong>" ),
										value: text,
										option: this
									};
							}) );
						},
						select: function( event, ui ) {
							ui.item.option.selected = true;
							self._trigger( "selected", event, {
								item: ui.item.option
							});
						},
						change: function( event, ui ) {
							if ( !ui.item ) {
								var matcher = new RegExp( "^" + jQuery.ui.autocomplete.escapeRegex( jQuery(this).val() ) + "$", "i" ),
									valid = false;
								select.children( "option" ).each(function() {
									if ( this.value.match( matcher ) ) {
										this.selected = valid = true;
										return false;
									}
								});
								if ( !valid ) {
									// remove invalid value, as it didn't match anything
									jQuery( this ).val( "" );
									select.val( "" );
									return false;
								}
							}
						}
					})
					.addClass( "ui-widget ui-widget-content ui-corner-left" );

				input.data( "autocomplete" )._renderItem = function( ul, item ) {
					return jQuery( "<li></li>" )
						.data( "item.autocomplete", item )
						.append( "<a>" + item.label + "</a>" )
						.appendTo( ul );
				};

				jQuery( "<button type='button'>&nbsp;</button>" )
					.attr( "tabIndex", -1 )
					.attr( "title", "Show All Items" )
					.insertAfter( input )
					.button({
						icons: {
							primary: "ui-icon-triangle-1-s"
						},
						text: false
					})
					.removeClass( "ui-corner-all" )
					.addClass( "ui-corner-right ui-button-icon" )
					.click(function() {
						// close if already visible
						if ( input.autocomplete( "widget" ).is( ":visible" ) ) {
							input.autocomplete( "close" );
							return false;
						}

						// pass empty string as value to search for, displaying all results
						input.autocomplete( "search", "" );
						input.focus();
						return false;
					});


			}

		}); // end widget

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
        jQuery('#clear').click(function() {
            jQuery('#to, #from')
                .val("")
                .removeClass('ambiguous')
                .each(function() {
                    setBlankClassIfEmpty(this);
                });
                
            jQuery('#disambiguation, #trip-data')
                .fadeOut('slow');
        });
  
        // to/from
        jQuery('#to, #from')
            .bind('blur, change', function() {
                setBlankClassIfEmpty(this);
            })
            .each(function() {
                setBlankClassIfEmpty(this);
            });
        
        // to/from toggle
        jQuery("#tofromtoggle").click(function() {
            var tempSwapVal = jQuery("#from").val();

            jQuery("#from").val(jQuery("#to").val())
                .each(function() {
                    setBlankClassIfEmpty(this);
                });

            jQuery("#to").val(tempSwapVal)
                .each(function() {
                    setBlankClassIfEmpty(this);
                });
        });
  
        // date pickers
        var now = new Date();
 
        jQuery("#leaveday")
            .val(zeroPad(now.getMonth() + 1) + "/" + zeroPad(now.getDate()) + "/" + now.getFullYear())
            .datepicker({
                showOn: "button",
                buttonImage: "img/calendar.png",
                buttonImageOnly: true
            });
	
        jQuery('#leavehour')
            .val((now.getHours() > 12) ? (now.getHours() -12) : ((now.getHours() == 0) ? 12 : now.getHours()));

		jQuery('#leaveminute')
            .val(zeroPad(now.getMinutes()))
            .bind('change', function(event, ui) {
                this.value = zeroPad(this.value);
            })
            .spinner({ min: 0, max: 59, increment: 'fast' });

        if (now.getHours() > 12) {
            jQuery('#leaveampm option[value="pm"]')
                .attr('selected', 'selected');
        }          

        jQuery("#leavetype, #leaveampm, #trippriority, #maxwalk").combobox();        

        // more options
        jQuery('a#optionstoggle').click(function() {
            if (jQuery(this).hasClass('active')) {
                jQuery('#moreoptions').hide();

                jQuery(this).html('More Options<span></span>')
                    .removeClass('active');
            } else {
                jQuery('#moreoptions').show();

                jQuery(this).html('Fewer Options<span></span>')
                    .addClass('active');
            }
        });

        // form submit action
        jQuery("form#trip-plan-form").submit(function(e) {
            e.preventDefault();
            
            makeTripRequest();
        });

    }
    
    function addNarrativeUIBehavior() {
        // table row focus
        jQuery('#tripresult-summaries tbody tr').click(function() {
            jQuery('#tripresult-summaries tr').removeClass("active");
            jQuery(this).addClass("active");

            jQuery('#' + (this.id).split('-')[0] + '-results')
                .slideDown()
                .addClass("active");            

            jQuery('.results').not('#' + (this.id).split('-')[0] + '-results')
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