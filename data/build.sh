#!/bin/sh

mkdir tmp

touch tmp/master.sql

cat static/clean.sql >> tmp/master.sql

# generate shapefile SQL
for d in `find ./ -name "*.shp" | cut -d "/" -f 2`
do
	shp2pgsql -W windows-1252 -s 4326 $d/*.shp $d >> tmp/master.sql
done

# generate info SQL
for d in `find ./ -name "*.csv" | cut -f 2 -d "/"`
do
	cat "static/"$d"_schema.sql" >> tmp/master.sql
	"scripts/process_"$d".php" >> tmp/master.sql
done

cat static/views.sql >> tmp/master.sql
cat static/post_load.sql >> tmp/master.sql

mv tmp/master.sql ./

rm -rf tmp
