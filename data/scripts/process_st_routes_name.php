#!/usr/bin/php5 -q
<?
	$file = fopen("st_routes_name/All_Routes.csv", "r");

	$header = null;
	$maxlengths = array();

	echo "set client_encoding to utf8;";

	$l = 0;
	while(!feof($file)) {
		$vals = fgetcsv($file);
		$l++;

		if($vals == "")
			continue;

		foreach($vals as $k=>$v) {
			if(@$maxlengths[$k] < strlen($v) || ! @isset($maxlengths[$k])) {
				$maxlengths[$k] = strlen($v);
			}

			$vals[$k] = trim($v);
			$vals[$k] = iconv("Mac", "UTF-8", $v);
		}

		if($l == 1) {
			foreach($vals as $k=>$v) {
				$vals[$k] = strtolower($v);
			}
			$header = $vals;
			continue;
		}

		echo "INSERT INTO st_routes_names(";
		echo join(",", $header);
		echo ") VALUES (";

		$i = 0;
		foreach($header as $colname) {
			$v = @$vals[$i];

			if(! isset($vals[$i]) || strlen($v) == 0)
				echo "null";
			else if(is_numeric($v))
				echo $v;
			else
				echo "'" . pg_escape_string(str_replace("_", " ", $v)) . "'";

			if($i < count($header) - 1) 
				echo ",";

			$i++;
		}

		echo ");\n";
	}

	fclose($file);
