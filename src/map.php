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

	<title>Interactive System Map</title>

    <!--INCLUDE ALL OF THESE FILES IN A PRODUCTION DEPLOYMENT, IN THIS ORDER-->
    <link type="text/css" href="css/screen-reset.css" rel="stylesheet" media="screen, projection" />
    <link type="text/css" href="css/print-reset.css" rel="stylesheet" media="print" />
    
    <link type="text/css" href="css/jquery/ui-custom/jquery-ui-1.8.6.custom.css" rel="stylesheet" media="screen, projection" />
    <link type="text/css" href="css/jquery/ui.selectmenu.css" rel="stylesheet" media="screen, projection" />
    
    <link type="text/css" href="css/tripplanner/otp-screen.css" rel="stylesheet" media="screen, projection, print" />
    <link type="text/css" href="css/tripplanner/otp-print.css" rel="stylesheet" media="print" />
    <!--[if lt IE 8]><link rel="stylesheet" href="css/ie.css" type="text/css" media="screen, projection"><![endif]-->

    <!--DO NOT INCLUDE THE FILE BELOW IN A PRODUCTION DEPLOYMENT - FOR DEMO ONLY-->
    <link type="text/css" href="css/demo.css" rel="stylesheet" media="screen, projection" />

    <!--INCLUDE ALL OF THESE FILES IN A PRODUCTION DEPLOYMENT, IN THIS ORDER-->
    <script type="text/javascript" src="js/jquery/jquery-1.4.2.min.js"></script>
    <script type="text/javascript" src="js/jquery/jquery-jsonp.min.js"></script>
    <script type="text/javascript" src="js/jquery/jquery-ui-1.8.6.custom.min.js"></script>
    <script type="text/javascript" src="js/jquery/jquery-ui-selectmenu.min.js"></script>
    <script type="text/javascript" src="js/openlayers/OpenLayers.js"></script>
    
    <script type="text/javascript" src="js/config.js"></script>
    <script type="text/javascript" src="js/util.js"></script>
    <script type="text/javascript" src="js/agency.js"></script>
    <script type="text/javascript" src="js/map.js"></script>
	<script type="text/javascript" src="js/systemMap.js"></script>
    
    <!--THE BLOCK BELOW IS SPECIFIC TO THIS PAGE AND USE CASE-->
  	<script type="text/javascript">
        function init() {
            var systemMap = OTP.SystemMap(document.getElementById("map"), 
                                          document.getElementById("map-controls"));
            
            // SET PROPERTIES PASSED TO US FROM THE HOMEPAGE OR ANOTHER FORM
            <?php
                echo "systemMap.showRouteWithCriteria('" . $_REQUEST['route'] . "', '" . $_REQUEST['mode'] . "', '" . $_REQUEST['operator'] . "', '" . $_REQUEST['stops'] . "', '" . $_REQUEST['title'] . "');\n";
                echo "systemMap.showScheduleLinkInRouteMarker(false);\n";
                echo "systemMap.setModeChooserUIVisibility(false);\n";

                if($_REQUEST['route'] != "" && $_REQUEST['mode'] != "") {
                    echo "systemMap.setPrintable(true);\n";
                }
            ?>        
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

<body class="map">

    <!--THIS BLOCK IS FOR USER TESTING ONLY. REMOVE IN A PRODUCTION DEPLOYMENT-->
    <div class="demolinks">
        <a class="home" href="home.php">Home</a>
        <a class="map" href="map.php">Home</a>
        <a class="schedule" href="schedule.php">Home</a>
        <a class="tripplanner" href="tripplanner.php">Home</a>
    </div>
    <!--END-->

<div id="map-controls" class="fullsize">
    <div id="map-controls-wrap">
        <div id="base-layers">
            <strong>View:</strong> <a id="base-road" class="active" href="#">Road</a> | <a id="base-aerial" href="#">Aerial</a>
        </div>
        <div id="toggle-layers">
            <strong>Show on map:</strong> 
            <a id="toggle-bus" href="#">Bus</a>
            <a id="toggle-sounder" href="#">Sounder</a>
            <a id="toggle-link" href="#">Link</a>
            <a id="toggle-ferry" href="#">Ferry</a>
            <div id="bus-layer-chooser" class="layer-chooser bus">
                <div class="header">
                    <p>Show <strong>Bus Routes</strong> on map</p>
                    <a href="#" class="close">Close</a>
                </div>
                <form>
                    <label>
                        Agency
                        <select id="bus-agency">
                            <option value="">Select transit agency</option>
                            <option value="ST">Sound Transit</option>
                            <option value="MT">King County Metro</option>
                            <option value="CT">Community Transit</option>
                            <option value="PT">Pierce Transit</option>
                            <option value="ET">Everett Transit</option>
                        </select>
                    </label>
                    <label>
                        Route
                        <select id="bus-route">
                            <option value="">Select route</option>
                        </select>
                    </label>
                </form>
            </div>
            <div id="sounder-layer-chooser" class="layer-chooser sounder">
                <div class="header">
                    <p>Show <strong>Sounder Train</strong> on map</p>
                    <a href="#" class="close">Close</a>
                </div>
                <form>
                    <label>
                        <input type="checkbox" id="sounder-tacoma-seattle" value="MSOUNDER/7"> 
                        Tacoma/Seattle route
                    </label>
                    <label>
                        <input type="checkbox" id="sounder-everett-seattle" value="MSOUNDER/4"> 
                        Everett/Seattle route
                    </label>
                </form>
            </div>
            <div id="link-layer-chooser" class="layer-chooser link">
                <div class="header">
                    <p>Show <strong>Link Light Rail</strong> on map</p>
                    <a href="#" class="close">Close</a>                    
                </div>
                <form>                    
                    <label>
                        <input type="checkbox" id="link-central" value="M599"> 
                        Central Link Light Rail
                        <span class="small">(Seatac Airport to Downtown Seattle)</span>
                    </label>
                    <label>
                        <input type="checkbox" id="link-tacoma" value="PTLDTC"> 
                        Tacoma Link Light Rail
                        <span class="small">(Downtown Tacoma)</span>
                    </label>
                </form>
            </div>
            <div id="ferry-layer-chooser" class="layer-chooser WSF">
                <div class="header">
                    <p>Show <strong>Washington State Ferries</strong> on map</p>
                    <a href="#" class="close">Close</a>
                </div>
                <form>
                    <select id="ferry">
                        <option selected="true" value="">Select route</option>
                        <option value="MWSF-5I">Seattle - Bainbridge Island</option>
                        <option value="MWSF-3I">Seattle - Bremerton</option>
                        <option value="MWSF-13I">Fauntleroy-Southworth</option>
                        <option value="MWSF-1I">Point Definance - Talequah</option>
                        <option value="MWSF-6I">Edmonds - Kingston</option>
                        <option value="MWSF-7I">Mukilteo - Clinton</option>
                        <option value="MWSF-14I">Fauntleroy - Vashon</option>
                        <option value="MWSF-15I">Vashon - Southworth</option>
                    </select>
                </form>
            </div>
            <a id="toggle-fares" href="#">Fares</a>
            <a id="toggle-parking" href="#">Parking</a>
            <a id="toggle-location" href="#">Locations</a>
        </div>
        <div id="print-controls">
            <a id="print" href="#">Print</a>
        </div>
    </div>
</div>
<div id="tripplanner-wrap" class="fullsize">
  <div id="map">
      <div id="loading"><p>Loading...</p></div>
      <div id="atis-credits">ATIS: Powered by Trapeze</div>
      <div id="legend">
          <div class="toggler">Legend<span class="ui-selectmenu-icon ui-icon ui-icon-triangle-1-s"> </span></div>
          <div class="content"><img src="images/tripplanner/route_legend.png" alt="Routes Legend"/></div>
      </div>
  </div>
</div><!-- /#tripplanner-wrap -->
<div id="print-warning">
    <p>
    To print the contents of this page, choose the print icon (<img src="images/tripplanner/print.png" alt="Print Icon"/>).
    </p>
</div>
</body>
</html>
