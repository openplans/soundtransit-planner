#!/usr/bin/php5 -q
<?
	$file = fopen("st_parkandrides_info/PR_INFO.csv", "r");

	$header = null;
	$maxlengths = array();

	echo "set client_encoding to win;";

	$l = 0;
	while(!feof($file)) {
		$vals = fgetcsv($file);
		$l++;

		foreach($vals as $k=>$v) {
			if(@$maxlengths[$k] < strlen($v) || ! @isset($maxlengths[$k])) {
				$maxlengths[$k] = strlen($v);
			}

			$vals[$k] = trim($v);
		}

		if($l == 1) {
			foreach($vals as $k=>$v) {
				$vals[$k] = strtolower($v);
			}
			$header = $vals;
			continue;
		}

		echo "INSERT INTO st_parkandrides_info(";
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
				echo "'" . pg_escape_string($v) . "'";

			if($i < count($header) - 1) 
				echo ",";

			$i++;
		}

		echo ");\n";
	}

	fclose($file);
