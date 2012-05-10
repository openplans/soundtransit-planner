-- remove non-public routes
delete from st_routes_shape where designator like 'M661';

-- simplify polyline features
update st_routes_shape set the_geom = simplify(the_geom, .0001);

vacuum full analyze;
