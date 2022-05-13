import os
import xml.etree.ElementTree as ET
from xml.etree.ElementTree import Element, ElementTree


def read_gis_data(folder_path):
    """
    Read the OSM file and return OSM XML.
    """
    for root, dirs, _ in os.walk(folder_path):
        dirs.sort()
        for id in dirs:
            if int(id) > 0:
                continue
            arcs_path = os.path.join(root, id, '%s.arcs' % id)
            nodes_path = os.path.join(root, id, '%s.nodes' % id)
            route_path = os.path.join(root, id, '%s.route' % id)
            track_path = os.path.join(root, id, '%s.track' % id)
            if not (os.path.exists(arcs_path) and os.path.exists(nodes_path)
                    and os.path.exists(route_path) and os.path.exists(track_path)):
                continue
            xml_root = Element('osm', version='0.6', generator='buaa_mdc')
            xml_tree = ElementTree(xml_root)
            # Read nodes.
            # format: 54.335879	56.117280
            minlat, minlon, maxlat, maxlon = None, None, None, None
            node_dict = {}
            with open(nodes_path, 'r') as f:
                line_count = 0
                for line in f:
                    line = line.strip().split('\t')
                    lon, lat = line[0], line[1]
                    lon_float, lat_float = float(lon), float(lat)
                    if minlon is None or minlon > lon_float:
                        minlon = lon_float
                    if maxlon is None or maxlon < lon_float:
                        maxlon = lon_float
                    if minlat is None or minlat > lat_float:
                        minlat = lat_float
                    if maxlat is None or maxlat < lat_float:
                        maxlat = lat_float
                    node = Element('node', id=str(line_count), lat=lat, lon=lon, version='0',
                                   timestamp='2000-01-01T00:00:00Z', changeset='1', uid='1', user='buaa_mdc')
                    node_dict[line_count] = '%s %s' % (lon, lat)
                    xml_root.append(node)
                    line_count += 1
                f.close()
            bounds = Element('bounds', minlat=str(minlat), minlon=str(
                minlon), maxlat=str(maxlat), maxlon=str(maxlon))
            xml_root.insert(0, bounds)
            # Read arcs.
            # format: 0	2433
            with open(arcs_path, 'r') as f:
                line_count = 0
                for line in f:
                    line = line.strip().split('\t')
                    start_node, end_node = line[0], line[1]
                    arc = Element('way', id=str(line_count), version='0',
                                  timestamp='2000-01-01T00:00:00Z', changeset='1', uid='1', user='buaa_mdc')
                    node1 = Element('nd', ref=str(start_node))
                    node2 = Element('nd', ref=str(end_node))
                    tag1 = Element('tag', k='highway', v='tertiary')
                    tag2 = Element('tag', k='name', v='%s' % line_count)
                    tag3 = Element('tag', k='oneway', v='yes')
                    arc.append(node1)
                    arc.append(node2)
                    arc.append(tag1)
                    arc.append(tag2)
                    arc.append(tag3)
                    xml_root.append(arc)
                    line_count += 1
                f.close()
            xml_tree.write(os.path.join(root, 'osm', '%s.osm' % id),
                           encoding='utf-8', xml_declaration=True)
            # Read track.
            # format: 10.465693	51.626643	4.000000
            # output: 10.465693,51.626643,4.000000
            # output_path: os.path.join(root, 'osm', '%s.txt' % id)
            with open(track_path, 'r') as f:
                with open(os.path.join(root, 'osm', '%s.txt' % id), 'w') as f_out:
                    for line in f:
                        line = line.strip().split('\t')
                        lon, lat, timestamp = line[0], line[1], int(float(
                            line[2]).__floor__() + 1600000000)
                        f_out.write('%s,%s,%s\n' % (lon, lat, timestamp))
                f.close()
                f_out.close()
            # Read route.
            # format: 4359
            # output: 10.465693	51.626643
            # output_path: os.path.join(root, 'osm', '%s.out.txt' % id)
            # with open(route_path, 'r') as f:
            #     with open(os.path.join(root, 'osm', '%s.out.txt' % id), 'w') as f_out:
            #         for line in f:
            #             line = line.strip()
            #             f_out.write('%s\n' % node_dict[int(line)])
            #     f.close()
            #     f_out.close()


if __name__ == '__main__':
    read_gis_data(os.getcwd())
