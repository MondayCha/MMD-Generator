import os
import xml.etree.ElementTree as ET
from xml.etree.ElementTree import Element, ElementTree


def read_route_data(folder_path):
    """
    Read the OSM file and return OSM XML.
    """
    for root, dirs, _ in os.walk(folder_path):
        dirs.sort()
        for id in dirs:
            arcs_path = os.path.join(root, id, '%s.arcs' % id)
            nodes_path = os.path.join(root, id, '%s.nodes' % id)
            route_path = os.path.join(root, id, '%s.route' % id)
            track_path = os.path.join(root, id, '%s.track' % id)
            if not (os.path.exists(arcs_path) and os.path.exists(nodes_path)
                    and os.path.exists(route_path) and os.path.exists(track_path)):
                continue
            node_dict = {}
            with open(nodes_path, 'r') as f:
                line_count = 0
                for line in f:
                    line = line.strip().split('\t')
                    lon, lat = line[0], line[1]
                    node_dict[line_count] = '%s %s' % (lon, lat)
                    line_count += 1
                f.close()
            arcs_dict = {}
            with open(arcs_path, 'r') as f:
                line_count = 0
                for line in f:
                    line = line.strip().split('\t')
                    start_node, end_node = line[0], line[1]
                    arcs_dict[line_count] = '%s %s' % (start_node, end_node)
                    line_count += 1
                f.close()
            # Read route.
            # format: 4359
            # output: 10.465693	51.626643
            # output_path: os.path.join(root, 'osm', '%s.out.txt' % id)
            with open(route_path, 'r') as f:
                with open(os.path.join(os.getcwd(), 'scripts', 'osm', '%s.out.txt' % id), 'w') as f_out:
                    initialized = False
                    for line in f:
                        line = line.strip()
                        arcs = arcs_dict[int(line)]
                        if not initialized:
                            f_out.write('%s\n' % node_dict[int(arcs.split(' ')[0])])
                            f_out.write('%s\n' % node_dict[int(arcs.split(' ')[1])])
                            initialized = True
                        else:
                            f_out.write('%s\n' % node_dict[int(arcs.split(' ')[1])])
                f.close()
                f_out.close()


if __name__ == '__main__':
    read_route_data('/home/monday/documents/map-matching-dataset/')
