<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN"
	"http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
	<title>Interactive System Map</title>

    <!--INCLUDE ALL OF THESE FILES IN A PRODUCTION DEPLOYMENT, IN THIS ORDER-->
	<link type="text/css" href="css/screen-reset.css" rel="stylesheet" media="screen, projection" />
	<link type="text/css" href="css/print-reset.css" rel="stylesheet" media="print" />
	<link type="text/css" href="css/jquery/ui-custom/jquery-ui-1.8.6.custom.css" rel="stylesheet" media="screen, projection" />
    <link type="text/css" href="css/jquery/ui.combobox.css" rel="stylesheet" media="screen, projection" />
	<link type="text/css" href="css/jquery/ui.spinner.css" rel="stylesheet" media="screen, projection" />
	<link type="text/css" href="css/jquery/ui.combobox.css" rel="stylesheet" media="screen, projection" />
	<link type="text/css" href="css/otp.css" rel="stylesheet" media="screen, projection" />
    <!--[if lt IE 8]><link rel="stylesheet" href="css/ie.css" type="text/css" media="screen, projection"><![endif]-->  

    <!--DO NOT INCLUDE THE FILE BELOW IN A PRODUCTION DEPLOYMENT - FOR DEMO ONLY-->
	<link type="text/css" href="css/demo.css" rel="stylesheet" media="screen, projection" />

    <!--INCLUDE ALL OF THESE FILES IN A PRODUCTION DEPLOYMENT, IN THIS ORDER-->
	<script type="text/javascript" src="js/jquery/jquery-1.4.2.min.js"></script>
	<script type="text/javascript" src="js/jquery/jquery-ui-1.8.6.custom.min.js"></script>
	<script type="text/javascript" src="js/jquery/jquery-combobox-support.min.js"></script>
	<script type="text/javascript" src="js/jquery/jquery-ui-spinner.min.js"></script>
	<script type="text/javascript" src="js/openlayers/OpenLayers.js"></script>
	<script type="text/javascript" src="js/narrativeForm.js"></script>
	<script type="text/javascript" src="js/narrative.js"></script>
	<script type="text/javascript" src="js/map.js"></script>		
	
    <!--THE BLOCK BELOW IS SPECIFIC TO THIS PAGE AND USE CASE-->
  	<script type="text/javascript">
      jQuery(document).ready(function() {
        OTP.Map(document.getElementById("map"), document.getElementById("map-controls"));
      });
    </script>
</head>

<body class="map">
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
                            <option value="Select transit agency">Select transit agency</option>
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
                        <input type="checkbox" id="sounder-tacoma-seattle"> 
                        Tacoma/Seattle route
                    </label>

                    <label>
                        <input type="checkbox" id="sounder-everett-seattle"> 
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
                        <input type="checkbox" id="link-central"> 
                        Central Link Light Rail
                        <span class="small">(Seatac Airport to Downtown Seattle)</span>
                    </label>
                    
                    <label>
                        <input type="checkbox" id="link-tacoma"> 
                        Everett/Seattle route
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
                        <option value="Select route">Select route</option>
                        <option value="TEST">Seattle - Bainbridge Island</option>
                        <option value="TEST2">Seattle - Bremerton</option>
                        <option value="TEST3">Seattle - Vashon - Southwort</option>
                        <option value="TEST4">Point Definance - Talequah</option>
                        <option value="TEST5">Edmonds - Kingston</option>
                        <option value="TEST6">Mukilteo - Clinton</option>
                    </select>
                </form>
            </div>
            
            <a id="toggle-fares" href="#">Fares</a>
            <a id="toggle-parking" href="#">Parking</a>
            <a id="toggle-location" href="#">Locations</a>
        </div>
    </div>
</div>
<div id="tripplanner-wrap" class="fullsize">
  <div id="map"></div>
</div><!-- /#tripplanner-wrap -->
</body>
</html>
