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

OTP.Config = {
    wfsServiceUrl: "http://sea.dev.openplans.org:8080/geoserver/wfs",

    serviceAlertAggregatorUrl: "http://sea.dev.openplans.org:8080/delayfeeder/ws/status",

    feedbackUrl: "http://survey.soundtransit.org/fs.aspx?surveyid=8b406e435904b11a9c611932519ca44",

    atisProxyServiceUrl: "http://sea.dev.openplans.org:8080/translatis-api/ws/planP",
    atisProxyScheduleUrl: "http://sea.dev.openplans.org:8080/translatis-api/ws/schedule",
    atisProxyStopsUrl: "http://sea.dev.openplans.org:8080/translatis-api/ws/routestops",

    bingMapsKey: "AgszXQ8Q5lbiJFYujII-Lcie9XQ-1DK3a2X7xWJmfSeipw8BAAF0ETX8AJ4K-PDm",

    tripPlannerPrintUrl: "tripplanner_printable.php",
    systemMapPrintUrl: "map_printable.php",

    openLayersUIImagePath: "js/openlayers/img/",
    tripPlannerImagePath: "images/tripplanner/"
};