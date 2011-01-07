<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN"
  "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
  <title>Tripplanner</title>

    <!--INCLUDE ALL OF THESE FILES IN A PRODUCTION DEPLOYMENT, IN THIS ORDER-->
  <link type="text/css" href="css/screen-reset.css" rel="stylesheet" media="screen, projection" />
  <link type="text/css" href="css/print-reset.css" rel="stylesheet" media="print" />
  <link type="text/css" href="css/jquery/ui-custom/jquery-ui-1.8.6.custom.css" rel="stylesheet" media="screen, projection" />
  <link type="text/css" href="css/jquery/ui.selectmenu.css" rel="stylesheet" media="screen, projection" />
  <link type="text/css" href="css/jquery/ui.combobox.css" rel="stylesheet" media="screen, projection" />
  <link type="text/css" href="css/jquery/ui.spinner.css" rel="stylesheet" media="screen, projection" />
  <link type="text/css" href="css/jquery/ui.combobox.css" rel="stylesheet" media="screen, projection" />
  <link type="text/css" href="css/otp.css" rel="stylesheet" media="screen, projection" />
    <!--[if lt IE 8]><link rel="stylesheet" href="css/ie.css" type="text/css" media="screen, projection"><![endif]-->  

    <!--DO NOT INCLUDE THE FILE BELOW IN A PRODUCTION DEPLOYMENT - FOR DEMO ONLY-->
  <link type="text/css" href="css/demo.css" rel="stylesheet" media="screen, projection" />

    <!--INCLUDE ALL OF THESE FILES IN A PRODUCTION DEPLOYMENT, IN THIS ORDER-->
  <script type="text/javascript" src="js/jquery/jquery-1.4.2.min.js"></script>
  <script type="text/javascript" src="js/jquery/jquery-jsonp.min.js"></script>
  <script type="text/javascript" src="js/jquery/jquery-ui-1.8.6.custom.min.js"></script>
  <script type="text/javascript" src="js/jquery/jquery-ui-selectmenu.min.js"></script>
  <script type="text/javascript" src="js/jquery/jquery-combobox-support.min.js"></script>
  <script type="text/javascript" src="js/jquery/jquery-ui-spinner.min.js"></script>
  <script type="text/javascript" src="js/openlayers/OpenLayers.js"></script>
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
      <a id="clear" href="#">Clear</a> <a href="#">Help</a>
    </div>
    <h2>Plan your trip!</h2>
    <form id="trip-plan-form">
      <div id="tofrom-area">
        <div class="ui-widget">
          <label for="from"><img class="tripflag" src="img/otp/a-flag.png" alt="A" /> <strong>Start</strong> Address, intersection, or landmark</label>
          <input name="from" id="from" type="text" value="" />
        </div>
        <div class="ui-widget">
          <label for="to"><img class="tripflag" src="img/otp/b-flag.png" alt="B" /> <strong>End</strong> Address, intersection, or landmark</label>
          <input name="to" id="to" type="text" value="" />
        </div>
        <a id="tofromtoggle" href="#">toggle</a>
      </div>
      <div class="ui-widget">
        <span id="leavetype-wrap">
          <select id="leavetype" name="leavetype">
            <option value="Arrive By">Arrive By</option>
            <option value="Leave At">Leave At</option>
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
            <option value="QUICK">Fastest Trip</option>
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
        <div id="accessible-area"><label><input name="accessible" type="checkbox" id="accessible" /> Accessible trip <img src="img/otp/wheelchair16x16.png" alt="Wheelchair icon" /></label></div>
      </div>
      <div class="ui-widget">
        <input id="trip-submit" type="submit" value="Plan Trip &rarr;" />
        <a id="optionstoggle" href="#">More Options<span></span></a>
      </div>
    </form>
    <div id="trip-data">
      <div id="how-to-plan">
        <h3>2 Ways to Plan Your Trip</h3>
        <h4>1. Enter your start and end locations.</h4>
        <p>Enter your origin and destination above (don't use city or zip) then select "Plan Trip".</p>
        <h4>2. Pick points on the map.</h4>
        <p>Right-click on the map to set the Start and End locations, then select "Plan Trip".</p>
      </div>
    </div><!-- /#trip-data -->
  </div><!-- /#plannerpanel --> 
  <div id="map"></div>
</div><!-- /#tripplanner-wrap -->
</body>
</html>
