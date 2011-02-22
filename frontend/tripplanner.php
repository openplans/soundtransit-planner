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
    <title>Trip Planner</title>

    <!--INCLUDE ALL OF THESE FILES IN A PRODUCTION DEPLOYMENT, IN THIS ORDER-->
    <link type="text/css" href="css/screen-reset.css" rel="stylesheet" media="screen, projection" />
    <link type="text/css" href="css/print-reset.css" rel="stylesheet" media="print" />
    <link type="text/css" href="css/jquery/ui-custom/jquery-ui-1.8.6.custom.css" rel="stylesheet" media="screen, projection" />
    <link type="text/css" href="css/jquery/ui.selectmenu.css" rel="stylesheet" media="screen, projection" />
    <link type="text/css" href="css/jquery/ui.spinner.css" rel="stylesheet" media="screen, projection" />
    <link type="text/css" href="css/jquery/fancybox.css" rel="stylesheet" media="screen, projection" />
    <link type="text/css" href="css/otp.css" rel="stylesheet" media="screen, projection" />
    <!--[if lt IE 8]><link rel="stylesheet" href="css/ie.css" type="text/css" media="screen, projection"><![endif]-->

    <!--DO NOT INCLUDE THE FILE BELOW IN A PRODUCTION DEPLOYMENT - FOR DEMO ONLY-->
    <link type="text/css" href="css/demo.css" rel="stylesheet" media="screen, projection" />

    <!--INCLUDE ALL OF THESE FILES IN A PRODUCTION DEPLOYMENT, IN THIS ORDER-->
    <script type="text/javascript" src="js/jquery/jquery-1.4.2.min.js"></script>
    <script type="text/javascript" src="js/jquery/jquery-jsonp.min.js"></script>
    <script type="text/javascript" src="js/jquery/jquery-ui-1.8.6.custom.min.js"></script>
    <script type="text/javascript" src="js/jquery/jquery-ui-selectmenu.min.js"></script>
    <script type="text/javascript" src="js/jquery/jquery-ui-spinner.min.js"></script>
    <script type="text/javascript" src="js/jquery/jquery-fancybox.min.js"></script>
    <script type="text/javascript" src="js/openlayers/OpenLayers.js"></script>
    <script type="text/javascript" src="js/config.js"></script>
    <script type="text/javascript" src="js/util.js"></script>
    <script type="text/javascript" src="js/agency.js"></script>
    <script type="text/javascript" src="js/narrativeForm.js"></script>
    <script type="text/javascript" src="js/narrative.js"></script>
    <script type="text/javascript" src="js/map.js"></script>
  
    <!--THE BLOCK BELOW IS SPECIFIC TO THIS PAGE AND USE CASE-->
    <script type="text/javascript">
        function init() {
            // INITIALIZE THE TRIP PLANNER PANEL--PASS IN THE DOM NODE FOR THE PLANNER PANEL, MAP AND MAP CONTROLS AS BELOW.
            var narrative = OTP.Narrative(document.getElementById("plannerpanel"), document.getElementById("map"), document.getElementById("map-controls"));

            // SET PROPERTIES PASSED TO US FROM THE HOMEPAGE OR ANOTHER FORM
            <?php
                if(isset($_REQUEST['from'])) 
                    echo "narrative.setFrom('" . $_REQUEST['from'] . "');\n";

                if(isset($_REQUEST['to'])) 
                    echo "narrative.setTo('" . $_REQUEST['to'] . "');\n";

                if(isset($_REQUEST['leavetype'])) 
                    echo "narrative.setLeaveType('" . $_REQUEST['leavetype'] . "');\n";

                if(isset($_REQUEST['leaveday'])) 
                    echo "narrative.setDay('" . $_REQUEST['leaveday'] . "');\n";

                if(isset($_REQUEST['leavehour'])) 
                    echo "narrative.setHour('" . $_REQUEST['leavehour'] . "');\n";

                if(isset($_REQUEST['leaveminute'])) 
                    echo "narrative.setMinute('" . $_REQUEST['leaveminute'] . "');\n";

                if(isset($_REQUEST['leaveampm'])) 
                    echo "narrative.setAmPm('" . $_REQUEST['leaveampm'] . "');\n";

                if(isset($_REQUEST['trippriority'])) 
                    echo "narrative.setTripPriority('" . $_REQUEST['trippriority'] . "');\n";

                if(isset($_REQUEST['maxwalk'])) 
                    echo "narrative.setMaxWalk('" . $_REQUEST['maxwalk'] . "');\n";

                if(isset($_REQUEST['accessible'])) 
                    echo "narrative.setAccessible('true');\n";
                    
                // submit form if to/from is set
                if(isset($_REQUEST['from']) && isset($_REQUEST['to']) && $_REQUEST['from'] != "" && $_REQUEST['to'] != "") {
                    echo "narrative.planTrip();\n";
                }
            ?>
        }

        if(jQuery.browser.msie) {
            window.onload = init;
        } else {
            jQuery(document).ready(init);
        }     
    </script>
</head>

<body class="tripplanner">
    
    <!--THIS BLOCK IS FOR USER TESTING ONLY. REMOVE IN A PRODUCTION DEPLOYMENT-->
    <div class="demolinks">
        <a class="home" href="home.php">Home</a>
        <a class="map" href="map.php">Home</a>
        <a class="schedule" href="schedule.php">Home</a>
        <a class="tripplanner" href="tripplanner.php">Home</a>
    </div>
    <!--END-->
    
<div id="map-controls">
    <div id="map-controls-wrap">
        <div id="base-layers">
            <strong>View:</strong> <a id="base-road" class="active" href="#">Road</a> | <a id="base-aerial" href="#">Aerial</a>
        </div>
        <div id="toggle-layers">
            <strong>Show on map:</strong> 
            
            <a id="toggle-fares" href="#">Fares</a>
            <a id="toggle-parking" href="#">Parking</a>
            <a id="toggle-location" href="#">Locations</a>
        </div>
    </div>
</div>
<div id="tripplanner-wrap">
  <div id="plannerpanel">
    <div class="form-meta">
      <a id="clear" href="#">Clear</a> <a id="help" href="#">Help</a>
    </div>
    <h2>Plan your trip!</h2>
    <form id="trip-plan-form">
      <div id="tofrom-area">
        <div class="ui-widget">
          <label for="from"><img class="tripflag" src="images/tripplanner/a-flag.png" alt="A" /> <strong>Start</strong> Address, intersection, or landmark</label>
          <input name="from" id="from" type="text" value="" />
        </div>
        <div class="ui-widget">
          <label for="to"><img class="tripflag" src="images/tripplanner/b-flag.png" alt="B" /> <strong>End</strong> Address, intersection, or landmark</label>
          <input name="to" id="to" type="text" value="" />
        </div>
        <a id="tofromtoggle" href="#" title="Reverse To/From Locations">toggle</a>
      </div>
      <div class="ui-widget">
        <span id="leavetype-wrap">
          <select id="leavetype" name="leavetype">
            <option value="Arrive By">Arrive By</option>
            <option value="Leave At" selected="selected">Leave At</option>
          </select>
        </span>
        <span id="leaveday-wrap"><input name="leaveday" id="leaveday" type="text" /></span>
        <input id="leavehour" name="leavehour" type="text" value="12" />:<input id="leaveminute" name="leaveminute" type="text" value="00" />
        <span id="leaveampm-wrap">
          <select id="leaveampm" name="leaveampm"/>
            <option value="am">am</option>
            <option value="pm">pm</option>
          </select>
        </span>
      </div>
      <div id="moreoptions" class="ui-widget">
        <span id="trippriority-wrap">
          <select id="trippriority" name="trippriority">
            <option value="TRANSFERS">Fewest Transfers</option>
            <option value="QUICK" selected="selected">Fastest Trip</option>
          </select>
        </span>
        <span id="maxwalk-wrap">
          <select id="maxwalk" name="maxwalk">
          <option value="420">1/4 mile max walk</option>
          <option value="840" selected="true">1/2 mile max walk</option>
            <option value="1260">3/4 mile max walk</option>
            <option value="1680">1 mile max walk</option>
          </select>
        </span>
        <div id="mode-area"><span>Include mode:</span><label><input name="bus" type="checkbox" id="bus" value="BUSISH" checked="true"/><span id="bus_label">Bus</span></label><label><input name="train" type="checkbox" checked="true" value="TRAINISH" id="train" /><span id="sounder_label">Sounder</span><span id="link_label">Link</span></label></div>
        <div id="accessible-area"><span>Accessible trip:</span><label><input name="accessible" type="checkbox" id="accessible" /><span id="wheelchair_accessible_label">Wheelchair Accessible</span></label></div>
      </div>
      <div class="ui-widget">
        <input id="trip-submit" type="submit" value="Plan Trip" />
        <a id="optionstoggle" href="#">Advanced Search<span> </span></a>
      </div>
    </form>
    <div id="trip-data">
      <div id="how-to-plan"></div>
    </div><!-- /#trip-data -->
    <div id="help-content">
        <div class="section">
            <h1>Plan your trip</h1>
            
            <p>
            <strong>Enter information in the start and end boxes</strong>
            <ul>
                <li>By address: Enter the street address, you don’t need to enter city, state or zip code.</li>
                <li>By intersection: Enter cross streets for your start or end point. Separate the two street names with &amp;, and, or @.</li>
                <li>By landmark: Enter the name of transit center, city office, business or school. Note: not all landmarks are available in the trip planner. If you don’t find the landmark you are looking for, try entering the address or intersection.</li>
                <li>To reverse your trip, click the arrow (<img src="images/tripplanner/toggle.png" alt="reverse arrow"/>)</li>
            </ul>
            </p>
            
            <p>
            <strong>Select your location on the map</strong>
            <ul>
                <li>Zoom into the map to the location you want to start or end from</li>
                <li>Right click (or Control Click on a Mac) to select a start or end point</li>
                <li>To change the start or end point, drag the flag to a new location</li>
            </ul>
            </p>

            <p>
            <strong>Refining your results</strong>
            <ul>
                <li>You will get the most accurate results using an address or intersection as your start end points</li>
                <li>If the trip planner does not have an exact match, you can select a match from the list or try to search again.</li> 
            </ul>
            </p>
        </div>
    
        <div class="section">
            <h1>Selecting date and time</h1>

            <p>
                <ul>
                    <li><strong>Leave at</strong> – Set the time you’d like to leave your starting point.</li>
                    <li><strong>Arrive by</strong> – Set the time you’d like to arrive at your end point.</li>
                    <li><strong>Date</strong> – Set the specific day of your trip. Note that schedules differ on weekends and holidays.</li>
                    <li><strong>Time</strong> – Set the time of your trip. Note be sure to change am/pm if necessary.</li>
                </ul>
            </p>
        </div>

        <div class="section">
            <h1>Advanced search</h1>

            <p>
                <ul>
                    <li><strong>Fastest trip</strong> – Choose this option to find the trip that takes the shortest amount of time from start to finish.</li> 
                    <li><strong>Fewest transfers</strong> – Choose this option to find the trip with the fewest number of transfers between buses.</li>
                    <li><strong>Walking distance</strong> – Select how long you are willing to walk to the start or end point of your trip. Selecting a longer walking distance often provides more trip options. </li>
                </ul>
            </p>
        </div>

        <div class="section">
            <h1>Using the map</h1>

            <p>
                <ul>
                    <li><strong>Plan a trip</strong> – you can plan a trip using the map by selecting a start or end point by right clicking (or control clicking on a Mac).</li>
                    <li><strong>Change your trip</strong> - to change your trip, drag the start or end point on the map. A new route and results will appear in the left.</li>
                    <li><strong>Zoom</strong> – to change the zoom on the map, use the gray slider on the left of the map.</li>
                    <li><strong>Make the map larger</strong> – to make the map bigger, click on the double arrow on the left middle of the map. Click it again to return the map to its original size. (<span id="icon_help_resize">Resize Icon</span>)</li>
                    <li><strong>Show on the map</strong> – Click the icon in the upper right to see the following:</li>
                    <ul>
                        <li>Fares <img src="images/tripplanner/fares-icon.png" alt="Fares Icon"/></li>
                        <li>Parking <img src="images/tripplanner/parking-icon.png" alt="Parking Icon"/></li>
                        <li>Stops <img src="images/tripplanner/location-icon.png" alt="Stops Icon"/></li>
                    </ul>
                </ul>
        </div>
    </div>
  </div><!-- /#plannerpanel --> 
  <div id="map">
    <div id="loading"><p>Loading...</p></div>
    <div id="atis-credits">ATIS: Powered by Trapeze</div>
    <a id="toggle-map-width" href="#" title="Show Map Full Screen">&nbsp;</a>
  </div>
</div><!-- /#tripplanner-wrap -->
</body>
</html>
