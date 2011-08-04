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

OTP.Util = {
    centsToDollars: function(cents) {
        try {
            return parseFloat(cents/100).toFixed(2);
        } catch(e) {
            return null;
        }
    },

    metersToMiles: function(meters) {
        try {
            return parseFloat(meters / 1609.344).toFixed(1);
        } catch(e) {
            return null;
        }
    },

    metersToFeet: function(meters) {
        try {
            return parseInt(meters * 3.2808, 10);
        } catch(e) {
            return null;
        }
    },

    metersToPrettyDistance: function(meters) {
        if (meters === null) {
            return "Unknown";
        }

        var miles = OTP.Util.metersToMiles(meters);

        if(miles === null) {
            return "Unknown";
        }

        // Display distances < 0.1 miles in feet
        if (miles < 0.1) {
            var feet = OTP.Util.metersToFeet(meters);
            
            if(feet === null) {
                return "Unknown";
            }
            
            return feet + " ft";
        } else {
            return miles + " mi";
        }
    },

    // FIXME: potential timezone issues?
    // adapted from http://anentropic.wordpress.com/2009/06/25/javascript-iso8601-parser-and-pretty-dates/
    ISO8601StringToDate: function(str) {
        if(str === null) {
            return null;
        }

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
    },

    millisecondsToString: function(ms) {
        var msecondsPerMinute = 1000 * 60;
        var msecondsPerHour = msecondsPerMinute * 60;

        try {
            ms = parseFloat(ms);
            
            if(isNaN(ms)) {
                return "Unknown";
            }
        } catch(e) {
            return "Unknown";
        }

        var hours = Math.floor(ms / msecondsPerHour);
        var interval = ms - (hours * msecondsPerHour);
        var minutes = Math.floor(interval / msecondsPerMinute);

        var hourString = (hours > 0) ? ((hours === 1) ? hours + " hour, " : hours + " hours, ") : false;
        var minuteString = minutes + " min";

        if(hourString) {
            return hourString + minuteString;
        } else {
            return minuteString;
        }
    },

    dateToPrettyTime: function(date) {
        if(date === null) {
            return "Unknown";
        }
        
        var minutes = date.getMinutes();
        minutes = (minutes < 10) ? "0" + minutes : "" + minutes;

        var hours = date.getHours();
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
    },

    dateToPrettyDate: function(date) {
        if(date === null) {
            return "Unknown";
        }
        
        var month = date.getMonth() + 1;
        month = (month < 10) ? "0" + month : "" + month;

        var day = date.getDay();
        day = (day < 10) ? "0" + day : "" + day;
        
        return month + "/" + day + "/" + (date.getYear() + 1900);
    },

    makeSentenceCase: function(str) {
        if(str === null) {
            return str;
        }

        str = str.toLowerCase().replace(/(^|\W)./g,function(c){return c.toUpperCase();});

        // assume all two letter words at end of headsign is abbreviation--all caps.
        return str.replace(/(\W[A-Z]{2}$)/ig,function(c){return c.toUpperCase();});
    },

    getParameterByName: function(name, defaultValue) {
        name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
        var regexS = "[\\?&]"+name+"=([^&#]*)";
        var regex = new RegExp(regexS);
        var results = regex.exec(window.location.href);
        if(results == null) {
                return defaultValue;
        } else {
                return decodeURIComponent(results[1].replace(/\+/g, " "));
        }
    },

    // leg narrative formatting
    formatLeg: function(legIndex, leg) {
        if(leg === null) {
            return null;
        }
        
        if(leg["@mode"] === "WALK") {
            var html = '<img class="mode-icon" src="' + OTP.Config.tripPlannerImagePath + 'walk16x16.png" alt="Walk" />' +
                            'Walk from <strong>' + ((leg.from.name !== null) ? leg.from.name : "Unknown") + '</strong> to <strong>' + ((leg.to.name !== null) ? leg.to.name : "Unknown") + '</strong>';

            html += '<table class="substeps"><tbody>';

            var stepCollection = null;
            if(leg.steps.walkSteps instanceof Array) {
                stepCollection = leg.steps.walkSteps;
            } else {
                stepCollection = [leg.steps.walkSteps];
            }

            var stepNumber = 1;
            var lastStreetName = "unknown street";
            jQuery.each(stepCollection, function(i, walkStep) {
                if(typeof walkStep["@nil"] !== 'undefined') {
                    return;
                }

                html += '<tr><td>' + stepNumber + '. ';

                if(typeof walkStep.absoluteDirection !== 'undefined') {
                    html += 'Walk ' + walkStep.absoluteDirection.toLowerCase() + ' on <strong>' + walkStep.streetName + '</strong>';
                } else {
                    var relativeDirection = walkStep.relativeDirection.toLowerCase();

                    if(relativeDirection === "continue") {
                        html += 'Continue on <strong>' + walkStep.streetName + '</strong>';
                    } else if(walkStep.stayOn === true) {
                        html += 'Proceed ' + relativeDirection + ' to stay on <strong>' + walkStep.streetName + '</strong>';
                    } else if(walkStep.becomes === true) {
                        html += 'Continue ' + relativeDirection + ' as <strong>' + lastStreetName + '</strong> becomes <strong>' + walkStep.streetName + '</strong>';
                    } else {
                        html += 'Turn ' + relativeDirection + ' at <strong>' + walkStep.streetName + '</strong>';
                    }
                }

                if(i === stepCollection.length - 1) {
                    html += '<div class="stepmeta">' + OTP.Util.millisecondsToString(leg.duration) + ' (' + OTP.Util.metersToPrettyDistance(leg.distance) + ')</div>';
                }

                html += '</td></tr>';

                lastStreetName = walkStep.streetName;
                stepNumber++;
            });

            html += '</tbody></table>';

            return jQuery('<li class="walk leg-' + legIndex + '"></li>').html(html);
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
                    '<img class="mode-icon" src="' + OTP.Config.tripPlannerImagePath + OTP.Agency.getModeLabelForLeg(leg["@mode"], leg["@route"]).toLowerCase() + '16x16.png" alt="' + OTP.Agency.getModeLabelForLeg(leg["@mode"], leg["@route"]) + '" />' + 
                        OTP.Util.makeSentenceCase(leg["@mode"]) + ' - ' + 
                            '<a href="' + OTP.Agency.getURLForLeg(leg["@agencyId"], leg["@route"]) + '" class="agency" target="_new">' + 
                                OTP.Agency.getAgencyNameForLeg(leg["@agencyId"], leg["@route"]) + 
                            '</a>' + 
                            ' <strong>' + OTP.Agency.getDisplayNameForLeg(leg["@mode"], leg["@route"]) + '</strong> ' +
                            OTP.Agency.getFormattedHeadsign(leg["@route"], leg["@headsign"]) + 
                    '<table class="substeps"><tbody>' + 
                    '<tr><td>' + OTP.Util.dateToPrettyTime(OTP.Util.ISO8601StringToDate(leg.startTime)) + '</td><td>Depart ' + ((leg.from.name !== null) ? leg.from.name : "Unknown") + '</div></td></tr>' + 
                    '<tr><td>' + OTP.Util.dateToPrettyTime(OTP.Util.ISO8601StringToDate(leg.endTime)) + '</td><td>Arrive ' + ((leg.to.name !== null) ? leg.to.name : "Unknown") + 
                        '<div class="stepmeta">' +
                            OTP.Util.millisecondsToString(leg.duration) + ((stopsPassed >= 0) ? ' (' + stopsPassed + ' stop' + ((stopsPassed === 1) ? '' : 's') + ')' : '') +
                            '<br />Previous stop is ' + previousToStop + 
                        '</div>' + 
                    '</td></tr>' + 
                    '</tbody></table>')
                    .addClass(leg["@agencyId"] + OTP.Agency.getDisplayNameForLeg(leg["@mode"], leg["@route"]));
        }
    },
    
    formatLegInfoWindowHtml: function(leg) {
        // walk legs don't get an info marker window
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
};

// Add hash-sieving function to find unique elements in array
Array.prototype.unique = function() {
    var o = {}, i, l = this.length, r = [];
    for(i=0; i<l;i++) o[this[i]] = this[i];
    for(i in o) r.push(o[i]);
    return r;
};