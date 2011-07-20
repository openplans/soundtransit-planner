<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN"
  "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<!--
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
-->
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=8" />

    <title>Trip Planner: Printable Page</title>

    <!--INCLUDE ALL OF THESE FILES IN A PRODUCTION DEPLOYMENT, IN THIS ORDER-->
    <link type="text/css" href="css/screen-reset.css" rel="stylesheet" media="screen, projection" />
    <link type="text/css" href="css/print-reset.css" rel="stylesheet" media="print" />

    <link type="text/css" href="css/tripplanner/otp-screen.css" rel="stylesheet" media="screen, projection, print" />
    <link type="text/css" href="css/tripplanner/otp-printable-screen.css" rel="stylesheet" media="screen, projection, print" />
    <link type="text/css" href="css/tripplanner/otp-printable-print.css" rel="stylesheet" media="print" />
    <!--[if lt IE 8]><link rel="stylesheet" href="css/ie.css" type="text/css" media="screen, projection, print"><![endif]-->

    <script type="text/javascript" src="js/jquery/jquery-1.4.2.min.js"></script>
    <script type="text/javascript" src="js/jquery/jquery-jsonp.min.js"></script>
    <script type="text/javascript" src="js/openlayers/OpenLayers.js"></script>

    <script type="text/javascript" src="js/config.js"></script>
    <script type="text/javascript" src="js/util.js"></script>
    <script type="text/javascript" src="js/agency.js"></script>
    <script type="text/javascript" src="js/map.js"></script>
    <script type="text/javascript" src="js/printableTripPlanner.js"></script>

    <script type="text/javascript">
        function init() {
            OTP.PrintableTripPlanner();
        }

        /*
            Needed for OpenLayers--do not remove! 
        */    
        if(jQuery.browser.msie) {
            window.onload = init;
        } else {
            jQuery(document).ready(init);
        }
    </script>
</head>

<body class="map_text">
    <div id="print-controls">
        <ul>
            <li><a href="#" id="map_text" class="selected">Map &amp; Text</a></li>
            <li><a href="#" id="map_only">Map</a></li>
            <li><a href="#" id="text_only">Text</a></li>
        </ul>
        <a id="print" href="#">Print</a>
    </div>
    <div id="trip-header">
        <div id="from-label">
            <img src="images/tripplanner/a-flag.png" alt="A Flag (From)"/>
            <h1>Loading...</h1>
            <p></p>
        </div>
        <div id="to-label">
            <img src="images/tripplanner/b-flag.png" alt="B Flag (To)"/>
            <h1>Loading...</h1>
            <p></p>
        </div>
        <div id="travelTime">
            <span>Travel Time:</span> 
            <p></p>
        </div>
        <div id="fare">
            <span>Fare: Cash (ORCA)</span>
            <ul></ul>
        </div>
    </div>
    <div id="map_wrapper">
        <div id="map">
            <div id="loading"><p>Loading...</p></div>
            <div id="atis-credits">ATIS: Powered by Trapeze</div>
        </div>
    </div>
    <div id="details">
        <ul id="narrative" class="trip-stepbystep"></ul>
        <div id="toDetailMap">
            <div id="loading"><p>Loading...</p></div>
        </div>
        <div id="fromDetailMap">
            <div id="loading"><p>Loading...</p></div>
        </div>
    </div>
</body>
</html>
