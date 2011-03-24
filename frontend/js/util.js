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

    makeSentenceCase: function(str) {
        if(str === null) {
            return str;
        }

        str = str.toLowerCase().replace(/(^|\W)./g,function(c){return c.toUpperCase();});

        // assume all two letter words at end of headsign is abbreviation--all caps.
        return str.replace(/(\W[A-Z]{2}$)/ig,function(c){return c.toUpperCase();});
    }
};

// Add hash-sieving function to find unique elements in array
Array.prototype.unique = function() {
    var o = {}, i, l = this.length, r = [];
    for(i=0; i<l;i++) o[this[i]] = this[i];
    for(i in o) r.push(o[i]);
    return r;
};