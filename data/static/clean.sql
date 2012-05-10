set client_encoding to win;

drop view if exists st_fareoutlets;
drop view if exists st_parkandrides;
drop view if exists st_stops;
drop view if exists st_stops_routes;
drop view if exists st_routes;

drop table if exists st_fareoutlets_shape;
drop table if exists st_parkandrides_info;
drop table if exists st_parkandrides_shape;
drop table if exists st_parkingnear_shape;
drop table if exists st_routes_names;
drop table if exists st_routes_shape;
drop table if exists st_routes_stops;
drop table if exists st_stops_shape;

delete from geometry_columns;

