create view st_routes as 
	select distinct 
	designator,
	direction, 
	dayofweek, 
	routeid,
	type, 
	operator, 
	stops, 
	routetyp,
	the_geom,
 	st_routes_names.routedescription 
	from st_routes_shape left join st_routes_names on st_routes_shape.designator = st_routes_names.atisroute;

create view st_parkandrides as
	select 
	st_parkandrides_shape.name,
	st_parkandrides_shape.location,
	st_parkandrides_shape.the_geom,
	st_parkandrides_info.spaces,
	st_parkandrides_info.timefull,
	st_parkandrides_info.numbikeloc,
	st_parkandrides_info.bikerack,
	st_parkandrides_info.tvm,
	st_parkandrides_info.electricca,
	st_parkandrides_info.restrooms,
	st_parkandrides_info.hours,
	st_parkandrides_info.notes,
	st_parkandrides_info.commonname as altname,
	st_parkandrides_info.address as altlocation
	from st_parkandrides_shape left join st_parkandrides_info on st_parkandrides_shape.name = st_parkandrides_info.name;

create view st_fareoutlets as
	select name, location, outlettype, notes, the_geom from st_fareoutlets_shape;

create view st_stops as
	select distinct st_stops_shape.name, st_stops_shape.localid, st_stops_shape.atisid, st_stops_shape.accessible, st_stops_shape.the_geom, st_parkingnear_shape.park2min as parking_near 
	from st_stops_shape left join st_parkingnear_shape on st_stops_shape.name = st_parkingnear_shape.name;

