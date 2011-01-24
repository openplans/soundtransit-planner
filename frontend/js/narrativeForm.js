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

OTP.NarrativeForm = function(_root) {
    if(typeof _root === 'undefined' || _root === null) {
        return null;
    }

    // DOM elements
    var root = jQuery(_root);

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

    }

    // constructor
    addFormUIBehavior();

    // public methods
    return {};
};