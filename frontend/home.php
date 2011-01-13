<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN"
  "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
  <meta http-equiv="X-UA-Compatible" content="IE=8" />
  <title>Homepage</title>

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
    <script type="text/javascript" src="js/jquery/jquery-ui-spinner.min.js"></script>
    <script type="text/javascript" src="js/openlayers/OpenLayers.js"></script>
    <script type="text/javascript" src="js/narrativeForm.js"></script>
    <script type="text/javascript" src="js/map.js"></script>	
	
    <!--THE BLOCK BELOW IS SPECIFIC TO THIS PAGE AND USE CASE-->
  	<script type="text/javascript">
        function init() {
            OTP.NarrativeForm(document.getElementById("plannerform"));
        }

        if(jQuery.browser.msie) {
          window.onload = init;
        } else {
          jQuery(document).ready(init);
        }
    </script>
</head>

<body class="home">

  <div id="plannerform">
    <div class="form-meta">
      <a id="clear" href="#">Clear</a> <a href="#">Help</a>
    </div>
    <h2>Plan your trip!</h2>
    <form id="trip-plan-form" action="tripplanner.php" method="post">
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
        <div id="accessible-area"><label><input name="accessible" type="checkbox" id="accessible" /> Accessible trip <img src="img/otp/wheelchair16x16.png" alt="Wheelchair icon" /></label></div>
      </div>
      <div class="ui-widget">
        <input id="trip-submit" type="submit" value="Plan Trip" />
        <a id="optionstoggle" href="#">More Options<span> </span></a>
      </div>
    </form>
  </div>
    
</body>
</html>
