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

    <title>Schedules/Route Maps</title>

    <!--INCLUDE ALL OF THESE FILES IN A PRODUCTION DEPLOYMENT, IN THIS ORDER-->
    <link type="text/css" href="css/screen-reset.css" rel="stylesheet" media="screen, projection" />
    <link type="text/css" href="css/print-reset.css" rel="stylesheet" media="print" />
    
    <link type="text/css" href="css/tripplanner/otp-screen.css" rel="stylesheet" media="screen, projection, print" />
    <!--[if lt IE 8]><link rel="stylesheet" href="css/ie.css" type="text/css" media="screen, projection"><![endif]-->

    <!--DO NOT INCLUDE THE FILE BELOW IN A PRODUCTION DEPLOYMENT - FOR DEMO ONLY-->
    <link type="text/css" href="css/demo.css" rel="stylesheet" media="screen, projection" />
</head>

<body class="schedule">

    <!--THIS BLOCK IS FOR USER TESTING ONLY. REMOVE IN A PRODUCTION DEPLOYMENT-->
    <div class="demolinks">
        <a class="home" href="home.php">Home</a>
        <a class="map" href="map.php">Home</a>
        <a class="schedule" href="schedule.php">Home</a>
        <a class="tripplanner" href="tripplanner.php">Home</a>
    </div>
    <!--END-->

    <div>
      <h2>Direct links for Route Map demo pages:</h2>
      <ul class="scheduledemo">
        <li>
            <a href="./map.php?mode=SOUNDER&amp;route=MSOUNDER&amp;stops=7&amp;title=Sounder: Tacoma/Seattle">Sounder: Tacoma/Seattle route</a>
        </li>
        <li>
            <a href="./map.php?mode=SOUNDER&amp;route=MSOUNDER&amp;stops=4&amp;title=Sounder: Everett/Seattle">Sounder: Everett/Seattle route</a>
        </li>
        <li>
            <a href="./map.php?mode=LINK&amp;route=M599&amp;title=Central Link Light Rail">Central Link Light Rail</a>
        </li>
        <li>
            <a href="./map.php?mode=LINK&amp;route=PTLDTC&amp;title=Tacoma Link Light Rail">Tacoma Link Light Rail</a>
        </li>
        <li>
            <a href="./map.php?mode=BUS&amp;operator=ST&amp;route=510&amp;title=510">Bus Route 510</a>
        </li>
        <li>
            <a href="./map.php?mode=BUS&amp;operator=ST&amp;route=P590&amp;title=590">Bus Route 590</a>
        </li>
      </ul>
    </div>
</body>
</html>
