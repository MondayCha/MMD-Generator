def get_bounds(coordinates):
    min_lat = min_lon = max_lat = max_lon = None
    for coordinate in coordinates:
        if min_lat is None or coordinate.latitude < min_lat:
            min_lat = coordinate.latitude
        if min_lon is None or coordinate.longitude < min_lon:
            min_lon = coordinate.longitude
        if max_lat is None or coordinate.latitude > max_lat:
            max_lat = coordinate.latitude
        if max_lon is None or coordinate.longitude > max_lon:
            max_lon = coordinate.longitude
    return [[float(min_lon), float(min_lat)], [float(max_lon), float(max_lat)]]