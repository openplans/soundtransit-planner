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

OTP.NarrativeForm = function(_root, map) {
    var originalTo = null;
    var originalFrom = null;
    
    if(typeof _root === 'undefined' || _root === null) {
        return null;
    }

    // DOM elements
    var root = jQuery(_root);

    function setBlankClassIfEmpty(element) {
        if(jQuery(element).val() === "") {
            jQuery(element).addClass('blank');
        } else {
            jQuery(element).removeClass('blank');
        }
    }

    function incrementAtMax(element) {
        var hoursField = root.find('#leavehour');
        var ampmField = root.find('#leaveampm');

        if (parseInt(hoursField.val(), 10) > 11) {
            hoursField.val(1);
        } else {
            hoursField.val(parseInt(hoursField.val(), 10) + 1);
            if (hoursField.val() === 12) {
                ampmField.val((ampmField.val() === 'am') ? 'pm' : 'am').trigger('change');
            }
        }
        element.val('0');
    }

    function decrementAtMin(element) {
        var hoursField = root.find('#leavehour');
        var ampmField = root.find('#leaveampm');
        
        if (parseInt(hoursField.val(), 10) < 2) {
            hoursField.val(12);
        } else {
            hoursField.val(parseInt(hoursField.val(), 10) - 1);
            if (hoursField.val() === 11) {
                ampmField.val((ampmField.val() === 'am') ? 'pm' : 'am').trigger('change');
            }
        }
        element.val('59');
    }

    function zeroPad(value) {
        return (parseInt(value, 10) < 10) ? ("0" + value.toString()) : value;
    }

    // behaviors
    function addFormUIBehavior() {
        // feedback button
        root.find("#feedback").click(function() {
            var feedbackUrl = OTP.Config.feedbackUrl;

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

            var agenciesUsed = [];
            root.find(".results.active .trip-stepbystep li").each(function(e) {
                var leg = jQuery(this);
                if(leg.hasClass("walk")) {
                    return;
                }
                agenciesUsed.push(leg.find("a.agency").text());
            });

            feedbackUrl += "&from=" + escape(root.find("#from").val());
            feedbackUrl += "&to=" + escape(root.find("#to").val());
            feedbackUrl += "&leavetype=" + escape(root.find("#leavetype option:selected").val());
            feedbackUrl += "&leavedate=" + escape(root.find("#leaveday").val());
            feedbackUrl += "&leavetime=" + escape(root.find("#leavehour").val() + ":" + root.find("#leaveminute").val() + " " + root.find("#leaveampm option:selected").val());
            feedbackUrl += "&trippriority=" + escape(root.find("#trippriority option:selected").val());
            feedbackUrl += "&maxwalk=" + escape(root.find("#maxwalk option:selected").val());
            feedbackUrl += "&mode=" + escape(includeModes);
            feedbackUrl += "&originalTo=" + escape(originalTo);
            feedbackUrl += "&originalFrom=" + escape(originalFrom);
            feedbackUrl += "&agenciesUsed=" + escape(agenciesUsed.unique().join(","));
            feedbackUrl += "&accessible=" + (root.find("#maxwalk").attr("checked") === true);

            window.open(feedbackUrl);

            return false;
        });
        
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
                .html('<div id="how-to-plan"></div>')
                .fadeIn('slow');

            if(typeof map !== 'undefined' && map !== null) {
                map.reset();
            }

            return false;
        });

        // help button behavior
        root.find("#help").click(function() {
            jQuery.fancybox(
                root.find("#help-content").html(),
                {
                    'autoDimensions': false,
                    'width': 700,
                    'height': 400
                }
            );
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
                buttonImage: OTP.Config.tripPlannerImagePath + "calendar.png",
                buttonImageOnly: true
            });
  
        root.find('#leavehour')
            .val((now.getHours() > 12) ? (now.getHours() - 12) : ((now.getHours() === 0) ? 12 : now.getHours()))
            .bind('change', function(event, ui) {
                try {
                    var v = parseInt(this.value, 10);
                    if(v <= 0 || isNaN(v)) {
                        this.value = "1";
                    } else if(v > 12) {
                        this.value = "12";
                    }
                } catch(e) {
                    this.value = "1";
                }
            });
            
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

                jQuery(this).html('Advanced Search<span> </span>')
                    .removeClass('active');
            } else {
                root.find('#moreoptions').show();

                jQuery(this).html('Simple Search<span> </span>')
                    .addClass('active');
            }
            
            return false;
        });
    }

    root.find("form#trip-plan-form").submit(function(e) {
        if(originalTo === null) {
            originalTo = root.find("#to").val();
        }
        
        if(originalFrom === null) {
            originalFrom = root.find("#from").val();
        }
    });

    // constructor
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
        }        
    };
};
